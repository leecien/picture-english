// Run with a local HTTP server: python -m http.server 8000
// Install dev-only runner if needed: npm install --no-save playwright
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
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
    // PR #1 grid-era RPG save: its fields must keep their meaning.
    "pm-rpg-v1": JSON.stringify({
      version: 1,
      map: 0,
      positions: { food: { x: 4, y: 3 } },
      cleared: [],
      chests: [],
    }),
  };
  await page.addInitScript((values) => {
    if (!localStorage.getItem("test-seeded")) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      localStorage.setItem("test-seeded", "1");
    }
  }, legacy);
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.waitForSelector(".world-canvas");
  const idle = () =>
    page.waitForFunction(() => World.hero && !World.hero.moving, null, {
      timeout: 15000,
    });
  const hero = () => page.evaluate(() => World.hero);
  // Click a tile on the canvas like a player would (it must be on screen).
  const tapTile = async (x, y) => {
    await page.locator(".rpg-stage").scrollIntoViewIfNeeded();
    const p = await page.evaluate(([x, y]) => {
      const c = World.tileToClient(x, y),
        r = World.canvas.getBoundingClientRect();
      return c.x > r.left && c.x < r.right && c.y > r.top && c.y < r.bottom
        ? c
        : null;
    }, [x, y]);
    assert(p, `tile ${x},${y} visible`);
    await page.mouse.click(p.x, p.y);
  };
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
  // Fresh scene start; tapping a bush is refused (collision), tapping grass walks there.
  assert.deepEqual(
    [(await hero()).x, (await hero()).y, (await hero()).moving],
    [16, 8, false],
  );
  await tapTile(15, 6);
  await page.waitForTimeout(400);
  assert.deepEqual(
    [(await hero()).x, (await hero()).y],
    [16, 8],
    "bush collision",
  );
  await tapTile(14, 10);
  await idle();
  assert.deepEqual([(await hero()).x, (await hero()).y], [14, 10], "click to walk");
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).world.food),
    { x: 14, y: 10 },
  );
  // Keyboard still works.
  await page.locator(".world-canvas").focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowRight");
  await idle();
  assert((await hero()).x > 14, "keyboard step");
  // Monsters roam on the map; tapping one locks it as the auto-attack target.
  const mobs = await page.evaluate(() =>
    World.entities.filter((e) => e.kind === "mob").map((e) => [e.tx, e.ty]),
  );
  assert.equal(mobs.length, 6, "food map monsters");
  await page.evaluate(() => {
    const m = World.entities.find((e) => e.kind === "mob");
    World.approach(m);
  });
  assert.match(await page.locator(".rpg-status").innerText(), /鎖定/);
  // Interact button auto-walks to the resident, then the dialog opens and the scene pauses.
  await page.locator("#rpg-interact").click();
  await page.waitForSelector("[data-quest]", { timeout: 15000 });
  assert.equal(await page.locator("[data-quest]").count(), 2);
  assert(await page.evaluate(() => World.paused));
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
  // Walk next to the chest, then tap it on the canvas; claim once and reload.
  await page.evaluate(() => World.walkTo(20, 8));
  await idle();
  await tapTile(21, 7);
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("pm-rpg-v1")).chests.length === 1,
  );
  let xp = await page.evaluate(() => P.xp);
  await page.locator("#rpg-interact").click();
  assert.equal(await page.evaluate(() => P.xp), xp, "chest claimed once");
  assert(
    await page.evaluate(() => World.entities.find((e) => e.kind === "chest").open),
  );
  const before = await hero();
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(
    [(await hero()).x, (await hero()).y],
    [before.x, before.y],
    "position restored",
  );
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).positions),
    { food: { x: 4, y: 3 } },
    "grid-era positions untouched",
  );
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
  // Clear home entry to the commute mode.
  await page.locator("#quick-drive").click();
  await page.waitForSelector("#drive:not([hidden])");
  await page.locator("#drive-back").click();
  await page.waitForSelector("#home:not([hidden])");
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
  await page.waitForSelector(".world-canvas");
  for (let map = 0; map < 5; map++) {
    await page.locator(`[data-map="${map}"]`).click();
    assert(
      await page.evaluate(
        (map) =>
          World.entities.some((e) => e.kind === "npc") &&
          World.entities.filter((e) => e.kind === "mob").length >= 4 &&
          RPG.maps[map].layout.every((r) => r.length === 24),
        map,
      ),
      "map " + map + " populated",
    );
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
    "PASS: legacy saves, mobile layout, click-to-walk, collision, keyboard, roaming monsters, auto-approach NPC, chest tap, both quest types, cards, achievements, rewards, unlocks, reload, all maps, sparse sentence pools, normal practice, no browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
