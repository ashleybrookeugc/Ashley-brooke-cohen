import app from './worker.js';

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

    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === 'function') {
      return app.scheduled(controller, env, ctx);
    }
  },
};
