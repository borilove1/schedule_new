import { useState, useEffect, useCallback } from 'react';
import { X, Clock, CheckCircle, Edit, Trash2, Info, Bell, MessageCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { getRelativeTime, NOTIFICATION_TYPES } from '../../utils/mockNotifications';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useActionGuard } from '../../hooks/useActionGuard';
import ErrorAlert from '../common/ErrorAlert';
import LoadingSpinner from '../common/LoadingSpinner';
import api from '../../utils/api';

export default function NotificationModal({ isOpen, onClose, onEventClick }) {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor, hoverBg } = useThemeColors();
  const { inProgress, execute } = useActionGuard();

  const unreadBg = isDarkMode ? '#1e3a5f' : '#dbeafe';

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const { notifications: loadedNotifications } = await api.getNotifications({ limit: 200 });
      setNotifications(loadedNotifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err.message || '알림을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // ESC 키로 모달 닫기
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  // 모달 애니메이션
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const getIconWithColor = (type) => {
    const iconProps = { size: 18 };
    const configs = {
      [NOTIFICATION_TYPES.EVENT_REMINDER]: { icon: <Clock {...iconProps} />, color: '#3B82F6', bg: isDarkMode ? '#1e3a5f' : '#dbeafe' },
      [NOTIFICATION_TYPES.EVENT_DUE_SOON]: { icon: <AlertTriangle {...iconProps} />, color: '#f59e0b', bg: isDarkMode ? '#3b2f1a' : '#fef3c7' },
      [NOTIFICATION_TYPES.EVENT_OVERDUE]: { icon: <AlertCircle {...iconProps} />, color: '#ef4444', bg: isDarkMode ? '#3b1a1a' : '#fee2e2' },
      [NOTIFICATION_TYPES.EVENT_COMPLETED]: { icon: <CheckCircle {...iconProps} />, color: '#10b981', bg: isDarkMode ? '#1c3b2a' : '#d1fae5' },
      [NOTIFICATION_TYPES.EVENT_UPDATED]: { icon: <Edit {...iconProps} />, color: '#f59e0b', bg: isDarkMode ? '#3b2f1a' : '#fef3c7' },
      [NOTIFICATION_TYPES.EVENT_DELETED]: { icon: <Trash2 {...iconProps} />, color: '#ef4444', bg: isDarkMode ? '#3b1a1a' : '#fee2e2' },
      [NOTIFICATION_TYPES.EVENT_COMMENTED]: { icon: <MessageCircle {...iconProps} />, color: '#3B82F6', bg: isDarkMode ? '#1e3a5f' : '#dbeafe' },
      [NOTIFICATION_TYPES.SYSTEM]: { icon: <Info {...iconProps} />, color: '#8b5cf6', bg: isDarkMode ? '#2d1f5e' : '#ede9fe' },
    };
    return configs[type] || { icon: <Bell {...iconProps} />, color: '#3B82F6', bg: isDarkMode ? '#1e3a5f' : '#dbeafe' };
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await execute(async () => {
      try {
        await api.deleteNotification(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      } catch (err) {
        console.error('Failed to delete notification:', err);
        setError(err.message || '알림 삭제에 실패했습니다.');
      }
    });
  };

  const handleMarkAsRead = async (notificationId) => {
    await execute(async () => {
      try {
        await api.markNotificationAsRead(notificationId);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
      } catch (err) {
        console.error('Failed to mark as read:', err);
        setError(err.message || '알림 읽음 처리에 실패했습니다.');
      }
    });
  };

  const handleMarkAllAsRead = async () => {
    await execute(async () => {
      try {
        await api.markAllNotificationsAsRead();
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
      } catch (err) {
        console.error('Failed to mark all as read:', err);
        setError(err.message || '모두 읽음 처리에 실패했습니다.');
      }
    });
  };

  const handleDeleteReadNotifications = async () => {
    await execute(async () => {
      try {
        await api.deleteReadNotifications();
        setNotifications(prev => prev.filter(n => !n.isRead));
      } catch (err) {
        console.error('Failed to delete read notifications:', err);
        setError(err.message || '읽은 알림 삭제에 실패했습니다.');
      }
    });
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    // 관련 일정이 있으면 해당 일정으로 이동
    if (notification.relatedEventId && onEventClick) {
      onEventClick(notification.relatedEventId);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isAnimating ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        transition: 'background-color 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: cardBg,
          borderRadius: '16px',
          width: '100%',
          transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.25s ease, opacity 0.2s ease',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: isDarkMode
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Header - fixed */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          backgroundColor: cardBg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 id="notification-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: textColor }}>알림</h2>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['all', 'unread'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                    backgroundColor: filter === f ? '#3B82F6' : 'transparent',
                    color: filter === f ? '#fff' : secondaryTextColor,
                    cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s'
                  }}
                >
                  {f === 'all' ? `전체 ${notifications.length}` : `읽지않음 ${notifications.filter(n => !n.isRead).length}`}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: secondaryTextColor,
              cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
            }}
            title="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {error && (
            <div style={{ padding: '12px 24px' }}>
              <ErrorAlert message={error} />
            </div>
          )}

          {loading ? (
            <LoadingSpinner message="로딩 중..." />
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: secondaryTextColor }}>
              <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '16px' }}>
                {filter === 'unread' ? '읽지 않은 알림이 없습니다.' : '알림이 없습니다.'}
              </p>
            </div>
          ) : (
            <div>
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: index < filteredNotifications.length - 1 ? `1px solid ${borderColor}` : 'none',
                    backgroundColor: notification.isRead ? 'transparent' : unreadBg,
                    cursor: 'pointer', transition: 'background-color 0.2s',
                    position: 'relative',
                    paddingLeft: notification.isRead ? '20px' : '36px'
                  }}
                  onMouseEnter={(e) => { if (notification.isRead) e.currentTarget.style.backgroundColor = hoverBg; }}
                  onMouseLeave={(e) => { if (notification.isRead) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {!notification.isRead && (
                    <div style={{
                      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                      width: '6px', height: '6px', backgroundColor: '#3B82F6', borderRadius: '50%'
                    }} />
                  )}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {(() => {
                      const { icon, color, bg } = getIconWithColor(notification.type);
                      return (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: bg, color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {icon}
                        </div>
                      );
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: textColor, marginBottom: '2px' }}>
                        {notification.title}
                      </div>
                      <div style={{ fontSize: '13px', color: secondaryTextColor, marginBottom: '4px', lineHeight: '1.4' }}>
                        {notification.message}
                      </div>
                      <div style={{ fontSize: '12px', color: secondaryTextColor, opacity: 0.7 }}>
                        {getRelativeTime(notification.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      disabled={inProgress}
                      style={{
                        background: 'none', border: 'none', padding: '4px',
                        color: secondaryTextColor, cursor: inProgress ? 'not-allowed' : 'pointer',
                        opacity: 0.5, transition: 'opacity 0.2s', flexShrink: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                      title="삭제"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - fixed */}
        {!loading && notifications.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
            backgroundColor: cardBg
          }}>
            {/* 읽은 알림 삭제 버튼 */}
            <button
              onClick={handleDeleteReadNotifications}
              disabled={inProgress || notifications.filter(n => n.isRead).length === 0}
              style={{
                padding: '8px 16px', borderRadius: '6px',
                border: `1px solid ${borderColor}`, backgroundColor: 'transparent',
                color: notifications.filter(n => n.isRead).length === 0 ? secondaryTextColor : '#ef4444',
                cursor: (inProgress || notifications.filter(n => n.isRead).length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '500', transition: 'all 0.2s',
                opacity: (inProgress || notifications.filter(n => n.isRead).length === 0) ? 0.5 : 1
              }}
              onMouseEnter={(e) => { if (!inProgress && notifications.filter(n => n.isRead).length > 0) e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { if (!inProgress) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              읽은 알림 삭제 ({notifications.filter(n => n.isRead).length})
            </button>
            {/* 모두 읽음 처리 버튼 */}
            <button
              onClick={handleMarkAllAsRead}
              disabled={inProgress || notifications.filter(n => !n.isRead).length === 0}
              style={{
                padding: '8px 16px', borderRadius: '6px',
                border: `1px solid ${borderColor}`, backgroundColor: 'transparent',
                color: textColor,
                cursor: (inProgress || notifications.filter(n => !n.isRead).length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '500', transition: 'all 0.2s',
                opacity: (inProgress || notifications.filter(n => !n.isRead).length === 0) ? 0.5 : 1
              }}
              onMouseEnter={(e) => { if (!inProgress && notifications.filter(n => !n.isRead).length > 0) e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { if (!inProgress) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              모두 읽음 처리
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
