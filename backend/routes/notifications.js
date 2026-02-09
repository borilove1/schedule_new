const express = require('express');
const { authenticate } = require('../middleware/auth');
const notificationController = require('../src/controllers/notificationController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get unread count (must come before /:id routes)
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all as read
router.post('/read-all', notificationController.markAllAsRead);

// Delete all read notifications
router.delete('/read', notificationController.deleteReadNotifications);

// Check and create reminders for upcoming events
router.post('/check-reminders', notificationController.checkReminders);

// Get notifications
router.get('/', notificationController.getNotifications);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
