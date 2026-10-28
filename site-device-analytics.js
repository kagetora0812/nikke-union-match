/* NIKKE UNION MATCH / monthly device analytics (all public pages). */
(() => {
  'use strict';
  if (!window.localStorage || !window.crypto) return;
  if (/(?:^|\/)creator-admin\.html$/i.test(location.pathname)) return;
  const visitorKey = 'nikke_union_match_visitor_v1';
  let visitorId;
  try {
    visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      if (typeof crypto.randomUUID === 'function') {
        visitorId = crypto.randomUUID();
      } else {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        visitorId = 'v-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      }
      localStorage.setItem(visitorKey, visitorId);
    }
  } catch (_) { return; }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(visitorId)) return;

  const ua = navigator.userAgent || '';
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const device = tablet ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'pc';
  const url = 'https://igoekrvpgnjberppiawf.supabase.co/rest/v1/rpc/record_site_device_visit';
  const key = 'sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh';
  fetch(url, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    keepalive: true,
    headers: { 'content-type': 'application/json', apikey: key },
    body: JSON.stringify({ p_visitor_id: visitorId, p_device_type: device })
  }).then(response => {
    if (!response.ok) console.debug('[UM device analytics] HTTP', response.status);
  }).catch(() => { /* 集計失敗で表示・通知機能を止めない */ });
})();
