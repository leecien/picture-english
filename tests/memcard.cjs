// Battle memory card: right answer → attack → card → continue. A word's first 2–4 independent right answers show
// its card (the number fixed per word; count = the card book, pm-cards .c); after that only the short "答對了". Wrong, timeout, assisted
// and the same word again within the cool-down add nothing and show nothing. The card stays in the battle view about
// 3 s or until "繼續戰鬥"; its countdown waits while its sound plays and holds when the page is hidden. Showing,
// replaying or closing it gives no XP and no second attack. The last blow shows the card first, then the victory.
// Fleeing during a card never pulls the player back. Counts survive a reload.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 760 } }),
    errors = [];
  CUR = page;
  page.on("pageerror", (e) => errors.push(e.message));
  // a returning player on a legacy map (word and sentence questions)
  const legacy = {
    "pm-progress": JSON.stringify({ xp: 25, correct: 2, w: 2, s: 0, rounds: 1, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": "{}",
    "pm-log": "[]",
  };
  await page.addInitScript((values) => {
    // test clock skew, moved only between battles (no clock running) to let the 3-minute cool-down expire
    const realNow = Date.now;
    window.__skew = 0;
    Date.now = () => realNow() + window.__skew;
    window.__plays = 0;
    window.__playMs = 5;
    HTMLMediaElement.prototype.play = function () {
      window.__plays++;
      setTimeout(() => this.dispatchEvent(new Event("ended")), window.__playMs);
      return Promise.resolve();
    };
    if (window.speechSynthesis)
      speechSynthesis.speak = (u) => {
        window.__plays++;
        setTimeout(() => u.onend && u.onend(), window.__playMs);
      };
    if (!localStorage.getItem("test-seeded")) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      localStorage.setItem("test-seeded", "1");
    }
  }, legacy);
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  const ready = () => page.waitForFunction(() => Battle.ready, null, { timeout: 15000 });
  const card = () => page.locator("#bt-card");
  const fight = async () => {
    await ev(() => {
      const ms = World.entities.filter((e) => e.kind === "mob" && !e.dead);
      ms.forEach((m) => (m.wait = 999));
      const h = World.hero,
        m = ms.sort((a, b) => Math.hypot(a.tx - h.x, a.ty - h.y) - Math.hypot(b.tx - h.x, b.ty - h.y))[0];
      World.approach(m);
    });
    await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
    await ev(() => Battle.setFoeHp(500));
  };
  const answer = async (ok) => {
    await ready();
    const i = await ev((ok) => Learn.last.options.findIndex((o) => !!o.ok === ok), ok);
    await page.locator("#bt-act .qz-o button").nth(i).click();
  };
  const cardOf = (w) => ev((w) => (CARDS[w] ? { ...CARDS[w] } : null), w);
  /* The next word question (sentence questions are answered right and passed); its card count set to n. */
  const wordQ = async (n, allowCool = false) => {
    for (let k = 0; k < 60; k++) {
      await ready();
      await ev(() => Battle.setFoeHp(500)); // skipped questions must not end the fight
      const q = await ev(() => {
        const recent = (JSON.parse(localStorage.getItem("pm-learn-v1") || "{}").recent || {})["w:" + (Learn.last.item.w || "")];
        return { recK: Learn.last.recK, w: Learn.last.item.w || "", sup: !!Learn.last.item.sup, cool: recent > Date.now() - 3 * 60 * 1000 };
      });
      // a word answered right in the last 3 minutes is in the cool-down (not an independent new answer): skip it
      if (q.recK === "w" && q.w && !q.sup && (allowCool || !q.cool)) {
        await ev(([w, n]) => (CARDS[w] = { c: n, w: 0, last: 1 }), [q.w, n]);
        return q.w;
      }
      await answer(true);
      if (await card().count()) await page.locator("#bt-card-go").click();
    }
    throw new Error("no word question");
  };

  await fight();

  /* 1st independent right answer → attack, then the card (picture, English, Chinese, KK, 🔊), ~3 s, then the next question */
  let w = await wordQ(0);
  let hp0 = await ev(() => Battle.foe.hp),
    xp0 = await ev(() => P.xp);
  await answer(true);
  await page.waitForSelector("#bt-card", { timeout: 3000 });
  const t0 = Date.now();
  assert.equal((await cardOf(w)).c, 1);
  const hpHit = await ev(() => Battle.foe.hp);
  assert(hpHit < hp0, "the attack lands before the card");
  const xpHit = await ev(() => P.xp);
  assert(xpHit > xp0, "the right answer gave its XP once");
  const txt = await card().innerText();
  assert.match(txt, new RegExp(w));
  const L1 = await ev((w) => Battle.cardLimit(w), w);
  assert.match(txt, new RegExp(`記憶卡 1/${L1}`));
  const it = await ev((w) => WORDS.find((x) => x.w === w), w);
  if (it.z) assert(txt.includes(it.z), "Chinese");
  if (it.kk) assert(txt.includes(it.kk), "checked KK");
  assert.equal(await page.locator("#bt-card .bt-card-pic").count(), 1, "picture (image or emoji)");
  assert.equal(await page.locator("#bt-card-say").isVisible(), true, "pronunciation button");
  assert.equal(await page.locator("#battle").isVisible(), true, "the card stays inside the battle view");
  assert.equal(await ev(() => Battle.ready), false, "no next question (and no clock) while the card is up");
  await ready();
  const shown = Date.now() - t0;
  assert(shown >= 2500, `stays about 3 s (${shown} ms)`);
  assert.equal(await card().count(), 0);
  assert.equal(await ev(() => Battle.foe.hp), hpHit, "closing the card is not a second attack");
  assert.equal(await ev(() => P.xp), xpHit, "showing / closing the card gives no XP");

  /* 2nd: "繼續戰鬥" closes it early */
  w = await wordQ(1);
  await answer(true);
  await page.waitForSelector("#bt-card");
  assert.match(await card().innerText(), new RegExp(`記憶卡 2/${await ev((w) => Battle.cardLimit(w), w)}`));
  const t1 = Date.now();
  await page.locator("#bt-card-go").click();
  await ready();
  assert(Date.now() - t1 < 1500, "continue closes it at once");

  /* the word's last card (n = its limit, 2–4): 🔊 plays once even when tapped twice; the card waits while it plays;
     replay gives no XP */
  w = await wordQ(0);
  let L = await ev((w) => Battle.cardLimit(w), w);
  await ev(([w, n]) => (CARDS[w].c = n), [w, L - 1]);
  await answer(true);
  await page.waitForSelector("#bt-card");
  assert.match(await card().innerText(), new RegExp(`記憶卡 ${L}/${L}`));
  const xp3 = await ev(() => P.xp),
    p0 = await ev(() => window.__plays);
  await ev(() => (window.__playMs = 4000));
  await page.locator("#bt-card-say").click();
  await page.locator("#bt-card-say").click();
  assert.equal((await ev(() => window.__plays)) - p0, 1, "no overlapping playback");
  await page.waitForTimeout(3300);
  assert.equal(await card().count(), 1, "the countdown waits while the sound plays");
  await ev(() => (window.__playMs = 5));
  await page.locator("#bt-card-go").click();
  await ready();
  assert.equal(await ev(() => P.xp), xp3, "replaying gives no XP");

  /* one past the limit: only the short "答對了" */
  w = await wordQ(0);
  L = await ev((w) => Battle.cardLimit(w), w);
  await ev(([w, n]) => (CARDS[w].c = n), [w, L]);
  await answer(true);
  await page.waitForSelector("#bt-feedback .good");
  await page.waitForTimeout(600);
  assert.equal(await card().count(), 0, "no card past the word's limit");
  assert.equal((await cardOf(w)).c, L + 1);
  await ready();

  /* an old player's familiar word (c ≥ 3) never pops a card */
  w = await wordQ(9, true);
  await answer(true);
  await page.waitForTimeout(700);
  assert.equal(await card().count(), 0, "familiar word: no card");

  /* wrong: no card, no count */
  w = await wordQ(0, true);
  await answer(false);
  await page.waitForSelector("#bt-next");
  assert.equal(await card().count(), 0);
  assert.deepEqual([(await cardOf(w)).c, (await cardOf(w)).w], [0, 1], "a wrong answer adds no right count");
  await page.locator("#bt-next").click();

  /* timeout: no card, no count */
  w = await wordQ(0, true);
  await ev(() => Battle.settleForTest("timeout"));
  await page.waitForSelector("#bt-next");
  assert.equal(await card().count(), 0);
  assert.equal((await cardOf(w)).c, 0, "a timeout adds nothing");
  await page.locator("#bt-next").click();

  /* assisted (hint left one option): practice, no card, no count */
  w = await wordQ(0, true);
  await ev(() => (Learn.last.assisted = true));
  await answer(true);
  await page.waitForTimeout(1200);
  assert.equal(await card().count(), 0);
  assert.equal((await cardOf(w)).c, 0, "an assisted answer adds nothing");

  /* the same word again within the cool-down: not a new independent right answer */
  w = await wordQ(0);
  const again = await ev(() => {
    const q = Learn.last,
      before = CARDS[q.item.w] ? CARDS[q.item.w].c : 0,
      g1 = Learn.grade(q, true, "battle"),
      g2 = Learn.grade(q, true, "battle");
    return { before, after: CARDS[q.item.w].c, g1: g1.fresh, g2: g2.fresh };
  });
  assert.equal(again.g2, false, "a quick repeat is not fresh");
  assert.equal(again.after - again.before, 1, "only the first of two quick right answers counts");
  await answer(true); // the third right answer on the same word within seconds
  await page.waitForTimeout(700);
  assert.equal(await card().count(), 0, "a quick repeat shows no card");
  assert.equal((await cardOf(w)).c, 1, "and adds no count");
  await ready();

  /* a new battle 4 minutes later (cool-down over) */
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  await ev(() => (window.__skew += 4 * 60 * 1000));
  await fight();

  /* page hidden while the card is up: it holds and waits for the button; no new question starts behind it */
  w = await wordQ(0);
  await answer(true);
  await page.waitForSelector("#bt-card");
  await ev(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(3600);
  await ev(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(800);
  assert.equal(await card().count(), 1, "held while away, still waiting after coming back");
  assert.match(await card().innerText(), /繼續戰鬥/);
  assert.equal(await ev(() => Battle.ready), false, "no countdown behind the card");
  await page.locator("#bt-card-go").click();
  await ready();

  /* the last blow: card first, then the victory and its loot */
  w = await wordQ(0);
  await ev(() => Battle.setFoeHp(1));
  await answer(true);
  await page.waitForSelector("#bt-card");
  assert.equal(await page.locator("#bt-claim").count(), 0, "victory waits for the card");
  await page.locator("#bt-card-go").click();
  await page.waitForSelector("#bt-claim", { timeout: 5000 });
  await page.locator("#bt-claim").click();
  await page.waitForSelector("#battle", { state: "hidden" });

  /* flee while the card is up: the battle ends and the old card never brings it back */
  await ev(() => (window.__skew += 4 * 60 * 1000));
  await fight();
  w = await wordQ(0);
  await answer(true);
  await page.waitForSelector("#bt-card");
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  await page.waitForTimeout(3600);
  assert.equal(await page.locator("#battle").isHidden(), true, "not pulled back into the battle");
  assert.equal(await card().count(), 0);

  /* counts survive a reload (they are the card book) */
  const saved = await ev((w) => JSON.parse(localStorage.getItem("pm-cards"))[w].c, w);
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.equal(await ev((w) => CARDS[w].c, w), saved, "count kept after reload");
  // the limit is 2, 3 or 4, fixed per word: all three occur across the word bank and a reload gives the same numbers
  const limits = await ev(() => Object.fromEntries(WORDS.map((x) => [x.w, Battle.cardLimit(x.w)])));
  assert.deepEqual([...new Set(Object.values(limits))].sort(), [2, 3, 4], "limits vary between words (2–4)");
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await ev(() => Object.fromEntries(WORDS.map((x) => [x.w, Battle.cardLimit(x.w)]))), limits, "same limit for a word after reload");

  assert.deepEqual(errors, []);
  console.log("PASS: memory card after the attack for a word's first 2–4 independent right answers (limit picked per word, 2/3/4 all occur, same after reload) (picture, English, Chinese, KK, 🔊; in the battle view ~3 s, or 繼續戰鬥), none past the limit or for familiar words, none for wrong / timeout / assisted / quick repeat, sound plays once and pauses the countdown, holds while the page is hidden, no XP or second attack from the card, last blow shows the card before the victory, fleeing never pulls back, counts survive reload");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ battle: Battle.state, q: Learn.last && { k: Learn.last.recK, w: Learn.last.item.w || Learn.last.item.en }, card: (document.getElementById("bt-card") || {}).innerText })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-memcard-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
