// SSE (Server-Sent Events) 클라이언트
// 서버에서 실시간 이벤트를 수신하여 UI 갱신 트리거

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

let eventSource = null;
const listeners = new Map(); // eventType → Set<callback>

/**
 * SSE 연결 시작
 */
export function connectSSE() {
  if (eventSource) return; // 이미 연결됨

  const token = localStorage.getItem('token');
  if (!token) return;

  // EventSource는 커스텀 헤더를 지원하지 않으므로 쿼리 파라미터로 토큰 전달
  const url = `${API_BASE_URL}/sse/events?token=${encodeURIComponent(token)}`;
  console.log('[SSE] 연결 시도:', url.substring(0, 40) + '...');
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log('[SSE] 연결 성공');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[SSE] 수신:', data.type, data.action || '');
      const callbacks = listeners.get(data.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(data));
      }
    } catch {
      // 파싱 실패 무시 (heartbeat 등)
    }
  };

  eventSource.onerror = (err) => {
    console.log('[SSE] 에러, readyState:', eventSource?.readyState);
    // 자동 재연결 (EventSource 내장 기능)
    // 연결이 완전히 끊어지면 정리
    if (eventSource?.readyState === EventSource.CLOSED) {
      console.log('[SSE] 연결 종료됨 (CLOSED)');
      disconnectSSE();
    }
  };
}

/**
 * SSE 연결 종료
 */
export function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
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
