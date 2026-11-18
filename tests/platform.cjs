/* App foundation contracts: real legacy strings, malformed imports, atomic rollback,
   deployment guards and scoped/bounded worker caches. Optional UI run: TEST_URL=... */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const Platform = require("../platform.js");

class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); this.writes = []; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.writes.push(k); this.data.set(k, String(v)); }
  removeItem(k) { this.writes.push(k); this.data.delete(k); }
}
const raw = (s) => Object.fromEntries(s.data);
const source = new MemoryStorage({
  "pm-progress": '{ "xp":120, "correct":3, "rounds":2, "badges":["first"], "modes":["word"] }',
  "pm-cards": '{"cat":{"c":2,"w":0,"t":1234}}',
  "pm-rpg-v1": '{"version":1,"at":"kk","nv":{"taught":["k","æ","t"],"n01":true},"companion":{"claimed":true,"bond":4}}',
  "pm-best-word": "135", "pm-sound": "false", "pm-days": '["2026-11-16"]',
  "unrelated-credential": "must-not-export",
});
const backup = Platform.backup(source), text = JSON.stringify(backup);
assert.equal(Object.keys(backup.entries).length, 6);
assert(!text.includes("must-not-export"));
assert.equal(backup.entries["pm-progress"], source.getItem("pm-progress"), "raw whitespace and values survive export");
const target = new MemoryStorage({ "pm-progress": '{"xp":9}', "pm-log": "[]", "other-app": "keep-me" });
const preview = Platform.previewImport(text, target);
assert.deepEqual(preview.remove, ["pm-log"]);
assert.deepEqual(preview.replace, ["pm-progress"]);
assert.equal(target.getItem("pm-progress"), '{"xp":9}', "preview must not change progress");
assert.throws(() => Platform.restore(text, { storage: target }), /確認/);
assert.equal(target.getItem("pm-progress"), '{"xp":9}');
const result = Platform.restore(text, { confirmed: true, storage: target });
assert.equal(result.restored, 6);
assert.equal(result.reloadRequired, true);
assert.equal(target.getItem("pm-rpg-v1"), source.getItem("pm-rpg-v1"));
assert.equal(target.getItem("pm-progress"), source.getItem("pm-progress"));
assert.equal(target.getItem("pm-log"), null, "confirmed restore replaces the game snapshot");
assert.equal(target.getItem("other-app"), "keep-me");
assert(target.writes.every((k) => Platform.saveKeys.includes(k)), "never touch another app's keys");

const invalid = [
  "not json", JSON.stringify({ ...backup, application: "other-app" }),
  JSON.stringify({ ...backup, schemaVersion: 99 }),
  JSON.stringify({ ...backup, entries: {} }),
  JSON.stringify({ ...backup, entries: { "pm-anything": "{}" } }),
  JSON.stringify({ ...backup, entries: { "pm-progress": "[]" } }),
  JSON.stringify({ ...backup, entries: { "pm-progress": '{"xp":-2}' } }),
  JSON.stringify({ ...backup, entries: { "pm-progress": '{"xp":1e999}' } }),
  JSON.stringify({ ...backup, entries: { "pm-sound": '"false"' } }),
  JSON.stringify({ ...backup, entries: { "pm-best-word": '"135"' } }),
  JSON.stringify({ ...backup, entries: { "pm-rpg-v1": '{"version":2}' } }),
  JSON.stringify({ ...backup, entries: { "pm-cards": '{"__proto__":{"polluted":true}}' } }),
  JSON.stringify({ ...backup, entries: { "pm-days": '["not-a-date"]' } }),
  JSON.stringify({ ...backup, entries: { "pm-log": '["not-an-object"]' } }),
  JSON.stringify({ ...backup, entries: { "pm-cards": JSON.stringify({ x: "a".repeat(2 * 1024 * 1024) }) } }),
];
for (const bad of invalid) {
  const old = raw(target), count = target.writes.length;
  assert.throws(() => Platform.restore(bad, { confirmed: true, storage: target }));
  assert.deepEqual(raw(target), old);
  assert.equal(target.writes.length, count, "validate every field before changing anything");
}
assert.throws(() => Platform.previewImport(" ".repeat(Platform.maxBackupBytes + 1), target), /4 MB/);
class QuotaStorage extends MemoryStorage {
  constructor(entries) { super(entries); this.calls = 0; }
  setItem(k, v) { if (++this.calls === 2) throw new Error("quota"); super.setItem(k, v); }
}
const quota = new QuotaStorage({ "pm-progress": '{"xp":77}', "pm-cards": '{"dog":{"c":4}}', "foreign": "safe" });
const old = raw(quota);
assert.throws(() => Platform.restore(text, { confirmed: true, storage: quota }), /已回復原存檔/);
assert.deepEqual(raw(quota), old, "a mid-write failure rolls back exact old strings");
assert.equal(Object.prototype.polluted, undefined);

for (const url of ["https://raw.githack.com/leecien/picture-english/abc/index.html", "https://rawcdn.githack.com/x/", "https://claude.ai/artifact/test", "https://another.github.io/picture-english/", "https://leecien.github.io/other/", "file:///tmp/index.html", "capacitor://localhost/index.html"]) assert.equal(Platform.trustedDeployment(new URL(url)), false, url);
for (const url of ["http://localhost:8123/", "http://127.0.0.1:8123/game/", "https://leecien.github.io/picture-english/index.html"]) assert.equal(Platform.trustedDeployment(new URL(url)), true, url);

function browserAPI(url, extra = {}) {
  let registered = 0;
  const fake = { location: new URL(url), isSecureContext: true, navigator: { serviceWorker: { register() { registered++; return Promise.resolve({ active: {}, addEventListener() {} }); } } }, addEventListener() {}, ...extra };
  const document = { currentScript: { src: new URL("platform.js", url).href }, baseURI: url };
  fake.document = document;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../platform.js"), "utf8"), { window: fake, URL, TextEncoder, Promise, Date, Set, Map, setTimeout });
  return { api: fake.Platform, registrations: () => registered };
}

class Cache {
  constructor() { this.items = new Map(); }
  key(k) { return typeof k === "string" ? k : k.url; }
  async put(k, r) { this.items.set(this.key(k), r.clone()); }
  async match(k) { const r = this.items.get(this.key(k)); return r && r.clone(); }
  async keys() { return [...this.items.keys()].map((url) => ({ url })); }
  async delete(k) { return this.items.delete(this.key(k)); }
}
async function workerContracts() {
  const callbacks = {}, cacheMap = new Map(), calls = [], origin = "https://leecien.github.io/picture-english/";
  let offline = false, skips = 0;
  const caches = { async open(k) { if (!cacheMap.has(k)) cacheMap.set(k, new Cache()); return cacheMap.get(k); }, async keys() { return [...cacheMap.keys()]; }, async delete(k) { return cacheMap.delete(k); } };
  cacheMap.set("some-other-app", new Cache());
  cacheMap.set("picture-english-app-%2Felsewhere%2F-old-shell", new Cache());
  cacheMap.set("picture-english-app-%2Fpicture-english%2F-old-shell", new Cache());
  const context = { self: { location: { href: origin + "service-worker.js" }, addEventListener(k, f) { callbacks[k] = f; }, clients: { async claim() {} }, skipWaiting() { skips++; } }, caches, URL, Response, fetch: async (request) => {
    const url = typeof request === "string" ? request : request.url; calls.push(url);
    if (offline) throw new Error("offline");
    if (/atlas\.(js|css)|worlds\.json/.test(url)) return new Response("missing optional", { status: 404 });
    const image = /\.png$/.test(url);
    return new Response("cached:" + new URL(url).pathname, { headers: { "content-type": image ? "image/png" : "text/plain" } });
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8"), context);
  let install;
  callbacks.install({ waitUntil(p) { install = p; } }); await install;
  assert.equal(skips, 0, "a worker update cannot activate without a user action");
  let activated; callbacks.activate({ waitUntil(p) { activated = p; } }); await activated;
  assert(cacheMap.has("some-other-app"));
  assert(cacheMap.has("picture-english-app-%2Felsewhere%2F-old-shell"));
  assert(!cacheMap.has("picture-english-app-%2Fpicture-english%2F-old-shell"));
  async function request(pathname, mode = "cors", method = "GET") {
    let response;
    callbacks.fetch({ request: { url: pathname.startsWith("https:") ? pathname : origin + pathname, method, mode }, respondWith(p) { response = p; } });
    return response ? await response : null;
  }
  offline = true;
  const nav = await request("", "navigate"); assert.match(await nav.text(), /cached:.*index\.html/);
  const js = await request("platform.js"); assert.match(await js.text(), /platform\.js/);
  assert.equal(await request("assets/voice/words/cat.mp3"), null, "never cache or intercept all pronunciation files");
  assert.equal(await request("https://third-party.example/private.png"), null);
  assert.equal(await request("assets/scenes/life/private.png?token=123"), null);
  assert.equal(await request("index.html", "cors", "POST"), null);
  offline = false;
  for (let i = 0; i < 20; i++) assert((await request("assets/scenes/life/" + i + ".png")).ok);
  const images = [...cacheMap.entries()].find(([k]) => k.endsWith("-images"))[1];
  assert.equal((await images.keys()).length, 12, "visited image cache is bounded");
  callbacks.message({ data: { type: "ACTIVATE_UPDATE" } }); assert.equal(skips, 1);
}

async function uiContracts() {
  if (!process.env.TEST_URL) return;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 760 }, acceptDownloads: true });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { if (!localStorage.getItem("platform-seed")) { localStorage.setItem("platform-seed", "1"); localStorage.setItem("pm-progress", JSON.stringify({ xp: 90, rounds: 1, badges: [], modes: [] })); localStorage.setItem("foreign-site-key", "keep"); } });
  await page.goto(process.env.TEST_URL); await page.waitForSelector(".world-canvas");
  if (!(await page.evaluate(() => typeof Platform !== "undefined"))) await page.addScriptTag({ path: path.join(__dirname, "../platform.js") });
  await page.evaluate(() => { window.__pfClosed = 0; Platform.open({ onClose: () => __pfClosed++ }); });
  assert.equal(await page.evaluate(() => Platform.isOpen), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => Platform.isOpen), false);
  assert.equal(await page.evaluate(() => __pfClosed), 1);
  await page.evaluate(() => Platform.open());
  const downloadEvent = page.waitForEvent("download"); await page.locator("#pf-export").click();
  const download = await downloadEvent, exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(JSON.parse(exported.entries["pm-progress"]).xp, 90);
  assert(!Object.prototype.hasOwnProperty.call(exported.entries, "foreign-site-key"));
  const bad = JSON.stringify({ ...exported, entries: { "other-app": "{}" } });
  await page.locator("#pf-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(bad) });
  await page.waitForFunction(() => document.getElementById("pf-preview").textContent.includes("不屬於"));
  assert(await page.locator("#pf-confirm").isDisabled());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pm-progress")).xp), 90);
  const good = JSON.stringify({ ...exported, entries: { ...exported.entries, "pm-progress": '{"xp":777,"badges":[],"modes":[]}' } });
  await page.locator("#pf-file").setInputFiles({ name: "good.json", mimeType: "application/json", buffer: Buffer.from(good) });
  await page.waitForFunction(() => !document.getElementById("pf-confirm").disabled);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pm-progress")).xp), 90, "file selection does not restore");
  await Promise.all([page.waitForEvent("load"), page.locator("#pf-confirm").click()]);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pm-progress")).xp), 777);
  assert.equal(await page.evaluate(() => localStorage.getItem("foreign-site-key")), "keep");
  if (!(await page.evaluate(() => typeof Platform !== "undefined"))) await page.addScriptTag({ path: path.join(__dirname, "../platform.js") });
  await page.evaluate(() => Platform.init());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".world-canvas");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pm-progress")).xp), 777, "offline navigation retains the game save");
  await page.context().setOffline(false);
  assert.deepEqual(errors, []);
  await browser.close();
}

(async () => {
  for (const url of ["https://raw.githack.com/a/b/index.html", "https://claude.ai/artifact/x", "file:///app/index.html"]) { const x = browserAPI(url); await x.api.init(); assert.equal(x.registrations(), 0, url); }
  const web = browserAPI("https://leecien.github.io/picture-english/index.html"); await web.api.init(); assert.equal(web.registrations(), 1);
  assert.equal((await web.api.startRecording()).status, "unsupported");
  const native = browserAPI("https://localhost/index.html", { Capacitor: { isNativePlatform: () => true } }); await native.api.init(); assert.equal(native.registrations(), 0);
  let played, stopped = 0;
  Platform.setAudioProvider({ play(o) { played = o.text; return { status: "ended" }; }, stop() { stopped++; } });
  assert.equal((await Platform.play({ text: "cat" })).status, "ended"); assert.equal(played, "cat");
  Platform.setAudioProvider(null); assert.equal(stopped, 1);
  assert.equal(Platform.stopAudio().status, "unsupported", "do not pretend legacy Pron exposes cancellation when it does not");
  await workerContracts(); await uiContracts();
  console.log("PASS: legacy raw save round-trip, explicit preview/confirm, malformed/oversized/foreign/prototype payload rejection before writes, quota rollback, other keys untouched, deployment/native guards, audio delegation, relative worker shell offline, optional atlas failure tolerated, scoped cleanup, bounded images and explicit updates" + (process.env.TEST_URL ? ", 390px download/invalid file/preview/restore/reload UI and real worker offline map reload" : ""));
})().catch((e) => { console.error(e); process.exit(1); });
