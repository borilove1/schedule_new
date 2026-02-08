import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { subscribeToPush, isSubscribedToPush } from '../utils/pushHelper';

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
  const [pushDebugInfo, setPushDebugInfo] = useState(null);

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
      const debug = {
        hasSW: 'serviceWorker' in navigator,
        hasPushManager: 'PushManager' in window,
        hasNotification: 'Notification' in window,
        swController: null,
        swState: null,
        swReady: false,
        pushManagerAvail: false,
        notifPermission: 'Notification' in window ? Notification.permission : 'N/A',
        isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
        error: null,
      };

      try {
        if ('serviceWorker' in navigator) {
          // 기존 등록 확인
          const regs = await navigator.serviceWorker.getRegistrations();
          debug.registrationCount = regs.length;
          if (regs.length > 0) {
            debug.swScope = regs[0].scope;
            debug.swActive = !!(regs[0].active);
            debug.swInstalling = !!(regs[0].installing);
            debug.swWaiting = !!(regs[0].waiting);
          }

          // controller 확인
          debug.swController = !!(navigator.serviceWorker.controller);

          // SW ready 대기
          const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout (5s)')), 5000))
          ]);
          debug.swReady = true;
          debug.pushManagerAvail = !!(registration && registration.pushManager);
        }
      } catch (err) {
        debug.error = err.message || String(err);
      }

      setPushDebugInfo(debug);

      const supported = debug.swReady && debug.pushManagerAvail;
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
    pushDebugInfo,
  }), [unreadCount, loadUnreadCount, pushSupported, pushSubscribed, pushDebugInfo]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
