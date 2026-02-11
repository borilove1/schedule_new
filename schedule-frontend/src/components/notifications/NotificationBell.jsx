import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import NotificationModal from './NotificationModal';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../utils/api';

export default function NotificationBell({ onEventClick }) {
  const [showModal, setShowModal] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [preloadedNotifications, setPreloadedNotifications] = useState(null);
  const { unreadCount, loadUnreadCount } = useNotification();
  const { textColor } = useThemeColors();

  // 벨 클릭 시 알림을 먼저 로드한 후 모달 열기
  const handleBellClick = async () => {
    if (showModal) {
      setShowModal(false);
      setPreloadedNotifications(null);
      loadUnreadCount();
      return;
    }
    if (preloading) return;

    setPreloading(true);
    try {
      const { notifications } = await api.getNotifications({ limit: 200 });
      setPreloadedNotifications(notifications || []);
      setShowModal(true);
    } catch (err) {
      console.error('Failed to preload notifications:', err);
      setPreloadedNotifications([]);
      setShowModal(true);
    } finally {
      setPreloading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPreloadedNotifications(null);
    loadUnreadCount();
  };

  // 알림에서 일정 클릭 시
  const handleEventClick = (eventId) => {
    setShowModal(false);
    setPreloadedNotifications(null);
    loadUnreadCount();
    if (onEventClick) {
      onEventClick(eventId);
    }
  };

  return (
    <>
      <button
        onClick={handleBellClick}
        style={{
          background: 'none',
          border: 'none',
          color: textColor,
          cursor: preloading ? 'default' : 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          opacity: preloading ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
        title="알림"
        aria-label={`알림 ${unreadCount > 0 ? `(읽지 않음 ${unreadCount}개)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && !preloading && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '0px',
              backgroundColor: '#ef4444',
              color: '#fff',
              borderRadius: '8px',
              padding: '1px 4px',
              fontSize: '9px',
              fontWeight: '600',
              minWidth: '14px',
              height: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              lineHeight: '1'
            }}
            aria-live="polite"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationModal
        isOpen={showModal}
        onClose={handleModalClose}
        onEventClick={handleEventClick}
        initialNotifications={preloadedNotifications}
      />
    </>
  );
}
