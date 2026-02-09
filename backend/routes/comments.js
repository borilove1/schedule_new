const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, canViewEvent, canEditEvent } = require('../middleware/auth');
const { notifyByScope } = require('../src/controllers/notificationController');
const { broadcast } = require('../src/utils/sseManager');

const router = express.Router();

// 댓글 내용 검증 미들웨어
const validateComment = [
  body('content')
    .trim()
    .notEmpty().withMessage('댓글 내용을 입력해주세요.')
    .isLength({ max: 2000 }).withMessage('댓글은 2000자 이내로 입력해주세요.')
];

router.use(authenticate);

// ========== 댓글 조회 (일정) ==========
router.get('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const result = await query(`
      SELECT id, content, event_id, series_id,
             author_name, author_id, is_edited, created_at, updated_at
      FROM v_comments_with_details
      WHERE event_id = $1
      ORDER BY created_at ASC
    `, [eventId]);

    res.json({
      success: true,
      data: { comments: result.rows }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 댓글 조회 (반복 일정 시리즈) ==========
router.get('/series/:seriesId', async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const { occurrenceDate } = req.query;

    let result;
    if (occurrenceDate) {
      // 특정 회차 날짜의 댓글만 조회
      result = await query(`
        SELECT id, content, event_id, series_id, occurrence_date,
               author_name, author_id, is_edited, created_at, updated_at
        FROM v_comments_with_details
        WHERE series_id = $1 AND occurrence_date = $2
        ORDER BY created_at ASC
      `, [seriesId, occurrenceDate]);
    } else {
      // 전체 시리즈 댓글 조회 (하위호환)
      result = await query(`
        SELECT id, content, event_id, series_id, occurrence_date,
               author_name, author_id, is_edited, created_at, updated_at
        FROM v_comments_with_details
        WHERE series_id = $1
        ORDER BY created_at ASC
      `, [seriesId]);
    }

    res.json({
      success: true,
      data: { comments: result.rows }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 댓글 추가 (일정) ==========
router.post('/events/:eventId', validateComment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg }
      });
    }

    const { eventId } = req.params;
    const { content } = req.body;

    // 일정 존재 확인 + 공유 처/실 정보 조회
    const eventResult = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_001', message: '일정을 찾을 수 없습니다.' }
      });
    }

    // 공유 처/실 조회
    const sharedResult = await query(
      'SELECT office_id FROM event_shared_offices WHERE event_id = $1',
      [eventId]
    );
    const sharedOfficeIds = sharedResult.rows.map(r => r.office_id);

    // 일정 조회 권한 확인 (DB row는 snake_case이므로 camelCase로 변환)
    const eventRow = eventResult.rows[0];
    const eventForAuth = {
      ...eventRow,
      departmentId: eventRow.department_id,
      officeId: eventRow.office_id,
      divisionId: eventRow.division_id,
      creatorId: eventRow.creator_id,
      sharedOfficeIds,
    };
    if (!canViewEvent(req.user, eventForAuth)) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_005', message: '권한이 없습니다.' }
      });
    }

    // 댓글 추가
    const result = await query(`
      INSERT INTO comments (content, event_id, author_id)
      VALUES ($1, $2, $3)
      RETURNING id, content, is_edited, created_at
    `, [content, eventId, req.user.id]);

    // 일정 작성자에게 알림 (notifyByScope가 actorId 필터로 자기 댓글 제외)
    const event = eventResult.rows[0];
    try {
      await notifyByScope('EVENT_COMMENTED', '새 댓글', `"${event.title}" 일정에 ${req.user.name}님이 댓글을 남겼습니다.`, {
        actorId: req.user.id,
        creatorId: event.creator_id,
        departmentId: event.department_id,
        officeId: event.office_id,
        divisionId: event.division_id,
        relatedEventId: parseInt(eventId),
        metadata: { commentAuthor: req.user.name, commentContent: content.substring(0, 100) },
      });
    } catch (notifError) {
      console.error('Comment notification error:', notifError);
    }

    broadcast('event_changed', { action: 'comment_updated' });

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        author: {
          id: req.user.id,
          name: req.user.name
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 댓글 추가 (반복 일정 시리즈) ==========
router.post('/series/:seriesId', validateComment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg }
      });
    }

    const { seriesId } = req.params;
    const { content, occurrenceDate } = req.body;

    // 시리즈 존재 확인 + 공유 처/실 정보 조회
    const seriesResult = await query('SELECT * FROM event_series WHERE id = $1', [seriesId]);
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_001', message: '반복 일정을 찾을 수 없습니다.' }
      });
    }

    // 공유 처/실 조회
    const sharedResult = await query(
      'SELECT office_id FROM event_shared_offices WHERE series_id = $1',
      [seriesId]
    );
    const sharedOfficeIds = sharedResult.rows.map(r => r.office_id);

    // 권한 확인 (DB row는 snake_case이므로 camelCase로 변환)
    const seriesRow = seriesResult.rows[0];
    const seriesForAuth = {
      ...seriesRow,
      departmentId: seriesRow.department_id,
      officeId: seriesRow.office_id,
      divisionId: seriesRow.division_id,
      creatorId: seriesRow.creator_id,
      sharedOfficeIds,
    };
    if (!canViewEvent(req.user, seriesForAuth)) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_005', message: '권한이 없습니다.' }
      });
    }

    // 댓글 추가 (회차별 날짜 저장)
    const result = await query(`
      INSERT INTO comments (content, series_id, author_id, occurrence_date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, is_edited, created_at, occurrence_date
    `, [content, seriesId, req.user.id, occurrenceDate || null]);

    // 시리즈 작성자에게 알림 (notifyByScope가 actorId 필터로 자기 댓글 제외)
    const series = seriesResult.rows[0];
    try {
      await notifyByScope('EVENT_COMMENTED', '새 댓글', `"${series.title}" 일정에 ${req.user.name}님이 댓글을 남겼습니다.`, {
        actorId: req.user.id,
        creatorId: series.creator_id,
        departmentId: series.department_id,
        officeId: series.office_id,
        divisionId: series.division_id,
        metadata: { seriesId: parseInt(seriesId), commentAuthor: req.user.name, commentContent: content.substring(0, 100) },
      });
    } catch (notifError) {
      console.error('Comment notification error:', notifError);
    }

    broadcast('event_changed', { action: 'comment_updated' });

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        seriesId,
        author: {
          id: req.user.id,
          name: req.user.name
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 댓글 수정 ==========
router.put('/:id', validateComment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg }
      });
    }

    const { id } = req.params;
    const { content } = req.body;

    // 댓글 조회
    const commentResult = await query(`
      SELECT * FROM comments WHERE id = $1
    `, [id]);

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMMENT_001', message: '댓글을 찾을 수 없습니다.' }
      });
    }

    const comment = commentResult.rows[0];

    // 본인 댓글만 수정 가능
    if (comment.author_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'COMMENT_002', message: '댓글을 수정할 권한이 없습니다.' }
      });
    }

    // 댓글 수정
    const result = await query(`
      UPDATE comments
      SET content = $1, is_edited = true
      WHERE id = $2
      RETURNING id, content, is_edited, updated_at
    `, [content, id]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// ========== 댓글 삭제 ==========
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 댓글 조회
    const commentResult = await query('SELECT * FROM comments WHERE id = $1', [id]);

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMMENT_001', message: '댓글을 찾을 수 없습니다.' }
      });
    }

    const comment = commentResult.rows[0];

    // 본인 댓글만 삭제 가능 (또는 ADMIN)
    if (comment.author_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'COMMENT_003', message: '댓글을 삭제할 권한이 없습니다.' }
      });
    }

    // 댓글 삭제
    await query('DELETE FROM comments WHERE id = $1', [id]);

    broadcast('event_changed', { action: 'comment_updated' });

    res.json({
      success: true,
      data: { message: '댓글이 삭제되었습니다.' }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
