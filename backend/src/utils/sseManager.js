// SSE (Server-Sent Events) 연결 관리자
// 앱이 열려있는 클라이언트에게 실시간 변경사항 브로드캐스트

const clients = new Map(); // userId → Set<res>

/**
 * SSE 연결 핸들러 (라우트에서 사용)
 * GET /api/v1/sse/events
 */
function handleSSEConnection(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { message: '인증 필요' } });
  }

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
  });

  // 연결 확인 이벤트
  res.write('data: {"type":"connected"}\n\n');

  // 클라이언트 등록
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  // 30초마다 하트비트 (연결 유지)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // 연결 종료 시 정리
  req.on('close', () => {
    clearInterval(heartbeat);
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  });
}

/**
 * 모든 연결된 클라이언트에게 브로드캐스트
 * @param {string} eventType - 이벤트 타입 (event_changed, notification_changed)
 * @param {object} data - 전송 데이터
 * @param {number} excludeUserId - 제외할 사용자 ID (변경을 일으킨 사용자)
 */
function broadcast(eventType, data = {}, excludeUserId = null) {
  const message = JSON.stringify({ type: eventType, ...data });

  for (const [userId, userClients] of clients) {
    if (excludeUserId && userId === excludeUserId) continue;

    for (const res of userClients) {
      try {
        res.write(`data: ${message}\n\n`);
      } catch {
        userClients.delete(res);
      }
    }
  }
}

/**
 * 특정 사용자에게만 전송
 */
function sendToUser(userId, eventType, data = {}) {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const message = JSON.stringify({ type: eventType, ...data });
  for (const res of userClients) {
    try {
      res.write(`data: ${message}\n\n`);
    } catch {
      userClients.delete(res);
    }
  }
}

/**
 * 현재 연결 수 반환
 */
function getConnectionCount() {
  let count = 0;
  for (const userClients of clients.values()) {
    count += userClients.size;
  }
  return count;
}

module.exports = {
  handleSSEConnection,
  broadcast,
  sendToUser,
  getConnectionCount,
};
