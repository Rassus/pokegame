/* ============ sw.js — para poder instalar el juego como app ============
 * - Código del juego (html, js, css): primero la red, así cada actualización
 *   llega al momento; si no hay conexión, la última copia guardada.
 * - Sprites, iconos y fuente: no cambian nunca, se sirven de la caché
 *   (se van guardando según se usan: no se descarga todo de golpe).
 * - Firebase y demás servicios de fuera no se tocan.
 */
const CODE = 'ps-code-v2', ART = 'ps-art-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CODE).then(c => c.addAll(['./css/style.css', './manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CODE && k !== ART).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const art = /\/assets\/(pokemon|icons|fonts)\//.test(url.pathname);
  if (art) {
    e.respondWith(caches.open(ART).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // La página y version.json no se sirven de la copia guardada: si no, el
  // juego ve una versión nueva, recarga la página vieja y lo repite.
  const fresh = req.mode === 'navigate' || /\/(index\.html|version\.json|sw\.js)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    try {
      const res = await fetch(req, fresh ? { cache: 'no-store' } : undefined);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CODE).then(c => c.put(fresh ? new Request(url.pathname) : req, copy)).catch(() => {});
        return res;
      }
    } catch (err) { /* sin red */ }
    const hit = await caches.match(req) || await caches.match(url.pathname)
      || (req.mode === 'navigate' ? await caches.match('./index.html') : null);
    return hit || Response.error();
  })());
});
