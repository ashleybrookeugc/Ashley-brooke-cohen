// Shared validator for Mary Kate, moderation and video testing. The browser's
// existing HttpOnly abc_admin session never leaves the website gateway.
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

export async function isAdmin(request, env, now = Date.now()) {
  const cookie = (request.headers.get('cookie') || '').split(';')
    .map(value => value.trim()).find(value => value.startsWith('abc_admin='))?.slice(10);
  if (!cookie || !env.ADMIN_SESSION_SECRET) return false;
  const [payload, signature, extra] = cookie.split('.');
  if (!payload || !signature || extra !== undefined) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(env.ADMIN_SESSION_SECRET),
    {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const expected = b64(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff) return false;
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
    const {exp} = JSON.parse(new TextDecoder().decode(bytes));
    return Number.isFinite(exp) && exp > now;
  } catch {
    return false;
  }
}
