// Companion 露米 (wind fairy): earned in the find-luggage stage only, claim-later for players who already passed it,
// friend chats (3–5 turns, several right replies, off-topic replies corrected), bond from chats / wins / story with
// daily caps, unlocks (heal Lv2, chase Lv3, outfits), battle help that never answers for you (one hint per battle,
// assisted practice when one option is left, shield from 3 right answers, clock paused during the animation),
// rest toggle, commute mode for chats, monsters per island, audio failure fallback in listening battles.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;
const KK_DONE = { vowel: true, consonant: true, stress: true, word: true, bubble: true, battle: true, done: true, units: { v1: true, v2: true, v3: true, c1: true, c2: true, c3: true } };

async function setup(browser, save, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ([save, mute]) => {
      if (mute) {
        // Audio that cannot play: recorded clips fail and speech errors out.
        HTMLMediaElement.prototype.play = function () {
          return Promise.reject(new Error("blocked"));
        };
        if (window.speechSynthesis) speechSynthesis.speak = (u) => setTimeout(() => u.onerror && u.onerror(), 5);
      } else {
        HTMLMediaElement.prototype.play = function () {
          setTimeout(() => this.dispatchEvent(new Event("ended")), 5);
          return Promise.resolve();
        };
        if (window.speechSynthesis) speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5);
      }
      if (!localStorage.getItem("test-seeded")) {
        localStorage.setItem("pm-rpg-v1", JSON.stringify(save));
        localStorage.setItem("test-seeded", "1");
      }
    },
    [save, !!opt.mute],
  );
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  CUR = page;
  const ev = (f, a) => page.evaluate(f, a);
  const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());
  const right = () => ev(() => Learn.last.options.findIndex((o, i) => o.ok && !document.querySelectorAll(".qz-o button")[i].disabled));
  const wrong = () => ev(() => Learn.last.options.findIndex((o, i) => !o.ok && !document.querySelectorAll(".qz-o button")[i].disabled));
  async function fightNearest(filter) {
    await ev((f) => {
      const ms = World.entities.filter((e) => e.kind === "mob" && !e.dead && (!f || e.name === f));
      ms.forEach((m) => (m.wait = 999));
      const h = World.hero,
        m = ms.sort((a, b) => Math.hypot(a.tx - h.x, a.ty - h.y) - Math.hypot(b.tx - h.x, b.ty - h.y))[0];
      World.approach(m);
    }, filter || null);
    await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  }
  return { ctx, page, errors, ev, visible, right, wrong, fightNearest };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });

  /* ---------- 1. Returning player who already passed the baggage stage: claim later at the carousel ---------- */
  const a = await setup(browser, { version: 1, at: "wind", kk: KK_DONE, story: { wind: { stage: 4, done: true, bag: "desk", purpose: "sightseeing" } } });
  const { page, ev } = a;
  assert.equal(await ev(() => World.entities.some((e) => e.kind === "pet")), false, "no companion just for having an old save");
  assert.equal(await ev(() => RPG.data.companion.claimed), false);
  assert(await ev(() => !!World.npc("lumi")), "Lumi waits at the carousel");
  assert.match(await page.locator("#quest-text").innerText(), /露米/, "the objective points to her");
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  for (let k = 0; k < 10 && (await a.visible("#dlg")); k++) {
    if (await a.visible(".dlg-choices")) await page.locator(".dlg-choices button", { hasText: "一起走吧" }).click();
    else await page.locator(".dlg-next").click();
  }
  assert.deepEqual(await ev(() => [RPG.data.companion.claimed, RPG.data.companion.bond, !!World.npc("lumi")]), [true, 0, false], "claimed; the waiting NPC is gone");
  assert(await ev(() => World.entities.some((e) => e.kind === "pet" && e.look.name === "露米")), "Lumi follows");

  /* ---------- 2. Companion sheet and a friend chat ---------- */
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="buddy"]').click();
  const sheet = await page.locator("#menu-body").innerText();
  assert.match(sheet, /默契 Lv\.1[\s\S]*打招呼[\s\S]*今天吃什麼[\s\S]*規劃旅行/);
  assert.match(sheet, /🔒 微風治療[\s\S]*🔒 追擊/, "heal and chase locked at Lv.1");
  await page.locator('[data-chat="food"]').click();
  await page.waitForSelector("#dlg:not([hidden])");
  let turns = 0,
    offTopic = false,
    corrected = false;
  for (let k = 0; k < 40 && (await a.visible("#dlg")); k++) {
    if (await a.visible(".dlg-choices")) {
      const labels = await page.locator(".dlg-choices button").allInnerTexts();
      const pick = await ev((labels) => {
        const sc = SCENES.find((c) => c.id === "companion").scenes.find((s) => s.id === "food");
        const ok = new Set(sc.items.flatMap((it) => [it.en, ...(it.alt || []).map((x) => x.en)]));
        return labels.map((l) => ok.has(l));
      }, labels);
      assert(pick.filter(Boolean).length >= 1 && pick.length <= 3, "one or two good replies plus an off-topic one");
      turns++;
      // first turn: answer off-topic once to see the gentle correction
      const i = turns === 1 ? pick.indexOf(false) : pick.indexOf(true);
      if (turns === 1) offTopic = true;
      await page.locator(".dlg-choices button").nth(i).click();
      continue;
    }
    const body = await page.locator("#dlg-body").innerText();
    if (/接不太上/.test(body)) corrected = true;
    if (await a.visible(".dlg-next")) await page.locator(".dlg-next").click();
    else await page.waitForTimeout(50);
  }
  assert(turns >= 3 && turns <= 5, "3–5 turns, got " + turns);
  assert(offTopic && corrected, "an off-topic reply gets a gentle fix");
  assert.equal(await ev(() => RPG.data.companion.bond), 3, "chat adds bond");
  const clog = await ev(() => JSON.parse(localStorage.getItem("pm-log"))[0]);
  assert.equal(clog.scn, "旅伴聊天・今天吃什麼");
  assert.equal(clog.tot, turns);
  // Same topic again today: practice is fine, but no extra bond (no farming)
  await ev(() => {
    document.getElementById("hud-menu").click();
  });
  await page.locator('[data-m="buddy"]').click();
  assert.match(await page.locator('[data-chat="food"]').innerText(), /今天聊過了/);
  await page.locator('[data-chat="food"]').click();
  for (let k = 0; k < 40 && (await a.visible("#dlg")); k++) {
    if (await a.visible(".dlg-choices")) await page.locator(".dlg-choices button").first().click();
    else if (await a.visible(".dlg-next")) await page.locator(".dlg-next").click();
    else await page.waitForTimeout(50);
  }
  assert.equal(await ev(() => RPG.data.companion.bond), 3, "same topic, same day: no extra bond");

  /* ---------- 3. Commute mode practises the companion chats ---------- */
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="buddy"]').click();
  await page.locator('[data-buddy="drive"]').click();
  await page.waitForSelector("#drive:not([hidden])");
  assert.match(await page.locator("#drive-from").innerText(), /旅伴聊天/);
  await page.locator("#drive-back").click();
  await page.waitForSelector("#panel", { state: "hidden" });

  /* ---------- 4. Battle help: hint once (clock paused while it plays), shield from 3 right answers ---------- */
  await ev(() => World.walkTo(5, 8));
  await a.fightNearest("草地史萊姆");
  await page.waitForFunction(() => Battle.ready);
  assert.equal(await ev(() => Battle.foe.name), "草地史萊姆", "west island monster");
  await ev(() => Battle.setFoeHp(400));
  assert.equal(await page.locator("#bt-buddy").isVisible(), true, "Lumi shown in battle");
  const nOpts = await page.locator(".qz-o button").count();
  await page.locator('[data-help="hint"]').click();
  const l1 = await ev(() => Battle.state.left);
  await page.waitForTimeout(300);
  assert.equal(await ev(() => Battle.state.left), l1, "clock paused during the support animation");
  await page.waitForSelector(".qz-o button.gone", { state: "attached" });
  assert.equal(await page.locator(".qz-o button.gone").count(), 1, "one wrong option removed");
  assert.equal(await ev(() => Learn.last.options.filter((o) => o.ok).length), 1, "she never picks for you");
  assert.equal(await page.locator('[data-help="hint"]').isDisabled(), true, "one hint per battle");
  assert.equal(await ev(() => !!Learn.last.assisted), nOpts === 2, "assisted only if one option is left");
  for (let k = 0; k < 3; k++) {
    await page.locator(".qz-o button").nth(await a.right()).click();
    await page.waitForFunction(() => Battle.ready, null, { timeout: 10000 });
  }
  assert.equal(await ev(() => Battle.state.guard), 1, "3 right answers: wind shield");
  const hpG = await ev(() => Battle.hp);
  await page.locator(".qz-o button").nth(await a.wrong()).click();
  assert.equal(await ev(() => Battle.hp), hpG, "shield blocks the hit");
  await page.locator("#bt-next").click();
  // Lv.1: no heal even at low HP
  await page.waitForFunction(() => Battle.ready);
  await ev(() => Battle.setHp(20));
  await page.locator(".qz-o button").nth(await a.wrong()).click();
  assert((await ev(() => Battle.hp)) < 20, "no heal at bond Lv.1");
  await page.locator("#bt-next").click();
  await page.waitForFunction(() => Battle.ready);
  await ev(() => Battle.setFoeHp(3));
  await ev(() => Battle.setHp(80));
  await page.locator(".qz-o button").nth(await a.right()).click();
  await page.waitForSelector("#bt-claim");
  await page.locator("#bt-claim").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  assert.equal(await ev(() => RPG.data.companion.bond), 4, "a win together adds 1");
  // Daily cap on battle bond
  await ev(() => (RPG.data.companion.day.wins = 5));

  /* ---------- 5. Bond Lv.2 heal, Lv.3 chase attack, outfits ---------- */
  await ev(() => {
    RPG.data.companion.bond = 30;
  });
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="buddy"]').click();
  const s3 = await page.locator("#menu-body").innerText();
  assert.match(s3, /默契 Lv\.3/);
  assert(!/🔒 微風治療|🔒 追擊/.test(s3), "heal and chase unlocked");
  assert.equal(await page.locator('[data-outfit="leaf"]').isDisabled(), false);
  assert.equal(await page.locator('[data-outfit="star"]').isDisabled(), true, "Lv.4 outfit still locked");
  await page.locator('[data-outfit="leaf"]').click();
  assert.equal(await ev(() => World.entities.find((e) => e.kind === "pet").look.hat), "#7cc56a", "outfit worn on the map");
  await page.locator("#menu-close").click();
  await ev(() => World.walkTo(16, 8));
  await a.fightNearest("旋風雀");
  await page.waitForFunction(() => Battle.ready);
  assert.equal(await ev(() => Battle.foe.name), "旋風雀", "middle island monster asks listening questions");
  assert.equal(await ev(() => Learn.last.recK), "s", "travel conversation questions");
  await ev(() => Battle.setFoeHp(400));
  const f0 = await ev(() => Battle.foe.hp);
  await page.locator(".qz-o button").nth(await a.right()).click();
  assert.match(await page.locator("#bt-log").innerText(), /追擊 \+4/, "chase attack at Lv.3");
  assert((await ev(() => Battle.foe.hp)) < f0);
  await page.waitForFunction(() => Battle.ready, null, { timeout: 10000 });
  await ev(() => Battle.setHp(25));
  await page.locator(".qz-o button").nth(await a.wrong()).click();
  assert.match(await page.locator("#bt-log").innerText(), /回復/, "heal at Lv.2+ when HP runs low");
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });

  /* ---------- 6. Rest toggle: no follower, no battle help; reload keeps it ---------- */
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="buddy"]').click();
  await page.locator('[data-buddy="toggle"]').click();
  assert.equal(await ev(() => World.entities.some((e) => e.kind === "pet")), false, "resting");
  await page.locator("#menu-close").click();
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await ev(() => [RPG.data.companion.active, RPG.data.companion.outfit, World.entities.some((e) => e.kind === "pet")]), [false, "leaf", false]);
  await ev(() => World.walkTo(30, 8));
  await a.fightNearest("岩甲龜");
  await page.waitForFunction(() => Battle.ready);
  assert.equal(await ev(() => Battle.foe.shield), true, "east island turtle starts with rock armour");
  assert.equal(await page.locator('[data-help="hint"]').count(), 0, "no companion help while she rests");
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  await page.locator("#hud-quest").click();
  assert.match(await page.locator("#menu-body").innerText(), /露米同行中・默契 Lv\.3/);
  assert.deepEqual(a.errors, []);
  await a.ctx.close();

  /* ---------- 7. A fresh player gets no companion; KK monsters and the tutorial bubble ---------- */
  const n = await setup(browser, { version: 1, at: "kk", kk: KK_DONE });
  assert.equal(await n.ev(() => World.entities.some((e) => e.kind === "pet")), false);
  assert.equal(await n.ev(() => World.entities.filter((e) => e.kind === "mob")[0].name), "音節泡泡");
  assert.equal(await n.ev(() => World.entities.filter((e) => e.kind === "mob")[0].look.hp), 24);
  await n.page.locator("#hud-menu").click();
  assert.equal(await n.page.locator('[data-m="buddy"]').count(), 0, "no companion menu before earning her");
  assert.deepEqual(n.errors, []);
  await n.ctx.close();

  /* ---------- 8. Listening battle with audio that cannot play: the clock waits; replay or read instead ---------- */
  const m = await setup(browser, { version: 1, at: "wind", kk: KK_DONE, story: { wind: { stage: 1 } } }, { mute: true });
  await m.ev(() => World.walkTo(16, 8));
  await m.fightNearest("旋風雀");
  await m.page.waitForSelector("#bt-read", { timeout: 15000 });
  assert.equal(await m.ev(() => Battle.state.left), null, "no countdown before the audio is heard");
  assert.equal(await m.page.locator(".qz-o button:not([disabled])").count(), 0, "options wait too");
  await m.page.locator("#bt-read").click();
  assert.match(await m.page.locator("#bt-feedback").innerText(), /題目文字/);
  await m.page.waitForFunction(() => Battle.ready);
  assert(await m.ev(() => Battle.state.left > 0), "clock starts after switching to text");
  assert.deepEqual(m.errors, []);
  await m.ctx.close();

  console.log("PASS: no companion for new or old saves until earned, claim-later at the carousel, companion sheet with locks, friend chat (3–5 turns, several good replies, off-topic corrected, logged), no bond farming on the same topic, commute mode for chats, hint once with paused clock and no answering for you, shield from 3 right answers, win bond, Lv.2 heal / Lv.3 chase / outfits, rest toggle saved, island monsters (slime, whirlwind sparrow listening, rock turtle armour), KK bubble HP 24, audio failure waits for replay or text");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ dlg: document.getElementById("dlg-body").innerText.slice(0, 300), menu: document.getElementById("menu-body").innerText.slice(0, 300), battle: Battle.state, log: document.getElementById("bt-log").textContent, hero: World.hero, at: RPG.data.at, comp: RPG.data.companion })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-companion-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
