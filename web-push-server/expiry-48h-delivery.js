'use strict';
// Standalone Web Push 48-hour warning. No changes to existing Discord bot or X collection.
// Default is read-only preview. --send-once sends to eligible, verified devices only.
const fs=require('node:fs');
const path=require('node:path');
const webpush=require('web-push');
const dir=__dirname;
const mode=process.argv[2]||'--dry-run';
if(!['--dry-run','--send-once'].includes(mode))throw Error('MODE_NOT_SUPPORTED');
for(const line of fs.readFileSync(path.join(dir,'.env'),'utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
 if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)throw Error('SUPABASE_CONFIG_MISSING');
const hdr={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function db(table,query,opts={}){
 const url=base+'/rest/v1/'+table+(query?'?'+new URLSearchParams(query):'');
 const r=await fetch(url,{method:opts.method||'GET',headers:{...hdr,...opts.headers},body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error(table+'_HTTP_'+r.status);
 if(r.status===204||opts.headers?.Prefer==='return=minimal')return null;
 return r.json();
}
(async()=>{
 const now=Date.now();
 const subs=await db('web_push_subscriptions',{select:'id,endpoint,p256dh,auth_secret,union_registration_id',enabled:'eq.true',notify_expiry:'eq.true',limit:'150'});
 if(subs.length>100)throw Error('GUARD_TOO_MANY_SUBSCRIBERS');
 const result={mode,verified_devices:0,due_memberships:0,attempts:0,accepted:0,failed:0,skipped:0,notifications_sent:0};
 const ready=[];
 for(const sub of subs){
  if(!sub.union_registration_id)continue;
  const sessions=await db('web_push_union_device_sessions',{select:'id',subscription_id:'eq.'+sub.id,union_registration_id:'eq.'+sub.union_registration_id,revoked_at:'is.null',expires_at:'gt.'+new Date(now).toISOString(),limit:'1'});
  if(!sessions.length)continue;
  result.verified_devices++;
  const memberships=await db('union_registrations',{select:'id,union_name,expires_at',id:'eq.'+sub.union_registration_id,limit:'1'});
  if(!memberships.length)continue;
  const member=memberships[0];
  const delta=Date.parse(member.expires_at)-now;
  // Delivery window: within 48h of expiry, allowing 1h of scheduling recovery.
  if(!(delta>47*3600000&&delta<=48*3600000))continue;
  ready.push({sub,member});
 }
 result.due_memberships=ready.length;
 if(mode==='--dry-run'){console.log(JSON.stringify(result,null,2));return;}
 const vapid=JSON.parse(fs.readFileSync(path.join(dir,'.vapid.json'),'utf8'));
 if(!vapid.publicKey||!vapid.privateKey)throw Error('VAPID_MISSING');
 webpush.setVapidDetails('https://kagetora0812.github.io/nikke-union-match/',vapid.publicKey,vapid.privateKey);
 for(const {sub,member} of ready){
  // Recheck toggles, binding and expiry just before delivery (OFF means no send).
  const current=await db('web_push_subscriptions',{select:'id,enabled,notify_expiry,union_registration_id',id:'eq.'+sub.id,limit:'1'});
  if(current.length!==1||!current[0].enabled||!current[0].notify_expiry||current[0].union_registration_id!==member.id){result.skipped++;continue;}
  const session=await db('web_push_union_device_sessions',{select:'id',subscription_id:'eq.'+sub.id,union_registration_id:'eq.'+member.id,revoked_at:'is.null',expires_at:'gt.'+new Date().toISOString(),limit:'1'});
  if(!session.length){result.skipped++;continue;}
  const latest=await db('union_registrations',{select:'expires_at',id:'eq.'+member.id,limit:'1'});
  if(latest.length!==1||latest[0].expires_at!==member.expires_at){result.skipped++;continue;}
  // Idempotent per device AND expiration timestamp. Renewed expiry gets a new key.
  const dedupKey=member.id+':'+member.expires_at;
  const claim=await db('web_push_delivery_events',{on_conflict:'subscription_id,category,dedup_key',select:'id'},{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:{subscription_id:sub.id,category:'expiry_48h',dedup_key:dedupKey,status:'pending'}});
  if(!Array.isArray(claim)||!claim.length){result.skipped++;continue;}
  const deliveryId=claim[0].id;
  let status='failed',code=null;
  result.attempts++;
  try{
   const payload={title:'UNION MATCH・懈軸霈画悄髯舌∪縺ｧ48譎る俣',body:(member.union_name||'繝ｦ繝九が繝ｳ')+'縺ｮ謗ｲ霈画悄髯舌′霑代▼縺・※縺・∪縺吶ゅし繧､繝医〒譛滄剞繧堤｢ｺ隱阪・蟒ｶ髟ｷ縺励※縺上□縺輔＞縲・,type:'expiry_48h',tag:'um-expiry-'+member.id,url:'https://kagetora0812.github.io/nikke-union-match/index.html?um_push=expiry_48h'};
   const response=await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify(payload),{TTL:1800,urgency:'normal'});
   if(response.statusCode<200||response.statusCode>=300)throw Error('HTTP_'+response.statusCode);
   status='sent';result.accepted++;result.notifications_sent++;
  }catch(e){code='PUSH_'+(e.statusCode||'ERROR');status=[404,410].includes(e.statusCode)?'gone':'failed';result.failed++;}
  await db('web_push_delivery_events',{id:'eq.'+deliveryId},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,attempted_at:new Date().toISOString(),error_code:code}});
  if(status==='gone')await db('web_push_subscriptions',{id:'eq.'+sub.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:{enabled:false,notify_expiry:false,updated_at:new Date().toISOString()}});
 }
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error('EXPIRY_PUSH_ERROR:',e.message);process.exitCode=1;});
