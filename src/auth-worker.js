import app from './worker.js';

const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

async function resolveSecret(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value.get === 'function') {
    const resolved = await value.get();
    return resolved == null ? '' : String(resolved);
  }
  if (typeof value.value === 'string') return value.value;
  return String(value);
}

async function normalizedEnv(env) {
  const adminPassword = await resolveSecret(env.ADMIN_PASSWORD);
  const sessionSecret = await resolveSecret(env.ADMIN_SESSION_SECRET);
  return Object.assign(Object.create(env), {
    ADMIN_PASSWORD: adminPassword,
    ADMIN_SESSION_SECRET: sessionSecret,
  });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

async function secureEqual(a, b) {
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  if (da.length !== db.length) return false;
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function loginPage(message = '') {
  const notice = message
    ? `<p role="alert" style="margin:0 0 1rem;font-weight:700">${message}</p>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin login</title><link rel="stylesheet" href="/assets/site.css?v=admin-login-20260912"></head><body class="legal-page"><main class="legal-shell"><a class="back-home" href="/nyfw-pop-ups/">← NYFW Pop-Up Radar</a><p class="eyebrow">PRIVATE MODERATION</p><h1>Admin login</h1>${notice}<form method="post" action="/admin/login"><label>Password <input name="password" type="password" required autocomplete="current-password" autofocus></label><button class="tracker-button" type="submit">Sign in</button></form></main></body></html>`;
}

async function handleLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return new Response(loginPage('Admin authentication configuration is unavailable in this deployment.'), {
      status: 503,
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' },
    });
  }

  if (request.method === 'GET') {
    return new Response(loginPage(), {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  const form = await request.formData();
  const submitted = String(form.get('password') || '');
  if (!await secureEqual(submitted, env.ADMIN_PASSWORD)) {
    return new Response(loginPage('Incorrect password.'), {
      status: 401,
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' },
    });
  }

  const payload = b64(enc.encode(JSON.stringify({ exp: Date.now() + 28800000 })));
  const signature = await sign(payload, env.ADMIN_SESSION_SECRET);
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/moderation/',
      'Set-Cookie': `abc_admin=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const resolved = await normalizedEnv(env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/admin') {
      return new Response(null, { status: 303, headers: { Location: '/admin/login' } });
    }
    if (path === '/admin/login') return handleLogin(request, resolved);

    return app.fetch(request, resolved, ctx);
  },
  async scheduled(controller, env, ctx) {
    const resolved = await normalizedEnv(env);
    if (typeof app.scheduled === 'function') return app.scheduled(controller, resolved, ctx);
  },
};
