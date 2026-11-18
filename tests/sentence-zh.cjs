// Sentence options in battle + whole-line Chinese + fixed phrases.
// - Choosing a sentence option answers once and plays that whole sentence (right or wrong); the 🔊 beside an
//   option only replays it. No overlapping sound; the next question (and its countdown) waits until the line has
//   finished; double taps do not attack or score twice.
// - 「看中文」 next to a line shows its own context translation (data/line-zh.json / the material's zh), folds again,
//   is not an answer, and stops the battle clock while open; options get theirs only after answering.
// - Fixed phrases are one unit: tapping either word of "Good evening" first shows 晚上好 and plays "Good evening";
//   the phrase card offers 「查看個別單字」. Word look-up (dotted words) still works.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;
(async () => {
  const timing = [];
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 760 } }),
    errors = [];
  CUR = page;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("pm-progress", JSON.stringify({ xp: 25, correct: 2, w: 2, s: 0, rounds: 1, modes: ["word"], badges: ["first"], placeDismissed: true }));
    window.__played = [];
    window.__playMs = 5;
    HTMLMediaElement.prototype.play = function () {
      if (!/^data:/.test(this.src)) window.__played.push("file:" + this.src.split("/").pop()); // data: = UI click sound unlock
      setTimeout(() => this.dispatchEvent(new Event("ended")), window.__playMs);
      return Promise.resolve();
    };
    if (window.speechSynthesis) {
      speechSynthesis.speak = (u) => {
        window.__played.push(u.text);
        setTimeout(() => u.onend && u.onend(), window.__playMs);
      };
      speechSynthesis.cancel = () => {};
    }
  });
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Pron.phrase("good evening") && Pron.lineZh("Good evening. How can I help you?"));
  const ev = (f, a) => page.evaluate(f, a);
  const played = () => ev(() => window.__played.slice());
  const clearPlayed = () => ev(() => (window.__played = []));

  /* ---------- fixed phrases and 看中文 on a line (outside battle) ---------- */
  await ev(() => {
    const d = document.createElement("div");
    d.id = "t-line";
    d.style.cssText = "position:fixed;top:120px;left:16px;right:16px;z-index:70;background:#fff;padding:8px";
    d.innerHTML = `<p>${Pron.sent("Good evening. How can I help you?")}</p><p>${Pron.sent("I'd like to check in, please.", "", { zh: "我要辦理入住。" })}</p>`;
    document.body.appendChild(d);
  });
  const pp = await ev(() => [...document.querySelectorAll("#t-line .pw-p")].map((x) => [x.textContent, x.dataset.p]));
  assert.deepEqual(pp.slice(0, 2), [["Good", "good evening"], ["evening.", "good evening"]], "Good evening is one phrase");
  assert(pp.some(([t, p]) => t === "help" && p === "how can i help you"), "How can I help you? is one phrase");
  for (const word of ["Good", "evening."]) {
    await clearPlayed();
    await page.locator("#t-line .pw-p", { hasText: word }).first().click();
    const card = page.locator(".wd-card");
    await card.waitFor();
    const t = await card.innerText();
    assert.match(t, /晚上好/, `tapping "${word}" shows the greeting first`);
    assert.doesNotMatch(t, /^好的/, "not good + evening");
    assert.match(t, /片語/);
    assert.deepEqual(await played(), ["Good evening"], "the whole greeting plays");
  }
  await page.locator(".wd-words").click();
  assert.equal(await page.locator(".wd-singles").isVisible(), true, "查看個別單字");
  assert.match(await page.locator(".wd-singles").innerText(), /Good[\s\S]*evening/);
  await page.locator(".wd-close").click();
  await clearPlayed();
  await page.locator("#t-line .pw-p", { hasText: "help" }).click();
  assert.match(await page.locator(".wd-card").innerText(), /請問需要什麼協助？/);
  assert.deepEqual(await played(), ["How can I help you"]);
  await page.locator(".wd-close").click();
  await page.locator("#t-line .pw-p", { hasText: "check" }).click();
  assert.match(await page.locator(".wd-card").innerText(), /辦理入住/, "check in → 辦理入住");
  await page.locator(".wd-close").click();
  // 看中文: the line's own translation, toggled
  const zb = page.locator("#t-line .zh-btn").first();
  assert.equal(await page.locator("#t-line .zh-line").first().isHidden(), true, "folded at first");
  await zb.click();
  assert.equal(await page.locator("#t-line .zh-line").first().innerText(), "晚上好，請問需要什麼協助？", "whole-line context translation");
  assert.equal(await zb.innerText(), "收起中文");
  await zb.click();
  assert.equal(await page.locator("#t-line .zh-line").first().isHidden(), true, "folds again");
  await page.locator("#t-line .zh-btn").nth(1).click();
  assert.equal(await page.locator("#t-line .zh-line").nth(1).innerText(), "我要辦理入住。");
  await ev(() => document.getElementById("t-line").remove());

  /* ---------- battle: hotel reply question ---------- */
  const startBattle = (idx) =>
    ev((idx) => {
      window.__ended = null;
      Battle.start(
        { look: { name: "測試泡泡", shape: "bubble", colors: ["#bfe6ff", "#ffffff"], lv: 1, hp: 500, atk: 3 } },
        { region: "wind", make: () => Learn.sceneQuestion("travel", "hotel", idx, { mode: "listen", ctx: "battle" }), onEnd: (r) => (window.__ended = r) },
      );
    }, idx);
  await startBattle(0);
  await page.waitForFunction(() => Battle.ready, null, { timeout: 15000 });
  // the other person's line: phrases + 看中文; reading it stops the clock and is not an answer
  assert.equal(await page.locator("#bt-act .qz-their .pw-p").count() >= 2, true, "phrases in the prompt line");
  // Timing (revision 10 item 5): the countdown ticks every 0.1 s, so a value read *before* the click can be one tick
  // older than the value at the moment the Chinese opens (the coordinator's 18 vs 17.9). Measure the two apart:
  //   pre  = the clock just before clicking (it must really be running: a real countdown, not a stuck one)
  //   open = the clock in the same instant the translation is visible
  //   held = the clock 1.5 s later, still open → must equal `open` exactly (frozen, no tick lost or skipped)
  const runA = await ev(() => Battle.state.left);
  await page.waitForTimeout(350);
  const pre = await ev(() => Battle.state.left);
  assert(pre < runA, `the countdown runs before reading (${runA} → ${pre})`);
  await page.locator("#bt-act .qz-their .zh-btn").click();
  const open = await page.waitForFunction(() => {
    const z = document.querySelector("#bt-act .qz-their .zh-line");
    return z && !z.hidden && z.offsetHeight > 0 ? Battle.state.left : null;
  });
  const leftOpen = await open.jsonValue();
  assert.equal(await page.locator("#bt-act .qz-their .zh-line").innerText(), "晚上好，請問需要什麼協助？");
  await page.waitForTimeout(1500);
  const held = await ev(() => Battle.state.left);
  timing.push({ pre, open: leftOpen, held, preToOpen: +(pre - leftOpen).toFixed(1) });
  assert.equal(held, leftOpen, `the clock is frozen while the Chinese is open (open ${leftOpen}, after 1.5 s ${held})`);
  assert(pre - leftOpen <= 0.3 + 1e-9, `only ticks between reading the clock and the click (${pre} → ${leftOpen})`);
  assert.equal(await ev(() => Battle.state.settled), false, "reading is not answering");
  await page.locator("#bt-act .qz-their .zh-btn").click();
  await page.waitForTimeout(400);
  assert((await ev(() => Battle.state.left)) < held, "the clock runs again when folded");
  // a phrase in the prompt: card first, still not an answer
  await page.locator("#bt-act .qz-their .pw-p", { hasText: "evening" }).click();
  assert.match(await page.locator(".wd-card").innerText(), /晚上好/);
  assert.equal(await ev(() => Battle.state.settled), false);
  await page.locator(".wd-close").click();
  // no Chinese on the options before answering (it would point at the right one)
  assert.equal(await page.locator("#bt-act .qz-o .zh-btn").count(), 0, "options: no Chinese before answering");
  // 🔊 beside an option only replays it
  const opts = await ev(() => Learn.last.options.map((o) => ({ en: o.html, ok: !!o.ok })));
  await clearPlayed();
  await page.locator("#bt-act .qz-o .qz-hear").first().click();
  await page.waitForTimeout(100);
  assert.deepEqual(await played(), [opts[0].en], "the speaker plays the option");
  assert.equal(await ev(() => Battle.state.settled), false, "and does not answer");

  // a wrong choice: answered once, the chosen sentence plays (not the right one on top), the next question waits
  const wrongI = opts.findIndex((o) => !o.ok),
    myHp0 = await ev(() => Battle.hp);
  await ev(() => (window.__playMs = 2500));
  await clearPlayed();
  await ev((i) => {
    const b = document.querySelectorAll("#bt-act .qz-o > .qz-opt > button")[i];
    b.click();
    b.click(); // double tap
  }, wrongI);
  await page.waitForTimeout(150);
  assert.deepEqual(await played(), [opts[wrongI].en], "the chosen (wrong) sentence plays once, nothing on top");
  const myHp1 = await ev(() => Battle.hp);
  assert(myHp1 < myHp0, "a wrong answer is hit once");
  await page.waitForTimeout(300);
  assert.equal(await ev(() => Battle.hp), myHp1, "no second hit from the double tap");
  // after answering: each option can show its own Chinese
  assert.equal(await page.locator("#bt-act .qz-o .zh-btn").count(), opts.length, "options: 看中文 after answering");
  await page.locator("#bt-act .qz-o .zh-btn").nth(wrongI).click();
  assert.notEqual(await page.locator("#bt-act .qz-o .zh-line").nth(wrongI).innerText(), "");
  await page.locator("#bt-next").click();
  await page.locator("#bt-next").click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  assert.equal(await ev(() => Battle.ready), false, "the next question waits while the chosen line plays");
  await page.waitForFunction(() => Battle.ready, null, { timeout: 8000 });
  assert.equal(await ev(() => Battle.state.turn), 2, "exactly one next question");

  // a right choice: the chosen sentence plays, then the next question
  const opts2 = await ev(() => Learn.last.options.map((o) => ({ en: o.html, ok: !!o.ok })));
  const rightI = opts2.findIndex((o) => o.ok),
    foe0 = await ev(() => Battle.foe.hp),
    xp0 = await ev(() => P.xp);
  await clearPlayed();
  await ev((i) => {
    const b = document.querySelectorAll("#bt-act .qz-o > .qz-opt > button")[i];
    b.click();
    b.click();
  }, rightI);
  await page.waitForTimeout(150);
  assert.deepEqual(await played(), [opts2[rightI].en.replace(/&#39;/g, "'")], "the chosen (right) sentence plays once");
  const foe1 = await ev(() => Battle.foe.hp);
  assert(foe1 < foe0, "one attack");
  await page.waitForTimeout(1300);
  assert.equal(await ev(() => Battle.ready), false, "no next question while it plays");
  assert.equal(await ev(() => Battle.foe.hp), foe1, "no second attack");
  const xp1 = await ev(() => P.xp);
  assert(xp1 - xp0 <= 8, "scored once");
  await page.waitForFunction(() => Battle.ready, null, { timeout: 8000 });
  assert.equal(await ev(() => Battle.state.turn), 3);
  await ev(() => (window.__playMs = 5));
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });

  assert.deepEqual(errors, []);
  console.log("TIMING " + JSON.stringify(timing));
  console.log("PASS: phrases are one unit (Good evening → 晚上好 + the whole greeting played from either word; How can I help you?; check in), 查看個別單字, 看中文 shows the line's own translation and folds; in battle: reading Chinese or a phrase is not an answer and stops the clock, options get 看中文 only after answering, 🔊 only replays, choosing a sentence answers once and plays that whole sentence (right or wrong, nothing on top), double taps do not hit / attack / score twice, the next question waits for the line");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ battle: typeof Battle !== "undefined" && Battle.state, played: window.__played, q: typeof Learn !== "undefined" && Learn.last && Learn.last.item })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-sentzh-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
