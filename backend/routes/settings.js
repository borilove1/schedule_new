const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ADMIN만 접근 가능
router.use(authenticate);
router.use(authorize('ADMIN'));

// ========== 설정 조회 ==========
router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT key, value FROM system_settings ORDER BY key');
    
    // 객체 형태로 변환
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = JSON.parse(row.value);
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// ========== 설정 수정 ==========
router.put('/', async (req, res, next) => {
  try {
    const updates = req.body;
    const updatedSettings = {};

    // 각 설정값 업데이트
    for (const [key, value] of Object.entries(updates)) {
      await query(`
        UPDATE system_settings
        SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE key = $3
      `, [JSON.stringify(value), req.user.id, key]);

      updatedSettings[key] = value;
    }

    res.json({
      success: true,
      data: {
        ...updatedSettings,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 개별 설정 조회 ==========
router.get('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;

    const result = await query('SELECT key, value, description FROM system_settings WHERE key = $1', [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SYS_001', message: '시스템 설정을 찾을 수 없습니다.' }
      });
    }

    res.json({
      success: true,
      data: {
        key: result.rows[0].key,
        value: JSON.parse(result.rows[0].value),
        description: result.rows[0].description
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 개별 설정 수정 ==========
router.put('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const result = await query(`
      UPDATE system_settings
      SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3
      RETURNING key, value, updated_at
    `, [JSON.stringify(value), req.user.id, key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SYS_001', message: '시스템 설정을 찾을 수 없습니다.' }
      });
    }

    res.json({
      success: true,
      data: {
        key: result.rows[0].key,
        value: JSON.parse(result.rows[0].value),
        updatedAt: result.rows[0].updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
