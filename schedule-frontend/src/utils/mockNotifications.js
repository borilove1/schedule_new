/**
 * Mock notification data generator
 * Phase 1: Used for UI development
 * Phase 2: Will be replaced with API calls
 */

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  EVENT_REMINDER: 'EVENT_REMINDER',
  EVENT_DUE_SOON: 'EVENT_DUE_SOON',
  EVENT_OVERDUE: 'EVENT_OVERDUE',
  EVENT_COMPLETED: 'EVENT_COMPLETED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_DELETED: 'EVENT_DELETED',
  EVENT_COMMENTED: 'EVENT_COMMENTED',
  SYSTEM: 'SYSTEM'
};

/**
 * Generate mock notifications
 * @returns {Array} Array of notification objects
 */
export const generateMockNotifications = () => {
  const now = new Date();

  return [
    {
      id: 'notif-1',
      type: NOTIFICATION_TYPES.EVENT_REMINDER,
      title: '일정 알림',
      message: '"주간 회의" 일정이 30분 후 시작됩니다.',
      isRead: false,
      createdAt: new Date(now.getTime() - 10 * 60000).toISOString(), // 10분 전
      relatedEventId: 'series-1-1770076800000',
      metadata: {
        eventTitle: '주간 회의',
        eventStartAt: new Date(now.getTime() + 20 * 60000).toISOString(),
        alertType: '30min'
      }
    },
    {
      id: 'notif-2',
      type: NOTIFICATION_TYPES.EVENT_REMINDER,
      title: '일정 알림',
      message: '"프로젝트 발표" 일정이 1시간 후 시작됩니다.',
      isRead: false,
      createdAt: new Date(now.getTime() - 30 * 60000).toISOString(), // 30분 전
      relatedEventId: 'series-2-1770080400000',
      metadata: {
        eventTitle: '프로젝트 발표',
        eventStartAt: new Date(now.getTime() + 30 * 60000).toISOString(),
        alertType: '1hour'
      }
    },
    {
      id: 'notif-3',
      type: NOTIFICATION_TYPES.EVENT_COMPLETED,
      title: '일정 완료',
      message: '"팀 미팅" 일정이 완료되었습니다.',
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(), // 2시간 전
      relatedEventId: '123',
      metadata: {
        eventTitle: '팀 미팅',
        completedBy: '홍길동'
      }
    },
    {
      id: 'notif-4',
      type: NOTIFICATION_TYPES.EVENT_UPDATED,
      title: '일정 수정',
      message: '"고객 미팅" 일정이 수정되었습니다.',
      isRead: false,
      createdAt: new Date(now.getTime() - 5 * 3600000).toISOString(), // 5시간 전
      relatedEventId: '456',
      metadata: {
        eventTitle: '고객 미팅',
        updatedBy: '김철수'
      }
    },
    {
      id: 'notif-5',
      type: NOTIFICATION_TYPES.SYSTEM,
      title: '시스템 알림',
      message: '일정 관리 시스템이 업데이트되었습니다.',
      isRead: true,
      createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(), // 1일 전
      relatedEventId: null,
      metadata: {
        version: '1.0.1'
      }
    },
    {
      id: 'notif-6',
      type: NOTIFICATION_TYPES.EVENT_REMINDER,
      title: '일정 알림',
      message: '"월례 보고" 일정이 내일 시작됩니다.',
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 24 * 3600000).toISOString(), // 2일 전
      relatedEventId: '789',
      metadata: {
        eventTitle: '월례 보고',
        eventStartAt: new Date(now.getTime() + 24 * 3600000).toISOString(),
        alertType: '1day'
      }
    },
    {
      id: 'notif-7',
      type: NOTIFICATION_TYPES.EVENT_DELETED,
      title: '일정 삭제',
      message: '"임시 회의" 일정이 삭제되었습니다.',
      isRead: true,
      createdAt: new Date(now.getTime() - 3 * 24 * 3600000).toISOString(), // 3일 전
      relatedEventId: null,
      metadata: {
        eventTitle: '임시 회의',
        deletedBy: '이영희'
      }
    },
    {
      id: 'notif-8',
      type: NOTIFICATION_TYPES.EVENT_COMPLETED,
      title: '일정 완료',
      message: '"분기 리뷰" 일정이 완료되었습니다.',
      isRead: true,
      createdAt: new Date(now.getTime() - 5 * 24 * 3600000).toISOString(), // 5일 전
      relatedEventId: '101',
      metadata: {
        eventTitle: '분기 리뷰',
        completedBy: '박지성'
      }
    }
  ];
};

/**
 * Format timestamp as relative time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted relative time
 */
export const getRelativeTime = (timestamp) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  // 7일 이상이면 날짜 표시
  return past.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get icon name based on notification type
 * @param {string} type - Notification type
 * @returns {string} Icon name (lucide-react icon)
 */
export const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.EVENT_REMINDER:
      return 'Clock';
    case NOTIFICATION_TYPES.EVENT_DUE_SOON:
      return 'AlertTriangle';
    case NOTIFICATION_TYPES.EVENT_OVERDUE:
      return 'AlertCircle';
    case NOTIFICATION_TYPES.EVENT_COMPLETED:
      return 'CheckCircle';
    case NOTIFICATION_TYPES.EVENT_UPDATED:
      return 'Edit';
    case NOTIFICATION_TYPES.EVENT_DELETED:
      return 'Trash2';
    case NOTIFICATION_TYPES.EVENT_COMMENTED:
      return 'MessageCircle';
    case NOTIFICATION_TYPES.SYSTEM:
      return 'Info';
    default:
      return 'Bell';
  }
};
