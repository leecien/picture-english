// Field battles in a row must not keep asking the same sentences (reported on a phone: three monsters, the same
// meeting lines again and again). Region field fights ask questionRefs[(turn - 1) % n] and restart at turn 1 for
// every monster; Learn.sceneQuestion now rotates a recently asked line to the least recently asked line of the
// same scene (ctx "…:field" or opt.rotate), and wrong options rotate too (a small scene borrows from its category's
// other scenes, only where the Chinese defines the one answer). Ordered story questions keep their exact line.
// Run with a local HTTP server: python -m http.server 8000
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
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Learn.scene("school", "group"));
  const run = await page.evaluate(() => {
    // three monsters, four turns each, refs 0..4 of school/group as the region quest does ("meaning" mode)
    const out = [];
    for (let fight = 0; fight < 3; fight++)
      for (let turn = 1; turn <= 4; turn++) {
        const q = Learn.sceneQuestion("school", "group", (turn - 1) % 5, { mode: "meaning", ctx: "region:test:field" });
        Learn.track(q);
        out.push({ target: q.item.en, opts: q.options.map((o) => o.html.replace(/&#39;/g, "'")), oks: q.options.filter((o) => o.ok).length });
      }
    return out;
  });
  const size = await page.evaluate(() => Learn.scene("school", "group").items.length);
  const targets = run.map((r) => r.target);
  assert.equal(new Set(targets.slice(0, size)).size, size, `the first ${size} questions are all different lines`);
  for (let i = 0; i + size <= targets.length; i++) assert.equal(new Set(targets.slice(i, i + size)).size, size, "no line again before the scene has gone round");
  assert(run.every((r) => r.oks === 1 && new Set(r.opts).size === r.opts.length), "one right option, no duplicate options");
  // wrong options rotate: no single wrong line in more than 3 of the 12 questions, many different ones overall
  const wrongs = run.flatMap((r) => r.opts.filter((o) => o !== r.target));
  const freq = Object.values(wrongs.reduce((m, o) => ((m[o] = (m[o] || 0) + 1), m), {}));
  assert(Math.max(...freq) <= 3, `a wrong option repeats at most 3 times in 12 questions (max ${Math.max(...freq)})`);
  assert(new Set(wrongs).size >= 12, `many different wrong options (${new Set(wrongs).size})`);

  // ordered story questions keep their exact line, even if it was just asked
  const story = await page.evaluate(() => {
    const a = Learn.sceneQuestion("travel", "customs", 2, { mode: "listen", ctx: "story:customs" });
    Learn.track(a);
    const b = Learn.sceneQuestion("travel", "customs", 2, { mode: "listen", ctx: "story:customs" });
    return [a.item.en, b.item.en];
  });
  assert.equal(story[0], story[1], "story order unchanged");
  // replying to a heard line: wrong options only from the same scene (another scene's reply could also fit)
  const listen = await page.evaluate(() => {
    const items = Learn.scene("travel", "hotel").items.map((x) => x.en);
    const r = [];
    for (let k = 0; k < 6; k++) {
      const q = Learn.sceneQuestion("travel", "hotel", k, { mode: "listen", ctx: "region:t:field" });
      Learn.track(q);
      if (q.item.q) r.push(q.options.every((o) => items.includes(o.html.replace(/&#39;/g, "'")))); // only a heard line
    }
    return r;
  });
  assert(listen.length && listen.every(Boolean), "listen mode: options stay in the scene");
  assert.deepEqual(errors, []);
  console.log(`PASS: 3 field fights × 4 turns: no line again before the scene (${size} lines) has gone round, wrong options rotate (max ${Math.max(...freq)}× in 12, ${new Set(wrongs).size} different), one right option each, story order unchanged, heard-line replies keep same-scene options`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
