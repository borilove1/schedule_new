// routes/events.js - 반복 일정 지원 버전
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const eventController = require('../src/controllers/eventController');

const router = express.Router();
router.use(authenticate);

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

// ========== 일정 상세 조회 ==========
router.get('/:id', eventController.getEventById);

// ========== 일정 생성 (일반 또는 반복) ==========
router.post('/', createEventValidation, handleValidation, eventController.createEvent);

// ========== 일정 수정 (반복 일정 처리) ==========
router.put('/:id', updateEventValidation, handleValidation, eventController.updateEvent);

// ========== 일정 삭제 (반복 일정 처리) ==========
router.delete('/:id', eventController.deleteEvent);

// ========== 일정 완료 처리 ==========
router.post('/:id/complete', eventController.completeEvent);

// ========== 일정 완료 취소 ==========
router.post('/:id/uncomplete', eventController.uncompleteEvent);

module.exports = router;
