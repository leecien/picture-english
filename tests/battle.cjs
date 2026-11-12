// Phase 2 combat regression: HP/MP bar, auto-attack, monster counter-attack, drops and pick-up,
// supply items, resting, knock-out recovery, resident trade, backpack, save/reload, sprite sheets.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const legacy = {
    "pm-progress": JSON.stringify({ xp: 25, correct: 2, w: 2, s: 0, rounds: 1, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": JSON.stringify({ apple: { c: 2, w: 0, last: 1 } }),
    "pm-log": "[]",
  };
  await page.addInitScript((values) => {
    if (!localStorage.getItem("test-seeded")) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      localStorage.setItem("test-seeded", "1");
    }
  }, legacy);
  // Serve a prepared sprite sheet through the manifest, as real art will be.
  await page.route("**/assets/manifest.json", async (route) => {
    const res = await route.fetch(),
      m = await res.json();
    m.sprites["hero-walk"].file = "tests/fixtures/hero-walk.png";
    await route.fulfill({ response: res, json: m });
  });
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.waitForSelector(".world-canvas");
  await page.locator(".rpg-stage").scrollIntoViewIfNeeded();
  const idle = () => page.waitForFunction(() => !World.hero.moving, null, { timeout: 15000 });
  const ev = (f, a) => page.evaluate(f, a);

  // Status bar is always visible with starting supplies.
  assert.equal(await page.locator("#hud-hp b").innerText(), "HP 80/80");
  assert.equal(await page.locator("#hud-mp b").innerText(), "MP 30/30");
  assert.equal(await page.locator("#hud-berry small").innerText(), "3");
  assert.equal(await page.locator("#hud-dew small").innerText(), "2");
  await page.waitForFunction(() => World.hasArt("hero-walk"));

  // Companion follows the hero.
  await ev(() => World.walkTo(12, 10));
  await idle();
  await page.waitForTimeout(500);
  assert(
    await ev(() => {
      const p = World.entities.find((e) => e.kind === "pet");
      return Math.max(Math.abs(p.tx - World.hero.x), Math.abs(p.ty - World.hero.y)) <= 2;
    }),
    "pet follows",
  );

  // Click a (held still) monster on the canvas: the hero chases and attacks it.
  const xp0 = await ev(() => P.xp);
  const mob = await ev(() => {
    const ms = World.entities.filter((e) => e.kind === "mob");
    ms.forEach((m) => (m.wait = 999));
    const m = ms.sort((a, b) => Math.hypot(a.tx - 12, a.ty - 10) - Math.hypot(b.tx - 12, b.ty - 10))[0];
    m.path = [];
    m.px = (m.tx + 0.5) * 32;
    m.py = (m.ty + 0.5) * 32;
    m.hp = m.maxHp = 999;
    m.testTarget = true;
    return [m.tx, m.ty];
  });
  await ev(([x, y]) => World.walkTo(x + 2 < 23 ? x + 2 : x - 2, y), mob).catch(() => {});
  await idle();
  const at = await ev(([x, y]) => World.tileToClient(x, y), mob);
  await page.mouse.click(at.x, at.y - 6);
  assert(await ev(() => World.hero.fighting), "click locks target");
  await page.waitForFunction(() => World.entities.some((e) => e.testTarget && e.hp < 999), null, { timeout: 8000 });
  // Struck monsters fight back.
  await page.waitForFunction(() => Battle.hp < 80, null, { timeout: 10000 });
  assert.match(await page.locator("#hud-hp b").innerText(), /^HP \d+\/80$/);
  assert.equal(await ev(() => Battle.mp), 30, "normal attack costs no MP");

  // Finish it with a guaranteed drop roll: material + berry + dew.
  await ev(() => {
    window._rnd = Math.random;
    Math.random = () => 0.05;
    World.entities.find((e) => e.testTarget).hp = 1;
  });
  await page.waitForFunction(() => World.entities.filter((e) => e.kind === "drop").length === 3, null, { timeout: 8000 });
  await ev(() => (Math.random = window._rnd));
  assert(!(await ev(() => World.hero.fighting)), "target cleared after kill");
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(400);
    await ev(() => World.approach(World.entities.find((e) => e.kind === "drop")));
    await idle();
    await page.waitForTimeout(100);
  }
  assert.equal(await ev(() => World.entities.filter((e) => e.kind === "drop").length), 0, "all picked up");
  assert.deepEqual(await ev(() => [Battle.count("berry"), Battle.count("dew"), Battle.count("frosting")]), [4, 3, 1]);
  assert.equal(await ev(() => P.xp), xp0, "fighting never adds learning XP");
  assert.equal(await ev(() => localStorage.getItem("pm-log")), "[]", "fighting never writes pm-log");

  // Supply item via keyboard.
  await ev(() => Battle.hurt(30));
  const hpLow = await ev(() => Battle.hp);
  await page.locator(".world-canvas").focus();
  await page.keyboard.press("1");
  assert.equal(await ev(() => Battle.hp), Math.min(80, hpLow + 35));
  assert.equal(await ev(() => Battle.count("berry")), 3);

  // Knock-out: revive at the entrance with half HP/MP; nothing learned is lost.
  await ev(() => Battle.hurt(999));
  assert(await ev(() => World.hero.down));
  await page.waitForFunction(() => !World.hero.down, null, { timeout: 5000 });
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y, Battle.hp]), [16, 8, 40]);
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-cards")).apple.c), 2);

  // Rest: sitting recovers faster; moving stands up.
  await page.locator(".world-canvas").focus();
  await page.keyboard.press("r");
  assert(await ev(() => World.hero.sit));
  assert.equal(await page.locator("#hud-sit").getAttribute("aria-pressed"), "true");
  const hpSit = await ev(() => Battle.hp);
  await ev(() => Battle.tick(2.1, false));
  assert((await ev(() => Battle.hp)) > hpSit, "sitting regenerates");
  await ev(() => World.walkTo(16, 10));
  assert(!(await ev(() => World.hero.sit)), "moving stands up");
  await idle();

  // Trade three materials for a supply item at the resident.
  await ev(() => {
    Battle.pick("frosting");
    Battle.pick("shell");
  });
  await page.locator("#rpg-interact").click();
  await page.waitForSelector("[data-trade]", { timeout: 15000 });
  const berries = await ev(() => Battle.count("berry"));
  await page.locator('[data-trade="berry"]').click();
  assert.equal(await ev(() => Battle.count("berry")), berries + 1);
  assert.equal(await ev(() => Battle.count("frosting") + Battle.count("shell")), 0);
  assert(await page.locator('[data-trade="berry"]').isDisabled());
  await page.locator("#npc-close").click();

  // Backpack pauses the field (monsters freeze).
  await page.locator("#hud-bag").click();
  await page.waitForSelector(".bag");
  const before = await ev(() => World.entities.filter((e) => e.kind === "mob").map((e) => [e.px, e.py]));
  await ev(() => World.entities.forEach((e) => e.kind === "mob" && (e.wait = 0)));
  await page.waitForTimeout(900);
  assert.deepEqual(await ev(() => World.entities.filter((e) => e.kind === "mob").map((e) => [e.px, e.py])), before);
  await page.locator('[data-use="dew"]').click();
  await page.locator("#bag-close").click();
  assert(!(await ev(() => World.paused)));

  // Everything persists across reload; legacy keys keep their shape.
  await page.waitForTimeout(600);
  const saved = await ev(() => ({ hp: Battle.hp, mp: Battle.mp, berry: Battle.count("berry") }));
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await ev(() => ({ hp: Battle.hp, mp: Battle.mp, berry: Battle.count("berry") })), saved);
  const rpg = await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")));
  assert.equal(rpg.version, 1);
  assert(rpg.hero.kills >= 1 && rpg.hero.downs === 1);
  assert.equal(await ev(() => localStorage.getItem("pm-progress")), legacy["pm-progress"]);

  // Every map builds monsters with the per-map strength table.
  await ev(() => {
    const d = JSON.parse(localStorage.getItem("pm-rpg-v1"));
    d.cleared = ["food", "animal", "nature", "transport", "things"].flatMap((id) => [id + ":word", id + ":sent"]);
    localStorage.setItem("pm-rpg-v1", JSON.stringify(d));
  });
  await page.reload();
  await page.waitForSelector(".world-canvas");
  for (let map = 0; map < 5; map++) {
    await page.locator(`[data-map="${map}"]`).click();
    const m = await ev(() => World.entities.find((e) => e.kind === "mob"));
    assert.equal(m.maxHp, [30, 44, 60, 78, 96][map]);
    assert.equal(m.look.aggressive, map >= 2);
  }
  assert(await ev(() => document.documentElement.scrollWidth <= innerWidth), "no mobile overflow");
  await page.locator(".rpg-stage").screenshot({ path: "/tmp/picture-battle-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: status bar, pet follow, click-to-attack, counter-attack, no-MP normal attack, drops and pick-up, supply items, knock-out recovery, resting, trade, backpack pause, save/reload, per-map monsters, sprite sheet loading, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
