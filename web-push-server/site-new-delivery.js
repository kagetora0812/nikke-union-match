'use strict';
// Standalone guarded SITE new registration delivery, without touching Discord bots.
// Default: preview only. --send-once: one daily 21:00 JST summary per subscription.
const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');
const dir = __dirname;
const opt = process.argv[2] || '--dry-run';
if (!['--dry-run','--send-once'].includes(opt)) throw Error('MODE_NOT_SUPPORTED');
for (const line of fs.readFileSync(path.join(dir,'.env'),'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key) throw Error('SUPABASE_CONFIG_MISSING');
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function db(table, query, options={}) {
  const u=base+'/rest/v1/'+table+(query?'?'+new URLSearchParams(query):'');
  const res=await fetch(u,{headers:{...headers,...options.headers},method:options.method||'GET',body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(12000)});
  if (!res.ok) { const e=new Error(table+'_HTTP_'+res.status);e.status=res.status;throw e; }
  return (res.status===204 || options.headers?.Prefer==='return=minimal')?null:res.json();
}
(async()=>{
 const now=new Date();
 const jstMs=9*3600000;
 const jstNow=new Date(now.getTime()+jstMs);
 const jstDay=jstNow.toISOString().slice(0,10);
 const hour=jstNow.getUTCHours();
 // The existing minutely cron calls this script. Only the 21:00-21:59 JST
 // window is eligible; no notification is dispatched outside that hour.
 const inDeliveryHour=hour===21;
 const cutoff=Date.parse(jstDay+'T21:00:00+09:00');
 const previousCutoff=cutoff-24*3600000;
 const start=new Date(previousCutoff).toISOString();
 const end=new Date(cutoff).toISOString();
 // Only SITE commander registrations, as advertised in the notification UI.
 // Fetch one extra record and stop rather than silently undercount a large day.
 const commanders=await db('recruitments',{
   select:'id,status,created_at',created_at:'gt.'+start,order:'created_at.asc',limit:'101'
 });
 // Filter the fixed 21:00 cutoff locally; later registrations belong to tomorrow.
 const candidates=commanders.filter(r=>r.status==='open' && Date.parse(r.created_at)<=cutoff);
 const subs=await db('web_push_subscriptions',{select:'id,endpoint,p256dh,auth_secret',enabled:'eq.true',notify_site:'eq.true',limit:'101'});
 const preview={mode:opt,jst_day:jstDay,in_delivery_hour:inDeliveryHour,window_start:start,window_end:end,commander_count:candidates.length,subscriber_count:subs.length,attempts:0,accepted:0,failed:0,skipped:0,notifications_sent:0};
 if(opt==='--dry-run'){console.log(JSON.stringify(preview,null,2));return;}
 if(!inDeliveryHour || !candidates.length){console.log(JSON.stringify(preview,null,2));return;}
 if(commanders.length>100)throw Error('GUARD_ABORT_TOO_MANY_REGISTRATIONS');
 if(subs.length>100)throw Error('GUARD_ABORT_TOO_MANY_SUBSCRIBERS');
 const vapid=JSON.parse(fs.readFileSync(path.join(dir,'.vapid.json'),'utf8'));
 if(!vapid.publicKey||!vapid.privateKey)throw Error('VAPID_MISSING');
 webpush.setVapidDetails('https://kagetora0812.github.io/nikke-union-match/',vapid.publicKey,vapid.privateKey);
 for(const sub of subs){
   // One atomic claim per device and JST calendar day; do not send twice.
   const unique={subscription_id:sub.id,category:'site_new',dedup_key:'daily-commander:'+jstDay,status:'pending'};
   const claimed=await db('web_push_delivery_events',{on_conflict:'subscription_id,category,dedup_key',select:'id'},
     {method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:unique});
   if(!Array.isArray(claimed)||claimed.length===0){preview.skipped++;continue;}
   const receipt=claimed[0].id;
   preview.attempts++;
   const info={title:'UNION MATCH・懈眠逹謖・尚螳俶ュ蝣ｱ',body:'譁ｰ縺励＞謖・尚螳倥・逋ｻ骭ｲ縺・+candidates.length+'莉ｶ縺ゅｊ縺ｾ縺励◆縲・,type:'site_new',tag:'um-site-daily-'+jstDay,url:'https://kagetora0812.github.io/nikke-union-match/'};
   let status='failed',errorCode=null;
   try{
     const response=await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify(info),{TTL:3600,urgency:'normal'});
     if(response.statusCode<200||response.statusCode>=300)throw Error('PUSH_HTTP_'+response.statusCode);
     preview.accepted++;status='sent';
   }catch(e){preview.failed++;errorCode='PUSH_'+(e.statusCode||'ERROR');if([404,410].includes(e.statusCode))status='gone';}
   await db('web_push_delivery_events',{id:'eq.'+receipt},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,attempted_at:new Date().toISOString(),error_code:errorCode}});
   if(status==='gone')await db('web_push_subscriptions',{id:'eq.'+sub.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{enabled:false,updated_at:new Date().toISOString()}});
 }
 console.log(JSON.stringify(preview,null,2));
})().catch(err=>{console.error('SITE_PUSH_ERROR:',err.message);process.exitCode=1;});
