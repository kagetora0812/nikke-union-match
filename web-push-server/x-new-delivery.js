'use strict';
// Standalone, guarded X Web Push delivery. Does not access Discord bots or the X API.
// Default: preview only. --send-once: one count-only notification per subscription for newly claimed candidates.
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
const baseline=JSON.parse(fs.readFileSync(path.join(dir,'.x-push-baseline.json'),'utf8')).start_at;
if (!Number.isFinite(Date.parse(baseline)) || Date.parse(baseline)>Date.now()) throw Error('INVALID_BASELINE');
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function db(table, query, options={}) {
  const u=base+'/rest/v1/'+table+(query?'?'+new URLSearchParams(query):'');
  const res=await fetch(u,{headers:{...headers,...options.headers},method:options.method||'GET',body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(12000)});
  if (!res.ok) { const e=new Error(table+'_HTTP_'+res.status);e.status=res.status;throw e; }
  return (res.status===204 || options.headers?.Prefer==='return=minimal')?null:res.json();
}
(async()=>{
 const now=new Date();
 // Cap page sizes. Old posts are ineligible even when their original X post is recent.
 const rows=await db('x_recruitment_candidates',{select:'id,commander_name,status,listed_at,admin_hidden,admin_deleted_at,source_url',listed_at:'gt.'+baseline,order:'listed_at.asc',limit:'100'});
 const candidates=rows.filter(r=>r.status==='active'&&r.admin_hidden!==true&&!r.admin_deleted_at&&r.listed_at&&Date.parse(r.listed_at)<=now.getTime());
 const subs=await db('web_push_subscriptions',{select:'id,endpoint,p256dh,auth_secret',enabled:'eq.true',notify_x:'eq.true',limit:'500'});
 const preview={mode:opt,baseline,candidate_count:candidates.length,subscriber_count:subs.length,attempts:0,accepted:0,failed:0,skipped:0};
 if(opt==='--dry-run') {console.log(JSON.stringify({...preview,notifications_sent:0},null,2));return;}
 // A batch notification replaces the old one-push-per-candidate guard.
 if(candidates.length>100) throw Error('GUARD_ABORT_TOO_MANY_NEW_CANDIDATES_'+candidates.length);
 if(subs.length>100) throw Error('GUARD_ABORT_TOO_MANY_SUBSCRIBERS_'+subs.length);
 const vapid=JSON.parse(fs.readFileSync(path.join(dir,'.vapid.json'),'utf8'));
 if(!vapid.publicKey||!vapid.privateKey) throw Error('VAPID_MISSING');
 webpush.setVapidDetails('https://kagetora0812.github.io/nikke-union-match/',vapid.publicKey,vapid.privateKey);
 // Deduplicate each candidate per device as before, but notify once per device per run.
 for (const sub of subs) {
   const receipts=[];
   for (const candidate of candidates) {
     const unique={subscription_id:sub.id,category:'x_new',dedup_key:String(candidate.id),status:'pending'};
     // Atomic dedup: only newly claimed candidates belong to this batch.
     const claimed=await db('web_push_delivery_events', {on_conflict:'subscription_id,category,dedup_key',select:'id'}, {method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:unique});
     if(!Array.isArray(claimed)||claimed.length===0) {preview.skipped++;continue;}
     receipts.push(claimed[0].id);
   }
   if(receipts.length===0) continue;
   preview.attempts++;
   const info={title:'UNION MATCH・弭譁ｰ逹謖・尚螳・,body:'譁ｰ縺励＞謖・尚螳伜供髮・′'+receipts.length+'莉ｶ隕九▽縺九ｊ縺ｾ縺励◆縲・,type:'x_new',tag:'um-x-batch',url:'https://kagetora0812.github.io/nikke-union-match/'};
   let status='failed',errorCode=null;
   try {
     const response=await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify(info),{TTL:3600,urgency:'normal'});
     if(response.statusCode<200||response.statusCode>=300) throw Error('PUSH_HTTP_'+response.statusCode);
     preview.accepted++;status='sent';
   } catch(e) { preview.failed++;errorCode='PUSH_'+(e.statusCode||'ERROR');if([404,410].includes(e.statusCode))status='gone'; }
   const attemptedAt=new Date().toISOString();
   // Update only rows claimed by this run. Preserve existing per-candidate dedup keys.
   for (const receipt of receipts) {
     await db('web_push_delivery_events',{id:'eq.'+receipt},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,attempted_at:attemptedAt,error_code:errorCode}});
   }
   if(status==='gone') await db('web_push_subscriptions',{id:'eq.'+sub.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{enabled:false,updated_at:attemptedAt}});
 }
 console.log(JSON.stringify(preview,null,2));
})().catch(err=>{console.error('X_PUSH_ERROR:',err.message);process.exitCode=1;});
