/* Bump VERSION on every deployed shell change. No microphone, analytics or audio caching here. */
const VERSION = "20261117-vocabulary3000";
const BASE = new URL("./", self.location.href);
const PREFIX = "picture-english-app-" + encodeURIComponent(BASE.pathname) + "-";
const SHELL = PREFIX + VERSION + "-shell", MEDIA = PREFIX + VERSION + "-images";
const CORE = ["index.html", "shell.css", "rpg.css", "world.js", "battle.js", "learn.js", "novice.js", "lifescene.js", "pron.js", "rpg.js", "speech.js", "platform.js", "manifest.webmanifest", "offline.html", "assets/app/icon.svg", "data/words.json", "data/sentences.json", "data/levels.json", "data/themes.json", "data/scenes.json", "assets/manifest.json", "modules/audio-practice/audio-practice.js", "audio-bus.js", "audio-session.js", "audio-session.css", "world-regions.js"];
const OPTIONAL = ["atlas.js", "atlas.css", "data/worlds.json", "data/life-scenes.json", "data/dict-draft.json", "data/world-regions.json", "modules/audio-practice/processed-audio/normalize-plan.json"];
const MAX_IMAGES = 12, MAX_IMAGE_BYTES = 512 * 1024;
CORE.push("vocab.js", "vocab.css");
OPTIONAL.push("data/vocab-reviewed.json");
const coreURLs = new Set([...CORE, ...OPTIONAL].map((p) => new URL(p, BASE).href));
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(CORE.map(async (p) => {
      const url = new URL(p, BASE).href, response = await fetch(url, { cache: "reload" });
      if (!response.ok || response.type === "opaque") throw new Error("Required shell not available: " + p);
      await cache.put(url, response);
    }));
    await Promise.all(OPTIONAL.map(async (p) => {
      try { const url = new URL(p, BASE).href, r = await fetch(url, { cache: "reload" }); if (r.ok && r.type !== "opaque") await cache.put(url, r); } catch (_) {}
    }));
    // First install activates normally; an update waits for an explicit action from Platform.
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== MEDIA).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => { if (event.data && event.data.type === "ACTIVATE_UPDATE") self.skipWaiting(); });
async function limitedImage(request, response) {
  const type = response.headers.get("content-type") || "", length = Number(response.headers.get("content-length"));
  if (!response.ok || response.type === "opaque" || !type.startsWith("image/") || length > MAX_IMAGE_BYTES) return;
  if (!length && (await response.clone().blob()).size > MAX_IMAGE_BYTES) return;
  const cache = await caches.open(MEDIA);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((key) => cache.delete(key)));
}
self.addEventListener("fetch", (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname) || url.search) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL), cached = await cache.match(new URL("index.html", BASE).href);
      if (cached && (url.pathname === BASE.pathname || url.pathname === new URL("index.html", BASE).pathname)) return cached;
      try { return await fetch(request); } catch (_) { return (await cache.match(new URL("offline.html", BASE).href)) || Response.error(); }
    })()); return;
  }
  if (coreURLs.has(url.href)) {
    event.respondWith((async () => { const cache = await caches.open(SHELL); return (await cache.match(url.href)) || fetch(request); })()); return;
  }
  if (/\.(?:webp|png|svg|jpg|jpeg)$/.test(url.pathname) && /\/assets\/(?:scenes\/life|sprites|app)\//.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA), old = await cache.match(request);
      try { const response = await fetch(request); try { await limitedImage(request, response.clone()); } catch (_) {} return response; }
      catch (_) { return old || Response.error(); }
    })());
  }
});
