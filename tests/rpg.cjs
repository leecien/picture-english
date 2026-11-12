// Run with a local HTTP server: python -m http.server 8000
// Install dev-only runner if needed: npm install --no-save playwright
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const legacy = {
    "pm-progress": JSON.stringify({
      xp: 25,
      correct: 2,
      w: 2,
      s: 0,
      rounds: 1,
      modes: ["word"],
      badges: ["first"],
      placeDismissed: true,
    }),
    "pm-cards": JSON.stringify({ apple: { c: 2, w: 0, last: Date.now() } }),
    "pm-sents": JSON.stringify({
      "I am happy.": { c: 1, w: 0, last: Date.now() },
    }),
    "pm-best-word": "6",
    "pm-days": '["2026-11-11"]',
    "pm-log": "[]",
    "pm-sound": "false",
  };
  await page.addInitScript((values) => {
    if (!localStorage.getItem("test-seeded")) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      localStorage.setItem("test-seeded", "1");
    }
  }, legacy);
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.waitForSelector(".hero");
  assert.equal(await page.locator("[data-map]:disabled").count(), 4);
  for (const [k, v] of Object.entries(legacy))
    assert.equal(
      await page.evaluate((k) => localStorage.getItem(k), k),
      v,
      "legacy preserved " + k,
    );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no mobile overflow",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.locator(".hero").evaluate((e) => e.style.gridRow),
    "6",
    "wall collision",
  );
  for (let i = 0; i < 3; i++) await page.locator('[data-move="0,-1"]').click();
  await page.locator("#rpg-interact").click();
  assert.equal(await page.locator("[data-quest]").count(), 2);
  await page.locator('[data-quest="word"]').click();
  await page.waitForSelector("#game:not([hidden])");
  assert.equal(await page.evaluate(() => RPG.active.kind), "word");
  // Exercise every original question renderer, and record ten theme-matched answers via its shared grading path.
  for (let i = 0; i < 10; i++) {
    assert(await page.evaluate(() => !!$("stage").children.length));
    await page.evaluate(() => {
      const it = take("w");
      if (it.th !== "food") throw Error("quest theme mismatch");
      done(true, wInfo(it, [{ k: "w", it, ok: true }]));
    });
    await page.locator("#next").click();
  }
  await page.waitForSelector("#result:not([hidden])");
  assert(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pm-rpg-v1")).cleared.includes(
        "food:word",
      ),
    ),
  );
  assert(
    await page.evaluate(
      () =>
        P.badges.includes("round1") &&
        CARDS.apple.c >= 2 &&
        SENTS["I am happy."].c === 1,
    ),
  );
  await page.locator("#home-btn").click();
  assert.equal(await page.locator("[data-map]:disabled").count(), 4);
  await page.locator("#rpg-interact").click();
  await page.locator('[data-quest="sent"]').click();
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const it = take("s");
      done(true, {
        en: it.en,
        zh: it.zh,
        say: it,
        rec: [{ k: "s", it, ok: true }],
      });
    });
    await page.locator("#next").click();
  }
  await page.locator("#home-btn").click();
  assert.equal(await page.locator("[data-map]:disabled").count(), 3);
  // Reward idempotence and failed mission gating.
  const checks = await page.evaluate(() => {
    let before = P.xp;
    RPG.active = { map: 0, kind: "word" };
    S.score = 10;
    RPG.complete();
    const duplicate = P.xp === before;
    RPG.active = { map: 1, kind: "word" };
    S.score = 6;
    RPG.complete();
    return {
      duplicate,
      failed: !JSON.parse(localStorage.getItem("pm-rpg-v1")).cleared.includes(
        "animal:word",
      ),
    };
  });
  assert.deepEqual(checks, { duplicate: true, failed: true });
  // Walk to chest using touch buttons; claim once and reload.
  const walk = async (dir, n) => {
    for (let i = 0; i < n; i++)
      await page.locator(`[data-move="${dir}"]`).click();
  };
  await walk("0,1", 1);
  await walk("1,0", 3);
  await page.locator("#rpg-interact").click();
  let xp = await page.evaluate(() => P.xp);
  await page.locator("#rpg-interact").click();
  assert.equal(await page.evaluate(() => P.xp), xp);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pm-rpg-v1")).chests.length,
    ),
    1,
  );
  await page.reload();
  await page.waitForSelector(".hero");
  assert.equal(await page.locator("[data-map]:disabled").count(), 3);
  await page.locator('[data-map="1"]').click();
  assert.match(await page.locator(".rpg-heading").innerText(), /動物森林/);
  await page.locator("#tab-book").click();
  assert(await page.locator("#cards").innerText());
  await page.locator("#tab-log").click();
  assert(await page.locator("#logs").innerText());
  await page.locator("#tab-play").click();
  await page.locator("#go-word").click();
  assert.equal(await page.evaluate(() => RPG.active), null);
  await page.locator("#back").click();
  // Check all five maps and sparse beginner sentence routes; no empty question pools.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pm-rpg-v1"));
    d.cleared = ["food", "animal", "nature", "transport", "things"].flatMap(
      (id) => [id + ":word", id + ":sent"],
    );
    localStorage.setItem("pm-rpg-v1", JSON.stringify(d));
    P.xp = 0;
    saveP();
  });
  await page.reload();
  await page.waitForSelector(".hero");
  for (let map = 0; map < 5; map++) {
    await page.locator(`[data-map="${map}"]`).click();
    await page.evaluate((map) => {
      RPG.active = { map, kind: "sent" };
      for (const type of TYPES.sent) {
        S.usedS.clear();
        $("stage").innerHTML = "";
        G[type.id]($("stage"));
        clearTimeout(S.timer);
      }
      RPG.active = null;
    }, map);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "/tmp/picture-rpg-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/picture-rpg-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: legacy saves, mobile layout, movement, both quest types, cards, achievements, rewards, unlocks, reload, all maps, sparse sentence pools, normal practice, no browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
