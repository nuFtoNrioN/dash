// Service worker tối giản: cho phép cài như app, không lưu dữ liệu quản trị vào bộ nhớ đệm.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#14121c;color:#ece8f6;font:16px system-ui;display:grid;place-items:center;height:100vh"><p>Không có mạng. Hãy thử lại sau.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  }
});
