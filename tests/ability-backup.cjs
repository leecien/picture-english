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
  // a different log afterwards, then restore the backup
  await ev(() => {
    localStorage.removeItem("pm-ability-v1");
    localStorage.setItem("pm-ability-v1", JSON.stringify({ v: 2, events: [] }));
  });
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
  assert.deepEqual(await ev(() => Ability.events.map((e) => e.id)), mine, "nothing was changed by the refused backup");
  assert.deepEqual(errors, []);
  console.log("PASS: pm-ability-v1 is backed up, previewed, restored (events identical after reload); a malformed ability log is refused before writing");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
