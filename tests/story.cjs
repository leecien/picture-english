// End-to-end opening route on a 390px phone: full-screen shell, KK micro-lessons (demo first, targeted retry,
// sounds limited to what was taught), tutorial battle (free demo cast, MP only on success, shield break),
// graduation, portal, Wind Islands listen-first stages with branches, commute round trip, reload.
// Run with a local HTTP server: python -m http.server 8000
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
  const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());
  return {
    ev,
    async talk() {
      await page.locator("#act-talk").click();
      await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
    },
    /* Drive the open dialog until it closes: answer questions (correctly unless `wrong` says so), press continue,
       pick choices by the first matching pattern. Returns what was seen, for assertions. */
    async play({ choices = [], wrong = () => false, stopAt } = {}) {
      const seen = { qs: [], lines: [], retries: 0, choicesTaken: [] };
      let n = 0;
      for (let step = 0; step < 400; step++) {
        if (!(await visible("#dlg"))) return seen;
        if (stopAt && (await page.locator("#dlg-body").innerText()).match(stopAt)) return seen;
        if (await visible(".qz-o button:not([disabled])")) {
          const q = await ev(() => ({ unit: Learn.last.unit, sym: Learn.last.sym, q: Learn.last.item.q, en: Learn.last.item.w || Learn.last.item.en, cue: !!document.querySelector(".qz-cue:not([open])") }));
          const bad = !(await visible(".qz-f .bad")) && wrong(n, q);
          const i = await ev((ok) => {
            const opts = Learn.last.options;
            return opts.findIndex((o, k) => !!o.ok === ok && !document.querySelectorAll(".qz-o button")[k].disabled);
          }, !bad);
          await page.locator(".qz-o button").nth(i).click();
          if (bad) {
            if (await visible(".qz-f .bad")) seen.retries++;
            continue;
          }
          seen.qs.push(q);
          n++;
          continue;
        }
        if (await visible(".qz-next")) {
          await page.locator(".qz-next").click();
          continue;
        }
        if (await visible(".dlg-choices")) {
          const labels = await page.locator(".dlg-choices button:not([disabled])").allInnerTexts();
          let k = -1;
          for (const re of choices) {
            k = labels.findIndex((l) => re.test(l));
            if (k >= 0) break;
          }
          if (k < 0) k = 0;
          seen.choicesTaken.push(labels[k]);
          await page.locator(".dlg-choices button:not([disabled])").nth(k).click();
          continue;
        }
        if (await visible(".dlg-next")) {
          const en = await page.locator(".dlg-en").allInnerTexts();
          seen.lines.push(...en, await page.locator("#dlg-body").innerText());
          await page.locator(".dlg-next").click();
          continue;
        }
        await page.waitForTimeout(50);
      }
      throw new Error("dialog did not finish");
    },
    /* Timed battle: one question per turn; answer right until the claim button shows. */
    async battleWin() {
      await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
      for (let turn = 0; turn < 40 && (await ev(() => Battle.active)); turn++) {
        await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim") || document.getElementById("bt-next"), null, { timeout: 10000 });
        if (await page.locator("#bt-claim").count()) break;
        if (await page.locator("#bt-next").count()) {
          await page.locator("#bt-next").click();
          continue;
        }
        await page.locator(".qz-o button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
        await page.waitForFunction(() => !Battle.ready, null, { timeout: 5000 });
      }
      await page.locator("#bt-claim").click();
      await page.waitForSelector("#battle", { state: "hidden" });
    },
    hero: () => ev(() => World.hero),
  };
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });

  /* ---------- 1. Full-screen shell on a phone: one goal, one main action ---------- */
  const { ctx, page, errors } = await setup(browser);
  const t = h(page);
  const onScreen = (ids) =>
    t.ev((ids) => ids.every((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.width >= 44 * 0.99 && r.height >= 44 * 0.99 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    }), ids);
  const fit = await t.ev(() => ({ shell: document.getElementById("shell").getBoundingClientRect().height, inner: innerHeight, scroll: document.documentElement.scrollHeight, wide: document.documentElement.scrollWidth }));
  assert.equal(fit.shell, fit.inner, "game fills the viewport");
  assert(fit.scroll <= fit.inner && fit.wide <= 390, "no page scrolling");
  assert(await onScreen(["hud-menu", "act-talk", "hud-more"]), "main controls on screen, at least 44px");
  assert.equal(await page.locator("#hud-berry").isHidden(), true, "supplies tucked away while healthy");
  assert.match(await page.locator("#act-label").innerText(), /前往 Ava/, "main action names the next step");
  assert.equal(await t.ev(() => RPG.data.at), "kk", "new players start in the KK village");

  /* ---------- 2. KK micro-lessons ---------- */
  const xp0 = await t.ev(() => P.xp);
  await t.talk();
  const vowel = await t.play({ choices: [/下一個/], wrong: (n) => n === 0 });
  assert.equal(vowel.retries, 1, "a miss gives a hint and a retry, not a restart");
  assert(vowel.qs.every((q) => q.unit && ["v1", "v2", "v3"].includes(q.unit)), "vowel lesson stays in its units");
  const pairs = { v1: ["i", "ɪ"], v2: ["æ", "ɛ"], v3: ["ɑ", "ʌ"] };
  assert(vowel.qs.every((q) => pairs[q.unit].includes(q.sym)), "only the sounds just demonstrated");
  const order = vowel.qs.map((q) => q.unit);
  assert.deepEqual([...new Set(order)], ["v1", "v2", "v3"], "units in order, each taught before it is asked");
  assert(await t.ev(() => RPG.data.kk.vowel && RPG.data.kk.units.v1 && RPG.data.kk.units.v3), "unit progress saved");
  assert(vowel.lines.some((l) => /還要多練的音/.test(l)), "summary names the sound to practise");
  assert(await t.ev(() => Learn.soundsDue().length > 0), "missed sound marked for review (persisted)");
  assert((await t.ev(() => JSON.parse(localStorage.getItem("pm-learn-v1")).sounds)) != null);
  for (const id of ["consonant", "stress", "word"]) {
    await t.talk();
    await t.play({ choices: [/下一個/] });
    assert(await t.ev((id) => RPG.data.kk[id], id), "lesson done: " + id);
  }
  assert((await t.ev(() => P.xp)) > xp0, "lessons give learning XP");
  const log = await t.ev(() => JSON.parse(localStorage.getItem("pm-log")));
  assert(log.some((l) => l.m === "quest" && /KK 新手村・母音/.test(l.scn)), "lesson logged");
  // Pause mid-lesson keeps progress (fresh context, consonant lesson)
  {
    const c = await setup(browser);
    const tc = h(c.page);
    await tc.ev(() => {
      localStorage.setItem("pm-rpg-v1", JSON.stringify({ version: 1, at: "kk", kk: { vowel: true } }));
    });
    await c.page.reload();
    await c.page.waitForSelector(".world-canvas");
    await tc.talk();
    await tc.play({ choices: [/先休息/] });
    assert.deepEqual(await tc.ev(() => [!!RPG.data.kk.units.c1, !!RPG.data.kk.units.c2, !!RPG.data.kk.consonant]), [true, false, false], "stopping keeps finished units");
    await tc.talk();
    const rest = await tc.play({ choices: [/下一個/] });
    assert(!rest.qs.some((q) => q.unit === "c1"), "resumes at the next unit");
    assert.deepEqual(c.errors, []);
    await c.ctx.close();
    CUR = page;
  }

  /* ---------- 3. Tutorial battle: one timed question per turn, shield breaks on the first right answer ---------- */
  assert.match(await page.locator("#quest-text").innerText(), /音節泡泡/);
  await t.ev(() => World.approach(World.entities.find((e) => e.kind === "mob" && e.story === "tutorial")));
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  const before = await t.hero();
  assert.match(await page.locator("#bt-foe-shield").innerText(), /泡泡膜/);
  await page.waitForFunction(() => Battle.ready);
  assert.match(await page.locator("#bt-log").innerText(), /答對就攻擊/, "tutorial hint");
  assert(await page.locator(".qz-o button").count() <= 3, "three options at most");
  assert(await t.ev(() => Battle.state.left > 10), "tutorial turns get extra time");
  // Wrong answer: you get hit (softened in the tutorial), the explanation waits for "next"
  const hp0 = await t.ev(() => Battle.hp);
  await page.locator(".qz-o button").nth(await t.ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  assert((await t.ev(() => Battle.hp)) < hp0, "a wrong answer gets you hit");
  assert.equal(await t.ev(() => Battle.foe.shield), true);
  await page.locator("#bt-next").click();
  await page.waitForFunction(() => Battle.ready, null, { timeout: 5000 });
  const hpA = await t.ev(() => Battle.foe.hp);
  await page.locator(".qz-o button").nth(await t.ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  assert.equal(await t.ev(() => Battle.foe.shield), false, "first right answer breaks the bubble film");
  assert.equal(await t.ev(() => Battle.foe.hp), hpA, "the shield took that hit");
  await page.waitForFunction(() => Battle.ready, null, { timeout: 5000 });
  await page.locator(".qz-o button").nth(await t.ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  assert((await t.ev(() => Battle.foe.hp)) < hpA, "then right answers hit");
  await t.battleWin();
  const after = await t.hero();
  assert.deepEqual([after.x, after.y], [before.x, before.y], "back on the field where the fight began");
  assert(await t.ev(() => RPG.data.kk.battle));

  /* ---------- 4. Graduation and portal ---------- */
  await t.talk();
  await t.play();
  assert(await t.ev(() => RPG.data.kk.done), "graduated");
  await t.ev(() => {
    const L = RPG.maps[0].layout,
      y = L.findIndex((r) => r.includes("@"));
    World.walkTo(L[y].indexOf("@"), y);
  });
  await page.waitForFunction(() => RPG.data.at === "wind", null, { timeout: 30000 });
  assert.match(await page.locator("#hud-map").innerText(), /風之旅行群島/);

  /* ---------- 5. Check-in: listen first, Chinese cue folded ---------- */
  await t.talk();
  const offer = await page.locator("#dlg-body").innerText();
  assert.match(offer, /初級[\s\S]*多益準備目標/);
  const checkin = await t.play({ choices: [/開始對話/, /window seat/], wrong: (n) => n === 1 });
  assert(checkin.qs.every((q) => q.q && q.cue), "NPC speaks first; the Chinese cue starts folded");
  assert.equal(checkin.retries, 1);
  assert.equal(await t.ev(() => RPG.data.story.wind.stage), 1);
  assert(checkin.lines.some((l) => /這段練到/.test(l)), "stage summary");

  /* ---------- 6. Commute mode from the customs quest, then back to the same spot and quest ---------- */
  const spot = await t.hero();
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="drive"]').click();
  await page.waitForSelector("#drive:not([hidden])");
  assert.match(await page.locator("#drive-from").innerText(), /海關問答[\s\S]*wind\/travel\/customs\/1/);
  assert(await page.locator("#dk-scene").isChecked());
  assert.equal(await page.locator('#drive-scs [aria-pressed="true"]').innerText(), "海關入境", "same scene preselected");
  await page.locator("#drive-back").click();
  await page.waitForSelector("#panel", { state: "hidden" });
  assert.deepEqual([(await t.hero()).x, (await t.hero()).y], [spot.x, spot.y], "same position after the round trip");
  assert.equal(await t.ev(() => RPG.data.story.wind.stage), 1, "quest unchanged");

  /* ---------- 7. Customs: purpose choice, then the three-phase immigration trial ---------- */
  await t.talk();
  await t.play({ choices: [/開始對話/, /on business/] });
  assert.equal(await t.ev(() => RPG.data.story.wind.purpose), "business");
  await page.waitForSelector("#battle:not([hidden])", { timeout: 10000 });
  assert.equal(await t.ev(() => Battle.foe.name), "風之守衛", "customs boss, the officer is not a target");
  await page.waitForFunction(() => Battle.ready);
  assert.match(await t.ev(() => Battle.state.phase), /1\/3：來訪目的/);
  assert(["What is the purpose of your visit?", "What do you do?", "Are you traveling alone?"].includes(await t.ev(() => Learn.last.item.q)), "phase 1 asks about the visit");
  const phases = new Set();
  for (let k = 0; k < 40 && (await t.ev(() => Battle.active)); k++) {
    await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 10000 });
    if (await page.locator("#bt-claim").count()) break;
    phases.add(await t.ev(() => Battle.state.phase));
    await page.locator(".qz-o button").nth(await t.ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await page.waitForFunction(() => !Battle.ready, null, { timeout: 5000 });
  }
  assert.equal(phases.size, 3, "purpose, accommodation and days phases");
  await page.locator("#bt-claim").click();
  await page.waitForSelector("#dlg:not([hidden])");
  await t.play();
  assert.equal(await t.ev(() => RPG.data.story.wind.stage), 2);

  /* ---------- 8. Baggage at the desk: beginner lines, meet Lumi, invite her ---------- */
  await t.talk();
  const bag = await t.play({ choices: [/開始對話/, /服務櫃檯/, /一起走吧/] });
  assert(bag.qs.length === 5 && bag.qs.every((q) => q.q), "five beginner lines, NPC first");
  assert(bag.lines.some((l) => /露米/.test(l)) && bag.lines.some((l) => /不會替你答題/.test(l)), "meet Lumi; she does not answer for you");
  assert.equal(await t.ev(() => RPG.data.story.wind.bag), "desk");
  assert.deepEqual(await t.ev(() => [RPG.data.companion.claimed, World.entities.some((e) => e.kind === "pet" && e.look.name === "露米")]), [true, true], "desk path earns the companion");
  assert.match(await t.ev(() => RPG.stages[2].scene), /lostbag/);

  /* ---------- 9. Hotel: the desk branch changes the clerk's line ---------- */
  await t.talk();
  const hotel = await t.play({ choices: [/開始對話/] });
  assert(hotel.lines.some((l) => /suitcase arrived/.test(l)));
  assert(await t.ev(() => RPG.data.companion.bond === 4), "a story stage finished with Lumi adds bond");
  assert(await t.ev(() => RPG.data.story.wind.done), "story complete");
  await page.locator("#hud-quest").click();
  const journal = await page.locator("#menu-body").innerText();
  assert.match(journal, /風之旅行群島 · 故事完成/);
  assert.match(journal, /風／旅遊／行李沒出來（初級）／初級/);
  assert.match(journal, /不代表考試分數/);
  await page.locator("#menu-close").click();

  /* ---------- 10. Reload keeps everything; "back to the entrance" works ---------- */
  const xpEnd = await t.ev(() => P.xp);
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await t.ev(() => [RPG.data.at, RPG.data.kk.done, RPG.data.story.wind.done, P.xp, RPG.data.kk.units.w2]), ["wind", true, true, xpEnd, true]);
  assert(await t.ev(() => Learn.soundsDue().length > 0), "review state survives reload");
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="start"]').click();
  assert.deepEqual([(await t.hero()).x, (await t.hero()).y], [4, 8], "back to the map entrance");
  assert.deepEqual(errors, []);
  await ctx.close();

  /* ---------- 11. The other baggage branch: chase the gull (closer on right, further on wrong) ---------- */
  const b = await setup(browser);
  const t2 = h(b.page);
  await t2.ev(() => {
    localStorage.setItem("pm-rpg-v1", JSON.stringify({ version: 1, at: "wind", kk: { vowel: true, consonant: true, stress: true, word: true, bubble: true, battle: true, done: true }, story: { wind: { stage: 2, purpose: "sightseeing" } } }));
  });
  await b.page.reload();
  await b.page.waitForSelector(".world-canvas");
  assert.equal(await t2.ev(() => World.entities.some((e) => e.kind === "pet")), false, "no companion at the start");
  await t2.talk();
  await t2.play({ choices: [/開始對話/, /自己去追/] });
  assert(await t2.ev(() => RPG.data.companion.met && !RPG.data.companion.claimed), "met Lumi, not yet invited");
  assert(await t2.ev(() => World.entities.some((e) => e.story === "thief")), "gull appears");
  await t2.ev(() => World.approach(World.entities.find((e) => e.story === "thief")));
  await b.page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  await b.page.waitForFunction(() => Battle.ready);
  assert.equal(await t2.ev(() => Battle.state.dist), 3);
  await b.page.locator(".qz-o button").nth(await t2.ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  assert.equal(await t2.ev(() => Battle.state.dist), 4, "wrong: the gull flies further");
  const hpChase = await t2.ev(() => Battle.hp);
  await b.page.locator("#bt-next").click();
  await b.page.waitForFunction(() => Battle.ready);
  await b.page.locator(".qz-o button").nth(await t2.ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  assert.equal(await t2.ev(() => Battle.state.dist), 3, "right: closer");
  assert.equal(await t2.ev(() => Battle.hp), hpChase, "a chase does not hurt");
  await t2.battleWin();
  assert.deepEqual(await t2.ev(() => [RPG.data.story.wind.bag, RPG.data.story.wind.stage]), ["found", 3], "chase branch recovers the bag");
  await b.page.waitForSelector("#dlg:not([hidden])");
  await t2.play({ choices: [/一起走吧/] });
  assert(await t2.ev(() => RPG.data.companion.claimed), "chase path earns the companion too");
  await t2.talk();
  const h2 = await t2.play({ choices: [/開始對話/] });
  assert(h2.lines.some((l) => /help you with your bag/.test(l)), "chase branch has its own hotel line");
  assert.deepEqual(b.errors, []);
  await b.ctx.close();

  /* ---------- 12. Landscape keeps the controls visible; low HP brings the berry out ---------- */
  const l = await setup(browser, { width: 844, height: 390 });
  const tl = h(l.page);
  assert(await tl.ev(() => ["hud-hp", "quest-text", "hud-menu", "act-talk", "hud-more"].every((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  })), "landscape controls visible");
  await tl.ev(() => {
    Battle.setHp(10);
    RPG.refresh();
  });
  assert.equal(await l.page.locator("#hud-berry").isVisible(), true, "emergency supply shown at low HP");
  await l.page.setViewportSize({ width: 390, height: 600 });
  await l.page.waitForTimeout(300);
  assert.equal(await l.page.evaluate(() => document.getElementById("shell").getBoundingClientRect().height), 600, "resizes with the viewport");
  assert.deepEqual(l.errors, []);
  await l.ctx.close();

  console.log("PASS: 390px full screen with one main action, KK micro-lessons (demo-first units, retry not restart, taught sounds only, review saved, resume after a break), timed tutorial battle (3 options, extra time, hit on wrong, shield break), graduation and portal, listen-first check-in with folded cue, commute round trip, customs purpose + 3-phase immigration trial boss, beginner baggage lines, meeting and inviting Lumi, hotel lines per branch, journal, reload, back to entrance, gull chase (closer/further, no damage) and Lumi on that path too, landscape, low-HP berry, resize");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ dlg: document.getElementById("dlg-body").innerText.slice(0, 400), name: document.getElementById("dlg-name").textContent, quest: document.getElementById("quest-text").textContent, hero: World.hero, battle: Battle.active, log: document.getElementById("bt-log").textContent, at: RPG.data.at })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-story-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
