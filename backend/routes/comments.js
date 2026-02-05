const express = require('express');
const { query } = require('../config/database');
const { authenticate, canViewEvent, canEditEvent } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// ========== 댓글 추가 (일정) ==========
router.post('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { content } = req.body;

    // 일정 존재 확인
    const eventResult = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_001', message: '일정을 찾을 수 없습니다.' }
      });
    }

    // 일정 조회 권한 확인
    if (!canViewEvent(req.user, eventResult.rows[0])) {
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
router.post('/series/:seriesId', async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const { content } = req.body;

    // 시리즈 존재 확인
    const seriesResult = await query('SELECT * FROM event_series WHERE id = $1', [seriesId]);
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_001', message: '반복 일정을 찾을 수 없습니다.' }
      });
    }

    // 권한 확인
    if (!canViewEvent(req.user, seriesResult.rows[0])) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_005', message: '권한이 없습니다.' }
      });
    }

    // 댓글 추가
    const result = await query(`
      INSERT INTO comments (content, series_id, author_id)
      VALUES ($1, $2, $3)
      RETURNING id, content, is_edited, created_at
    `, [content, seriesId, req.user.id]);

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
router.put('/:id', async (req, res, next) => {
  try {
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

    res.json({
      success: true,
      data: { message: '댓글이 삭제되었습니다.' }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
