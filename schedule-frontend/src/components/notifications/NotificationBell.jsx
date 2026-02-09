import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import NotificationModal from './NotificationModal';
import { useNotification } from '../../contexts/NotificationContext';

export default function NotificationBell({ onEventClick }) {
  const [showModal, setShowModal] = useState(false);
  const { unreadCount, loadUnreadCount } = useNotification();
  const { textColor } = useThemeColors();

  // Refresh unread count when modal closes
  const handleModalClose = () => {
    setShowModal(false);
    loadUnreadCount();
  };

  // 알림에서 일정 클릭 시
  const handleEventClick = (eventId) => {
    setShowModal(false);
    loadUnreadCount();
    if (onEventClick) {
      onEventClick(eventId);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(!showModal)}
        style={{
          background: 'none',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        title="알림"
        aria-label={`알림 ${unreadCount > 0 ? `(읽지 않음 ${unreadCount}개)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
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
      />
    </>
  );
}
