// SSE (Server-Sent Events) 클라이언트
// 서버에서 실시간 이벤트를 수신하여 UI 갱신 트리거

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

let eventSource = null;
let reconnectTimer = null;
let errorCount = 0;
const MAX_ERRORS_BEFORE_RECONNECT = 3;
const RECONNECT_DELAY = 5000;
const listeners = new Map(); // eventType → Set<callback>

/**
 * SSE 연결 시작
 * - OPEN 상태면 스킵
 * - CONNECTING/CLOSED/에러 상태면 기존 연결 정리 후 새로 연결
 */
export function connectSSE() {
  // 이미 연결 중이고 정상이면 스킵
  if (eventSource?.readyState === EventSource.OPEN) return;

  // 기존 연결이 끊어졌거나 CONNECTING 상태로 멈춰있으면 정리
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  const token = localStorage.getItem('token');
  if (!token) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const url = `${API_BASE_URL}/sse/events?token=${encodeURIComponent(token)}`;
  eventSource = new EventSource(url);
  errorCount = 0;

  eventSource.onopen = () => {
    console.log('[SSE] 연결 성공');
    errorCount = 0;
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const callbacks = listeners.get(data.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(data));
      }
    } catch {
      // 파싱 실패 무시 (heartbeat 등)
    }
  };

  eventSource.onerror = () => {
    errorCount++;

    if (eventSource?.readyState === EventSource.CLOSED) {
      // 완전히 닫힘 → 정리 후 재연결 예약
      disconnectSSE();
      scheduleReconnect();
    } else if (errorCount >= MAX_ERRORS_BEFORE_RECONNECT) {
      // CONNECTING 상태에서 연속 에러 → 강제 재연결
      disconnectSSE();
      scheduleReconnect();
    }
    // 그 외: EventSource 내장 자동 재연결에 맡김
  };
}

/**
 * 재연결 예약
 */
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    errorCount = 0;
    connectSSE();
  }, RECONNECT_DELAY);
}

/**
 * SSE 연결 종료
 */
export function disconnectSSE() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  errorCount = 0;
}

/**
 * 이벤트 리스너 등록
 * @param {string} eventType - 이벤트 타입 (event_changed, notification_changed 등)
 * @param {Function} callback - 콜백 함수
 * @returns {Function} 리스너 해제 함수
 */
export function onSSE(eventType, callback) {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType).add(callback);

  // cleanup 함수 반환
  return () => {
    const callbacks = listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        listeners.delete(eventType);
      }
    }
  };
}

/**
 * SSE 연결 상태 확인
 */
export function isSSEConnected() {
  return eventSource?.readyState === EventSource.OPEN;
}
