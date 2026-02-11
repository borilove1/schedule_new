// routes/events.js - 반복 일정 지원 버전
const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const eventController = require('../src/controllers/eventController');

const router = express.Router();

// 첨부파일 다운로드: 쿼리 파라미터 토큰 → Authorization 헤더 변환 (authenticate 전에 실행)
router.use('/attachments/:attachmentId/download', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(authenticate);

// ========== Multer 파일 업로드 설정 ==========
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'text/csv',
  'application/zip',
  'application/x-hwp', 'application/haansofthwp', 'application/x-hwpml',
];

// 허용 확장자 (MIME 위조 방지를 위해 확장자도 함께 검증)
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.txt', '.csv', '.zip', '.hwp',
]);

// 위험한 확장자 차단 (이중 확장자 공격 방지: report.pdf.exe 등)
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
  '.sh', '.bash', '.csh', '.ksh',
  '.app', '.action', '.command', '.workflow',
  '.reg', '.inf', '.hta', '.cpl', '.msc',
  '.dll', '.sys', '.drv',
  '.docm', '.xlsm', '.pptm',  // 매크로 포함 Office 파일
  '.jar', '.py', '.rb', '.php', '.asp', '.aspx', '.jsp',
  '.html', '.htm', '.xhtml', '.svg',  // XSS 가능
]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    // 1) MIME 타입 검증
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('허용되지 않는 파일 형식입니다.'));
    }
    // 2) 확장자 검증 (소문자 변환)
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('허용되지 않는 파일 확장자입니다.'));
    }
    // 3) 이중 확장자 공격 방지 (report.pdf.exe)
    const nameParts = file.originalname.toLowerCase().split('.');
    if (nameParts.length > 2) {
      for (let i = 1; i < nameParts.length; i++) {
        if (DANGEROUS_EXTENSIONS.has('.' + nameParts[i])) {
          return cb(new Error('위험한 파일 형식이 포함되어 있습니다.'));
        }
      }
    }
    cb(null, true);
  }
});

// Multer 에러 핸들링 미들웨어
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 20MB 이하여야 합니다.' }
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: { code: 'TOO_MANY_FILES', message: '최대 5개까지 업로드할 수 있습니다.' }
      });
    }
    return res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: '파일 업로드 중 오류가 발생했습니다.' }
    });
  }
  if (err && err.message === '허용되지 않는 파일 형식입니다.') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE_TYPE', message: err.message }
    });
  }
  next(err);
};

// 검증 결과 처리 미들웨어
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값이 올바르지 않습니다.',
        details: errors.array()
      }
    });
  }
  next();
};

// 일정 생성 검증 규칙
const createEventValidation = [
  body('title').notEmpty().withMessage('제목을 입력하세요'),
  body().custom((value) => {
    if (!value.startAt && !value.start_at) {
      throw new Error('시작 시간을 입력하세요');
    }
    return true;
  }),
  body().custom((value) => {
    if (!value.endAt && !value.end_at) {
      throw new Error('종료 시간을 입력하세요');
    }
    return true;
  }),
];

// 일정 수정 검증 규칙
const updateEventValidation = [
  body('title').optional().notEmpty().withMessage('제목은 빈 값일 수 없습니다'),
];

// ========== 일정 목록 조회 (반복 일정 자동 확장) ==========
router.get('/', eventController.getEvents);

// ========== 일정 검색 ==========
router.get('/search', eventController.searchEvents);

// ========== 첨부파일 다운로드 ==========
router.get('/attachments/:attachmentId/download', eventController.downloadAttachment);

// ========== 첨부파일 삭제 ==========
router.delete('/attachments/:attachmentId', eventController.deleteAttachment);

// ========== 일정 상세 조회 ==========
router.get('/:id', eventController.getEventById);

// ========== 일정 생성 (일반 또는 반복) ==========
router.post('/', createEventValidation, handleValidation, eventController.createEvent);

// ========== 첨부파일 업로드 ==========
router.post('/:id/attachments', upload.array('files', 5), handleMulterError, eventController.uploadAttachment);

// ========== 일정 수정 (반복 일정 처리) ==========
router.put('/:id', updateEventValidation, handleValidation, eventController.updateEvent);

// ========== 일정 삭제 (반복 일정 처리) ==========
router.delete('/:id', eventController.deleteEvent);

// ========== 일정 완료 처리 ==========
router.post('/:id/complete', eventController.completeEvent);

// ========== 일정 완료 취소 ==========
router.post('/:id/uncomplete', eventController.uncompleteEvent);

module.exports = router;
