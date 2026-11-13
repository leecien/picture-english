// Commute mode regression: scene picker, playback speed and think time, pause/resume/stop control bar,
// and voice answers through claude.ai dictation (mocked). Audio and speech synthesis are stubbed so the
// loop runs fast and every prompt can be inspected. Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-3, `${msg}: ${a} vs ${b}`);

// Records every clip and spoken line, and finishes each one quickly.
function stubAudio() {
  window.__said = [];
  window.__plays = [];
  HTMLMediaElement.prototype.play = function () {
    window.__plays.push({ src: this.src, rate: this.playbackRate });
    if (!/^data:/.test(this.src)) setTimeout(() => this.dispatchEvent(new Event("ended")), 30);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {};
  if (window.speechSynthesis) {
    speechSynthesis.speak = (u) => {
      window.__said.push({ text: u.text, rate: u.rate, lang: u.lang });
      setTimeout(() => u.onend && u.onend(), 30);
    };
    speechSynthesis.cancel = () => {};
  }
}
function mockDictation() {
  window.__dict = { calls: [], final: null, state: null };
  const d = {
    start: () => {
      __dict.calls.push("start");
      setTimeout(() => __dict.state && __dict.state({ state: "listening" }), 10);
      return Promise.resolve();
    },
    stop: () => {
      __dict.calls.push("stop");
      return Promise.resolve();
    },
    active: () => true,
    onFinal: (h) => ((__dict.final = h), () => {}),
    onPartial: () => () => {},
    onState: (h) => ((__dict.state = h), () => {}),
  };
  window.claude = { use: async (n) => (n === "dictation" ? Object.freeze(d) : null) };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const errors = [];

  /* ---------- 1. Scenes, speed, think time, pause/resume, stop (listen-along mode) ---------- */
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx1.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(stubAudio);
  await page.addInitScript(() => localStorage.setItem("pm-progress", JSON.stringify({ xp: 25, badges: [], placeDismissed: true })));
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  await page.locator("#quick-drive").click();
  await page.waitForSelector("#drive:not([hidden])");
  assert(await page.locator("#drive-scenes").isHidden(), "scene picker hidden for mixed practice");
  await page.locator("#dk-scene").check();
  await page.waitForSelector('#drive-cats [data-cat="travel"]');
  assert.equal(await page.locator("#drive-cats button").count(), 9, "random + eight categories");
  await page.locator('#drive-cats [data-cat="all"]').click();
  assert(await page.locator("#drive-scs").isHidden(), "no sub-scenes in random mode");
  assert.match(await page.locator("#drive-scene-note").innerText(), /從 8 大類、59 個場景隨機出題，共 465 句/);
  await page.locator('#drive-cats [data-cat="travel"]').click();
  await page.locator('#drive-scs [data-scene="customs"]').click();
  assert.match(await page.locator("#drive-scene-note").innerText(), /旅遊 · 海關入境（入門）：10 句，依真實對話的順序/);
  await page.locator('#drive-pace-setup [data-rate="0.75"]').click();
  await page.locator('#drive-pace-setup [data-think="3"]').click();
  assert.deepEqual(
    await ev(() => {
      const p = JSON.parse(localStorage.getItem("pm-drive-pref"));
      return [p.rate, p.think, p.kind, p.cat, p.scene];
    }),
    [0.75, 3, "scene", "travel", "customs"],
  );
  await page.locator("#drive-listen").check();
  await page.locator("#drive-start").click();
  // The officer speaks first in English, then the Chinese cue, all at the chosen speed.
  await page.waitForFunction(() => __said.some((s) => s.text === "對方說"));
  await page.waitForFunction(() => /🤔/.test(document.getElementById("drive-state").textContent), null, { timeout: 10000 });
  const said = await ev(() => __said);
  const q = said.find((s) => s.lang === "en-US");
  assert.equal(q.text, "What is the purpose of your visit?", "a single scene starts at its first line");
  assert.equal(await ev(() => D.cur.it.en), "I'm here for sightseeing.");
  near(q.rate, 0.85 * 0.75, "English prompt slowed");
  assert(said.some((s) => s.text.startsWith("你要回答：") && Math.abs(s.rate - 0.75) < 1e-3), "Chinese cue slowed");
  near((await ev(() => __plays.find((p) => /zh\/ui\//.test(p.src)))).rate, 0.75, "recorded clips slowed");
  assert.match(await page.locator("#drive-q").innerText(), /海關入境[\s\S]*對方：/);
  // The control bar stays fixed on screen during the think pause.
  const bar = await page.locator("#drive-bar").boundingBox();
  assert(bar.y + bar.height <= 844 + 1 && bar.y > 500, "control bar pinned to the bottom");
  // Pause during "think": everything stops and nothing new is spoken.
  const qText = await page.locator("#drive-q").innerText();
  await page.locator("#drive-pause").click();
  assert.match(await page.locator("#drive-state").innerText(), /已暫停/);
  assert.equal(await page.locator("#drive-pause").innerText(), "▶ 繼續");
  const n0 = await ev(() => __said.length + __plays.length);
  await page.waitForTimeout(4500);
  assert.equal(await ev(() => __said.length + __plays.length), n0, "silent while paused");
  // Speed can change mid-session from the bar.
  await page.locator('#drive-pace-run [data-rate="1"]').click();
  await page.locator("#drive-pause").click();
  await page.waitForFunction((n) => __said.length > n, (await ev(() => __said.length)), { timeout: 5000 });
  assert.equal(await page.locator("#drive-q").innerText(), qText, "resume replays the same question");
  near((await ev(() => __said.filter((s) => s.lang === "en-US").pop())).rate, 0.85, "new speed applied");
  // Stop is immediate.
  await page.locator("#drive-stop").click();
  await page.waitForSelector("#drive-setup:not([hidden])", { timeout: 500 });
  const n1 = await ev(() => __said.length);
  await page.waitForTimeout(1500);
  assert(await ev((n) => __said.length <= n + 1, n1), "nothing after stop except the goodbye line");
  await ctx1.close();

  /* ---------- 1b. Answer judging accepts how recognizers actually write things ---------- */
  const ctxJ = await browser.newContext();
  const pj = await ctxJ.newPage();
  await pj.goto(URL);
  await pj.waitForSelector(".world-canvas");
  const judged = await pj.evaluate(() =>
    [
      ["I will stay for five days.", "I will stay for 5 days"],
      ["Does three o'clock work for you?", "does 3:00 work for you"],
      ["What time is check out?", "what time is checkout"],
      ["Okay, no problem.", "OK no problem"],
      ["My suitcase hasn't arrived.", "my suitcase has not arrived"],
      ["I'd like to withdraw two hundred dollars.", "I'd like to withdraw 200 dollars"],
    ].map(([t, a]) => sentScore(t, a) >= 0.75),
  );
  assert.deepEqual(judged, [true, true, true, true, true, true], "digits, spacing and contractions accepted");
  assert(await pj.evaluate(() => sentScore("I'm here for sightseeing.", "I'm here for business") < 0.75), "wrong answers still rejected");
  await ctxJ.close();

  /* ---------- 2. Voice answers through claude.ai dictation (mocked viewer) ---------- */
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(e.message));
  await p2.addInitScript(stubAudio);
  await p2.addInitScript(mockDictation);
  await p2.addInitScript(() => localStorage.setItem("pm-progress", JSON.stringify({ xp: 25, s: 0, badges: [], placeDismissed: true })));
  await p2.goto(URL);
  await p2.waitForSelector(".world-canvas");
  await p2.locator("#quick-drive").click();
  await p2.waitForFunction(() => /Claude 的聽寫/.test(document.getElementById("drive-mic-note").textContent));
  await p2.locator("#dk-scene").check();
  await p2.locator('#drive-cats [data-cat="dining"]').click();
  await p2.locator('#drive-scs [data-scene="cafe"]').click();
  await p2.locator('#drive-pace-setup [data-think="3"]').click();
  await p2.locator("#drive-start").click();
  assert.deepEqual(await p2.evaluate(() => __dict.calls), ["start"], "dictation opened by the Start tap");
  await p2.waitForSelector("#drive-state.listening", { timeout: 10000 });
  const target = await p2.evaluate(() => D.cur.it.en);
  // Speech heard right as the window opens (the page's own prompt) is ignored.
  await p2.evaluate(() => __dict.final({ text: "ni yao hui da" }));
  await p2.waitForTimeout(800);
  await p2.evaluate((t) => __dict.final({ text: " " + t }), target);
  await p2.waitForFunction(() => /答對了/.test(document.getElementById("drive-state").textContent), null, { timeout: 5000 });
  assert.match(await p2.locator("#drive-heard").innerText(), new RegExp(target.replace(/[.?]/g, "\\$&")));
  await p2.waitForFunction((t) => (JSON.parse(localStorage.getItem("pm-sents") || "{}")[t] || {}).c === 1, target, { timeout: 5000 });
  assert.equal(await p2.evaluate(() => P.s), 1);
  await p2.locator("#drive-stop").click();
  assert(await p2.evaluate(() => __dict.calls.includes("stop")), "dictation closed on stop");
  const log = await p2.evaluate(() => JSON.parse(localStorage.getItem("pm-log"))[0]);
  assert.equal(log.m, "commute");
  assert.equal(log.scn, "餐廳 · 咖啡店");
  assert(log.n.includes(target));
  await p2.locator("#drive-back").click();
  await p2.locator("#tab-log").click();
  assert.match(await p2.locator("#logs").innerText(), /開車模式 · 餐廳 · 咖啡店/);
  await ctx2.close();

  /* ---------- 3. Viewer without dictation (Claude app / Safari): falls back to listen-along ---------- */
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p3 = await ctx3.newPage();
  p3.on("pageerror", (e) => errors.push(e.message));
  await p3.addInitScript(stubAudio);
  await p3.addInitScript(() => (window.claude = { use: async () => null }));
  await p3.goto(URL);
  await p3.waitForSelector(".world-canvas");
  await p3.locator("#quick-drive").click();
  assert.match(await p3.locator("#drive-mic-note").innerText(), /不能使用麥克風/);
  await p3.locator("#drive-start").click();
  assert(await p3.evaluate(() => D.listen), "listen-along without a microphone");
  await p3.locator("#drive-stop").click();
  await ctx3.close();

  assert.deepEqual(errors, []);
  console.log("PASS: scene picker, speed and think time saved, slowed clips and speech, pinned control bar, pause/resume replay, immediate stop, mid-session speed change, dictation voice answers with echo guard, scene records and log, no-mic fallback, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
