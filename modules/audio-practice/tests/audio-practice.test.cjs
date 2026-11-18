// AudioPractice 自動測試
//   node tests/audio-practice.test.cjs
// 需要：Node 18+、playwright（含 Chromium）、一個指向專案根目錄的 HTTP 伺服器：
//   python3 -m http.server 8811   （在專案根目錄；TEST_URL 可改網址）
// 錄音測試使用 Chromium 的「假麥克風」（--use-file-for-fake-audio-capture），會真的經過
// getUserMedia → MediaRecorder → Blob → 播放，但不是實體麥克風；真機收音需另外人工測試。
// 語音辨識在無頭瀏覽器無法連線，一律用模擬的 SpeechRecognition。
const assert = require("node:assert/strict");
const path = require("node:path");
const AP = require("../audio-practice.js");

const BASE = (process.env.TEST_URL || "http://127.0.0.1:8811") + "/modules/audio-practice/demo.html";
const FIX = path.join(__dirname, "fixtures");
const results = [];
function pendingPermissionFixture() {
  const vm = require("node:vm"), fs = require("node:fs");
  let grant;
  const revoked = [], track = { stops: 0, stop() { this.stops++; } };
  const W = {
    navigator: { mediaDevices: { getUserMedia: () => new Promise((r) => (grant = r)) } },
    MediaRecorder: function () {},
    SpeechRecognition: class { start() {} abort() { if (this.onerror) this.onerror({ error: "aborted" }); if (this.onend) this.onend(); } },
    Blob, URL: { createObjectURL: () => "blob:pending-test", revokeObjectURL: (u) => revoked.push(u) },
    document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
  };
  const context = { window: W, module: { exports: {} }, setTimeout, clearTimeout, Promise, Date, Map, Set };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../audio-practice.js"), "utf8"), context);
  return { api: context.module.exports, revoked, track, grant() { grant({ getTracks: () => [track], getAudioTracks: () => [track] }); } };
}
async function t(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
    console.log("  ✓", name);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
    console.log("  ✗", name, "\n     ", e.message);
  }
}

/* ---------------- 1. 逐字比對（Node） ---------------- */
async function unit() {
  console.log("逐字比對");
  const st = (target, heard, conf) => {
    const c = AP.compare(target, typeof heard === "string" ? { ok: true, alts: [heard], conf } : heard);
    return c.status + " " + c.items.map((x) => x.word + ":" + x.state).join(" ");
  };
  await t("完全吻合（標點、大小寫）", () => assert.match(st("The boy kicks the ball.", "the boy kicks the ball"), /^match/));
  await t("漏字", () => assert.equal(st("The boy kicks the ball.", "the boy the ball"), "partial The:heard boy:heard kicks:missing the:heard ball.:heard"));
  await t("不同詞會記錄聽成什麼", () => {
    const c = AP.compare("The boy kicks the ball.", { ok: true, alts: ["the boy kiss the ball"] });
    const k = c.items.find((x) => x.word === "kicks");
    assert.equal(k.state, "different");
    assert.equal(k.heard, "kiss");
  });
  await t("多說的字放回原位置", () => assert.equal(st("I like cats.", "I really like cats"), "partial I:heard really:extra like:heard cats.:heard"));
  await t("重複字按位置對齊", () => assert.equal(st("the cat and the dog", "the cat and dog"), "partial the:heard cat:heard and:heard the:missing dog:heard"));
  await t("數字與年份（2020 = twenty twenty）", () => assert.match(st("I have lived here since 2020.", "I have lived here since twenty twenty"), /^match/));
  await t("縮寫（I'm = I am）", () => assert.match(st("I'm hungry.", "I am hungry"), /^match/));
  await t("單字前的冠詞不算多說", () => assert.match(st("apple", "an apple"), /^match/));
  await t("贅詞 um/uh 忽略", () => assert.match(st("My dad drives a car.", "um my dad drives uh a car"), /^match/));
  await t("低信心 → 不確定（中性）", () => assert.match(st("cat", "hat", 0.2), /^uncertain cat:unsure/));
  await t("次佳候選吻合 → 不確定", () => assert.equal(AP.compare("cat", { ok: true, alts: ["hat", "cat"] }).status, "uncertain"));
  await t("沒有結果（權限等錯誤）→ no-result，不算錯", () => {
    const c = AP.compare("cat", { ok: false, error: "permission-denied", message: "x" });
    assert.equal(c.status, "no-result");
    assert(c.items.every((x) => x.state === "unsure"));
  });
  await t("每個狀態都有文字標籤（不只顏色）", () => {
    const c = AP.compare("a b c", { ok: true, alts: ["a x d e"] });
    assert(c.items.every((x) => x.label && x.label.length));
  });
  await t("句意/拼字嚴格路徑不接受同音字；read 不以時態猜同音", () => {
    const res = { ok:true, alts:["to"], conf:.95 };
    assert.equal(AP.compare("two", res).status, "match");
    assert.equal(AP.compare("two", res, {allowHomophones:true}).status, "match");
    assert.equal(AP.compare("two", res, {allowHomophones:false}).status, "mismatch");
    assert.equal(AP.compare("two", res, {mode:"meaning",allowHomophones:true}).status, "mismatch");
    assert.equal(AP.compare("two", {ok:true,alts:["cat","to"]}, {mode:"meaning"}).status, "mismatch");
    assert.notEqual(AP.compare("read", {ok:true,alts:["red"]}, {allowHomophones:true}).status, "match");
    assert.notEqual(AP.compare("I read books", {ok:true,alts:["I red books"]}, {mode:"meaning"}).status, "match");
  });
  await t("權限仍在等待時取消：Promise 即時結束、晚到 stream 釋放", async () => {
    const f = pendingPermissionFixture(), a = f.api;
    let busy = false; a.onBusy((b) => (busy = b));
    const pending = a.listen({ record: true, maxMs: 1000 });
    a.cancelListen();
    const result = await Promise.race([pending, new Promise((r) => setTimeout(() => r("timeout"), 100))]);
    assert.notEqual(result, "timeout"); assert.equal(result.error, "cancelled"); assert.equal(busy, false);
    f.grant(); await new Promise((r) => setTimeout(r, 5)); assert.equal(f.track.stops, 1);
    a.destroy();
  });
  await t("清除單次錄音 URL 不拆掉共享 busy 訂閱", async () => {
    const f = pendingPermissionFixture(), a = f.api;
    a.useFile(new Blob(["recording"], { type: "audio/wav" }));
    const signals = []; a.onBusy((b) => signals.push(b));
    a.clearRecording(); assert.equal(a.lastRecording(), null); assert.equal(f.revoked.length, 1);
    const pending = a.startRecording(); assert.equal(signals.at(-1), true);
    await a.stopRecording(); assert.equal(signals.at(-1), false);
    f.grant(); await pending; assert.equal(f.track.stops, 1);
    a.destroy();
  });
}

/* ---------------- 2. 瀏覽器 ---------------- */
// 模擬 SpeechRecognition：window.__sr = {mode, alts, conf, error} 決定下一次的結果
function mockSR() {
  window.__sr = { mode: "ok", alts: ["the boy kicks the ball"], conf: 0.9, starts: 0 };
  class FakeSR {
    constructor() {
      this.lang = "";
    }
    start() {
      const cfg = window.__sr;
      cfg.starts++;
      const fire = (n, e) => this["on" + n] && this["on" + n](e || {});
      setTimeout(() => {
        fire("start");
        if (cfg.mode === "ok") {
          fire("soundstart");
          const alts = cfg.alts.map((t, i) => ({ transcript: t, confidence: i ? 0.1 : cfg.conf }));
          const res = Object.assign(alts, { isFinal: true, length: alts.length });
          setTimeout(() => {
            fire("result", { results: [res] });
            fire("end");
          }, cfg.delay || 1200);
        } else if (cfg.mode === "hang") {
          this._hang = true; // 等待 stop()/逾時
        } else {
          setTimeout(() => {
            fire("error", { error: cfg.mode });
            fire("end");
          }, cfg.mode === "no-speech" ? 1500 : 150);
        }
      }, 20);
    }
    stop() {
      setTimeout(() => this.onend && this.onend({}), 30);
    }
    abort() {
      setTimeout(() => {
        this.onerror && this.onerror({ error: "aborted" });
        this.onend && this.onend({});
      }, 10);
    }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
}
// 模擬裝置朗讀：記錄每次 speak，0.4 秒後結束
function mockTTS() {
  window.__said = [];
  let curU = null,
    tm = 0;
  const ss = {
    speaking: false,
    pending: false,
    getVoices: () => [{ lang: "en-US", name: "Fake", localService: true }],
    speak(u) {
      window.__said.push(u.text);
      curU = u;
      ss.speaking = true;
      tm = setTimeout(() => {
        ss.speaking = false;
        curU = null;
        u.onend && u.onend({});
      }, 400);
    },
    cancel() {
      clearTimeout(tm);
      if (curU) {
        const u = curU;
        curU = null;
        ss.speaking = false;
        u.onerror && u.onerror({ error: "interrupted" });
      }
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true });
  window.SpeechSynthesisUtterance = function (t) {
    this.text = t;
  };
}

async function browser() {
  const { chromium } = require("playwright");
  const launch = (wav) =>
    chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"],
    });
  const errors = [];
  const open = async (br, init) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));
    for (const f of init || []) await page.addInitScript(f);
    await page.goto(BASE);
    await page.waitForFunction(() => window.AudioPractice);
    return page;
  };

  const br = await launch(path.join(FIX, "speech.wav"));
  console.log("播放（真實 Chromium 音訊元素 + 預錄 mp3）");
  let page = await open(br, [mockSR, mockTTS]);
  await t("播放預錄檔 → ended（音檔來源）", async () => {
    const r = await page.evaluate(() => AudioPractice.play({ url: "processed-audio/words/apple.mp3", text: "apple" }));
    assert.equal(r.status, "ended");
    assert.equal(r.source, "file");
  });
  await t("快速連點 5 次：前 4 次 cancelled，只有最後一次播完", async () => {
    const r = await page.evaluate(async () => {
      const ps = [];
      for (let i = 0; i < 5; i++) {
        ps.push(AudioPractice.play({ url: "processed-audio/sentences/the-boy-kicks-the-ball.mp3" }));
        await new Promise((ok) => setTimeout(ok, 60));
      }
      return (await Promise.all(ps)).map((x) => x.status);
    });
    assert.deepEqual(r, ["cancelled", "cancelled", "cancelled", "cancelled", "ended"]);
  });
  await t("快速連按播放 10 次：只有最後一次 ended，同時間只有一段在播", async () => {
    const r = await page.evaluate(async () => {
      let concurrent = 0, maxConc = 0;
      const o = HTMLMediaElement.prototype.play;
      const els = new Set();
      HTMLMediaElement.prototype.play = function () {
        els.add(this);
        return o.call(this);
      };
      const ps = [];
      for (let i = 0; i < 10; i++) {
        ps.push(AudioPractice.play({ url: "processed-audio/words/" + (i % 2 ? "apple" : "banana") + ".mp3" }));
        const playing = [...els].filter((a) => !a.paused).length;
        maxConc = Math.max(maxConc, playing);
        await new Promise((ok) => setTimeout(ok, 30));
      }
      const st = (await Promise.all(ps)).map((x) => x.status);
      HTMLMediaElement.prototype.play = o;
      return { st, maxConc, els: els.size };
    });
    assert.deepEqual(r.st, Array(9).fill("cancelled").concat("ended"));
    assert(r.maxConc <= 1, "同時播放 " + r.maxConc);
    assert.equal(r.els, 1, "只用一個音訊元素");
  });
  await t("stop() 讓等待中的 play 以 cancelled 結束，且不再忙碌", async () => {
    const r = await page.evaluate(async () => {
      const p = AudioPractice.play({ url: "processed-audio/sentences/the-boy-kicks-the-ball.mp3" });
      await new Promise((ok) => setTimeout(ok, 200));
      AudioPractice.stop();
      const x = await p;
      let busy;
      AudioPractice.onBusy((b) => (busy = b))();
      return [x.status, busy];
    });
    assert.deepEqual(r, ["cancelled", false]);
  });
  await t("音檔不存在 → 改用裝置朗讀", async () => {
    const r = await page.evaluate(() => AudioPractice.play({ url: "processed-audio/words/no-such-word.mp3", text: "no such word" }));
    assert.equal(r.status, "ended");
    assert.equal(r.source, "tts");
  });
  await t("音檔不存在且不允許改朗讀 → error load-failed", async () => {
    const r = await page.evaluate(() => AudioPractice.play({ url: "processed-audio/words/no-such-word.mp3", fallbackTts: false }));
    assert.equal(r.status, "error");
    assert.equal(r.reason, "load-failed");
  });
  await t("裝置朗讀：新播放取消前一句", async () => {
    const r = await page.evaluate(async () => {
      const a = AudioPractice.play({ text: "first" });
      await new Promise((ok) => setTimeout(ok, 100));
      const b = AudioPractice.play({ text: "second" });
      return [(await a).status, (await b).status, window.__said.slice(-2)];
    });
    assert.deepEqual(r, ["cancelled", "ended", ["first", "second"]]);
  });
  await t("onBusy：播放時通知 busy，結束後通知空閒；取消訂閱後不再通知", async () => {
    const r = await page.evaluate(async () => {
      const ev = [];
      const off = AudioPractice.onBusy((b, s) => ev.push(typeof b === "boolean" ? s.kind || "idle" : "NOT-BOOLEAN"));
      await AudioPractice.play({ url: "processed-audio/words/apple.mp3" });
      off();
      await AudioPractice.play({ url: "processed-audio/words/apple.mp3" });
      return ev;
    });
    assert.deepEqual(r, ["idle", "play", "idle"]);
  });

  console.log("錄音（Chromium 假麥克風，音源為預錄句子）");
  await t("開始 → 停止：取得 Blob、MIME、可播放、非靜音", async () => {
    const r = await page.evaluate(async () => {
      const s = await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 1800));
      const x = await AudioPractice.stopRecording();
      const p = await AudioPractice.play({ url: x.url });
      return { s, ok: x.ok, mime: x.mimeType, size: x.size, silent: x.silent, dur: x.durationMs, peak: x.peakDb, play: p.status, blob: x.blob instanceof Blob };
    });
    assert.equal(r.s.ok, true);
    assert.equal(r.ok, true);
    assert.equal(r.blob, true);
    assert.match(r.mime, /^audio\//);
    assert(r.size > 2000, "size " + r.size);
    assert.equal(r.silent, false);
    assert(r.dur > 1500);
    assert(r.peak > -40, "peak " + r.peak);
    assert.equal(r.play, "ended");
  });
  await t("重錄：舊錄音 URL 被釋放，新錄音可播放", async () => {
    const r = await page.evaluate(async () => {
      const old = AudioPractice.lastRecording().url;
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 900));
      const x = await AudioPractice.stopRecording();
      let oldOk = true;
      try {
        await fetch(old);
      } catch (e) {
        oldOk = false;
      }
      return { changed: x.url !== old, oldOk, ok: x.ok };
    });
    assert.deepEqual(r, { changed: true, oldOk: false, ok: true });
  });
  await t("播放中開始錄音：示範被停止（cancelled），錄音正常", async () => {
    const r = await page.evaluate(async () => {
      const p = AudioPractice.play({ url: "processed-audio/sentences/the-boy-kicks-the-ball.mp3" });
      await new Promise((ok) => setTimeout(ok, 200));
      const s = await AudioPractice.startRecording();
      const pr = await p;
      await new Promise((ok) => setTimeout(ok, 800));
      const x = await AudioPractice.stopRecording();
      return [pr.status, s.ok, x.ok];
    });
    assert.deepEqual(r, ["cancelled", true, true]);
  });
  await t("連續三輪 錄音 → 回放：每輪都有新錄音且可播放", async () => {
    const r = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 3; i++) {
        await AudioPractice.startRecording();
        await new Promise((ok) => setTimeout(ok, 800));
        const x = await AudioPractice.stopRecording();
        const p = await AudioPractice.play({ url: x.url });
        out.push([x.ok, p.status, x.url]);
      }
      return { ok: out.every((o) => o[0] && o[1] === "ended"), distinct: new Set(out.map((o) => o[2])).size };
    });
    assert.deepEqual(r, { ok: true, distinct: 3 });
  });
  await t("錄音中不能再開第二次錄音（busy）", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      const b = await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 600));
      await AudioPractice.stopRecording();
      return b.error;
    });
    assert.equal(r, "busy");
  });
  await t("太短的錄音 → too-short，不當成錯誤答案", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      return (await AudioPractice.stopRecording()).error;
    });
    assert.equal(r, "too-short");
  });
  await t("切到背景：播放與錄音都停止，麥克風釋放", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 300));
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((ok) => setTimeout(ok, 300));
      let busy;
      AudioPractice.onBusy((b) => (busy = b))();
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      return busy;
    });
    assert.equal(r, false);
  });

  console.log("跟讀辨識（模擬 SpeechRecognition）");
  const listen = (mode, alts) =>
    page.evaluate(
      async ([mode, alts]) => {
        window.__sr.mode = mode;
        if (alts) window.__sr.alts = alts;
        const r = await AudioPractice.listen({ maxMs: 3000, record: true });
        return { ok: r.ok, error: r.error, alts: r.alts, rec: r.recording && (r.recording.ok ? "ok" : r.recording.error) };
      },
      [mode, alts]
    );
  await t("成功：回傳候選文字，同時取得錄音", async () => {
    const r = await listen("ok", ["the boy kicks the ball"]);
    assert.equal(r.ok, true);
    assert.equal(r.alts[0], "the boy kicks the ball");
    assert.equal(r.rec, "ok");
  });
  await t("權限被拒 → permission-denied", async () => assert.equal((await listen("not-allowed")).error, "permission-denied"));
  await t("沒說話 → no-speech（錄到聲音時）", async () => assert.equal((await listen("no-speech")).error, "no-speech"));
  await t("網路／服務失敗 → recognition-failed", async () => assert.equal((await listen("network")).error, "recognition-failed"));
  await t("麥克風擷取失敗（沒有同時錄音）→ no-device", async () => {
    const r = await page.evaluate(async () => {
      window.__sr.mode = "audio-capture";
      return (await AudioPractice.listen({ maxMs: 3000 })).error;
    });
    assert.equal(r, "no-device");
  });
  await t("Android 衝突 (a)：錄音開著時辨識拿不到麥克風 → record-conflict，下次 auto 只辨識", async () => {
    const r = await page.evaluate(async () => {
      AudioPractice.resetRecordConflict();
      window.__sr.mode = "audio-capture";
      const a = await AudioPractice.listen({ maxMs: 3000, record: "auto" });
      const cap = AudioPractice.capabilities().shadowRecord;
      window.__sr.mode = "ok";
      window.__sr.alts = ["the boy kicks the ball"];
      let recSeen = false;
      const off = AudioPractice.onBusy((b, s) => s.recording && (recSeen = true));
      const b = await AudioPractice.listen({ maxMs: 3000, record: "auto" });
      off();
      const forced = await AudioPractice.listen({ maxMs: 3000, record: true }); // record:true 仍會錄
      AudioPractice.resetRecordConflict();
      return { aErr: a.error, aConf: a.recordConflict, cap, bOk: b.ok, skipped: b.recordSkipped, recSeen, forcedRec: forced.recording && forced.recording.ok };
    });
    assert.deepEqual(r, { aErr: "record-conflict", aConf: true, cap: false, bOk: true, skipped: true, recSeen: false, forcedRec: true });
  });
  await t("同音詞（two／to）算聽到並標註同音", async () => {
    const c = await page.evaluate(() => AudioPractice.compare("I have two cats.", { ok: true, alts: ["I have to cats"] }));
    assert.equal(c.status, "match");
    assert.equal(c.items[2].label, "聽到（同音字）");
  });
  await t("回放音量統一：錄音附 playbackGainDb，帶增益播放可正常結束", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 1500));
      const x = await AudioPractice.stopRecording();
      const p = await AudioPractice.play({ url: x.url, durationMs: x.durationMs, gainDb: 6 });
      return { g: x.playbackGainDb, active: x.activeDb, method: x.levelMethod, st: p.status, gain: p.gainDb };
    });
    assert.equal(typeof r.g, "number");
    assert(r.g >= -6 && r.g <= 12, "gain " + r.g);
    assert.equal(typeof r.active, "number");
    assert.equal(r.method, "live");
    assert.equal(r.st, "ended");
    assert.equal(r.gain, 6);
  });
  await t("stopListen() 正常結束（等待最後結果）", async () => {
    const r = await page.evaluate(async () => {
      window.__sr.mode = "hang";
      const p = AudioPractice.listen({ maxMs: 5000 });
      await new Promise((ok) => setTimeout(ok, 200));
      AudioPractice.stopListen();
      return (await p).error;
    });
    assert.equal(r, "no-speech");
  });
  await t("cancelListen() → cancelled 且錄音丟棄", async () => {
    const r = await page.evaluate(async () => {
      window.__sr.mode = "hang";
      const p = AudioPractice.listen({ maxMs: 5000, record: true });
      await new Promise((ok) => setTimeout(ok, 300));
      AudioPractice.cancelListen();
      const x = await p;
      let busy;
      AudioPractice.onBusy((b) => (busy = b))();
      return [x.error, busy];
    });
    assert.deepEqual(r, ["cancelled", false]);
  });
  await t("不支援辨識 → unsupported-recognition（錄音仍可用）", async () => {
    const r = await page.evaluate(async () => {
      const keep = [window.SpeechRecognition, window.webkitSpeechRecognition];
      window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
      const x = await AudioPractice.listen({ maxMs: 1500, record: true });
      [window.SpeechRecognition, window.webkitSpeechRecognition] = keep;
      return [x.error, x.recording && x.recording.ok];
    });
    assert.deepEqual(r, ["unsupported-recognition", true]);
  });

  console.log("destroy()");
  await t("destroy：釋放麥克風 track、臨時 URL；之後的呼叫回報 destroyed", async () => {
    const r = await page.evaluate(async () => {
      const tracks = [];
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        const s = await orig(c);
        tracks.push(...s.getTracks());
        return s;
      };
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 300));
      const prevUrl = AudioPractice.lastRecording() && AudioPractice.lastRecording().url;
      AudioPractice.destroy();
      let urlAlive = false;
      if (prevUrl)
        try {
          await fetch(prevUrl);
          urlAlive = true;
        } catch (e) {}
      const p = await AudioPractice.play({ text: "x" });
      AudioPractice.reset();
      navigator.mediaDevices.getUserMedia = orig;
      return { ended: tracks.every((t) => t.readyState === "ended"), n: tracks.length, urlAlive, after: p.reason };
    });
    assert.equal(r.n > 0, true);
    assert.equal(r.ended, true);
    assert.equal(r.urlAlive, false);
    assert.equal(r.after, "destroyed");
  });
  await page.context().close();

  /* 錯誤情境：權限、找不到裝置、非安全環境 */
  console.log("權限與裝置錯誤（模擬 getUserMedia 拒絕）");
  for (const [name, code] of [
    ["NotAllowedError", "permission-denied"],
    ["NotFoundError", "no-device"],
    ["NotReadableError", "device-busy"],
  ]) {
    await t(`${name} → ${code}`, async () => {
      const p = await open(br, [mockSR, mockTTS]);
      const r = await p.evaluate(async (n) => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error(n), { name: n }));
        const x = await AudioPractice.startRecording();
        let busy;
        AudioPractice.onBusy((b) => (busy = b))();
        return [x.error, !!x.message, busy];
      }, name);
      assert.deepEqual(r, [code, true, false]);
      await p.context().close();
    });
  }
  await t("沒有 mediaDevices（非 HTTPS 等）→ env-blocked 或 unsupported-recording", async () => {
    const p = await open(br, [mockSR, mockTTS, () => Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true })]);
    const r = await p.evaluate(async () => (await AudioPractice.startRecording()).error);
    assert.match(r, /^(env-blocked|unsupported-recording)$/);
    await p.context().close();
  });

  /* Demo 頁面完整流程 */
  console.log("demo.html 流程");
  page = await open(br, [mockSR, mockTTS]);
  await t("跟讀：示範播完前不能收音；播完後開始跟讀 → 逐字回饋 → 獨立朗讀 → 完成", async () => {
    await page.selectOption("#item", "3"); // The boy kicks the ball.
    const btn = (name) => page.locator("#sh-actions button", { hasText: name });
    await btn("聽示範").click();
    // 播放中只有「停止」，沒有開始跟讀
    assert.equal(await btn("開始跟讀").count(), 0);
    await btn("開始跟讀").waitFor({ timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__sr.starts), 0, "示範播完前不應啟動辨識");
    await page.evaluate(() => {
      window.__sr.mode = "ok";
      window.__sr.alts = ["the boy kiss the ball"];
    });
    await btn("開始跟讀").click();
    await page.locator("#sh-words .ap-w-different").waitFor({ timeout: 8000 });
    const txt = await page.locator("#sh-words").innerText();
    assert.match(txt, /不同詞/);
    assert.match(txt, /聽成 kiss/);
    assert.equal(await btn("開始獨立朗讀").count(), 0, "跟讀未通過前不能進獨立朗讀");
    assert(await btn("播放我的錄音").count(), "應可播放跟讀錄音");
    await page.evaluate(() => (window.__sr.alts = ["the boy kicks the ball"]));
    await btn("再跟讀一次").click();
    await btn("開始獨立朗讀").waitFor({ timeout: 8000 });
    const said = await page.evaluate(() => window.__said.length);
    const plays = [];
    await page.exposeFunction("__noteplay", (s) => plays.push(s));
    await page.evaluate(() => {
      const o = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        window.__noteplay(this.src);
        return o.call(this);
      };
    });
    await btn("開始獨立朗讀").click();
    await page.locator("#sh-status", { hasText: "獨立朗讀完成" }).waitFor({ timeout: 8000 });
    assert.equal(plays.filter((s) => /sentences\//.test(s)).length, 0, "獨立朗讀不得先播答案");
    assert.equal(await page.evaluate(() => window.__said.length), said, "獨立朗讀不得用朗讀播答案");
  });
  await t("跟讀錯誤狀態：沒聽到說話／服務失敗顯示原因，且寫明不算對錯", async () => {
    const btn = (name) => page.locator("#sh-actions button", { hasText: name });
    for (const [mode, re] of [
      ["no-speech", /沒有聽到說話|沒有收到聲音/],
      ["network", /語音辨識服務沒有回應/],
      ["not-allowed", /麥克風權限沒有開/],
    ]) {
      await page.selectOption("#item", "0");
      await btn("聽示範").click();
      await btn("開始跟讀").waitFor({ timeout: 8000 });
      await page.evaluate((m) => (window.__sr.mode = m), mode);
      await btn("開始跟讀").click();
      await page.locator("#sh-status", { hasText: "不算對錯" }).waitFor({ timeout: 8000 });
      const s = await page.locator("#sh-status").innerText();
      assert.match(s, re, mode + ": " + s);
      assert.equal(await page.locator("#sh-words .ap-w").count(), 0, "錯誤時不顯示紅綠逐字");
    }
  });
  await t("錄音區：錄音 → 播放 → 重錄 按鈕狀態正確", async () => {
    await page.click("#rec");
    await page.locator("#rec-status", { hasText: "錄音中" }).waitFor();
    await page.waitForTimeout(1200);
    await page.click("#rec");
    await page.locator("#rec-status", { hasText: "錄好了" }).waitFor({ timeout: 5000 });
    assert.equal(await page.isEnabled("#rec-play"), true);
    assert.match(await page.locator("#rec-info").innerText(), /KB，audio\//);
    await page.click("#rec-play");
    await page.click("#rec-again");
    await page.locator("#rec-status", { hasText: "錄音中" }).waitFor();
    await page.waitForTimeout(800);
    await page.click("#rec");
    await page.locator("#rec-status", { hasText: "錄好了" }).waitFor({ timeout: 5000 });
  });
  await t("聆聽模式：只播放、不啟動辨識或錄音", async () => {
    const before = await page.evaluate(() => window.__sr.starts);
    let rec = false;
    const off = await page.evaluate(() => {
      window.__recSeen = false;
      AudioPractice.onBusy((b, s) => s.recording && (window.__recSeen = true));
    });
    await page.click("#lm-start");
    await page.waitForTimeout(2500);
    await page.click("#lm-stop");
    rec = await page.evaluate(() => window.__recSeen);
    assert.equal(await page.evaluate(() => window.__sr.starts), before);
    assert.equal(rec, false);
  });
  await t("錄音中離開頁面（返回）：麥克風 track 被釋放", async () => {
    const p2 = await open(br, [mockSR, mockTTS, () => {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        const st = await orig(c);
        window.__tracks = (window.__tracks || []).concat(st.getTracks());
        return st;
      };
    }]);
    await p2.click("#rec");
    await p2.locator("#rec-status", { hasText: "錄音中" }).waitFor();
    const live = await p2.evaluate(() => window.__tracks.map((t) => t.readyState));
    await p2.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    const after = await p2.evaluate(() => [window.__tracks.map((t) => t.readyState), (() => { let b; AudioPractice.onBusy((x) => (b = x))(); return b; })()]);
    assert.deepEqual(live, ["live"]);
    assert.deepEqual(after, [["ended"], false]);
    await p2.context().close();
  });
  await page.screenshot({ path: path.join(__dirname, "screenshot-mobile.png"), fullPage: true });
  await page.context().close();
  await br.close();

  /* 靜音麥克風 */
  console.log("靜音麥克風（假裝置播放無聲檔）");
  const br2 = await launch(path.join(FIX, "silence.wav"));
  page = await open(br2, [mockSR, mockTTS]);
  await t("錄到完全無聲 → no-sound（仍保留錄音可回放）", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 1500));
      const x = await AudioPractice.stopRecording();
      return [x.ok, x.error, !!x.url];
    });
    assert.deepEqual(r, [false, "no-sound", true]);
  });
  await t("辨識 no-speech ＋ 錄音無聲 → 回報 no-sound（沒收到聲音）", async () => {
    const r = await page.evaluate(async () => {
      window.__sr.mode = "no-speech";
      return (await AudioPractice.listen({ maxMs: 2000, record: true })).error;
    });
    assert.equal(r, "no-sound");
  });
  await t("Android 衝突 (b)：辨識聽到話但錄音全無聲 → recordConflict，辨識結果仍保留", async () => {
    const r = await page.evaluate(async () => {
      AudioPractice.resetRecordConflict();
      window.__sr.mode = "ok";
      window.__sr.alts = ["hello"];
      const x = await AudioPractice.listen({ maxMs: 3000, record: "auto" });
      const out = { ok: x.ok, conflict: x.recordConflict, cap: AudioPractice.capabilities().shadowRecord };
      AudioPractice.resetRecordConflict();
      return out;
    });
    assert.deepEqual(r, { ok: true, conflict: true, cap: false });
  });
  await page.context().close();
  await br2.close();

  /* 手機相容：模擬 iOS 限制（AudioContext 啟動不了、只支援 audio/mp4）與手機尺寸 */
  console.log("手機相容（Chromium 模擬 iOS 限制）");
  const br3 = await launch(path.join(FIX, "speech.wav"));
  const iosInit = () => {
    // iOS 情境 1：AudioContext 停在 suspended（resume 無效）→ 即時音量計讀不到
    const AC = window.AudioContext;
    window.AudioContext = function () {
      const c = new AC();
      c.suspend();
      c.resume = () => Promise.resolve();
      return c;
    };
    window.AudioContext.prototype = AC.prototype;
    // iOS 情境 2：MediaRecorder 只支援 audio/mp4
    const iTS = MediaRecorder.isTypeSupported.bind(MediaRecorder);
    MediaRecorder.isTypeSupported = (t) => /^audio\/mp4/.test(t) && iTS(t);
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  };
  page = await open(br3, [mockSR, mockTTS, iosInit]);
  await t("iOS 模擬：音量計沒運作時改解碼錄音檔量測，不誤判沒聲音；錄成 audio/mp4 可回放", async () => {
    const r = await page.evaluate(async () => {
      await AudioPractice.startRecording();
      await new Promise((ok) => setTimeout(ok, 1500));
      const x = await AudioPractice.stopRecording();
      const p = await AudioPractice.play({ url: x.url, durationMs: x.durationMs, gainDb: x.playbackGainDb });
      return { ok: x.ok, mime: x.mimeType, method: x.levelMethod, silent: x.silent, peak: x.peakDb, play: p.status, plat: AudioPractice.capabilities().platform, boosted: p.gainDb || 0 };
    });
    assert.equal(r.ok, true);
    assert.match(r.mime, /^audio\/mp4/);
    assert.equal(r.method, "decoded");
    assert.equal(r.silent, false);
    assert(r.peak > -40, "peak " + r.peak);
    assert.equal(r.play, "ended");
    assert.equal(r.plat, "ios");
    assert.equal(r.boosted, 0, "AudioContext 未 running 時不可走放大路徑（否則會無聲）");
  });
  await page.context().close();
  await br3.close();

  // 預期中的錯誤：故意請求不存在的音檔（404）與已釋放的錄音 URL（ERR_FILE_NOT_FOUND）
  const unexpected = errors.filter((e) => !/status of 404|ERR_FILE_NOT_FOUND/.test(e));
  await t("整個過程沒有非預期的頁面錯誤", () => assert.deepEqual(unexpected, []));
}

(async () => {
  await unit();
  await browser();
  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n${results.length - fails.length}/${results.length} 通過`);
  require("node:fs").writeFileSync(path.join(__dirname, "results.json"), JSON.stringify({ date: new Date().toISOString(), results }, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
