/* Standalone UNION MATCH push handler (not yet registered on production). */
'use strict';
const SCOPE = new URL(self.registration.scope);
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const type = ['x_new', 'site_new', 'expiry_48h', 'test'].includes(payload.type) ? payload.type : 'test';
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 70) : 'UNION MATCH';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 170) : '新しいお知らせがあります。';
  const fallback = new URL('index.html', SCOPE);
  const requested = typeof payload.url === 'string' ? new URL(payload.url, SCOPE) : fallback;
  const target = requested.origin === SCOPE.origin && requested.pathname.startsWith(SCOPE.pathname) ? requested.href : fallback.href;
  const tag = typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : ('um-' + type);
  event.waitUntil((async () => {
    await self.registration.showNotification(title, { body, tag, data:{url:target, type} });
    // UM_PUSH_BADGE_V1
    try {
      if (typeof self.navigator?.setAppBadge === 'function')
        await self.navigator.setAppBadge(1);
    } catch (_) {}
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    try {
      if (typeof self.navigator?.clearAppBadge === 'function')
        await self.navigator.clearAppBadge();
    } catch (_) {}
  })());
  const url = event.notification.data?.url || new URL('index.html', SCOPE).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type:'window', includeUncontrolled:true });
    const match = windows.find(w => w.url.split('#')[0] === url.split('#')[0]);
    if (match) { await match.focus(); await match.navigate(url); return; }
    await clients.openWindow(url);
  })());
});
