// Save compatibility and legacy maps in the full-screen shell: PR #1 saves keep their meaning, returning players
// land on their map and can visit the KK village, legacy quests run inside the dialog and write the shared records,
// unlocks, chest, world map, learning panel round trip, original practice modes, click-to-walk, reload.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const legacy = {
    "pm-progress": JSON.stringify({ xp: 25, correct: 2, w: 2, s: 0, rounds: 1, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": JSON.stringify({ apple: { c: 2, w: 0, last: Date.now() } }),
    "pm-sents": JSON.stringify({ "I am happy.": { c: 1, w: 0, last: Date.now() } }),
    "pm-best-word": "6",
    "pm-days": '["2026-11-11"]',
    "pm-log": "[]",
    "pm-sound": "false",
    // PR #1 grid-era RPG save: its fields must keep their meaning.
    "pm-rpg-v1": JSON.stringify({ version: 1, map: 0, positions: { food: { x: 4, y: 3 } }, cleared: [], chests: [] }),
  };
  await page.addInitScript((values) => {
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.dispatchEvent(new Event("ended")), 5);
      return Promise.resolve();
    };
    if (window.speechSynthesis) speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5);
    if (!localStorage.getItem("test-seeded")) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      localStorage.setItem("test-seeded", "1");
    }
  }, legacy);
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  const hero = () => ev(() => World.hero);
  for (const [k, v] of Object.entries(legacy)) if (k !== "pm-rpg-v1") assert.equal(await ev((k) => localStorage.getItem(k), k), v, "legacy preserved " + k);

  // Returning player: lands on the legacy map, in the full-screen game.
  assert.equal(await ev(() => RPG.data.at), "food");
  assert.deepEqual([(await hero()).x, (await hero()).y, (await hero()).moving], [16, 8, false]);
  assert(await ev(() => document.body.classList.contains("field") && document.getElementById("panel").hidden));

  // Click a bush: refused. Click grass: walk there; position saved in the new `world` field.
  const tap = async (x, y) => {
    const p = await ev(([x, y]) => World.tileToClient(x, y), [x, y]);
    await page.mouse.click(p.x, p.y);
  };
  await tap(15, 6);
  await page.waitForTimeout(400);
  assert.deepEqual([(await hero()).x, (await hero()).y], [16, 8], "bush collision");
  await tap(15, 10);
  await page.waitForFunction(() => !World.hero.moving);
  assert.deepEqual([(await hero()).x, (await hero()).y], [15, 10], "click to walk");
  assert.deepEqual(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).world.food), { x: 15, y: 10 });

  // World map: KK village open for everyone; the next legacy map still locked; Wind needs the KK course.
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="map"]').click();
  assert.equal(await page.locator('[data-go="kk"]').isDisabled(), false);
  assert.equal(await page.locator('[data-go="animal"]').isDisabled(), true);
  assert.equal(await page.locator('[data-go="wind"]').isDisabled(), true);
  await page.locator("#menu-close").click();

  // Legacy quest inside the dialog: 10 theme words, records go to the shared card book and log.
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-next").click();
  await page.locator(".dlg-choices button", { hasText: "主題單字" }).click();
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".qz-o button:not([disabled])");
    const r = await ev(() => ({ i: Learn.last.options.findIndex((o) => o.ok), th: Learn.last.item.th }));
    assert.equal(r.th, "food", "quest theme");
    await page.locator(".qz-o button").nth(r.i).click();
    await page.locator(".qz-next").click();
  }
  await page.locator(".dlg-next").click();
  await page.waitForSelector("#dlg", { state: "hidden" });
  assert(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).cleared.includes("food:word")));
  const log0 = await ev(() => JSON.parse(localStorage.getItem("pm-log"))[0]);
  assert.deepEqual([log0.m, log0.sc, log0.tot], ["quest", 10, 10]);
  assert(await ev(() => P.badges.includes("first") && JSON.parse(localStorage.getItem("pm-cards")).apple && JSON.parse(localStorage.getItem("pm-sents"))["I am happy."].c === 1));

  // Second quest; then the next map unlocks. Repeat quests give no second reward; failed ones do not clear.
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-next").click();
  await page.locator(".dlg-choices button", { hasText: "句子交流" }).click();
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".qz-o button:not([disabled])");
    const r = await ev((i) => Learn.last.options.findIndex((o) => !!o.ok === i < 6), i);
    await page.locator(".qz-o button").nth(r).click();
    await page.locator(".qz-next").click();
  }
  await page.locator(".dlg-next").click();
  await page.waitForSelector("#dlg", { state: "hidden" });
  assert(!(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).cleared.includes("food:sent"))), "6/10 does not clear");
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-next").click();
  await page.locator(".dlg-choices button", { hasText: "句子交流" }).click();
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".qz-o button:not([disabled])");
    await page.locator(".qz-o button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await page.locator(".qz-next").click();
  }
  const xpBefore = await ev(() => P.xp);
  await page.locator(".dlg-next").click();
  await page.waitForSelector("#dlg", { state: "hidden" });
  assert(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).cleared.includes("food:sent")));
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="map"]').click();
  assert.equal(await page.locator('[data-go="animal"]').isDisabled(), false, "next map unlocked");
  await page.locator("#menu-close").click();
  assert.equal(xpBefore, await ev(() => P.xp), "reward given once when the quest completes, not again");

  // Chest: claimed once.
  await ev(() => World.walkTo(20, 8));
  await page.waitForFunction(() => !World.hero.moving);
  await tap(21, 7);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).chests.length === 1);
  const xp = await ev(() => P.xp);
  await page.locator("#act-talk").click();
  await page.waitForTimeout(300);
  assert.equal(await ev(() => P.xp), xp, "chest claimed once");

  // Learning panel round trip: card book and log open over the game and return to the same spot.
  const spot = await hero();
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="book"]').click();
  await page.waitForSelector("#panel:not([hidden])");
  assert(await page.locator("#cards").innerText());
  await page.locator("#tab-log").click();
  assert.match(await page.locator("#logs").innerText(), /主題單字/);
  await page.locator("#tab-play").click();
  // Original practice still works inside the panel.
  await page.locator("#go-word").click();
  await page.waitForSelector("#game:not([hidden])");
  for (const type of ["pic2word", "word2pic", "match", "wflash", "spell"]) {
    await ev((t) => {
      $("stage").innerHTML = "";
      G[t]($("stage"));
      clearTimeout(S.timer);
    }, type);
  }
  await page.locator("#back").click();
  await page.locator("#quick-map").click();
  await page.waitForSelector("#panel", { state: "hidden" });
  assert.deepEqual([(await hero()).x, (await hero()).y], [spot.x, spot.y], "back to the same spot");

  // Reload: map, positions (new and PR #1 fields) and unlocks persist.
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual([(await hero()).x, (await hero()).y], [spot.x, spot.y], "position restored");
  assert.deepEqual(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).positions), { food: { x: 4, y: 3 } }, "grid-era positions untouched");
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-rpg-v1")).version), 1);

  // Every legacy map builds, with a resident and monsters; sparse sentence routes never run dry.
  await ev(() => {
    const d = JSON.parse(localStorage.getItem("pm-rpg-v1"));
    d.cleared = ["food", "animal", "nature", "transport", "things"].flatMap((id) => [id + ":word", id + ":sent"]);
    localStorage.setItem("pm-rpg-v1", JSON.stringify(d));
    P.xp = 0;
    saveP();
  });
  await page.reload();
  await page.waitForSelector(".world-canvas");
  for (const id of ["food", "animal", "nature", "transport", "things"]) {
    await ev((id) => RPG.travel(id), id);
    assert(
      await ev(() => World.entities.some((e) => e.kind === "npc") && World.entities.filter((e) => e.kind === "mob").length >= 4),
      "map " + id,
    );
    await ev(() => {
      for (let i = 0; i < 20; i++) Learn.sentQuestion((s) => s.route === "business");
    });
  }
  // KK village is reachable for returning players.
  await ev(() => RPG.travel("kk"));
  assert.equal(await ev(() => RPG.data.at), "kk");
  assert(await ev(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll");
  await page.screenshot({ path: "/tmp/picture-rpg-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: legacy saves kept, returning player on legacy map, collision and click-to-walk, world map locks, in-dialog legacy quests with shared records and log, fail and repeat rules, unlock, chest once, learning panel round trip, original practice renderers, reload with PR #1 fields untouched, all legacy maps, KK village for returning players, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
