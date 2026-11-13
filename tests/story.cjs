// End-to-end opening route on a 390px phone: full-screen shell, KK village lessons, tutorial battle,
// graduation, portal to the Wind Islands, check-in -> customs (branch) -> baggage (desk or chase) -> hotel,
// commute-mode round trip from a quest, and reload. Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null; // page under test, for failure diagnostics

async function setup(browser, vp = { width: 390, height: 760 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // Silent, fast audio: recorded clips end at once; speech synthesis is skipped.
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.dispatchEvent(new Event("ended")), 5);
      return Promise.resolve();
    };
    if (window.speechSynthesis) speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5);
  });
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  CUR = page;
  return { ctx, page, errors };
}
const h = (page) => {
  const ev = (f, a) => page.evaluate(f, a);
  return {
    ev,
    // Answer the question on screen, correctly unless told otherwise, then continue.
    async answer(ok = true) {
      await page.waitForSelector(".qz-o button:not([disabled])", { timeout: 20000 });
      const i = await ev((ok) => Learn.last.options.findIndex((o) => !!o.ok === ok), ok);
      await page.locator(".qz-o button").nth(i).click();
      await page.locator(".qz-next").click();
    },
    async next() {
      await page.locator(".dlg-next").click();
    },
    async choose(text) {
      await page.locator(".dlg-choices button", { hasText: text }).first().click();
    },
    async talk() {
      await page.locator("#act-talk").click();
      await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
    },
    async closed() {
      await page.waitForSelector("#dlg", { state: "hidden", timeout: 10000 });
    },
    async battleWin() {
      await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
      for (let turn = 0; turn < 20 && (await ev(() => Battle.active)); turn++) {
        if (await page.locator("#bt-claim").count()) break;
        await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 10000 });
        if (await page.locator("#bt-claim").count()) break;
        await ev(() => Battle.setMp(30));
        await page.locator("#bt-skill").click();
        await page.locator(".bt-list [data-k]").first().click();
        await page.waitForSelector(".qz-o button:not([disabled])");
        const i = await ev(() => Learn.last.options.findIndex((o) => o.ok));
        await page.locator(".qz-o button").nth(i).click();
        await page.locator(".qz-next").click();
        await page.waitForFunction(() => document.getElementById("bt-claim") || Battle.ready || Battle.hp <= 0, null, { timeout: 10000 });
      }
      await page.locator("#bt-claim").click();
      await page.waitForSelector("#battle", { state: "hidden" });
    },
    hero: () => ev(() => World.hero),
  };
};

(async () => {
  const browser = await require("playwright").chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });

  /* ---------- 1. Full-screen shell on a phone ---------- */
  const { ctx, page, errors } = await setup(browser);
  const t = h(page);
  const fit = await t.ev(() => ({
    shell: document.getElementById("shell").getBoundingClientRect().height,
    inner: innerHeight,
    scroll: document.documentElement.scrollHeight,
    wide: document.documentElement.scrollWidth,
    hud: ["hud-hp", "quest-text", "hud-menu", "act-talk", "act-fight"].every((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    }),
  }));
  assert.equal(fit.shell, fit.inner, "game fills the viewport");
  assert(fit.scroll <= fit.inner && fit.wide <= 390, "no page scrolling");
  assert(fit.hud, "HUD and action buttons on screen");
  assert.equal(await t.ev(() => RPG.data.at), "kk", "new players start in the KK village");
  await page.screenshot({ path: "/tmp/picture-story-start.png" });

  /* ---------- 2. KK lessons (in-scene dialog; lessons write learning records) ---------- */
  const xp0 = await t.ev(() => P.xp);
  for (const [id, n] of [["vowel", 5], ["consonant", 5], ["stress", 5], ["word", 5]]) {
    await t.talk();
    assert.equal(await t.ev(() => document.getElementById("dlg-name").textContent.length > 0), true);
    await t.next(); // intro
    for (let i = 0; i < n; i++) await t.answer(i !== 1); // one wrong answer each lesson
    await t.next(); // result line
    if (id === "word") {
      await t.next();
      await t.next(); // chief: bubble + phonics hint
    }
    await t.closed();
    assert(await t.ev((id) => RPG.data.kk[id], id), "lesson done: " + id);
  }
  assert((await t.ev(() => P.xp)) > xp0, "lessons give learning XP");
  const log = await t.ev(() => JSON.parse(localStorage.getItem("pm-log")));
  assert(log.some((l) => l.m === "quest" && /KK 新手村・母音/.test(l.scn) && l.tot === 5), "lesson logged");
  assert(Object.keys(await t.ev(() => JSON.parse(localStorage.getItem("pm-cards") || "{}"))).length > 0, "cards recorded");

  /* ---------- 3. Tutorial battle: phonics skill, then return to the same spot ---------- */
  assert.match(await page.locator("#quest-text").innerText(), /音節泡泡/);
  await t.ev(() => World.approach(World.entities.find((e) => e.kind === "mob" && e.story === "tutorial")));
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  const before = await t.hero();
  assert.match(await page.locator("#bt-log").innerText(), /音標魔法/, "tutorial hint");
  assert.equal(await t.ev(() => World.paused), true, "field paused during battle");
  // Normal attack is weak against the bubble; the phonics skill matters.
  const mp0 = await t.ev(() => Battle.mp);
  await page.waitForFunction(() => Battle.ready);
  await page.locator("#bt-attack").click();
  await page.waitForFunction(() => Battle.ready, null, { timeout: 5000 });
  assert.equal(await t.ev(() => Battle.mp), mp0, "normal attack costs no MP");
  const hpA = await t.ev(() => Battle.foe.hp);
  await page.locator("#bt-skill").click();
  await page.locator(".bt-list [data-k]").first().click();
  assert.equal(await t.ev(() => Battle.mp), mp0 - 5, "skill costs MP");
  await page.waitForSelector(".qz-o button:not([disabled])");
  await t.ev(() => {
    const i = Learn.last.options.findIndex((o) => o.ok);
    document.querySelectorAll(".qz-o button")[i].click();
  });
  assert((await t.ev(() => Battle.foe.hp)) < hpA, "correct answer hits at once");
  await page.locator(".qz-next").click();
  await t.battleWin();
  const after = await t.hero();
  assert.deepEqual([after.x, after.y], [before.x, before.y], "back on the field where the fight began");
  assert(await t.ev(() => RPG.data.kk.battle));
  assert((await t.ev(() => JSON.parse(localStorage.getItem("pm-log"))[0])).m === "battle", "battle English logged");

  /* ---------- 4. Graduation and portal ---------- */
  await t.talk();
  await t.next();
  await t.closed();
  assert(await t.ev(() => RPG.data.kk.done), "graduated");
  await t.ev(() => {
    const L = RPG.maps[0].layout,
      y = L.findIndex((r) => r.includes("@"));
    World.walkTo(L[y].indexOf("@"), y);
  });
  await page.waitForFunction(() => RPG.data.at === "wind", null, { timeout: 30000 });
  assert.match(await page.locator("#hud-map").innerText(), /風之旅行群島/);

  /* ---------- 5. Check-in ---------- */
  await t.talk(); // auto-walks to the check-in counter (objective NPC)
  assert.match(await page.locator("#dlg-body").innerText(), /多益準備目標/);
  await t.choose("開始對話");
  await t.next();
  for (let i = 0; i < 4; i++) await t.answer();
  await t.choose("window seat");
  await t.next();
  await t.closed();
  assert.equal(await t.ev(() => RPG.data.story.wind.stage), 1);

  /* ---------- 6. Commute mode from the customs quest, then back to the same spot and quest ---------- */
  const spot = await t.hero();
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="drive"]').click();
  await page.waitForSelector("#drive:not([hidden])");
  assert.match(await page.locator("#drive-from").innerText(), /海關問答/);
  assert.match(await page.locator("#drive-from").innerText(), /wind\/travel\/customs\/1/);
  assert(await page.locator("#dk-scene").isChecked());
  assert.equal(await page.locator('#drive-scs [aria-pressed="true"]').innerText(), "海關入境", "same scene preselected");
  await page.locator("#drive-back").click();
  await page.waitForSelector("#panel", { state: "hidden" });
  assert.deepEqual([(await t.hero()).x, (await t.hero()).y], [spot.x, spot.y], "same position after the round trip");
  assert.equal(await t.ev(() => RPG.data.story.wind.stage), 1, "quest unchanged");

  /* ---------- 7. Customs with the business branch ---------- */
  await t.talk();
  await t.choose("開始對話");
  await t.next();
  await t.choose("on business");
  await t.next();
  assert.match(await page.locator(".qz-their").innerText(), /What do you do\?/, "business answer changes the follow-up");
  for (let i = 0; i < 3; i++) await t.answer();
  await t.next();
  await t.closed();
  assert.equal(await t.ev(() => RPG.data.story.wind.purpose), "business");

  /* ---------- 8. Baggage: report at the desk ---------- */
  await t.talk();
  await t.choose("開始對話");
  await t.next();
  await t.choose("服務櫃檯");
  await t.next();
  for (let i = 0; i < 3; i++) await t.answer();
  await t.next();
  await t.closed();
  assert.equal(await t.ev(() => RPG.data.story.wind.bag), "desk");

  /* ---------- 9. Hotel: the desk branch changes the clerk's line ---------- */
  await t.talk();
  await t.choose("開始對話");
  await t.next();
  for (let i = 0; i < 4; i++) await t.answer();
  assert.match(await page.locator(".dlg-en").innerText(), /suitcase arrived/);
  await t.next();
  await t.next();
  await t.closed();
  assert(await t.ev(() => RPG.data.story.wind.done), "story complete");
  await page.locator("#hud-quest").click();
  const journal = await page.locator("#menu-body").innerText();
  assert.match(journal, /風之旅行群島 · 故事完成/);
  assert.match(journal, /風／旅遊／海關入境／初級/);
  assert.match(journal, /不代表考試分數/);
  await page.locator("#menu-close").click();

  /* ---------- 10. Reload keeps everything ---------- */
  const xpEnd = await t.ev(() => P.xp);
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await t.ev(() => [RPG.data.at, RPG.data.kk.done, RPG.data.story.wind.done, P.xp]), ["wind", true, true, xpEnd]);
  await page.screenshot({ path: "/tmp/picture-story-end.png" });
  assert.deepEqual(errors, []);
  await ctx.close();

  /* ---------- 11. The other baggage branch: chase the gull (battle) ---------- */
  const b = await setup(browser);
  const t2 = h(b.page);
  await t2.ev(() => {
    const d = JSON.parse(localStorage.getItem("pm-rpg-v1") || "{}");
    localStorage.setItem("pm-rpg-v1", JSON.stringify({ ...d, version: 1, at: "wind", kk: { vowel: true, consonant: true, stress: true, word: true, bubble: true, battle: true, done: true }, story: { wind: { stage: 2, purpose: "sightseeing" } } }));
  });
  await b.page.reload();
  await b.page.waitForSelector(".world-canvas");
  await t2.talk();
  await t2.choose("開始對話");
  await t2.next();
  await t2.choose("自己去追");
  await t2.next();
  await t2.closed();
  assert(await t2.ev(() => World.entities.some((e) => e.story === "thief")), "gull appears");
  await t2.ev(() => World.approach(World.entities.find((e) => e.story === "thief")));
  await t2.battleWin();
  assert.deepEqual(await t2.ev(() => [RPG.data.story.wind.bag, RPG.data.story.wind.stage]), ["found", 3], "chase branch recovers the bag");
  await t2.talk();
  await t2.choose("開始對話");
  await t2.next();
  for (let i = 0; i < 4; i++) await t2.answer();
  assert.match(await b.page.locator(".dlg-en").innerText(), /help you with your bag/, "chase branch has its own hotel line");
  assert.deepEqual(b.errors, []);
  await b.ctx.close();

  /* ---------- 12. Landscape keeps the controls visible ---------- */
  const l = await setup(browser, { width: 844, height: 390 });
  const vis = await l.page.evaluate(() =>
    ["hud-hp", "quest-text", "hud-menu", "act-talk", "act-fight", "hud-berry"].every((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    }),
  );
  assert(vis, "landscape controls visible");
  await l.page.setViewportSize({ width: 390, height: 600 });
  await l.page.waitForTimeout(300);
  assert.equal(await l.page.evaluate(() => document.getElementById("shell").getBoundingClientRect().height), 600, "resizes with the viewport");
  assert.deepEqual(l.errors, []);
  await l.ctx.close();

  console.log("PASS: 390px full screen, KK lessons with records, tutorial battle (phonics skill, no-MP attack, return to spot), graduation and portal, check-in, commute round trip with the same scene and position, customs branch, baggage desk and chase branches, hotel lines per branch, journal content IDs and TOEIC note, reload, landscape and resize");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ dlg: document.getElementById("dlg-body").innerText, name: document.getElementById("dlg-name").textContent, quest: document.getElementById("quest-text").textContent, hero: World.hero, battle: Battle.active, log: document.getElementById("bt-log").textContent, at: RPG.data.at })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-story-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
