import app from './auth-worker.js';

function eventDetailPage(occurrenceId) {
  const id = String(occurrenceId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>NYFW Pop-Up Radar · Ashley Brooke Cohen</title><link rel="stylesheet" href="/assets/site.css?v=event-detail-20260912-router"><script src="/assets/event-detail.js?v=event-detail-20260912-router" defer></script></head><body class="radar-page" data-occurrence-id="${id}"><main class="detail-shell" id="event-detail"><p class="loading">Loading event details…</p></main></body></html>`, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

function getOccurrenceId(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const pathMatch = path.match(/^\/nyfw-pop-ups\/event\/([^/]+)$/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);

  if (
    path === '/nyfw-pop-ups/event' ||
    path === '/nyfw-pop-ups/event/index.html' ||
    path === '/nyfw-pop-ups/event.html'
  ) {
    return url.searchParams.get('id') ||
      url.searchParams.get('occurrence') ||
      url.searchParams.get('occurrenceId') ||
      '';
  }

  return '';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const occurrenceId = getOccurrenceId(url);
    if (occurrenceId) return eventDetailPage(occurrenceId);
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === 'function') {
      return app.scheduled(controller, env, ctx);
    }
  },
};
