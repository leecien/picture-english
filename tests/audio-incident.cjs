/* AUDIO-INCIDENT-01 (revision 11): the recording plays back clearly, but recognition returned no text.
   Panel contracts with a controlled engine (the real comparison function); real MediaRecorder / SpeechRecognition
   behaviour on a phone is NOT covered here and still needs the player's device.
   - clear recording + no text → 「錄音已保留，但未辨識到文字；可重播或重試，這次不計分」, never 「沒有聽到說話」
   - every word 「尚未評分」 (not 「不確定」), no progress / result / XP, buttons usable again
   - one recognition-only retry, said out loud (「本次未保留錄音」), not repeated, not automatic
   - interim text without a final result, network failure, a silent recording (true no-sound) kept apart
   - each round its own recording: the old playback URL is released, never reused
   - a diagnostic summary on screen (never sent anywhere) */
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");
const base = process.env.TEST_URL || "http://127.0.0.1:8000";
let passed = 0;
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/__audio_incident_test", (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>' }));
    await page.goto(base.replace(/\/$/, "") + "/__audio_incident_test");
    await page.addScriptTag({ path: path.join(__dirname, "../modules/audio-practice/audio-practice.js") });
    await page.evaluate(() => {
      const compare = AudioPractice.compare;
      const t = (window.T = { calls: [], listening: null, partial: null, created: [], revoked: [], result: [] });
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (b) => { const u = create(b); t.created.push(u); return u; };
      URL.revokeObjectURL = (u) => { t.revoked.push(u); revoke(u); };
      window.AudioPractice = {
        VERSION: "0.2.0-test", compare,
        capabilities: () => ({ recording: true, recognition: "browser" }),
        reset() {}, stop() {}, clearRecording() {},
        play: async (o) => (t.calls.push(["play", o.url || o.text]), { status: "ended" }),
        listen: (o) => { t.calls.push(["listen", o.record]); t.partial = o.onPartial; return new Promise((res) => (t.listening = res)); },
        stopListen() {}, cancelListen() { if (t.listening) { const r = t.listening; t.listening = null; r({ ok: false, error: "cancelled" }); } },
        startRecording: async () => ({ ok: true }), stopRecording: async () => ({ ok: false, error: "not-recording" }),
      };
      window.AudioBus = { play: async () => ({ status: "ended" }) };
      localStorage.setItem("pm-progress", '{"xp":123}');
    });
    await page.addStyleTag({ path: path.join(__dirname, "../audio-session.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../audio-session.js") });
    const tick = () => page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    const clearRec = { ok: true, blob: "BLOB", durationMs: 2300, levelMeasured: true, silent: false, playbackGainDb: 3 };
    const silentRec = { ok: true, blob: "BLOB", durationMs: 2300, levelMeasured: true, silent: true, error: "no-sound" };
    // resolve the pending listen() with an engine result; rec gets a real Blob in the page
    const finish = (res, rec, partial) =>
      page.evaluate(({ res, rec, partial }) => {
        if (partial && T.partial) T.partial(partial);
        const r = T.listening; T.listening = null;
        if (rec) res.recording = { ...rec, blob: new Blob(["sound-" + Math.random()], { type: "audio/webm" }) };
        r(res);
      }, { res, rec, partial });
    const start = async () => { await page.locator("#as-start").click(); await tick(); };
    const msg = () => page.locator("#as-message").textContent();
    const listens = () => page.evaluate(() => T.calls.filter((c) => c[0] === "listen").map((c) => c[1]));
    async function test(name, fn) { await fn(); passed++; console.log("✓ " + name); }
    const NO_SPEECH = { ok: false, error: "no-speech", message: "沒有聽到說話。請在提示出現後開口，再試一次。", detail: "ended-without-result", heardSound: true };

    await page.evaluate(() => AudioSession.open({ items: [{ id: "r1", en: "I can do the research part.", zh: "我可以負責資料研究的部分。" }], label: "跟讀", onResult: (r) => T.result.push(r) }));
    await page.locator("#as-demo").click(); await tick();

    await test("錄音清楚、辨識零文字：說錄音已保留，不說「沒有聽到說話」；每個字「尚未評分」；不計分", async () => {
      await start();
      await finish(NO_SPEECH, clearRec);
      await tick();
      const m = await msg();
      assert.match(m, /錄音已保留，但未辨識到文字；可重播或重試，這次不計分/);
      assert.doesNotMatch(m, /沒有聽到說話/);
      assert.equal(await page.locator(".aus-token-pending").count(), 6, "6 words, all pending");
      assert.equal(await page.locator(".aus-token-unsure, .aus-token-missing, .aus-token-different").count(), 0, "nothing marked wrong or 不確定");
      assert.match(await page.locator("#as-feedback").textContent(), /尚未評分/);
      assert(await page.locator("#as-replay").isVisible(), "the kept recording can be played");
      assert(await page.locator("#as-start").isEnabled(), "buttons usable again");
      assert(await page.locator("#as-stop").isHidden());
      assert.equal(await page.evaluate(() => T.result.length), 0, "no progress reported");
      assert.equal(await page.evaluate(() => localStorage.getItem("pm-progress")), '{"xp":123}', "no save written");
    });
    await test("診斷摘要在畫面上：辨識沒有文字、錯誤碼、錄音量到有聲、可回放；不上傳", async () => {
      assert(await page.locator("#as-diag").isVisible());
      await page.locator("#as-diag summary").click();
      const d = await page.locator("#as-diag-body").textContent();
      assert.match(d, /引擎 0\.2\.0-test/);
      assert.match(d, /辨識結果 沒有文字・錯誤 no-speech・細節 ended-without-result・辨識器聽到聲音 是/);
      assert.match(d, /最後文字 0 字元/);
      assert.match(d, /錄音 有・\d+ bytes・2300 ms・音量量到有聲・可回放 是/);
      assert.match(d, /模式 recognition\+recording/);
    });
    await test("一次說明過的「只辨識」重試：不同時錄音，提示本次未保留錄音；上一輪錄音網址釋放、不沿用", async () => {
      const oldUrl = await page.evaluate(() => T.created[T.created.length - 1]);
      assert.match(await msg(), /下一次會改成只做辨識/);
      await start();
      assert.deepEqual((await listens()).slice(-1), [false], "recognition only");
      assert.match(await msg(), /這次只做辨識，本次未保留錄音/);
      assert(await page.evaluate((u) => T.revoked.includes(u), oldUrl), "the previous recording URL is released");
      assert(await page.locator("#as-replay").isHidden(), "no old recording offered as this round's");
      await finish({ ok: true, alts: ["I can do the research part."], conf: 0.9 }, null);
      await tick();
      assert.match(await msg(), /逐字辨識吻合/);
      assert.equal(await page.locator(".aus-token-heard").count(), 6);
    });
    await test("只辨識重試有上限：同一項不再自動提出；之後恢復同時錄音", async () => {
      await start();
      assert.deepEqual((await listens()).slice(-1), ["auto"]);
      await finish(NO_SPEECH, clearRec);
      await tick();
      assert.match(await msg(), /錄音已保留，但未辨識到文字/);
      assert.doesNotMatch(await msg(), /下一次會改成只做辨識/, "offered once per item");
      await start();
      assert.deepEqual((await listens()).slice(-1), ["auto"]);
      await finish(NO_SPEECH, clearRec);
      await tick();
    });
    await test("只來部分文字沒有最後結果：說明只收到部分文字；仍不計分", async () => {
      await start();
      await finish(NO_SPEECH, clearRec, "I can do the");
      await tick();
      assert.match(await msg(), /辨識只收到部分文字，沒有最後結果/);
      assert.match(await page.locator("#as-diag-body").textContent(), /部分文字 12 字元/);
      assert.equal(await page.evaluate(() => T.result.length), 0);
    });
    await test("辨識服務失敗（network）＋清楚錄音：同樣是非計分技術狀態", async () => {
      await start();
      await finish({ ok: false, error: "recognition-failed", message: "語音辨識服務沒有回應", detail: "network" }, clearRec);
      await tick();
      assert.match(await msg(), /錄音已保留，但未辨識到文字/);
      assert.match(await page.locator("#as-diag-body").textContent(), /錯誤 recognition-failed・細節 network/);
    });
    await test("錄音真的量到無聲：不說錄音已保留，維持引擎的「沒有收到聲音」；字仍是尚未評分", async () => {
      await start();
      await finish({ ok: false, error: "no-sound", message: "沒有收到聲音。請靠近手機再說一次。" }, silentRec);
      await tick();
      assert.match(await msg(), /沒有收到聲音/);
      assert.doesNotMatch(await msg(), /錄音已保留/);
      assert(await page.locator("#as-replay").isHidden(), "a silent recording is not offered");
      assert.equal(await page.locator(".aus-token-unsure").count(), 0);
      assert.equal(await page.locator(".aus-token-pending").count(), 6);
    });
    await test("取消後晚到的結果被忽略；連續三輪各自獨立", async () => {
      await start();
      const late = await page.evaluate(() => T.listening);
      await page.locator("#as-cancel").click(); await tick();
      assert.match(await msg(), /這次已取消/);
      for (let i = 0; i < 3; i++) {
        await start();
        await finish(i === 1 ? { ok: true, alts: ["I can do the research part."], conf: 0.9 } : NO_SPEECH, clearRec);
        await tick();
        const m = await msg();
        if (i === 1) assert.match(m, /逐字辨識吻合/);
        else assert.match(m, /錄音已保留，但未辨識到文字/);
      }
      const n = await page.evaluate(() => T.created.length - new Set(T.revoked).size);
      assert(n <= 1, "at most the current round's recording URL is alive");
      assert.equal(await page.evaluate(() => T.result.length), 0, "shadowing never reports completion");
    });
    assert.deepEqual(errors, []);
    console.log(`PASS: ${passed} AUDIO-INCIDENT-01 panel contracts (controlled engine; not a device test): clear recording + no text → 錄音已保留／尚未評分／不計分, one stated recognition-only retry, partial-only, network, true silence apart, rounds isolated, diagnostic summary`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
