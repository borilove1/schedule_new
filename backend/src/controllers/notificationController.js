const { query } = require('../../config/database');
const { sendEmail } = require('../utils/emailService');
const { sendPushToUser } = require('../utils/pushService');

/**
 * Convert snake_case to camelCase for frontend
 */
const convertToCamelCase = (obj) => {
  const camelCaseObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    camelCaseObj[camelKey] = obj[key];
  }
  return camelCaseObj;
};

/**
 * Get notifications for current user
 * GET /api/v1/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 50, isRead } = req.query;
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = $1';
    const params = [userId];

    if (isRead !== undefined) {
      whereClause += ' AND is_read = $2';
      params.push(isRead === 'true');
    }

    const notificationsQuery = `
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(parseInt(limit));

    const result = await query(notificationsQuery, params);

    // Convert to camelCase
    const notifications = result.rows.map(convertToCamelCase);

    res.json({ success: true, data: { notifications } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

/**
 * Get unread notification count
 * GET /api/v1/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
    `;

    const result = await query(countQuery, [userId]);
    const count = parseInt(result.rows[0].count);

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
};

/**
 * Mark notification as read
 * PATCH /api/v1/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const updateQuery = `
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(updateQuery, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const notification = convertToCamelCase(result.rows[0]);

    res.json({ success: true, data: { notification } });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

/**
 * Mark all notifications as read
 * POST /api/v1/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const updateQuery = `
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
      RETURNING *
    `;

    const result = await query(updateQuery, [userId]);

    const notifications = result.rows.map(convertToCamelCase);

    res.json({
      success: true,
      data: {
        notifications,
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
};

/**
 * Delete notification
 * DELETE /api/v1/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleteQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(deleteQuery, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

/**
 * Delete all read notifications
 * DELETE /api/v1/notifications/read
 */
exports.deleteReadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const deleteQuery = `
      DELETE FROM notifications
      WHERE user_id = $1 AND is_read = true
      RETURNING id
    `;

    const result = await query(deleteQuery, [userId]);

    res.json({
      success: true,
      message: 'Read notifications deleted',
      data: { deletedCount: result.rows.length }
    });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete read notifications' });
  }
};

/**
 * 알림 타입 설정에 따라 수신자를 결정하고 알림 발송
 * @param {string} type - 알림 타입 (EVENT_UPDATED, EVENT_COMPLETED 등)
 * @param {string} title - 알림 제목
 * @param {string} message - 알림 내용
 * @param {object} context - { actorId, creatorId, departmentId, officeId, divisionId, targetUserId, relatedEventId, metadata }
 */
exports.notifyByScope = async (type, title, message, context) => {
  try {
    // 1. notification_config 조회
    const configResult = await query("SELECT value FROM system_settings WHERE key = 'notification_config'");
    const config = configResult.rows[0]?.value || {};
    const typeConfig = config[type];
    if (!typeConfig?.enabled) return; // OFF면 스킵

    // 2. scope에 따라 수신자 목록 결정
    const recipients = await resolveRecipients(typeConfig.scope, context);

    // 3. 행위자 본인 제외 (자기 알림 방지)
    const filtered = context.actorId
      ? recipients.filter(id => id !== context.actorId)
      : recipients;

    if (filtered.length === 0) return;

    // 4. 각 수신자에게 알림 생성
    for (const userId of filtered) {
      await exports.createNotification(userId, type, title, message, context.relatedEventId || null, context.metadata || null);
    }
  } catch (error) {
    console.error('[notifyByScope] Error:', error.message);
  }
};

/**
 * scope에 따라 수신자 목록 반환
 */
async function resolveRecipients(scope, context) {
  switch (scope) {
    case 'creator':
      return context.creatorId ? [context.creatorId] : [];
    case 'target':
      return context.targetUserId ? [context.targetUserId] : [];
    case 'department':
      if (!context.departmentId) return context.creatorId ? [context.creatorId] : [];
      return (await query(
        'SELECT id FROM users WHERE department_id = $1 AND is_active = true AND approved_at IS NOT NULL',
        [context.departmentId]
      )).rows.map(r => r.id);
    case 'dept_leads':
      return (await query(`
        SELECT id FROM users
        WHERE role = 'DEPT_LEAD' AND is_active = true AND approved_at IS NOT NULL
        AND (
          (scope = 'DEPARTMENT' AND department_id = $1)
          OR (scope = 'OFFICE' AND office_id = $2)
          OR (scope = 'DIVISION' AND division_id = $3)
        )
      `, [context.departmentId, context.officeId, context.divisionId])).rows.map(r => r.id);
    case 'office':
      if (!context.officeId) return context.creatorId ? [context.creatorId] : [];
      return (await query(
        'SELECT id FROM users WHERE office_id = $1 AND is_active = true AND approved_at IS NOT NULL',
        [context.officeId]
      )).rows.map(r => r.id);
    case 'admins':
      return (await query(
        "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = true"
      )).rows.map(r => r.id);
    default:
      return context.creatorId ? [context.creatorId] : [];
  }
}

/**
 * Create notification (helper function)
 * Used internally by other controllers
 */
exports.createNotification = async (userId, type, title, message, relatedEventId = null, metadata = null) => {
  try {
    const insertQuery = `
      INSERT INTO notifications (user_id, type, title, message, related_event_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      userId,
      type,
      title,
      message,
      relatedEventId,
      metadata ? JSON.stringify(metadata) : null
    ]);

    const notification = convertToCamelCase(result.rows[0]);

    // 이메일 알림 비동기 발송 (인앱 알림에 영향 없음)
    sendEmailNotification(userId, type, title, message).catch(err => {
      console.error('[Email] Background send error:', err.message);
    });

    // 푸시 알림 비동기 발송
    sendPushToUser(userId, {
      title: title,
      body: message,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: `notif-${notification.id}`,
      data: {
        notificationId: notification.id,
        type: type,
        relatedEventId: relatedEventId,
        url: '/',
      }
    }).catch(err => {
      console.error('[Push] Background send error:', err.message);
    });

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * 이메일 알림 발송 (내부 헬퍼)
 * 사용자 설정 + 시스템 설정 확인 후 발송
 */
async function sendEmailNotification(userId, type, title, message) {
  // 사용자 이메일 + 수신 설정 조회
  const userResult = await query(
    'SELECT email, email_notifications_enabled, email_preferences FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];

  // 마스터 토글 확인
  if (!user.email_notifications_enabled) return;

  // 타입별 수신 설정 확인
  const prefs = user.email_preferences || {};
  if (prefs[type] === false) return;

  // 시스템 이메일 활성화 확인
  const settingResult = await query(
    "SELECT value FROM system_settings WHERE key = 'email_enabled'"
  );
  if (settingResult.rows.length === 0) return;

  const emailEnabled = settingResult.rows[0].value;
  if (emailEnabled === false || emailEnabled === 'false') return;

  // 모든 조건 통과 → 이메일 발송
  await sendEmail(user.email, title, message);
}

/**
 * Check upcoming events and create reminders
 * POST /api/v1/notifications/check-reminders
 */
exports.checkReminders = async (req, res) => {
  try {
    const { scheduleExistingEvents, scheduleSeriesReminders } = require('../utils/reminderQueueService');

    await scheduleExistingEvents();
    const result = await scheduleSeriesReminders();

    res.json({
      success: true,
      message: 'Reminders checked via queue',
      data: { scheduledCount: result?.scheduledCount || 0 }
    });
  } catch (error) {
    console.error('Check reminders error:', error);
    res.status(500).json({ success: false, message: 'Failed to check reminders' });
  }
};
