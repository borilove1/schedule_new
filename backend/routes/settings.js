const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { testConnection, sendEmail, invalidateTransporterCache } = require('../src/utils/emailService');
const { rescheduleAllReminders } = require('../src/utils/reminderQueueService');

const router = express.Router();

// ADMIN만 접근 가능
router.use(authenticate);
router.use(authorize('ADMIN'));

// ========== 설정 조회 ==========
router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT key, value FROM system_settings ORDER BY key');
    
    // 객체 형태로 변환 (JSONB는 pg 드라이버가 자동 파싱)
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
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

    // SMTP 관련 설정이 변경되면 transporter 캐시 무효화
    const hasSmtpChanges = Object.keys(updates).some(k => k.startsWith('smtp_') || k === 'email_enabled');
    if (hasSmtpChanges) {
      invalidateTransporterCache();
    }

    // reminder_times 또는 due_soon_threshold 변경 시 모든 리마인더 재스케줄링
    const needsReschedule = ['reminder_times', 'due_soon_threshold'].some(k => Object.keys(updates).includes(k));
    if (needsReschedule) {
      try {
        await rescheduleAllReminders();
        console.log('[Settings] Reminder/due-soon times changed, rescheduled all reminders');
      } catch (err) {
        console.error('[Settings] Failed to reschedule reminders:', err.message);
      }
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
        value: result.rows[0].value,
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
        value: result.rows[0].value,
        updatedAt: result.rows[0].updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 테스트 이메일 발송 ==========
router.post('/test-email', async (req, res, next) => {
  try {
    // SMTP 연결 테스트
    const connectionResult = await testConnection();
    if (!connectionResult.success) {
      return res.json({
        success: false,
        error: { message: connectionResult.message }
      });
    }

    // 관리자 본인 이메일로 테스트 발송
    const userResult = await query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const adminEmail = userResult.rows[0].email;

    const emailResult = await sendEmail(
      adminEmail,
      '이메일 설정 테스트',
      '이메일 알림 설정이 올바르게 구성되었습니다. 이 메일이 정상적으로 수신되었다면 SMTP 설정이 완료된 것입니다.'
    );

    if (emailResult.success) {
      res.json({
        success: true,
        data: { message: `테스트 이메일이 ${adminEmail}으로 발송되었습니다.` }
      });
    } else {
      res.json({
        success: false,
        error: { message: `이메일 발송 실패: ${emailResult.error}` }
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
