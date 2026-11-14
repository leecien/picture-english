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
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="drive"]').click();
  await page.waitForSelector("#drive:not([hidden])");
  assert(await page.locator("#drive-scenes").isHidden(), "scene picker hidden for mixed practice");
  await page.locator("#dk-scene").check();
  await page.waitForSelector('#drive-cats [data-cat="travel"]');
  assert.equal(await page.locator("#drive-cats button").count(), 10, "random + nine categories (incl. companion chat)");
  await page.locator('#drive-cats [data-cat="all"]').click();
  assert(await page.locator("#drive-scs").isHidden(), "no sub-scenes in random mode");
  assert.match(await page.locator("#drive-scene-note").innerText(), /從 9 大類、65 個場景隨機出題，共 503 句/);
  await page.locator('#drive-cats [data-cat="travel"]').click();
  await page.locator('#drive-scs [data-scene="customs"]').click();
  assert.match(await page.locator("#drive-scene-note").innerText(), /旅遊 · 海關入境（初級）：10 句，依真實對話的順序/);
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
  await p2.locator("#hud-menu").click();
  await p2.locator('[data-m="drive"]').click();
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
  await p2.waitForSelector("#panel", { state: "hidden" });
  await p2.locator("#hud-menu").click();
  await p2.locator('[data-m="log"]').click();
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
  await p3.locator("#hud-menu").click();
  await p3.locator('[data-m="drive"]').click();
  assert.match(await p3.locator("#drive-mic-note").innerText(), /不能使用麥克風/);
  await p3.locator("#drive-start").click();
  assert(await p3.evaluate(() => D.listen), "listen-along without a microphone");
  await p3.locator("#drive-stop").click();
  await ctx3.close();

  /* ---------- 4. Microphone check and recording failures (stubbed browser APIs) ---------- */
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p4 = await ctx4.newPage();
  p4.on("pageerror", (e) => errors.push(e.message));
  await p4.addInitScript(stubAudio);
  await p4.addInitScript(() => {
    window.__mode = { gum: "deny", sr: "not-allowed" };
    navigator.mediaDevices.getUserMedia = async () => {
      if (__mode.gum === "deny") throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      // a silent but working microphone
      const ac = new AudioContext(),
        dest = ac.createMediaStreamDestination();
      return dest.stream;
    };
    class FakeSR {
      constructor() {
        this._l = {};
      }
      addEventListener(n, f) {
        (this._l[n] = this._l[n] || []).push(f);
      }
      _fire(n) {
        (this._l[n] || []).forEach((f) => f());
      }
      start() {
        setTimeout(() => {
          this._fire("start");
          this._fire("audiostart");
          if (__mode.sr === "ok") {
            this._fire("speechstart");
            this.onresult && this.onresult({ results: [Object.assign([{ transcript: __mode.say || "hello" }], { isFinal: true })] });
          } else if (__mode.sr !== "silent") this.onerror && this.onerror({ error: __mode.sr });
          if (__mode.sr !== "silent") {
            this._fire("audioend");
            this.onend && this.onend();
          }
        }, 30);
      }
      stop() {
        setTimeout(() => this.onend && this.onend(), 10);
      }
      abort() {
        this.stop();
      }
    }
    window.SpeechRecognition = FakeSR;
  });
  await p4.goto(URL);
  await p4.waitForSelector(".world-canvas");
  await p4.locator("#hud-menu").click();
  await p4.locator('[data-m="mic"]').click();
  await p4.waitForSelector("#mic-check:not([hidden])");
  assert.match(await p4.locator("#mic-check").innerText(), /語音辨識：✅ 支援/);
  assert.match(await p4.locator("#mic-check").innerText(), /錄音回放：尚未實作/);
  // permission denied for raw audio input
  await p4.locator("#mc-level-go").click();
  await p4.waitForFunction(() => /權限被拒絕/.test(document.getElementById("mc-level").textContent));
  assert.equal(await p4.locator("#mc-level-go").innerText(), "重試");
  // working but silent microphone
  await p4.evaluate(() => (__mode.gum = "ok"));
  await p4.locator("#mc-level-go").click();
  await p4.waitForFunction(() => /幾乎沒有聲音|有收到聲音/.test(document.getElementById("mc-level").textContent), null, { timeout: 8000 });
  // recognition lifecycle: error, then success
  await p4.locator("#mc-sr-go").click();
  await p4.waitForFunction(() => /權限被拒絕/.test(document.getElementById("mc-sr").textContent));
  assert.match(await p4.locator("#mc-log").innerText(), /start[\s\S]*audiostart[\s\S]*error：not-allowed[\s\S]*end/);
  await p4.evaluate(() => (__mode.sr = "ok"));
  await p4.locator("#mc-sr-go").click();
  await p4.waitForFunction(() => /辨識成功：「hello」/.test(document.getElementById("mc-sr").textContent));
  // timeout when nothing comes back
  await p4.evaluate(() => (__mode.sr = "silent"));
  await p4.locator("#mc-sr-go").click();
  await p4.waitForFunction(() => /沒有辨識到內容/.test(document.getElementById("mc-sr").textContent), null, { timeout: 12000 });
  assert.match(await p4.locator("#mc-log").innerText(), /逾時 8 秒/);
  // A recording failure during practice pauses with a reason, retry and listen-along.
  await p4.evaluate(() => (__mode.sr = "not-allowed"));
  await p4.locator('#drive-pace-setup [data-think="3"]').click();
  await p4.locator("#drive-start").click();
  await p4.waitForSelector("#mic-retry", { timeout: 15000 });
  assert.match(await p4.locator("#drive-heard").innerText(), /權限被拒絕/);
  assert.match(await p4.locator("#drive-state").innerText(), /收音失敗/);
  await p4.evaluate(() => {
    __mode.sr = "ok";
    __mode.say = D.cur.it.w || D.cur.it.en;
  });
  await p4.locator("#mic-retry").click();
  await p4.waitForFunction(() => /答對了/.test(document.getElementById("drive-state").textContent), null, { timeout: 15000 });
  // Silence is not a wrong answer: one more try, then the answer is shown without grading.
  await p4.waitForFunction(() => D.seen >= 1, null, { timeout: 10000 }); // the right answer above is recorded first
  const seen0 = await p4.evaluate(() => D.seen);
  await p4.evaluate(() => (__mode.sr = "empty"));
  await p4.waitForFunction(() => /沒聽到，請再說一次/.test(document.getElementById("drive-state").textContent), null, { timeout: 20000 });
  await p4.waitForFunction(() => /還是沒聽到聲音，這題不計分/.test(document.getElementById("drive-heard").textContent), null, { timeout: 20000 });
  assert.equal(await p4.evaluate(() => D.seen), seen0, "silence is not graded");
  await p4.evaluate(() => (__mode.sr = "audio-capture"));
  await p4.waitForSelector("#mic-follow", { timeout: 20000 });
  await p4.locator("#mic-follow").click();
  await p4.waitForFunction(() => D.listen && !D.paused);
  await p4.locator("#drive-stop").click();
  await ctx4.close();

  assert.deepEqual(errors, []);
  console.log("PASS: scene picker, speed and think time saved, slowed clips and speech, pinned control bar, pause/resume replay, immediate stop, mid-session speed change, dictation voice answers with echo guard, scene records and log, no-mic fallback, mic check (permission, input level, recognition lifecycle, timeout, retry), recording failure with retry and listen-along, silence not graded, no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
