const CACHE_NAME = 'schedule-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
];

// Install: 앱 셸 프리캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: 구버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME && key.startsWith('schedule-cache-'))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: API는 네트워크, 네비게이션은 network-first, 정적자산은 cache-first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // API 요청은 그대로 네트워크로 전달
  if (url.pathname.startsWith('/api/')) return;

  // 네비게이션 요청: network-first, 오프라인 시 캐시된 index.html 폴백
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 정적 자산: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          // 네트워크 에러 시 빈 응답 반환 (favicon 등)
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
    })
  );
});

// Push 알림 수신
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: '새 알림', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo192.png',
    badge: payload.badge || '/logo192.png',
    tag: payload.tag || 'default',
    renotify: true,
    data: payload.data || {},
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '일정관리', options)
      .then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: false });
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NOTIFICATION_RECEIVED', payload });
        });
      })
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existingClient = clients.find(c => c.visibilityState === 'visible');
        if (existingClient) {
          existingClient.focus();
          existingClient.postMessage({
            type: 'NOTIFICATION_CLICKED',
            notificationId: data.notificationId,
            relatedEventId: data.relatedEventId,
          });
          return;
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
