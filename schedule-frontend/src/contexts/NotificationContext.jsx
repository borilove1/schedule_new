import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { isPushSupported, subscribeToPush, isSubscribedToPush } from '../utils/pushHelper';

const NotificationContext = createContext();

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, []);

  // Push 상태 초기화
  useEffect(() => {
    const initPush = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);

      if (supported) {
        const subscribed = await isSubscribedToPush();
        setPushSubscribed(subscribed);

        // 권한이 이미 granted인데 구독이 없으면 자동 재구독
        if (!subscribed && Notification.permission === 'granted') {
          const success = await subscribeToPush();
          setPushSubscribed(success);
        }
      }
    };
    initPush();
  }, []);

  // Load on mount and set up polling
  useEffect(() => {
    loadUnreadCount();

    // Poll every 60 seconds
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // Service Worker 메시지 수신 (푸시 도착 시 즉시 카운트 갱신)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_RECEIVED') {
        loadUnreadCount();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [loadUnreadCount]);

  const value = useMemo(() => ({
    unreadCount,
    loadUnreadCount,
    refreshNotifications: loadUnreadCount,
    pushSupported,
    pushSubscribed,
    setPushSubscribed,
  }), [unreadCount, loadUnreadCount, pushSupported, pushSubscribed]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
