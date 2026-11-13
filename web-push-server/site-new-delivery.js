'use strict';
// Standalone guarded SITE new registration delivery, without touching Discord bots.
// Default: preview only. --send-once: 07:00-21:59 JST per registration; overnight registrations grouped at 07:00.
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
 const jstHour=(now.getUTCHours()+9)%24;
 const sendingHours=jstHour>=7 && jstHour<22;
 // Pick up recent registrations after short cron outages. Dedupe is per registration ID,
 // not per day, so each registration is delivered at most once per subscription.
 const start=new Date(now.getTime()-48*3600000).toISOString();
 const commanders=await db('recruitments',{
   select:'id,status,created_at',created_at:'gt.'+start,order:'created_at.asc',limit:'101'
 });
 if(commanders.length>100)throw Error('GUARD_ABORT_TOO_MANY_REGISTRATIONS');
 const candidates=commanders.filter(r=>r.status==='open' && Date.parse(r.created_at)<=now.getTime());
 const subs=await db('web_push_subscriptions',{select:'id,endpoint,p256dh,auth_secret',enabled:'eq.true',notify_site:'eq.true',limit:'101'});
 if(subs.length>100)throw Error('GUARD_ABORT_TOO_MANY_SUBSCRIBERS');
 const preview={mode:opt,jst_hour:jstHour,sending_hours:sendingHours,window_start:start,registration_count:candidates.length,subscriber_count:subs.length,attempts:0,accepted:0,failed:0,skipped:0,notifications_sent:0};
 if(opt==='--dry-run'||!sendingHours||!candidates.length||!subs.length){console.log(JSON.stringify(preview,null,2));return;}
 const vapid=JSON.parse(fs.readFileSync(path.join(dir,'.vapid.json'),'utf8'));
 if(!vapid.publicKey||!vapid.privateKey)throw Error('VAPID_MISSING');
 webpush.setVapidDetails('https://kagetora0812.github.io/nikke-union-match/',vapid.publicKey,vapid.privateKey);
 // Group registrations created in quiet hours into one morning push per device.
 // Registration-ID claims remain atomic, so repeated cron runs never notify twice.
 const quiet=candidates.filter(r=>{const h=(new Date(r.created_at).getUTCHours()+9)%24;return h>=22||h<7;});
 const daytime=candidates.filter(r=>{const h=(new Date(r.created_at).getUTCHours()+9)%24;return h>=7&&h<22;});
 async function claim(sub, candidate){
   const unique={subscription_id:sub.id,category:'site_new',dedup_key:'commander:'+candidate.id,status:'pending'};
   const claimed=await db('web_push_delivery_events',{on_conflict:'subscription_id,category,dedup_key',select:'id'},
     {method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:unique});
   if(!Array.isArray(claimed)||!claimed.length){preview.skipped++;return null;}
   return claimed[0].id;
 }
 async function send(sub, receipts, info){
   if(!receipts.length)return;
   preview.attempts++;
   let status='failed',errorCode=null;
   try{
     const response=await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify(info),{TTL:3600,urgency:'normal'});
     if(response.statusCode<200||response.statusCode>=300)throw Error('PUSH_HTTP_'+response.statusCode);
     preview.accepted++;preview.notifications_sent++;status='sent';
   }catch(e){preview.failed++;errorCode='PUSH_'+(e.statusCode||'ERROR');if([404,410].includes(e.statusCode))status='gone';}
   for(const receipt of receipts){
     await db('web_push_delivery_events',{id:'eq.'+receipt},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,attempted_at:new Date().toISOString(),error_code:errorCode}});
   }
   if(status==='gone')await db('web_push_subscriptions',{id:'eq.'+sub.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{enabled:false,updated_at:new Date().toISOString()}});
 }
 for(const sub of subs){
   const quietReceipts=[];
   for(const candidate of quiet){const receipt=await claim(sub,candidate);if(receipt)quietReceipts.push(receipt);}
   if(quietReceipts.length){
     const info={title:'UNION MATCH｜新着指揮官情報',body:'深夜の新規指揮官登録が'+quietReceipts.length+'件ありました。',type:'site_new',tag:'um-site-overnight',url:'https://kagetora0812.github.io/nikke-union-match/'};
     await send(sub,quietReceipts,info);
   }
   for(const candidate of daytime){
     const receipt=await claim(sub,candidate);
     if(!receipt)continue;
     const info={title:'UNION MATCH｜新着指揮官情報',body:'新しい指揮官が登録されました。',type:'site_new',tag:'um-site-'+candidate.id,url:'https://kagetora0812.github.io/nikke-union-match/'};
     await send(sub,[receipt],info);
   }
 }
 console.log(JSON.stringify(preview,null,2));
})().catch(err=>{console.error('SITE_PUSH_ERROR:',err.message);process.exitCode=1;});
