// pm-ability-v1 in the app backup (platform.js, integration branch): exported, previewed, restored after a reload,
// malformed ability data refused before anything is written. Skips (and says so) where platform.js is absent.
// Run with a local HTTP server on a build that has platform.js: TEST_URL=http://127.0.0.1:8013 node tests/ability-backup.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 760 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("pm-progress", JSON.stringify({ xp: 40, correct: 3, w: 3, s: 0, rounds: 1, modes: ["word"], badges: [], placeDismissed: true })));
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  if (!(await page.evaluate(() => typeof Platform !== "undefined" && Platform.saveKeys))) {
    console.log("SKIP: no platform.js in this build (backup lives on the integration branch)");
    return browser.close();
  }
  await page.waitForFunction(() => Ability.data);
  const ev = (f, a) => page.evaluate(f, a);
  assert(await ev(() => Platform.saveKeys.includes("pm-ability-v1")), "pm-ability-v1 is a backed-up key");
  const mine = await ev(() => {
    const items = Ability.data.grammarItems.slice(0, 3);
    items.forEach((g, i) => Ability.log(Ability.grammarQuestion(g), { result: i ? "correct" : "wrong", ms: 2000 }));
    return Ability.events.map((e) => e.id);
  });
  const text = await ev(() => JSON.stringify(Platform.backup()));
  const preview = await ev((t) => Platform.previewImport(t), text);
  assert(preview.keys.includes("pm-ability-v1"), "the preview lists the ability log");
  // a newer device log afterwards: 2 events the backup does not have, 1 event changed (same id)
  await ev(() => {
    const st = JSON.parse(localStorage.getItem("pm-ability-v1"));
    st.events[1] = { ...st.events[1], result: "wrong" };
    st.events.push({ ...st.events[0], id: "t-new-1", at: Date.now() }, { ...st.events[0], id: "t-new-2", at: Date.now() + 1 });
    localStorage.setItem("pm-ability-v1", JSON.stringify(st));
  });
  const pv = await ev((t) => Platform.previewImport(t), text);
  assert.deepEqual(pv.ability, { device: 5, backup: 3, result: 3, lost: 2, changed: 1, inBackup: true }, "the preview counts lost and overwritten device events");
  // the preview the player sees says so before anything is written
  await ev(() => Platform.open({ onClose() {} }));
  await page.setInputFiles("#pf-file", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await page.waitForFunction(() => /能力紀錄/.test(document.getElementById("pf-preview").textContent));
  const shown = await ev(() => document.getElementById("pf-preview").textContent);
  assert.match(shown, /目前裝置 5 筆 → 還原後 3 筆/);
  assert.match(shown, /2 筆不在備份裡，還原後會消失/);
  assert.match(shown, /1 筆同一次作答的內容不同，會改成備份的版本/);
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-ability-v1")).events.length), 5, "previewing writes nothing");
  await ev(() => Platform.close());
  // quota: the browser refuses one write in the middle → every key back as it was
  const snap = () => ev(() => Object.fromEntries(Platform.saveKeys.filter((k) => localStorage.getItem(k) != null).map((k) => [k, localStorage.getItem(k)])));
  const beforeQuota = await snap();
  const quotaMsg = await ev((t) => {
    const orig = Storage.prototype.setItem;
    let once = true; // the backup's ability log does not fit; after the rollback frees space the old one does
    Storage.prototype.setItem = function (k, v) {
      if (k === "pm-ability-v1" && once) (once = false), (() => { throw new DOMException("quota", "QuotaExceededError"); })();
      return orig.call(this, k, v);
    };
    try {
      Platform.restore(t, { confirmed: true });
      return "";
    } catch (e) {
      return e.message;
    } finally {
      Storage.prototype.setItem = orig;
    }
  }, text);
  assert.match(quotaMsg, /已回復原存檔/, "a quota failure is reported");
  assert.deepEqual(await snap(), beforeQuota, "a quota failure leaves every saved key exactly as before (atomic)");
  const done = await ev((t) => Platform.restore(t, { confirmed: true }), text);
  assert(done.restored >= 2 && done.reloadRequired);
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Ability.data);
  assert.deepEqual(await ev(() => Ability.events.map((e) => e.id)), mine, "the ability events are back after restore + reload");
  // malformed ability data is refused before anything is written
  const bad = JSON.parse(text);
  bad.entries["pm-ability-v1"] = JSON.stringify({ v: 2, events: [{ item: "g:x", qtype: "grammar:form-choice", at: 1 }] });
  const refused = await ev((t) => {
    try {
      Platform.previewImport(t);
      return "";
    } catch (e) {
      return e.message;
    }
  }, JSON.stringify(bad));
  assert.match(refused, /能力紀錄/, "a malformed ability log is refused");
  // duplicate event ids: refused by the learning-profile module's validateStore (same rules both sides)
  const dup = JSON.parse(text), dupSt = JSON.parse(dup.entries["pm-ability-v1"]);
  dupSt.events.push({ ...dupSt.events[0] });
  dup.entries["pm-ability-v1"] = JSON.stringify(dupSt);
  const refusedDup = await ev((t) => {
    try {
      Platform.restore(t, { confirmed: true });
      return "";
    } catch (e) {
      return e.message;
    }
  }, JSON.stringify(dup));
  assert.match(refusedDup, /duplicate id/, "duplicate event ids are refused");
  assert.deepEqual(await ev(() => Ability.events.map((e) => e.id)), mine, "nothing was changed by the refused backup");
  assert.deepEqual(errors, []);
  console.log("PASS: pm-ability-v1 is backed up; the 整份還原 preview counts device events lost (2) and overwritten (1) and the player sees it before confirming; a quota failure mid-restore puts every key back (atomic); restored events identical after reload; malformed and duplicate-id logs refused before writing");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
