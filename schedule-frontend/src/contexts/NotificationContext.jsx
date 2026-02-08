import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { subscribeToPush, isSubscribedToPush } from '../utils/pushHelper';
import { onSSE } from '../utils/sseClient';

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

  // Push 상태 초기화 (비동기 - SW ready 대기 후 정확한 체크)
  useEffect(() => {
    const initPush = async () => {
      if (!('serviceWorker' in navigator)) return;

      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000))
        ]);

        const supported = !!(registration && registration.pushManager);
        setPushSupported(supported);

        if (supported) {
          const subscribed = await isSubscribedToPush();
          setPushSubscribed(subscribed);

          // 권한이 이미 granted인데 구독이 없으면 자동 재구독
          if (!subscribed && 'Notification' in window && Notification.permission === 'granted') {
            const success = await subscribeToPush();
            setPushSubscribed(success);
          }
        }
      } catch {
        // SW ready timeout - push not supported
      }
    };
    initPush();
  }, []);

  // Load on mount and set up polling (30초)
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // SSE 실시간 갱신: 일정 변경 시 알림 카운트도 갱신
  useEffect(() => {
    const unsubscribe = onSSE('event_changed', () => {
      loadUnreadCount();
    });
    return unsubscribe;
  }, [loadUnreadCount]);

  // Visibility API: 앱 복귀 시 즉시 갱신
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
