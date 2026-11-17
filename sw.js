/* 轻量离线缓存：页面骨架 + 数据 + 立绘。数据用 stale-while-revalidate，保证能看到更新。 */
const V = "bdx-v10";
const SHELL = ["./", "index.html", "assets/style.css", "assets/app.js", "manifest.webmanifest"];
const DATA = ["data/bands.json", "data/songs.json", "data/playlists.json", "data/changelog.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // meta.json 永不缓存，确保页面能发现数据更新
  if (url.pathname.endsWith("/data/meta.json")) return;

  e.respondWith((async () => {
    const cache = await caches.open(V);
    const cached = await cache.match(req);
    if (cached) {
      // 后台更新
      fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()) }).catch(() => { });
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res.ok && (DATA.some(d => url.pathname.endsWith(d)) || url.pathname.includes("/images/"))) {
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return cached || new Response("离线且未缓存", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  })());
});
