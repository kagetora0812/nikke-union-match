// bot.htmlの閉じ </body> 直前で <script src="./bot-analytics.js"></script> として読込
// ボット認証・ページ公開フラグ・演出処理へは干渉しません。
(() => {
  const url = 'https://igoekrvpgnjberppiawf.supabase.co/rest/v1/rpc/record_bot_page_action';
  const apiKey = 'sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh';
  const q = new URLSearchParams(location.search);
  const qsource = q.get('um_source');
  let source = ['index','registration','x'].includes(qsource) ? qsource : 'direct_unknown';
  if (source === 'direct_unknown' && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      const host = ref.hostname.toLowerCase();
      if (ref.origin === location.origin) source = 'index';
      else if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host === 't.co') source = 'x';
      else source = 'external';
    } catch (_) {}
  }
  let visitorId;
  try {
    visitorId=localStorage.getItem('nikke_union_match_visitor_v1');
    if (!visitorId) {
      visitorId=crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('nikke_union_match_visitor_v1',visitorId);
    }
  } catch (_) { visitorId=`temp-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  // Page views only. No Discord invite button / SPECIAL click monitoring.
  fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':apiKey,'Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({p_visitor_id:visitorId,p_source:source,p_event:'pageview'}),
    keepalive:true
  }).catch(()=>{});
})();
