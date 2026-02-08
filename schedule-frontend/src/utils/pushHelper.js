import api from './api';

/**
 * VAPID 공개키를 Uint8Array로 변환 (applicationServerKey용)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

/**
 * 푸시 알림 지원 여부 확인
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * 현재 푸시 권한 상태
 * @returns {'default'|'granted'|'denied'|'unsupported'}
 */
export function getPushPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * 푸시 알림 구독
 * 1. VAPID 공개키 조회
 * 2. 브라우저 알림 권한 요청
 * 3. Service Worker를 통해 Push 구독 생성
 * 4. 백엔드에 구독 정보 전송
 */
export async function subscribeToPush() {
  if (!isPushSupported()) return false;

  try {
    const { vapidPublicKey } = await api.getVapidPublicKey();
    if (!vapidPublicKey) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subJson = subscription.toJSON();
    await api.subscribeToPush({
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }
    });

    console.log('[Push] 구독 완료');
    return true;
  } catch (error) {
    console.error('[Push] 구독 실패:', error);
    return false;
  }
}

/**
 * 푸시 알림 구독 해제
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.unsubscribeFromPush(endpoint);
      console.log('[Push] 구독 해제 완료');
    }
    return true;
  } catch (error) {
    console.error('[Push] 구독 해제 실패:', error);
    return false;
  }
}

/**
 * 현재 푸시 구독 존재 여부
 */
export async function isSubscribedToPush() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
