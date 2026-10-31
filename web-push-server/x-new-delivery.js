'use strict';
// Notify once per fully judged X search run (automatic or manual).
// Keep this standalone from the Discord BOT and X API.
const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');
const dir = __dirname;
const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--send-once'].includes(mode)) throw Error('MODE_NOT_SUPPORTED');
for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https:\/\/[^/]+\.supabase\.co$/.test(base) || !key) throw Error('SUPABASE_CONFIG_MISSING');
const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const baselineFile = path.join(dir, '.x-push-completed-run-baseline.json');
async function db(table, query, opts = {}) {
  const url = base + '/rest/v1/' + table + (query ? '?' + new URLSearchParams(query) : '');
  const response = await fetch(url, {
    method: opts.method || 'GET',
    headers: { ...headers, ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const err = new Error(table + '_HTTP_' + response.status);
    err.status = response.status;
    throw err;
  }
  return response.status === 204 || opts.headers?.Prefer === 'return=minimal' ? null : response.json();
}
function loadBaseline() {
  if (!fs.existsSync(baselineFile)) return null;
  const value = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).start_at;
  if (!Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now()) throw Error('INVALID_RUN_BASELINE');
  return value;
}
(async () => {
  let baseline = loadBaseline();
  if (!baseline) {
    if (mode === '--send-once') {
      // The first run starts a new delivery era. Never replay older finalized searches.
      const state = { start_at: new Date().toISOString(), version: 1 };
      try {
        fs.writeFileSync(baselineFile, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        console.log(JSON.stringify({ mode, initialized: true, start_at: state.start_at, notifications_sent: 0 }, null, 2));
        return;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      baseline = loadBaseline();
    } else {
      console.log(JSON.stringify({ mode, baseline_missing: true, note: 'First --send-once initializes without sending', notifications_sent: 0 }, null, 2));
      return;
    }
  }
  // The DB completion flag is only true when expected posts have all been judged.
  // Never use newly created candidate rows as the send trigger.
  const runs = await db('x_recruitment_schedule_runs', {
    select: 'id,executed_at,status,judgment_completed,new_listing_count',
    executed_at: 'gt.' + baseline,
    status: 'in.(success,manual)',
    judgment_completed: 'eq.true',
    new_listing_count: 'gt.0',
    order: 'executed_at.asc', limit: '500',
  });
  if (runs.length >= 500) throw Error('GUARD_TOO_MANY_COMPLETED_RUNS');
  const subs = await db('web_push_subscriptions', {
    select: 'id,endpoint,p256dh,auth_secret', enabled: 'eq.true', notify_x: 'eq.true', limit: '500',
  });
  const result = { mode, baseline, completed_runs: runs.length, final_new_listings: runs.reduce((sum, run) => sum + Number(run.new_listing_count || 0), 0), subscriber_count: subs.length, attempts: 0, accepted: 0, failed: 0, skipped: 0, notifications_sent: 0 };
  if (mode === '--dry-run') { console.log(JSON.stringify(result, null, 2)); return; }
  if (subs.length > 100) throw Error('GUARD_TOO_MANY_SUBSCRIBERS');
  if (!runs.length || !subs.length) { console.log(JSON.stringify(result, null, 2)); return; }
  const vapid = JSON.parse(fs.readFileSync(path.join(dir, '.vapid.json'), 'utf8'));
  if (!vapid.publicKey || !vapid.privateKey) throw Error('VAPID_MISSING');
  webpush.setVapidDetails('https://kagetora0812.github.io/nikke-union-match/', vapid.publicKey, vapid.privateKey);
  for (const run of runs) {
    // One final aggregate per search run and device, including runs completed by RESUME.
    for (const sub of subs) {
      const claimed = await db('web_push_delivery_events', {
        on_conflict: 'subscription_id,category,dedup_key', select: 'id',
      }, {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: { subscription_id: sub.id, category: 'x_new', dedup_key: 'run:' + run.id, status: 'pending' },
      });
      if (!Array.isArray(claimed) || claimed.length === 0) { result.skipped++; continue; }
      result.attempts++;
      let status = 'failed', errorCode = null;
      try {
        const payload = {
          title: 'UNION MATCH｜X新着指揮官',
          body: '新しい指揮官募集が' + run.new_listing_count + '件見つかりました。',
          type: 'x_new', tag: 'um-x-run-' + run.id,
          url: 'https://kagetora0812.github.io/nikke-union-match/',
        };
        const response = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' });
        if (response.statusCode < 200 || response.statusCode >= 300) throw Error('PUSH_HTTP_' + response.statusCode);
        status = 'sent'; result.accepted++; result.notifications_sent++;
      } catch (error) {
        errorCode = 'PUSH_' + (error.statusCode || 'ERROR');
        status = [404, 410].includes(error.statusCode) ? 'gone' : 'failed';
        result.failed++;
      }
      const attemptedAt = new Date().toISOString();
      await db('web_push_delivery_events', { id: 'eq.' + claimed[0].id }, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: { status, attempted_at: attemptedAt, error_code: errorCode },
      });
      if (status === 'gone') await db('web_push_subscriptions', { id: 'eq.' + sub.id }, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { enabled: false, updated_at: attemptedAt },
      });
    }
  }
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error('X_PUSH_ERROR:', error.message); process.exitCode = 1; });
