// Timed English battle on a legacy map (returning player): one question per turn, at most 3 options, a countdown;
// right = attack (+MP, combo), wrong or timeout = hit; one settlement per question; pause on hidden page and resume;
// practice mode without a clock; optional MP help never blocks answering; victory loot, battle log (timeouts apart),
// flee, defeat and revive, field rest / bag / trade, save and reload, one simple art style.
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
  const legacy = {
    "pm-progress": JSON.stringify({ xp: 25, correct: 2, w: 2, s: 0, rounds: 1, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": JSON.stringify({ apple: { c: 2, w: 0, last: 1 } }),
    "pm-log": "[]",
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
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  const ready = () => page.waitForFunction(() => Battle.ready, null, { timeout: 10000 });
  const fight = async () => {
    await ev(() => {
      const ms = World.entities.filter((e) => e.kind === "mob");
      ms.forEach((m) => (m.wait = 999));
      const h = World.hero,
        m = ms.sort((a, b) => Math.hypot(a.tx - h.x, a.ty - h.y) - Math.hypot(b.tx - h.x, b.ty - h.y))[0];
      World.approach(m);
    });
    await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
    await ready();
  };
  const pickAnswer = async (ok) => {
    await page.waitForSelector(".qz-o button:not([disabled])");
    const i = await ev((ok) => Learn.last.options.findIndex((o) => !!o.ok === ok), ok);
    await page.locator(".qz-o button").nth(i).click();
  };

  // Returning player lands on their legacy map; characters use the simple NPC style (#6), no free puppy.
  assert.equal(await ev(() => RPG.data.at), "food");
  assert.equal(await ev(() => World.hasArt("hero-walk") || World.hasArt("pet-walk")), false, "hand-painted character sheets not used");
  assert.equal(await ev(() => World.entities.some((e) => e.kind === "pet")), false, "no companion until it is earned");
  assert.equal(await page.locator("#hud-hp b").innerText(), "HP 80/80");
  assert.equal(await page.locator("#hud-berry small").innerText(), "3");

  /* Encounter: one question, at most 3 options, a running clock */
  await fight();
  await ev(() => Battle.setFoeHp(400));
  assert.equal(await ev(() => World.paused), true, "monsters pause in battle");
  assert((await page.locator(".qz-o button").count()) <= 3, "three options at most");
  const l0 = await ev(() => Battle.state.left);
  assert(l0 > 0 && l0 <= 18, "countdown started");
  await page.waitForTimeout(400);
  assert((await ev(() => Battle.state.left)) < l0, "clock runs");

  /* Pause when the page is hidden; "準備好了" resumes */
  await ev(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.locator("#bt-pause").isVisible(), true, "pause screen");
  const lp = await ev(() => Battle.state.left);
  await page.waitForTimeout(500);
  assert.equal(await ev(() => Battle.state.left), lp, "clock frozen while paused");
  await ev(() => delete document.hidden);
  await page.locator("#bt-ready").click();
  assert.equal(await ev(() => Battle.state.paused), false);

  /* Wrong answer: you get hit, the answer is explained, nothing happens to the foe; the explanation is not timed */
  const mp0 = await ev(() => Battle.mp),
    hp0 = await ev(() => Battle.hp),
    foe1 = await ev(() => Battle.foe.hp);
  await pickAnswer(false);
  assert.equal(await ev(() => Battle.foe.hp), foe1, "wrong answer: no damage");
  assert((await ev(() => Battle.hp)) < hp0, "wrong answer: you are hit");
  assert.equal(await ev(() => Battle.mp), mp0, "no MP lost");
  assert.match(await page.locator(".qz-f").innerText(), /正確答案/);
  const weakWord = await ev(() => Learn.last.item.w || Learn.last.item.en);
  // Double settlement is impossible: a late timeout after the answer changes nothing
  const hpW = await ev(() => Battle.hp);
  await ev(() => Battle.settleForTest("timeout"));
  assert.equal(await ev(() => Battle.hp), hpW, "one settlement per question");
  await page.locator("#bt-next").click();
  await ready();

  /* Right answer: damage at once, MP +2, XP; it moves on by itself */
  await ev(() => Battle.setMp(10));
  const xp1 = await ev(() => P.xp),
    foe2 = await ev(() => Battle.foe.hp);
  await pickAnswer(true);
  assert((await ev(() => Battle.foe.hp)) < foe2, "correct answer hits immediately");
  assert.equal(await ev(() => Battle.mp), 12, "a right answer restores a little MP");
  assert((await ev(() => P.xp)) > xp1, "battle English gives XP");
  await ready();

  /* Optional MP help never blocks answering: heal, +time, shield; then answer with 0 MP */
  await ev(() => {
    Battle.setHp(30);
    Battle.setMp(30);
  });
  await page.locator('[data-help="heal"]').click();
  assert.deepEqual(await ev(() => [Battle.hp, Battle.mp]), [58, 22], "heal: +35% HP for 8 MP");
  const lt = await ev(() => Battle.state.left);
  await page.locator('[data-help="time"]').click();
  assert((await ev(() => Battle.state.left)) > lt + 4, "+5 seconds");
  await page.locator('[data-help="shield"]').click();
  assert.equal(await ev(() => Battle.state.guard), 1);
  assert.equal(await ev(() => Battle.state.settled), false, "help does not use up the question");
  await ev(() => Battle.setMp(0));
  await pickAnswer(false);
  assert.equal(await ev(() => Battle.hp), 58, "the shield blocks the hit");
  await page.locator("#bt-next").click();
  await ready();
  assert.equal(await ev(() => Battle.mp), 0);
  await pickAnswer(true);
  await ready();

  /* Timeout: recorded apart from wrong answers (review metadata), you are hit */
  const hpT = await ev(() => Battle.hp),
    tq = await ev(() => Learn.last.item.w || Learn.last.item.en);
  await ev(() => Battle.settleForTest("timeout"));
  assert((await ev(() => Battle.hp)) < hpT, "timeout: you are hit");
  assert.match(await page.locator(".qz-f").innerText(), /時間到不算英文答錯/);
  assert(await ev((id) => JSON.parse(localStorage.getItem("pm-learn-v1")).review.some((r) => r.id === id && r.why === "timeout"), tq), "timeout kept for review");
  await page.locator("#bt-next").click();
  await ready();

  /* Practice mode: no clock from the next question */
  await page.locator("#bt-mode").click();
  await pickAnswer(true);
  await ready();
  assert.equal(await ev(() => Battle.state.left), null, "practice: no countdown");
  assert.equal(await page.locator(".bt-clock").isVisible(), false);
  await page.locator("#bt-mode").click();

  /* Combo: every 3 right answers powers up the next hit */
  await ev(() => Battle.setHp(80));
  for (let k = 0; k < 5 && !(await ev(() => Battle.state.combo >= 3 && Battle.state.combo % 3 === 0)); k++) {
    await pickAnswer(true);
    await page.waitForFunction(() => document.getElementById("bt-claim") || Battle.ready, null, { timeout: 10000 });
  }
  assert.equal(await ev(() => Battle.state.power), true, "combo of 3 powers up");

  /* Victory: loot, back to the same spot, field resumes; the battle is logged with its English and timeouts */
  await ev(() => Battle.setFoeHp(30));
  const spot = await ev(() => World.hero);
  await ev(() => Math.random = ((r) => () => 0.05)(Math.random));
  for (let i = 0; i < 20 && !(await page.locator("#bt-claim").count()); i++) {
    await ev(() => Battle.setHp(80));
    await pickAnswer(true);
    await page.waitForFunction(() => document.getElementById("bt-claim") || Battle.ready, null, { timeout: 10000 });
  }
  assert.match(await page.locator(".bt-end").innerText(), /勝利[\s\S]*糖霜/);
  await page.locator("#bt-claim").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  await ev(() => (Math.random = Math.random));
  assert.equal(await ev(() => Battle.count("frosting")), 1, "loot added");
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y, World.paused]), [spot.x, spot.y, false]);
  const blog = await ev(() => JSON.parse(localStorage.getItem("pm-log"))[0]);
  assert.equal(blog.m, "battle");
  assert(blog.w.includes(weakWord) && blog.tot >= 3, "battle log lists answered English");
  assert.equal(blog.to, 1, "timeouts logged apart");
  const word = await ev(() => Learn.last.item.w);

  /* Flee: always an exit (forced success here), monsters calm down */
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await fight();
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  assert.equal(await ev(() => World.paused), false);

  /* Defeat: wake at the entrance with half HP; learning records untouched */
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await fight();
  await ev(() => Battle.setHp(1));
  await pickAnswer(false);
  const cardsBefore = await ev(() => localStorage.getItem("pm-cards"));
  await page.locator("#bt-next").click();
  await page.waitForSelector("#bt-wake", { timeout: 10000 });
  await page.locator("#bt-wake").click();
  await page.waitForFunction(() => !World.hero.down && Battle.hp === 40, null, { timeout: 8000 });
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y]), [16, 8], "revived at the map entrance");
  assert.equal(await ev(() => localStorage.getItem("pm-cards")), cardsBefore, "defeat itself does not touch the card book");

  /* Field: rest, items, bag and resident trade (all in-scene) */
  await ev(() => (Math.random = () => 0.5));
  await page.locator("#hud-more").click();
  assert.equal(await page.locator("#hud-tray").isVisible(), true, "supplies and rest in the tray");
  await page.locator("#hud-sit").click();
  assert(await ev(() => World.hero.sit));
  const hpSit = await ev(() => Battle.hp);
  await ev(() => Battle.tick(2.1));
  assert((await ev(() => Battle.hp)) > hpSit, "resting heals");
  await page.locator("#hud-bag").click();
  assert.match(await page.locator("#menu-body").innerText(), /背包/);
  await page.locator("#menu-close").click();
  await ev(() => {
    Battle.give("shell");
    Battle.give("tealeaf");
  });
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-next").click();
  await page.locator(".dlg-choices button", { hasText: "補給交換" }).click();
  const berries = await ev(() => Battle.count("berry"));
  await page.locator(".dlg-choices button", { hasText: "換小紅莓" }).click();
  assert.equal(await ev(() => Battle.count("berry")), berries + 1, "trade works in the dialog");
  await page.locator(".dlg-choices button", { hasText: "完成" }).click();
  await page.waitForSelector("#dlg", { state: "hidden" });

  /* Aggressive monsters (third legacy map) start the battle themselves */
  await ev(() => {
    const d = JSON.parse(localStorage.getItem("pm-rpg-v1"));
    d.cleared = ["food:word", "food:sent", "animal:word", "animal:sent"];
    localStorage.setItem("pm-rpg-v1", JSON.stringify(d));
  });
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await ev(() => RPG.travel("nature"));
  await ev(() => {
    const m = World.entities.find((e) => e.kind === "mob");
    World.walkTo(m.tx + 1 < 23 ? m.tx + 1 : m.tx - 1, m.ty);
  });
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  assert.match(await page.locator("#bt-foe-name").innerText(), /雨滴精/);

  /* Save and reload */
  const saved = await ev(() => ({ hp: Battle.hp, berry: Battle.count("berry"), at: RPG.data.at }));
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await ev(() => ({ hp: Battle.hp, berry: Battle.count("berry"), at: RPG.data.at })), saved);
  assert.equal(await ev(() => localStorage.getItem("pm-progress") !== null), true);
  // Anti-farming survives a reload (pm-learn-v1), and old keys keep their shape.
  if (word) assert.equal(await ev((w) => Learn.grade({ recK: "w", item: WORDS.find((x) => x.w === w) }, true, "battle").fresh, word), false, "cooldown kept across reload");
  assert(await ev(() => { const s = JSON.parse(localStorage.getItem("pm-learn-v1")); return s.v === 1 && Array.isArray(s.review) && typeof s.recent === "object"; }));
  assert(await ev(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll");
  await page.screenshot({ path: "/tmp/picture-battle-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: legacy start in simple style without a free pet, timed question (<=3 options, clock), pause on hidden page and resume, wrong = hit, one settlement, right = hit +MP +XP, MP help (heal/time/shield) never blocks answering, timeout recorded apart, practice mode, combo, victory loot and return spot, battle log with timeouts, flee, defeat revive, rest, bag, trade dialog, aggressive encounter, save/reload, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
