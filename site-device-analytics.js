/* NIKKE UNION MATCH / monthly device analytics. No new cookies or personal data. */
(()=>{'use strict';
  if(!window.supabase||!window.localStorage)return;
  const key='nikke_union_match_visitor_v1';
  let visitorId='';try{visitorId=localStorage.getItem(key)||'';}catch{return;}
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(visitorId))return;
  const ua=navigator.userAgent||'';
  const isTablet=/iPad|Tablet|PlayBook|Silk/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const device=isTablet?'tablet':(/Mobi|iPhone|Android/i.test(ua)?'mobile':'pc');
  try{
    const client=window.supabase.createClient('https://igoekrvpgnjberppiawf.supabase.co','sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh');
    client.rpc('record_site_device_visit',{p_visitor_id:visitorId,p_device_type:device}).then(({error})=>{if(error)console.debug('Device analytics skipped:',error.message);});
  }catch(_){}
})();
