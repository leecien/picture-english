/* AudioPractice — 英語小旅人 音訊、錄音回放與跟讀模組（B 組獨立交件）
 *
 * 單一命名空間 AudioPractice，一次只有一個音訊管理者：
 *   play({text, url, lang, rate})  → Promise<{status:'ended'|'cancelled'|'error', source, reason?}>
 *   stop()                         → 停止播放；等待中的 play() 以 cancelled 結束
 *   startRecording(opts)           → Promise<{ok:true}|{ok:false, error}>（必須由使用者點擊直接呼叫）
 *   stopRecording()                → Promise<Recording|{ok:false,error}>
 *   onBusy(cb)                     → 取消訂閱函式；cb(busy:boolean, detail{busy, playing, recording, listening, kind})
 *   destroy()                      → 釋放 MediaStream、音訊、事件、臨時 URL
 * 草案以外的補充（不影響草案介面）：
 *   capabilities()                 → 這個環境能做什麼（播放、錄音、辨識來源）
 *   listen({lang, maxMs, record})  → 一次語音辨識（可同時錄音）；結果分類見 ERR
 *   cancelListen()                 → 取消辨識
 *   compare(target, result)        → 逐字回饋（聽到／漏字／不同詞／多說／不確定）
 *   lastRecording()                → 最近一次錄音（重錄時舊的 URL 會釋放）
 *
 * 重要限制：逐字比對只表示「辨識器聽到哪些字」，不是 KK 音素或口音評分。
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AudioPractice = api;
})(typeof window !== "undefined" ? window : globalThis, function (W) {
  "use strict";
  const VERSION = "0.2.0";

  /* ---------------- 錯誤分類：權限、沒聲音、辨識失敗分開，永遠不當成英文答錯 ---------------- */
  const ERR = {
    "permission-denied": "麥克風權限沒有開。請在瀏覽器網址列左邊的網站設定，把麥克風改成「允許」，再按一次。",
    "env-blocked": "這個頁面環境不允許使用麥克風（例如內嵌預覽或非 HTTPS 網址）。請改用 HTTPS 或 localhost 網址開啟。",
    "no-device": "找不到麥克風裝置。請確認耳機或麥克風有接好。",
    "device-busy": "麥克風正被其他 App 使用（通話、錄音、視訊），請先關閉再試。",
    "unsupported-recording": "這個瀏覽器不能錄音。建議使用最新版 Chrome、Edge 或 Safari。",
    "no-sound": "沒有收到聲音。請靠近手機再說一次，並確認沒有靜音、藍牙耳機沒有搶走麥克風。",
    "no-speech": "沒有聽到說話。請在提示出現後開口，再試一次。",
    "unsupported-recognition": "這個瀏覽器不支援語音辨識。仍可聽示範、錄音並回放自己的聲音。",
    "recognition-failed": "語音辨識服務沒有回應（可能是網路或服務問題）。這不是你說錯，請再試一次。",
    "recognition-language": "這個裝置的語音辨識不支援英文辨識設定。",
    "too-short": "錄音太短了，請按下後說完整句再停止。",
    "record-conflict": "這台裝置不能同時語音辨識和錄音（部分 Android 手機如此）。這不是你說錯：再按一次跟讀，接下來會只做辨識；想聽自己的聲音請用錄音區另外錄。",
    "autoplay-blocked": "瀏覽器擋下了自動播放，請再按一次播放。",
    "load-failed": "音檔載入失敗。",
    "no-tts": "這個裝置沒有可用的朗讀聲音。",
    "busy": "正在錄音或辨識中，請先停止。",
    "destroyed": "模組已釋放。",
  };
  const fail = (code, extra) => Object.assign({ ok: false, error: code, message: ERR[code] || code }, extra || {});

  /* ---------------- 狀態與事件 ---------------- */
  const subs = new Set();
  let seq = 0,
    cur = null, // 目前播放工作
    rec = null, // 目前錄音工作
    lis = null, // 目前辨識工作
    last = null, // 最近一次錄音
    audioEl = null,
    destroyed = false,
    dict = null, // claude.ai 聽寫（artifact 檢視器內）
    dictTried = false;
  const tempUrls = new Set();
  /* 部分 Android：SpeechRecognition 與 MediaRecorder 不能同時用麥克風。偵測到一次就記住（本分頁）。 */
  let recConflict = false;
  try {
    recConflict = W.sessionStorage && W.sessionStorage.getItem("ap-rec-conflict") === "1";
  } catch (e) {}
  function markConflict() {
    recConflict = true;
    try {
      W.sessionStorage.setItem("ap-rec-conflict", "1");
    } catch (e) {}
  }

  function status() {
    const kind = rec ? "record" : lis ? "listen" : cur ? "play" : null;
    return { busy: !!kind, playing: !!cur, recording: !!rec, listening: !!lis, kind };
  }
  let lastSig = "";
  function emit() {
    const s = status(),
      sig = JSON.stringify(s);
    if (sig === lastSig) return;
    lastSig = sig;
    subs.forEach((cb) => {
      try {
        cb(s.busy, s);
      } catch (e) {
        /* 訂閱者的錯誤不影響音訊 */
      }
    });
  }
  function onBusy(cb) {
    if (typeof cb !== "function") return () => {};
    subs.add(cb);
    const s = status();
    try {
      cb(s.busy, s); // 第一個參數為布林值（task.md：onBusy 以布林值回報）
    } catch (e) {}
    return () => subs.delete(cb);
  }

  /* ---------------- 能力檢查 ---------------- */
  const SRCtor = () => W.SpeechRecognition || W.webkitSpeechRecognition || null;
  function claudeDictation() {
    // artifact 檢視器內瀏覽器自己的 SpeechRecognition 會被擋，改用平台聽寫（只有在已宣告 dictation 時才有）。
    if (dictTried) return Promise.resolve(dict);
    dictTried = true;
    try {
      if (W.claude && typeof W.claude.use === "function")
        return W.claude
          .use("dictation")
          .then((d) => (dict = d || null))
          .catch(() => null);
    } catch (e) {}
    return Promise.resolve(null);
  }
  function platform() {
    const ua = (W.navigator && W.navigator.userAgent) || "";
    const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && W.navigator && W.navigator.maxTouchPoints > 1);
    return iOS ? "ios" : /Android/.test(ua) ? "android" : "desktop";
  }
  function capabilities() {
    const md = W.navigator && W.navigator.mediaDevices;
    const inViewer = !!(W.claude && typeof W.claude.use === "function");
    return {
      version: VERSION,
      secure: W.isSecureContext !== false,
      playback: typeof W.Audio === "function",
      tts: !!W.speechSynthesis,
      recording: !!(md && md.getUserMedia && W.MediaRecorder),
      recordingMime: pickMime(),
      recognition: inViewer ? (dict ? "claude-dictation" : SRCtor() ? "browser-maybe-blocked" : "none") : SRCtor() ? "browser" : "none",
      inClaudeViewer: inViewer,
      fileFallback: true, // <input type=file accept=audio/*> 永遠可用，供不能直接收音的環境
      shadowRecord: !recConflict, // false：這台裝置跟讀時不能同時錄音（已偵測到衝突）
      platform: platform(),
    };
  }

  /* ---------------- 播放 ---------------- */
  function getAudio() {
    if (!audioEl) {
      audioEl = new W.Audio();
      audioEl.preload = "auto";
      try {
        audioEl.setAttribute("playsinline", "");
      } catch (e) {}
    }
    return audioEl;
  }
  /* 回放音量統一用的第二個音訊元素：經 GainNode 放大。只在 AudioContext 已經 running 時使用，
     否則（iOS 未解鎖）放大路徑會沒有聲音，改回一般元素。 */
  let boostEl = null,
    boostGain = null;
  function getBoostAudio(gainDb) {
    try {
      const ac = audioCtx();
      if (!ac || ac.state !== "running") return null;
      if (!boostEl) {
        boostEl = new W.Audio();
        boostEl.preload = "auto";
        try {
          boostEl.setAttribute("playsinline", "");
        } catch (e) {}
        const src = ac.createMediaElementSource(boostEl);
        boostGain = ac.createGain();
        src.connect(boostGain);
        boostGain.connect(ac.destination);
      }
      boostGain.gain.value = Math.pow(10, gainDb / 20);
      return boostEl;
    } catch (e) {
      return null;
    }
  }
  function pickVoice(lang) {
    try {
      const vs = W.speechSynthesis.getVoices() || [];
      const base = String(lang || "en-US").toLowerCase();
      return (
        vs.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-") === base && v.localService) ||
        vs.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-") === base) ||
        vs.find((v) => v.lang && v.lang.toLowerCase().startsWith(base.slice(0, 2))) ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  function play(opts) {
    const o = opts || {};
    if (destroyed) return Promise.resolve({ status: "error", reason: "destroyed", message: ERR.destroyed });
    stop(); // 新播放先結束前一次：快速連點只有最新一段在播
    const job = { id: ++seq, done: false, cleanups: [] };
    const lang = o.lang || "en-US",
      rate = Math.min(2, Math.max(0.5, Number(o.rate) || 1));
    const p = new Promise((resolve) => {
      job.finish = (st, extra) => {
        if (job.done) return;
        job.done = true;
        job.cleanups.splice(0).forEach((f) => {
          try {
            f();
          } catch (e) {}
        });
        if (cur === job) cur = null;
        emit();
        resolve(Object.assign({ status: st, source: job.source || null, id: job.id }, job.gainDb ? { gainDb: job.gainDb } : {}, extra || {}));
      };
    });
    cur = job;
    emit();
    const tts = () => {
      if (job.done || job.fellBack) return;
      job.fellBack = true;
      if (!o.text) return job.finish("error", { reason: "load-failed", message: ERR["load-failed"] });
      if (!W.speechSynthesis || typeof W.SpeechSynthesisUtterance !== "function")
        return job.finish("error", { reason: "no-tts", message: ERR["no-tts"] });
      job.source = "tts";
      const ss = W.speechSynthesis;
      try {
        ss.cancel();
      } catch (e) {}
      const u = new W.SpeechSynthesisUtterance(String(o.text));
      u.lang = lang;
      u.rate = rate;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.onend = () => job.finish("ended");
      u.onerror = (e) => {
        const er = e && e.error;
        if (er === "interrupted" || er === "canceled") job.finish("cancelled");
        else job.finish("error", { reason: "no-tts", detail: er, message: ERR["no-tts"] });
      };
      // 看門狗：部分瀏覽器 onend 不觸發（Chrome 長句、iOS 切背景）。以字數估計上限，並輪詢 speaking。
      const est = 2500 + (String(o.text).length * 140) / rate;
      const t0 = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - t0 > 1500 && !ss.speaking && !ss.pending) job.finish("ended", { watchdog: "idle" });
        else if (Date.now() - t0 > est) {
          try {
            ss.cancel();
          } catch (e) {}
          job.finish("ended", { watchdog: "timeout" });
        }
      }, 250);
      job.cleanups.push(() => clearInterval(poll));
      job.cleanups.push(() => {
        u.onend = u.onerror = null;
        if (job.cancelled) {
          try {
            ss.cancel();
          } catch (e) {}
        }
      });
      try {
        ss.speak(u);
      } catch (e) {
        job.finish("error", { reason: "no-tts", message: ERR["no-tts"] });
      }
    };
    if (o.url) {
      job.source = "file";
      const boosted = typeof o.gainDb === "number" && Math.abs(o.gainDb) >= 0.5 ? getBoostAudio(o.gainDb) : null;
      const a = boosted || getAudio();
      job.gainDb = boosted ? o.gainDb : 0;
      const onEnd = () => job.finish("ended");
      const onErr = () => (o.text && o.fallbackTts !== false ? tts() : job.finish("error", { reason: "load-failed", message: ERR["load-failed"] }));
      a.addEventListener("ended", onEnd);
      a.addEventListener("error", onErr);
      let wd = 0;
      const onMeta = () => {
        clearTimeout(wd);
        // MediaRecorder 的 webm 常沒有長度（Infinity）：用呼叫端給的 durationMs
        const d = isFinite(a.duration) && a.duration > 0 ? a.duration : o.durationMs ? o.durationMs / 1000 : 30;
        wd = setTimeout(() => job.finish("ended", { watchdog: "timeout" }), (d / rate) * 1000 + 3000);
      };
      a.addEventListener("loadedmetadata", onMeta);
      wd = setTimeout(() => onErr(), 15000); // 15 秒還沒載入：視為載入失敗
      job.cleanups.push(() => {
        clearTimeout(wd);
        a.removeEventListener("ended", onEnd);
        a.removeEventListener("error", onErr);
        a.removeEventListener("loadedmetadata", onMeta);
        try {
          a.pause();
        } catch (e) {}
      });
      try {
        a.src = o.url;
        a.currentTime = 0;
        a.defaultPlaybackRate = a.playbackRate = rate;
        try {
          a.preservesPitch = true;
        } catch (e) {}
        const pr = a.play();
        if (pr && pr.catch)
          pr.catch((e) => {
            if (job.done) return;
            if (e && e.name === "NotAllowedError") job.finish("error", { reason: "autoplay-blocked", message: ERR["autoplay-blocked"] });
            else if (e && e.name === "AbortError") job.finish("cancelled");
            else onErr();
          });
      } catch (e) {
        onErr();
      }
    } else if (o.text) tts();
    else job.finish("error", { reason: "nothing-to-play" });
    return p;
  }

  function stop() {
    const j = cur;
    if (!j) {
      // 沒有工作也清乾淨，避免殘留朗讀
      return;
    }
    j.cancelled = true;
    if (j.source === "tts") {
      try {
        W.speechSynthesis.cancel();
      } catch (e) {}
    }
    j.finish("cancelled");
  }

  /* ---------------- 錄音 ---------------- */
  function pickMime() {
    const MR = W.MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== "function") return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm", "audio/aac"].find((t) => MR.isTypeSupported(t)) || "";
  }
  function mapMediaError(e) {
    const n = e && e.name;
    if (n === "NotAllowedError" || n === "PermissionDeniedError") return W.isSecureContext === false ? "env-blocked" : "permission-denied";
    if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return "no-device";
    if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return "device-busy";
    if (n === "SecurityError" || n === "TypeError") return "env-blocked";
    return "unsupported-recording";
  }
  async function permissionState() {
    try {
      const r = await W.navigator.permissions.query({ name: "microphone" });
      return r.state; // granted | denied | prompt
    } catch (e) {
      return "unknown";
    }
  }

  /* 共用 AudioContext：在使用者點擊當下（同步）建立／resume。iOS Safari 若在 await 之後才建立，
     會停在 suspended，音量計只讀到 0，造成「明明有聲音卻判成沒聲音」。 */
  let sharedAC = null;
  function audioCtx() {
    try {
      const AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return null;
      if (!sharedAC || sharedAC.state === "closed") sharedAC = new AC();
      if (sharedAC.state === "suspended" && sharedAC.resume) sharedAC.resume().catch(() => {});
      return sharedAC;
    } catch (e) {
      return null;
    }
  }
  const SILENCE_DB = -50;
  /* 50 ms 框的統計：峰值、全段 RMS、有聲框 RMS、有聲框數。 */
  function frameStats(samples, rate, silenceDb, frameLen) {
    const n = Math.min(samples.length, frameLen || Math.max(1, Math.round(rate * 0.05))),
      lin = Math.pow(10, (silenceDb == null ? SILENCE_DB : silenceDb) / 20);
    let peak = 0,
      sum = 0,
      loudSum = 0,
      loudN = 0,
      loud = 0,
      frames = 0;
    for (let i = 0; i + n <= samples.length; i += n) {
      let s = 0;
      for (let k = i; k < i + n; k++) {
        const v = samples[k];
        s += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      frames++;
      sum += s;
      if (Math.sqrt(s / n) > lin) (loud++, (loudSum += s), (loudN += n));
    }
    return { peak, sumSq: sum, n: frames * n, loudFrames: loud, loudSumSq: loudSum, loudN, frames };
  }
  /* 備援量測：把錄好的檔解碼後再量（音量計沒有真正運作時用，例如 iOS AudioContext 未啟動）。 */
  function measureBlob(blob) {
    return new Promise((resolve) => {
      try {
        const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
        if (!OAC || !blob.arrayBuffer) return resolve(null);
        const t = setTimeout(() => resolve(null), 4000);
        blob
          .arrayBuffer()
          .then((buf) => {
            const oac = new OAC(1, 1, 48000);
            const ok = (ab) => {
              clearTimeout(t);
              try {
                resolve(frameStats(ab.getChannelData(0), ab.sampleRate));
              } catch (e) {
                resolve(null);
              }
            };
            const pr = oac.decodeAudioData(buf, ok, () => (clearTimeout(t), resolve(null)));
            if (pr && pr.then) pr.then(ok, () => (clearTimeout(t), resolve(null)));
          })
          .catch(() => (clearTimeout(t), resolve(null)));
      } catch (e) {
        resolve(null);
      }
    });
  }

  /* opts: {maxMs=15000, silenceDb=-50, onLevel(level0to1)} — 呼叫要直接來自點擊事件（iOS 需要）。 */
  function startRecording(opts) {
    const o = opts || {};
    if (destroyed) return Promise.resolve(fail("destroyed"));
    if (rec) return Promise.resolve(fail("busy"));
    const md = W.navigator && W.navigator.mediaDevices;
    if (W.isSecureContext === false) return Promise.resolve(fail("env-blocked"));
    if (!md || !md.getUserMedia) return Promise.resolve(fail(W.claude && W.claude.use ? "env-blocked" : "unsupported-recording"));
    if (!W.MediaRecorder) return Promise.resolve(fail("unsupported-recording"));
    stop(); // 收音前停止示範，避免錄到喇叭聲
    const ac = audioCtx(); // 同步、在點擊事件內
    const job = { id: ++seq, chunks: [], t0: 0, peak: 0, sumSq: 0, n: 0, loudFrames: 0, loudSumSq: 0, loudN: 0, frames: 0, liveTicks: 0, stopping: null };
    rec = job;
    emit();
    const gum = md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return gum.then(
      (stream) => {
        if (rec !== job || destroyed) {
          stream.getTracks().forEach((t) => t.stop());
          return fail("busy", { cancelled: true });
        }
        job.stream = stream;
        const mime = pickMime();
        let mr;
        try {
          mr = mime ? new W.MediaRecorder(stream, { mimeType: mime }) : new W.MediaRecorder(stream);
        } catch (e) {
          try {
            mr = new W.MediaRecorder(stream);
          } catch (e2) {
            releaseRec(job);
            return fail("unsupported-recording");
          }
        }
        job.mr = mr;
        mr.ondataavailable = (e) => e.data && e.data.size && job.chunks.push(e.data);
        // 即時音量：畫面音量條＋初步判斷。只有 AudioContext 真的在跑（running）的框才算數。
        try {
          if (ac) {
            const src = ac.createMediaStreamSource(stream),
              an = ac.createAnalyser();
            an.fftSize = 2048;
            src.connect(an);
            job.src = src;
            const buf = new Float32Array(an.fftSize);
            const tick = () => {
              if (rec !== job || job.stopping) return;
              if (ac.state === "running") {
                an.getFloatTimeDomainData(buf);
                const st = frameStats(buf, ac.sampleRate, o.silenceDb, buf.length);
                job.liveTicks++;
                job.frames += st.frames;
                job.loudFrames += st.loudFrames;
                job.peak = Math.max(job.peak, st.peak);
                job.sumSq += st.sumSq;
                job.n += st.n;
                job.loudSumSq += st.loudSumSq;
                job.loudN += st.loudN;
                if (o.onLevel)
                  try {
                    o.onLevel(Math.min(1, Math.sqrt(st.sumSq / Math.max(1, st.n)) * 6));
                  } catch (e) {}
              }
              job.raf = setTimeout(tick, 50);
            };
            tick();
          }
        } catch (e) {
          job.src = null;
        }
        job.mime = mr.mimeType || mime || "";
        job.t0 = Date.now();
        mr.start(250);
        job.maxT = setTimeout(() => stopRecording(), o.maxMs || 15000);
        // 使用者拔掉耳機或系統收回麥克風
        stream.getAudioTracks().forEach((t) => (t.onended = () => rec === job && stopRecording()));
        return { ok: true, mimeType: job.mime };
      },
      (e) => {
        if (rec === job) {
          rec = null;
          emit();
        }
        return fail(mapMediaError(e), { detail: e && e.name });
      }
    );
  }

  function releaseRec(job) {
    clearTimeout(job.maxT);
    clearTimeout(job.raf);
    // 先停 track 再播放：iOS 在麥克風開著時會把聲音導到聽筒、音量很小
    if (job.stream) job.stream.getTracks().forEach((t) => t.stop());
    if (job.src)
      try {
        job.src.disconnect();
      } catch (e) {}
    job.stream = job.src = null;
    if (rec === job) rec = null;
    emit();
  }

  const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : null);
  /* 回放音量統一：把自己錄音的有聲段調到約 -20 dBFS，最多 +12 dB、最多 -6 dB，且峰值不超過 -1 dBFS。 */
  const PLAYBACK_TARGET_DB = -20;
  function playbackGain(activeDb, peakDb) {
    if (activeDb == null) return 0;
    let g = PLAYBACK_TARGET_DB - activeDb;
    if (peakDb != null) g = Math.min(g, -1 - peakDb);
    return Math.round(Math.max(-6, Math.min(12, g)) * 10) / 10;
  }

  function stopRecording() {
    const job = rec;
    if (!job) return Promise.resolve(fail("no-sound", { reason: "not-recording" }));
    if (job.stopping) return job.stopping;
    job.stopping = new Promise((resolve) => {
      const done = async () => {
        const durationMs = job.t0 ? Date.now() - job.t0 : 0;
        const type = job.mime || (job.chunks[0] && job.chunks[0].type) || "audio/webm";
        const blob = new W.Blob(job.chunks, { type });
        releaseRec(job);
        if (job.discard) return resolve(fail("busy", { cancelled: true }));
        if (durationMs < 400 || !blob.size) return resolve(fail("too-short", { durationMs }));
        // 即時音量計至少跑過 ~0.3 秒才採用；否則（iOS 未啟動、背景節流）改解碼錄音檔再量
        let st = job,
          method = "live";
        if (job.liveTicks < 6) {
          const m = await measureBlob(blob);
          if (m && m.frames) (st = m), (method = "decoded");
          else method = "none";
        }
        const measured = method !== "none";
        const silent = measured ? st.loudFrames < 3 : false; // 量不到就不宣稱沒聲音
        const peakDb = measured ? db(st.peak) : null,
          rmsDb = measured && st.n ? db(Math.sqrt(st.sumSq / st.n)) : null,
          activeDb = measured && st.loudN ? db(Math.sqrt(st.loudSumSq / st.loudN)) : null;
        if (destroyed) return resolve(fail("destroyed"));
        const url = W.URL.createObjectURL(blob);
        tempUrls.add(url);
        if (last && last.url) revoke(last.url); // 重錄：釋放舊錄音
        last = {
          ok: true,
          blob,
          url,
          mimeType: type,
          size: blob.size,
          durationMs,
          peakDb,
          rmsDb,
          activeDb,
          playbackGainDb: silent ? 0 : playbackGain(activeDb, peakDb),
          levelMeasured: measured,
          levelMethod: method,
          silent,
          playable: canPlay(type),
        };
        if (silent) return resolve(Object.assign({}, last, { ok: false, error: "no-sound", message: ERR["no-sound"] }));
        resolve(last);
      };
      try {
        if (job.mr && job.mr.state !== "inactive") {
          job.mr.onstop = done;
          job.mr.stop();
        } else done();
      } catch (e) {
        done();
      }
    });
    return job.stopping;
  }
  function canPlay(type) {
    try {
      const a = getAudio();
      return a.canPlayType ? a.canPlayType(String(type).split(";")[0]) !== "" : true;
    } catch (e) {
      return true;
    }
  }
  function revoke(url) {
    try {
      W.URL.revokeObjectURL(url);
    } catch (e) {}
    tempUrls.delete(url);
  }
  /* Release the completed recording without destroying the shared audio engine/subscriptions.
     Stop/cancel active capture separately before calling this during a screen transition. */
  function clearRecording() {
    if (last && last.url) revoke(last.url);
    last = null;
    return { ok: true };
  }
  /* 不能直接收音的環境（claude.ai 預覽、舊瀏覽器）：讓使用者用手機錄音 App 錄好再選檔。 */
  function useFile(file) {
    if (!file) return fail("no-sound");
    const url = W.URL.createObjectURL(file);
    tempUrls.add(url);
    if (last && last.url) revoke(last.url);
    last = { ok: true, blob: file, url, mimeType: file.type || "audio/*", size: file.size, durationMs: null, fromFile: true, levelMeasured: false, silent: false, playable: canPlay(file.type || "") };
    return last;
  }

  /* ---------------- 語音辨識 ---------------- */
  const SR_ERR = {
    "not-allowed": "permission-denied",
    "service-not-allowed": "env-blocked",
    "no-speech": "no-speech",
    "audio-capture": "no-device",
    network: "recognition-failed",
    aborted: "cancelled",
    "language-not-supported": "recognition-language",
    "bad-grammar": "recognition-failed",
  };
  const DICT_ERR = { not_granted: "permission-denied", dismissed: "permission-denied", hidden: "cancelled", viewer_stopped: "cancelled" };

  /* listen({lang='en-US', maxMs=8000, record=false})
     → {ok:true, alts:[...], conf, source, recording?} 或 {ok:false, error, message, recording?}
     record=true 時同時錄音（Android Chrome 可能不允許兩者共用麥克風，失敗會分開回報）。
     必須由使用者點擊直接呼叫。 */
  function listen(opts) {
    const o = opts || {};
    if (destroyed) return Promise.resolve(fail("destroyed"));
    if (lis || rec) return Promise.resolve(fail("busy"));
    stop();
    const job = { id: ++seq, done: false };
    lis = job;
    emit();
    // record: true 一定同時錄音；"auto" 在已知衝突的裝置上只辨識
    const skipRec = o.record === "auto" && recConflict;
    const wantRec = !!o.record && !skipRec;
    // 錄音與辨識同一個點擊啟動（iOS／聽寫都要求直接來自使用者操作）
    const recP = wantRec ? startRecording({ maxMs: (o.maxMs || 8000) + 2000, onLevel: o.onLevel }) : Promise.resolve(null);
    return new Promise((resolve) => {
      job.finish = async (res) => {
        if (job.done) return;
        job.done = true;
        clearTimeout(job.t);
        if (lis === job) lis = null;
        let r = null;
        // A browser permission prompt may leave getUserMedia unresolved indefinitely.
        // Cancellation must finish now; stopRecording invalidates the pending capture job,
        // whose eventual stream is stopped by startRecording's stale-job guard.
        if (res.error === "cancelled") {
          if (wantRec && rec) { rec.discard = true; r = await stopRecording(); }
          res.recording = wantRec ? r || fail("busy", { cancelled: true }) : undefined;
          emit();
          resolve(res);
          return;
        }
        const started = await recP;
        if (wantRec && started && started.ok) r = await stopRecording();
        res.recording = wantRec ? r || started : undefined;
        if (skipRec) res.recordSkipped = true;
        // 衝突偵測：(a) 錄音開著時辨識拿不到麥克風；(b) 辨識聽到話但錄音全是無聲；(c) 辨識成功但錄音裝置被占用
        const conflict =
          wantRec &&
          ((started && started.ok && !res.ok && res.error === "no-device") ||
            (res.ok && r && r.error === "no-sound") ||
            (res.ok && started && !started.ok && started.error === "device-busy"));
        if (conflict) {
          markConflict();
          res.recordConflict = true;
          if (!res.ok) Object.assign(res, fail("record-conflict"));
        }
        // 辨識沒有結果，但錄音也證明沒聲音 → 回報「沒收到聲音」，比「沒聽到說話」更準確
        if (!res.ok && res.error === "no-speech" && r && r.error === "no-sound") Object.assign(res, fail("no-sound"));
        emit();
        resolve(res);
      };
      job.cancel = () => job.finish(fail("busy", { error: "cancelled", message: "已取消。" }));
      const SR = SRCtor();
      if (dict) return listenDictation(job, o); // artifact 檢視器：平台聽寫優先（瀏覽器辨識在框架內會被擋）
      // 不支援辨識但有錄音：照樣收音到使用者按「說完了」或逾時，讓使用者回放自己比對。
      const noRecog = () => {
        if (!wantRec) return job.finish(fail("unsupported-recognition"));
        recP.then((st) => {
          if (job.done) return;
          if (!st || !st.ok) return job.finish(fail("unsupported-recognition"));
          job.soft = () => job.finish(fail("unsupported-recognition"));
          job.t = setTimeout(job.soft, o.maxMs || 8000);
        });
      };
      if (!SR) {
        // 嘗試 claude 聽寫（只有在 artifact 檢視器且已宣告時存在）
        if (W.claude && W.claude.use && !dictTried) return claudeDictation().then((d) => (d ? listenDictation(job, o) : noRecog()));
        return noRecog();
      }
      let r;
      try {
        r = new SR();
      } catch (e) {
        return job.finish(fail("unsupported-recognition"));
      }
      job.r = r;
      r.lang = o.lang || "en-US";
      r.interimResults = !!o.onPartial;
      r.continuous = false;
      r.maxAlternatives = 3;
      let alts = null,
        conf = null,
        err = null,
        gotSound = false;
      r.onsoundstart = r.onspeechstart = () => (gotSound = true);
      r.onresult = (e) => {
        const x = e.results[e.results.length - 1];
        if (!x) return;
        if (!x.isFinal) {
          if (o.onPartial)
            try {
              o.onPartial(x[0].transcript);
            } catch (er) {}
          return;
        }
        alts = Array.from(x).map((a) => a.transcript);
        conf = x[0] && typeof x[0].confidence === "number" ? x[0].confidence : null;
      };
      r.onnomatch = () => (err = err || "no-match");
      r.onerror = (e) => (err = e && e.error);
      r.onend = () => {
        if (alts && alts.length) return job.finish({ ok: true, alts, conf, source: "browser" });
        if (err === "no-match") return job.finish(fail("no-speech", { detail: "nomatch", heardSound: gotSound }));
        const code = SR_ERR[err] || (err ? "recognition-failed" : "no-speech");
        if (code === "cancelled") return job.finish(fail("busy", { error: "cancelled", message: "已取消。" }));
        job.finish(fail(code, { detail: err || "ended-without-result", heardSound: gotSound }));
      };
      job.t = setTimeout(() => {
        try {
          r.stop();
        } catch (e) {}
        setTimeout(() => job.finish(alts ? { ok: true, alts, conf, source: "browser" } : fail("no-speech", { detail: "timeout" })), 1500);
      }, o.maxMs || 8000);
      job.abort = () => {
        try {
          r.abort();
        } catch (e) {}
      };
      job.soft = () => {
        try {
          r.stop();
        } catch (e) {}
      };
      try {
        r.start();
      } catch (e) {
        job.finish(fail("recognition-failed", { detail: e && e.message }));
      }
    });
  }
  function listenDictation(job, o) {
    const d = dict;
    let text = "",
      offs = [];
    const end = (res) => {
      offs.forEach((f) => {
        try {
          f();
        } catch (e) {}
      });
      job.finish(res);
    };
    offs.push(d.onFinal((e) => (text += (text ? " " : "") + String((e && e.text) || "").trim())));
    if (o.onPartial) offs.push(d.onPartial((e) => o.onPartial(String((e && e.text) || ""))));
    offs.push(
      d.onState((e) => {
        if (!e || e.state !== "idle") return;
        if (text.trim()) return end({ ok: true, alts: [text.trim()], conf: null, source: "claude-dictation" });
        const rs = e.reason;
        if (!rs || rs === "stopped") return end(fail("no-speech", { detail: rs || "idle" }));
        end(fail(DICT_ERR[rs] || "recognition-failed", { detail: rs }));
      })
    );
    job.t = setTimeout(() => d.stop().catch(() => {}), o.maxMs || 8000);
    job.abort = () => d.stop().catch(() => {});
    job.soft = job.abort;
    try {
      d.start({ language: (o.lang || "en").slice(0, 2) }).catch((e) => end(fail(DICT_ERR[e && e.code] || "recognition-failed", { detail: e && e.code })));
    } catch (e) {
      end(fail("recognition-failed"));
    }
  }
  /* 使用者按「說完了」：正常結束並等最後的字，不是取消。 */
  function stopListen() {
    const j = lis;
    if (j && j.soft) j.soft();
  }
  function cancelListen() {
    const j = lis;
    if (!j) return;
    if (j.abort) j.abort();
    if (rec) rec.discard = true;
    j.cancel();
  }

  /* ---------------- 逐字回饋 ---------------- */
  const CONTR = {
    "i'm": "i am", "it's": "it is", "don't": "do not", "can't": "cannot", "won't": "will not", "i've": "i have", "she's": "she is", "he's": "he is",
    "we're": "we are", "i'd": "i would", "that's": "that is", "what's": "what is", "where's": "where is", "there's": "there is", "let's": "let us",
    "i'll": "i will", "we'll": "we will", "you're": "you are", "they're": "they are", "isn't": "is not", "doesn't": "does not", "didn't": "did not",
    "wasn't": "was not", "aren't": "are not", "haven't": "have not", "hasn't": "has not", "couldn't": "could not", "shouldn't": "should not",
    "wouldn't": "would not", "you've": "you have", "we've": "we have", "they've": "they have", "you'll": "you will", "it'll": "it will", ok: "okay",
  };
  const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function numWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
    // 年份唸法：2020 → twenty twenty；2000–2009 → two thousand ...
    if (n >= 1100 && n < 2000 && n % 100 === 0) return numWords(n / 100) + " hundred"; // 1900 → nineteen hundred
    if (n >= 1100 && n < 10000 && n % 100 !== 0 && !(n >= 2000 && n < 2010)) return numWords(Math.floor(n / 100)) + " " + (n % 100 < 10 ? "oh " + ONES[n % 100] : numWords(n % 100));
    if (n < 10000) return numWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numWords(n % 1000) : "");
    return String(n);
  }
  function tokens(s) {
    const t = String(s || "")
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/(\d),(\d{3})/g, "$1$2")
      .replace(/\b\d{1,4}\b/g, (m) => numWords(+m))
      .replace(/-/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ""))
      .filter(Boolean)
      .map((w) => CONTR[w] || w)
      .join(" ")
      .replace(/[^a-z0-9' ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    return t;
  }
  const FILLER = new Set(["um", "uh", "er", "erm", "ah", "hmm", "mm"]);
  /* 同音詞：辨識器常寫成另一個拼法（two/to、for/four），聽起來一樣，算「聽到」並標註同音。 */
  const HOMO = {};
  [
    ["to", "too", "two"], ["for", "four"], ["there", "their"], ["right", "write"], ["see", "sea"], ["hear", "here"],
    ["know", "no"], ["new", "knew"], ["one", "won"], ["by", "buy", "bye"], ["ate", "eight"], ["son", "sun"], ["meet", "meat"],
    ["week", "weak"], ["flower", "flour"], ["pair", "pear"], ["road", "rode"], ["blue", "blew"], ["eye", "i"], ["hour", "our"],
    ["wear", "where"], ["whole", "hole"], ["night", "knight"], ["tail", "tale"], ["peace", "piece"], ["mail", "male"],
  ].forEach((g, k) => g.forEach((w) => (HOMO[w] = k)));
  // Heteronyms such as read depend on tense; do not infer their sound from text.
  const same = (a, b, allowHomophones) => a === b || (allowHomophones && HOMO[a] !== undefined && HOMO[a] === HOMO[b]);
  // 編輯距離＋回溯，依位置對齊（重複字不會被「句中某處有」誤判）。
  function align(target, heard, allowHomophones = true) {
    const disp = String(target).trim().split(/\s+/).filter(Boolean);
    const T = [],
      own = [];
    disp.forEach((w, i) => tokens(w).forEach((t) => (T.push(t), own.push(i))));
    const H = tokens(heard).filter((w) => !FILLER.has(w));
    const n = T.length,
      m = H.length,
      INF = 1e9;
    const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
    const B = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    D[0][0] = 0;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= m; j++) {
        const c = D[i][j];
        if (c === INF) continue;
        const rx = (ii, jj, cost, op) => {
          if (c + cost < D[ii][jj]) {
            D[ii][jj] = c + cost;
            B[ii][jj] = { i, j, op };
          }
        };
        if (i < n && j < m) rx(i + 1, j + 1, same(T[i], H[j], allowHomophones) ? 0 : 1, same(T[i], H[j], allowHomophones) ? "ok" : "sub");
        if (i < n) rx(i + 1, j, 1, "miss");
        if (j < m) rx(i, j + 1, 1, "extra");
        if (i + 1 < n && j < m && T[i] + T[i + 1] === H[j]) rx(i + 2, j + 1, 0, "ok2"); // "check out" ↔ "checkout"
        if (i < n && j + 1 < m && H[j] + H[j + 1] === T[i]) rx(i + 1, j + 2, 0, "ok2h");
      }
    const st = new Array(n).fill("miss"),
      got = new Array(n).fill("");
    const extras = []; // {word, before: target index}
    for (let i = n, j = m; i || j; ) {
      const b = B[i][j];
      if (b.op === "ok" || b.op === "sub") (st[b.i] = b.op), (got[b.i] = H[b.j]);
      else if (b.op === "ok2") (st[b.i] = st[b.i + 1] = "ok"), (got[b.i] = got[b.i + 1] = H[b.j]);
      else if (b.op === "ok2h") (st[b.i] = "ok"), (got[b.i] = H[b.j] + " " + H[b.j + 1]);
      else if (b.op === "extra") extras.unshift({ word: H[b.j], at: b.i });
      i = b.i;
      j = b.j;
    }
    const words = disp.map((w, k) => {
      const idx = own.map((o, t) => (o === k ? t : -1)).filter((t) => t >= 0);
      const s = idx.map((t) => st[t]);
      const state = !idx.length || s.every((x) => x === "ok") ? "heard" : s.every((x) => x === "miss") ? "missing" : "different";
      const homophone = state === "heard" && idx.some((t) => got[t] && got[t] !== T[t] && HOMO[T[t]] !== undefined && HOMO[T[t]] === HOMO[got[t]]);
      return { word: w, state, heard: idx.map((t) => got[t]).filter(Boolean).join(" "), homophone };
    });
    // 「多說」放回句中正確位置（在第 at 個目標字之前）
    const out = [];
    words.forEach((w, k) => {
      const tStart = own.indexOf(k);
      extras.filter((e) => e.at === tStart).forEach((e) => out.push({ word: e.word, state: "extra", heard: e.word }));
      out.push(w);
    });
    extras.filter((e) => e.at >= n).forEach((e) => out.push({ word: e.word, state: "extra", heard: e.word }));
    const okN = st.filter((x) => x === "ok").length;
    return { items: out, score: n ? okN / n : 0, extraCount: extras.length, heardText: H.join(" "), targetCount: n };
  }
  const LABEL = { heard: "聽到", missing: "漏字", different: "不同詞", extra: "多說", unsure: "不確定" };
  const MARK = { heard: "✓", missing: "漏", different: "≠", extra: "＋", unsure: "?" };
  /* compare(target, listenResult | string, {confMin=0.4})
     → {status:'match'|'partial'|'mismatch'|'uncertain'|'no-result', items:[{word,state,heard,label,mark}], score, note}
     uncertain：最佳候選沒過但次佳候選完全吻合，或信心過低 → 全部標中性，不判對錯。 */
  function compare(target, res, opt) {
    const confMin = (opt && opt.confMin) || 0.4;
    const allowHomophones = !(opt && (opt.allowHomophones === false || opt.mode === "meaning"));
    const alts = typeof res === "string" ? [res] : res && res.ok ? res.alts || [] : [];
    if (!alts.length || !String(alts[0]).trim()) {
      return {
        status: "no-result",
        items: String(target).trim().split(/\s+/).map((w) => ({ word: w, state: "unsure", heard: "", label: LABEL.unsure, mark: "" })),
        score: 0,
        note: res && res.error ? res.message : "沒有辨識結果。",
      };
    }
    const a = align(target, alts[0], allowHomophones);
    const pass = a.score === 1 && (a.targetCount > 1 ? a.extraCount === 0 : a.items.filter((x) => x.state === "extra" && !/^(a|an|the)$/.test(x.word)).length === 0);
    let status = pass ? "match" : a.score >= 0.5 ? "partial" : "mismatch",
      note = "";
    const conf = res && typeof res.conf === "number" ? res.conf : null;
    if (conf !== null && conf > 0 && conf < confMin) (status = "uncertain"), (note = `辨識信心偏低（${conf.toFixed(2)}），這次不判斷。`);
    else if (!pass && alts.slice(1).some((x) => align(target, x, allowHomophones).score === 1)) (status = "uncertain"), (note = "辨識器的其他候選和目標一致，這次不判斷。");
    const items = a.items.map((x) => {
      const s = status === "uncertain" && x.state !== "extra" ? "unsure" : x.state;
      return Object.assign({}, x, { state: s, label: x.homophone && s === "heard" ? "聽到（同音字）" : LABEL[s], mark: MARK[s] });
    });
    return { status, items, score: a.score, heardText: a.heardText, note, basis: alts[0] };
  }

  /* ---------------- 釋放 ---------------- */
  function onHidden() {
    if (W.document && W.document.visibilityState === "hidden") {
      // 切背景：停止播放、收音與辨識，讓遊戲倒數可以安全凍結
      stop();
      if (lis) cancelListen();
      else if (rec) {
        rec.discard = true;
        stopRecording();
      }
    }
  }
  if (W.document && W.document.addEventListener) W.document.addEventListener("visibilitychange", onHidden);

  function destroy() {
    stop();
    if (lis) cancelListen();
    if (rec) {
      rec.discard = true;
      const j = rec;
      try {
        if (j.mr && j.mr.state !== "inactive") j.mr.stop();
      } catch (e) {}
      releaseRec(j);
    }
    try {
      if (W.speechSynthesis) W.speechSynthesis.cancel();
    } catch (e) {}
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
      } catch (e) {}
      audioEl = null;
    }
    if (boostEl) {
      try {
        boostEl.pause();
        boostEl.removeAttribute("src");
      } catch (e) {}
      boostEl = boostGain = null;
    }
    if (sharedAC)
      try {
        sharedAC.close();
      } catch (e) {}
    sharedAC = null;
    tempUrls.forEach(revoke);
    last = null;
    if (W.document && W.document.removeEventListener) W.document.removeEventListener("visibilitychange", onHidden);
    emit();
    subs.clear();
    destroyed = true;
  }
  /* 測試或重新進入頁面時重新啟用（destroy 之後）。 */
  function reset() {
    if (!destroyed) return;
    destroyed = false;
    lastSig = "";
    if (W.document && W.document.addEventListener) W.document.addEventListener("visibilitychange", onHidden);
  }

  claudeDictation();
  return {
    VERSION,
    ERR,
    play,
    stop,
    startRecording,
    stopRecording,
    onBusy,
    destroy,
    reset,
    capabilities,
    permissionState,
    listen,
    stopListen,
    cancelListen,
    compare,
    useFile,
    clearRecording,
    lastRecording: () => last,
    resetRecordConflict: () => {
      recConflict = false;
      try {
        W.sessionStorage.removeItem("ap-rec-conflict");
      } catch (e) {}
    },
    _align: align,
    _tokens: tokens,
  };
});
