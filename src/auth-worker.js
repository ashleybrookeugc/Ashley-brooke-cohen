import app from './worker.js';

const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unb(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(
    atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)),
    c => c.charCodeAt(0)
  );
}

async function isAdmin(request, env) {
  const cookie = request.headers.get('Cookie')?.match(/(?:^|; )abc_admin=([^;]+)/)?.[1];
  if (!cookie || !env.ADMIN_SESSION_SECRET) return false;
  const [payload, signature] = cookie.split('.');
  if (!payload || !signature || !equal(await sign(payload, env.ADMIN_SESSION_SECRET), signature)) return false;
  try {
    return JSON.parse(new TextDecoder().decode(unb(payload))).exp > Date.now();
  } catch {
    return false;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function strip(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceSignals(body, status) {
  const text = strip(body).toLowerCase();
  const signals = [];
  if (status === 404 || status === 410) signals.push('source_removed');
  if (/\bcancel(?:led|ed|ation)\b/.test(text)) signals.push('cancellation_language');
  if (/\bsold out\b/.test(text)) signals.push('sold_out_language');
  if (/\bwaitlist\b/.test(text)) signals.push('waitlist_language');
  if (/\bregistration closed\b|\brsvp closed\b|\bapplications? closed\b/.test(text)) signals.push('closed_language');
  return signals;
}

function hostFor(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return ''; }
}

function botProtectedSource(value) {
  const host = hostFor(value);
  return host.includes('instagram.com') || host.includes('tiktok.com') || host.includes('facebook.com') || host.includes('eventbrite.');
}

function classifyHttpStatus(status, sourceUrl) {
  if (status >= 200 && status < 300) return 'verified_automatically';
  if (status === 404 || status === 410) return 'unavailable';
  if (botProtectedSource(sourceUrl) || [401, 403, 405, 406, 409, 418, 429].includes(status)) return 'manual_verification_required';
  if (status === 408 || status >= 500) return 'temporarily_unavailable';
  return 'manual_verification_required';
}

async function fingerprint(value) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').slice(0, 250000);
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(cleaned)));
}

async function verifySubmissionSource(request, env, id) {
  if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const row = await env.DB.prepare(
    'SELECT id,content_type,event_name,source_url,status FROM submissions WHERE id=?'
  ).bind(id).first();
  if (!row) return json({ error: 'Submission not found.' }, 404);

  let response;
  let body = '';
  const checkedAt = new Date().toISOString();
  try {
    response = await fetch(row.source_url, {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
        'user-agent': 'AshleyBrookeCohenVerification/1.0 (+https://ashleybrookecohen.com/)',
      },
    });
    body = await response.text();
  } catch (err) {
    const verificationStatus = botProtectedSource(row.source_url)
      ? 'manual_verification_required'
      : 'temporarily_unavailable';
    return json({
      ok: false,
      reachable: verificationStatus === 'manual_verification_required',
      verification_status: verificationStatus,
      manual_required: verificationStatus === 'manual_verification_required',
      unavailable: false,
      source_url: row.source_url,
      checked_at: checkedAt,
      signals: verificationStatus === 'manual_verification_required' ? ['manual_verification_required'] : [],
      message: verificationStatus === 'manual_verification_required'
        ? 'Automatic verification was blocked by the source. The link may still be valid; open it manually before publishing.'
        : 'The source could not be reached right now. This is a temporary verification failure, not proof that the listing is gone.',
      error: String(err?.message || err),
    });
  }

  const verificationStatus = classifyHttpStatus(response.status, row.source_url);
  const contentSignals = sourceSignals(body, response.status);
  const signals = verificationStatus === 'manual_verification_required'
    ? [...contentSignals, 'manual_verification_required']
    : contentSignals;
  const fp = await fingerprint(body);
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS source_checks (
    submission_id TEXT PRIMARY KEY REFERENCES submissions(id),
    last_http_status INTEGER,
    last_fingerprint TEXT,
    last_signals_json TEXT,
    last_checked_at TEXT NOT NULL,
    last_changed_at TEXT
  );`);
  const previous = await env.DB.prepare(
    'SELECT last_fingerprint FROM source_checks WHERE submission_id=?'
  ).bind(id).first();
  const changed = Boolean(previous?.last_fingerprint && previous.last_fingerprint !== fp);
  await env.DB.prepare(
    `INSERT INTO source_checks
      (submission_id,last_http_status,last_fingerprint,last_signals_json,last_checked_at,last_changed_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(submission_id) DO UPDATE SET
       last_http_status=excluded.last_http_status,
       last_fingerprint=excluded.last_fingerprint,
       last_signals_json=excluded.last_signals_json,
       last_checked_at=excluded.last_checked_at,
       last_changed_at=CASE
         WHEN source_checks.last_fingerprint IS NOT NULL
          AND source_checks.last_fingerprint<>excluded.last_fingerprint
         THEN excluded.last_checked_at
         ELSE source_checks.last_changed_at
       END`
  ).bind(id, response.status, fp, JSON.stringify(signals), checkedAt, changed ? checkedAt : null).run();

  const verifiedAutomatically = verificationStatus === 'verified_automatically';
  const manualRequired = verificationStatus === 'manual_verification_required';
  const unavailable = verificationStatus === 'unavailable';
  const temporarilyUnavailable = verificationStatus === 'temporarily_unavailable';

  let message;
  if (verifiedAutomatically) {
    message = contentSignals.length
      ? `Source reached (HTTP ${response.status}), but review the flagged source signals before publishing.`
      : `Source reached successfully (HTTP ${response.status}). This confirms source availability, not every event fact; compare the source against the fields before publishing.`;
  } else if (manualRequired) {
    message = `Automatic verification was blocked or challenged (HTTP ${response.status}). The link may still be valid; open it manually before publishing.`;
  } else if (unavailable) {
    message = `Source returned HTTP ${response.status} and appears unavailable or removed.`;
  } else if (temporarilyUnavailable) {
    message = `Source returned HTTP ${response.status}. Treat this as temporarily unavailable, not proof that the listing is gone.`;
  } else {
    message = `Source returned HTTP ${response.status}. Manual verification is required.`;
  }

  return json({
    ok: verifiedAutomatically,
    reachable: verifiedAutomatically || manualRequired,
    verification_status: verificationStatus,
    manual_required: manualRequired,
    unavailable,
    temporarily_unavailable: temporarilyUnavailable,
    source_url: row.source_url,
    http_status: response.status,
    checked_at: checkedAt,
    signals,
    changed,
    message,
  });
}

function eventDetailPage(occurrenceId) {
  const id = String(occurrenceId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>NYFW Pop-Up Radar · Ashley Brooke Cohen</title><link rel="stylesheet" href="/assets/site.css?v=event-detail-20260912"><script src="/assets/event-detail.js?v=event-detail-20260912" defer></script></head><body class="radar-page" data-occurrence-id="${id}"><main class="detail-shell" id="event-detail"><p class="loading">Loading event details…</p></main></body></html>`, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/admin') {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/admin/login',
          'cache-control': 'no-store',
        },
      });
    }

    const eventMatch = path.match(/^\/nyfw-pop-ups\/event\/([a-zA-Z0-9_-]+)$/);
    if (eventMatch) return eventDetailPage(eventMatch[1]);

    const verifyMatch = path.match(/^\/api\/admin\/submissions\/([\w-]+)\/verify-source$/);
    if (verifyMatch) return verifySubmissionSource(request, env, verifyMatch[1]);

    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === 'function') {
      return app.scheduled(controller, env, ctx);
    }
  },
};
