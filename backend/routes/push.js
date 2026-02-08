const express = require('express');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { getVapidPublicKey } = require('../src/utils/pushService');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ success: false, message: '푸시 알림이 설정되지 않았습니다.' });
  }
  res.json({ success: true, data: { vapidPublicKey: key } });
});

// POST /api/v1/push/subscribe
router.post('/subscribe', [
  body('endpoint').isURL({ require_protocol: true }).withMessage('유효한 endpoint URL이 필요합니다.'),
  body('keys.p256dh').isString().notEmpty().withMessage('p256dh 키가 필요합니다.'),
  body('keys.auth').isString().notEmpty().withMessage('auth 키가 필요합니다.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
  }

  try {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;
    const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

    const result = await query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = $1, p256dh = $3, auth = $4, user_agent = $5, updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [userId, endpoint, keys.p256dh, keys.auth, userAgent]);

    res.json({ success: true, data: { subscriptionId: result.rows[0].id } });
  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    res.status(500).json({ success: false, message: '푸시 구독 저장에 실패했습니다.' });
  }
});

// DELETE /api/v1/push/unsubscribe
router.delete('/unsubscribe', [
  body('endpoint').isURL({ require_protocol: true }).withMessage('유효한 endpoint URL이 필요합니다.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
  }

  try {
    const { endpoint } = req.body;
    const userId = req.user.id;

    await query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, userId]
    );

    res.json({ success: true, message: '푸시 구독이 해제되었습니다.' });
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    res.status(500).json({ success: false, message: '푸시 구독 해제에 실패했습니다.' });
  }
});

module.exports = router;
