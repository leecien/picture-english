// Turn-based English battle on a legacy map (returning player): encounter, attack without MP, skills that cost MP
// and resolve on the answer, wrong answers, items, flee, defeat and revive, victory loot, anti-farming,
// aggressive monsters, field items / rest / bag / trade, save and reload, real sprite sheets.
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

  // Returning player lands on their legacy map, with the real hero / puppy art loaded.
  assert.equal(await ev(() => RPG.data.at), "food");
  await page.waitForFunction(() => World.hasArt("hero-walk") && World.hasArt("pet-walk"));
  assert.equal(await page.locator("#hud-hp b").innerText(), "HP 80/80");
  assert.equal(await page.locator("#hud-berry small").innerText(), "3");

  /* Encounter -> attack (no MP) -> foe turn */
  await fight();
  assert.equal(await ev(() => World.paused), true, "monsters pause in battle");
  const mp0 = await ev(() => Battle.mp),
    foe0 = await ev(() => Battle.foe.hp);
  await page.locator("#bt-attack").click();
  assert((await ev(() => Battle.foe.hp)) < foe0, "attack hits");
  assert.equal(await ev(() => Battle.mp), mp0, "normal attack costs no MP");
  await ready();

  /* Skill: MP is spent; a wrong answer does nothing; the right answer is shown and logged as weak */
  const foe1 = await ev(() => Battle.foe.hp);
  await page.locator("#bt-skill").click();
  await page.locator('.bt-list [data-k="0"]').click();
  assert.equal(await ev(() => Battle.mp), mp0 - 4, "skill costs MP");
  await pickAnswer(false);
  assert.equal(await ev(() => Battle.foe.hp), foe1, "wrong answer: no damage");
  assert.match(await page.locator(".qz-f").innerText(), /正確答案/);
  const weakWord = await ev(() => Learn.last.item.w);
  await page.locator(".qz-next").click();
  await ready();

  /* Correct answer: damage at once, XP and a card; the same word again soon gives nothing extra */
  const xp1 = await ev(() => P.xp);
  await ev(() => Battle.setMp(30));
  await page.locator("#bt-skill").click();
  await page.locator('.bt-list [data-k="0"]').click();
  const foe2 = await ev(() => Battle.foe.hp);
  await pickAnswer(true);
  assert((await ev(() => Battle.foe.hp)) < foe2, "correct answer hits immediately");
  const word = await ev(() => Learn.last.item.w);
  assert.equal(await ev(() => P.xp), xp1 + 6, "battle English gives XP");
  const c1 = await ev((w) => JSON.parse(localStorage.getItem("pm-cards"))[w].c, word);
  await page.locator(".qz-next").click();
  // Anti-farming: grade the same word again right away.
  const farm = await ev((w) => {
    const it = WORDS.find((x) => x.w === w),
      xp = P.xp,
      r = Learn.grade({ recK: "w", item: it }, true, "battle");
    return { fresh: r.fresh, xp: P.xp - xp, c: JSON.parse(localStorage.getItem("pm-cards"))[w].c };
  }, word);
  assert.deepEqual(farm, { fresh: false, xp: 0, c: c1 }, "same item within 3 minutes: no XP, no card progress");
  await ready();

  /* Items in battle */
  await ev(() => Battle.setHp(30));
  await page.locator("#bt-item").click();
  await page.locator('[data-i="berry"]').click();
  assert.equal(await ev(() => Battle.count("berry")), 2);
  await ready();

  /* Victory: loot, back to the same spot, field resumes; the battle is logged with its English */
  const spot = await ev(() => World.hero);
  await ev(() => Math.random = ((r) => () => 0.05)(Math.random));
  await ev(() => Battle.setMp(30));
  for (let i = 0; i < 12 && !(await page.locator("#bt-claim").count()); i++) {
    await page.locator("#bt-skill").click();
    await page.locator('.bt-list [data-k="0"]').click();
    await pickAnswer(true);
    await page.locator(".qz-next").click();
    await page.waitForFunction(() => document.getElementById("bt-claim") || Battle.ready);
    await ev(() => Battle.setMp(30));
    await ev(() => Battle.setHp(80));
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

  /* Flee: always an exit (forced success here), monsters calm down */
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await fight();
  await ev(() => (Math.random = () => 0.1));
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  assert.equal(await ev(() => World.paused), false);

  /* Defeat: wake at the entrance with half HP; learning records untouched */
  await page.reload();
  await page.waitForSelector(".world-canvas");
  const cardsBefore = await ev(() => localStorage.getItem("pm-cards"));
  await fight();
  await ev(() => Battle.setHp(1));
  await ev(() => (Math.random = () => 0.5));
  await page.locator("#bt-attack").click();
  await page.waitForSelector("#bt-wake", { timeout: 10000 });
  await page.locator("#bt-wake").click();
  await page.waitForFunction(() => !World.hero.down && Battle.hp === 40, null, { timeout: 8000 });
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y]), [16, 8], "revived at the map entrance");
  assert.equal(await ev(() => localStorage.getItem("pm-cards")), cardsBefore, "defeat leaves the card book untouched");

  /* Field: rest, items, bag and resident trade (all in-scene) */
  await ev(() => (Math.random = () => 0.5));
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
  assert(await ev(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll");
  await page.screenshot({ path: "/tmp/picture-battle-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: legacy start with real sprites, encounter, no-MP attack, MP skills, wrong answer, immediate hit, XP and cards, anti-farming, battle items, victory loot and return spot, battle log, flee, defeat revive, rest, bag, trade dialog, aggressive encounter, save/reload, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
