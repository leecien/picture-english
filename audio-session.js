/* In-game practice screen using the shared external AudioPractice engine.
   No pm-* writes and no pron:busy events here: the root owns grading and busy aggregation. */
const AudioSession = (() => {
  "use strict";
  let el = null, session = null, serial = 0, releasing = false, cleanup = Promise.resolve();
  const api = () => (typeof AudioPractice !== "undefined" ? AudioPractice : null);
  const q = (id) => el.querySelector("#" + id);
  const current = () => session && session.items[session.index];
  const state = () => session && session.states[session.index];
  const text = (id, value) => { q(id).textContent = value || ""; };
  function releaseRecording(s = session) {
    if (s && s.recordingUrl) URL.revokeObjectURL(s.recordingUrl);
    if (s) { s.recordingUrl = ""; s.recording = null; }
  }
  function stopWork(s = session) {
    serial++;
    const a = api();
    if (s) { clearTimeout(s.autoStop); s.pending = false; s.capture = ""; s.playing = false; }
    if (!a) return Promise.resolve();
    a.stop(); a.cancelListen();
    releasing = true;
    const done = a.stopRecording();
    cleanup = Promise.resolve(done).catch(() => null).then(() => {
      if (a.clearRecording) a.clearRecording();
      releasing = false; render();
    });
    return cleanup;
  }
  function keepRecording(r) {
    if (!session) return;
    releaseRecording();
    if (r && !r.silent && r.error !== 'no-sound' && r.playable !== false && r.blob && r.blob.size) {
      session.recording = r;
      // The screen owns its playback URL; the singleton may clear its own last recording.
      session.recordingUrl = URL.createObjectURL(r.blob);
    }
    const a = api(); if (a && a.clearRecording) a.clearRecording();
  }
  function message(value) { if (session) session.message = value; text("as-message", value); }
  function feedback(result) {
    const host = q("as-feedback"); host.replaceChildren();
    if (!result) return;
    for (const word of result.items || []) {
      const node = document.createElement("span");
      node.className = "aus-token aus-token-" + (["heard", "missing", "different", "extra", "unsure"].includes(word.state) ? word.state : "unsure");
      const strong = document.createElement("b"); strong.textContent = word.word;
      const label = document.createElement("small"); label.textContent = (word.mark || "") + " " + (word.label || "不確定");
      node.append(strong, label);
      if (word.state === "different" && word.heard) { const heard = document.createElement("small"); heard.textContent = "聽成：" + word.heard; node.appendChild(heard); }
      host.appendChild(node);
    }
  }
  function render() {
    if (!session || !el || el.hidden) return;
    const s = session, item = current(), st = state(), a = api();
    const finished = s.index >= s.items.length, busy = s.pending || s.playing || releasing;
    text("as-label", s.label);
    text("as-count", finished ? "練習結束" : (s.index + 1) + " / " + s.items.length);
    q("as-listen-only").checked = s.listenOnly;
    q("as-listen-only").disabled = busy;
    text("as-steps", s.listenOnly ? "聆聽模式：只播放，不收音、不計分" : "① 聽示範　→　② 跟讀　→　③ 自己念");
    const caps = a && a.capabilities ? a.capabilities() : {};
    q("as-record-copy").disabled = busy || !caps.recording;
    q("as-record-copy").parentElement.hidden = finished || s.listenOnly;
    if (!caps.recording) q("as-record-copy").checked = false;
    const hiddenAnswer = !finished && !s.listenOnly && st.phase === "independent" && !s.comparison;
    q("as-english").hidden = hiddenAnswer || finished;
    text("as-english", hiddenAnswer || finished ? "" : item.en);
    text("as-chinese", finished ? "本次獨立完成 " + s.completed.size + " / " + s.items.length + " 項。聆聽、略過或無法判讀的項目沒有計入完成。" : item.zh || "請練習這個英文內容。");
    text("as-phase", finished ? "這一輪結束" : s.listenOnly ? "聽一聽" : st.phase === "independent" ? "自己念：這次不先播示範" : st.demoHeard ? "跟著念，可以多練幾次" : "先聽示範，再開始跟讀");
    text("as-message", s.message);
    q("as-paused").hidden = !s.paused;
    text("as-partial", s.partial ? "辨識中（尚未判讀）：" + s.partial : "");
    feedback(s.comparison);
    q("as-demo").hidden = finished || (!s.listenOnly && st.phase === "independent");
    q("as-demo").disabled = busy || s.paused || !a;
    q("as-start").hidden = finished || s.listenOnly;
    q("as-start").disabled = finished || busy || s.paused || !a || !st.demoHeard;
    text("as-start", !finished && st.phase === "independent" ? "🎤 自己念" : "🎤 開始跟讀");
    q("as-record-only").hidden = finished || s.listenOnly;
    q("as-record-only").disabled = finished || busy || s.paused || !a || !st.demoHeard || !caps.recording;
    q("as-stop").hidden = !s.capture;
    q("as-stop").disabled = releasing;
    q("as-cancel").hidden = !busy;
    q("as-replay").hidden = !s.recordingUrl;
    q("as-replay").disabled = busy || s.paused;
    q("as-independent").hidden = finished || s.listenOnly || st.phase === "independent" || !st.shadowPassed;
    q("as-independent").disabled = busy || s.paused;
    q("as-help").hidden = finished || s.listenOnly || st.phase !== "independent";
    q("as-help").disabled = busy || s.paused;
    q("as-next").hidden = finished || (!s.listenOnly && !st.independentPassed);
    q("as-next").disabled = busy || s.paused;
    text("as-next", s.listenOnly ? "下一項（聆聽不計分）" : "下一項");
    q("as-skip").hidden = finished || s.listenOnly || st.independentPassed;
    q("as-skip").disabled = busy || s.paused;
    q("as-meter-wrap").hidden = !s.capture;
    text("as-capability", !a ? "音訊模組尚未載入，請稍後再試。" : caps.recognition === "none" ? "此瀏覽器沒有語音辨識，可錄音回放自己比對，不會自動判對錯。" : "如果同時錄音與辨識收不到聲音，可關閉「保留錄音」單做判讀，或使用「只錄音回放」。");
  }
  async function playDemo() {
    const s = session, st = state(), item = current(), a = api();
    if (!s || !item || !a || s.pending || s.playing || releasing || s.paused) return;
    const my = ++serial; s.playing = true; s.comparison = null; s.partial = ""; message("正在播放示範，播完才開放跟讀。"); render();
    try {
      const options = { text: item.en, url: item.audio || "", lang: "en-US", rate: 0.9 };
      const result = await (typeof AudioBus !== "undefined" && typeof AudioBus.play === "function" ? AudioBus.play(options) : a.play(options));
      if (s !== session || my !== serial) return;
      if (result.status === "ended") { st.demoHeard = true; if (!s.listenOnly) st.phase = "shadow"; message(s.listenOnly ? "示範播放完成。聆聽不計分。" : "聽好了，按「開始跟讀」再開口。"); }
      else message(result.status === "cancelled" ? "播放已停止，請準備好後再聽。" : result.message || "示範沒有播出，請重試。");
    } catch (_) { if (s === session && my === serial) message("示範播放失敗，請重試。"); }
    finally { if (s === session && my === serial) { s.playing = false; render(); } }
  }
  function begin(recordOnly) {
    const s = session, st = state(), item = current(), a = api();
    if (!s || !st || !item || !a || s.listenOnly || !st.demoHeard || s.pending || s.playing || releasing || s.paused) return;
    releaseRecording(); s.comparison = null; s.partial = ""; s.pending = true; s.capture = recordOnly ? "record" : "listen";
    st.attempts++; const my = ++serial;
    message(recordOnly ? "正在錄音；說完按「說完了」。只錄音不判對錯。" : "請開口，說完按「說完了」。");
    const onLevel = (level) => { if (session === s && my === serial) q("as-meter").value = Math.max(0, Math.min(1, Number(level) || 0)); };
    // Keep capture calls directly inside the user's click; no awaited playback before getUserMedia/SR.
    let pending;
    try {
      pending = recordOnly ? a.startRecording({ maxMs: 16000, onLevel }) : a.listen({ lang: "en-US", maxMs: 12000, record: q("as-record-copy").checked ? "auto" : false, onLevel, onPartial: (value) => { if (session === s && my === serial) { s.partial = value; text("as-partial", "辨識中（尚未判讀）：" + value); } } });
    } catch (_) { s.pending = false; s.capture = ""; message("目前無法開始收音，請確認權限與裝置後重試。"); render(); return; }
    render();
    Promise.resolve(pending).then((result) => {
      if (session !== s || my !== serial) return;
      if (recordOnly) {
        if (!result.ok) { s.pending = false; s.capture = ""; message(result.message || "無法開始錄音。這次不計分。"); }
        else s.autoStop = setTimeout(() => { if (session === s && my === serial && s.capture === "record") stopCapture(); }, 14000);
        // startRecording resolves when recording starts; completion is handled by the stop button.
        render(); return;
      }
      finishAttempt(s, st, item, result); s.pending = false; s.capture = ""; s.partial = ""; render();
    }).catch(() => { if (session === s && my === serial) { s.pending = false; s.capture = ""; message("收音或辨識失敗，這次不計分。可以再試一次。"); render(); } });
  }
  function finishAttempt(s, st, item, result) {
    const a = api();
    const notice = result.recordSkipped || result.recordConflict ? " 本次未保留錄音；裝置收音衝突時改為只辨識，可另外使用「只錄音回放」。" : result.recording && result.recording.levelMeasured === false ? " 無法確認音量；可以回放自行確認，不會判為沒聲音。" : "";
    keepRecording(result.recordSkipped || result.recordConflict ? null : result.recording);
    // This panel practices reading a target aloud, not sentence meaning or spelling.
    const comparison = a.compare(item.en, result, { allowHomophones: true }); s.comparison = comparison;
    try {
    if (!result.ok) { message((result.message || "沒有取得可判讀的語音。") + (s.recordingUrl ? " 可以播放自己的錄音。" : "") + " 這次不計分。"); return; }
    if (comparison.status === "uncertain" || comparison.status === "no-result") { message(comparison.note || "辨識不確定，請再試一次，這次不判對錯。"); return; }
    if (comparison.status !== "match") { message("看看標出的漏字或不同詞，再聽、再念一次即可；這次尚未完成。"); return; }
    if (st.phase !== "independent") { st.shadowPassed = true; message("這輪逐字辨識吻合！可以重聽、重錄，或按「試著自己念」。"); }
    else {
      st.independentPassed = true; message("自己念的文字辨識吻合，這項已完成。這不是 KK 或口音評分。");
      if (!s.completed.has(s.index)) {
        s.completed.add(s.index);
        if (typeof s.onResult === "function") {
          try { s.onResult({ id: item.id, index: s.index, en: item.en, zh: item.zh, item: item.original, status: "match", basis: "speech-recognition-text-match", shadowPassed: true, independentPassed: true, attempts: st.attempts, recordingAvailable: !!s.recordingUrl }); }
          catch (_) { message("判讀已完成，但進度回報遇到問題；請回到遊戲確認紀錄。"); }
        }
      }
    }
    if (result.recording && !result.recording.ok && !s.recordingUrl) message(s.message + " 這次未保存錄音；可改用「只錄音回放」另外錄製。");
    } finally { if (notice && session === s) message(s.message + notice); }
  }
  function stopCapture() {
    const s = session, a = api(); if (!s || !a || !s.capture) return;
    clearTimeout(s.autoStop);
    if (s.capture === "listen") { a.stopListen(); message("正在等待這次語音的最後結果……"); return; }
    const my = serial; message("正在整理錄音……");
    Promise.resolve(a.stopRecording()).then((result) => {
      if (session !== s || my !== serial) return;
      keepRecording(result); s.pending = false; s.capture = "";
      message((result.ok ? "已錄好，可以回放自己比對。只錄音沒有自動判讀，不計分。" : (result.message || "這次沒有可用錄音。") + (s.recordingUrl ? " 仍可回放檢查。" : "") + " 不計分。") + (result.levelMeasured === false ? " 無法確認音量；請回放自行確認。" : "")); render();
    }).catch(() => { if (session === s && my === serial) { s.pending = false; s.capture = ""; message("無法整理錄音，請重試。"); render(); } });
  }
  async function replay() {
    const s = session, a = api(); if (!s || !s.recordingUrl || !a || s.pending || s.playing || releasing || s.paused) return;
    const my = ++serial; s.playing = true; message("播放自己的錄音……"); render();
    try { const result = await a.play({ url: s.recordingUrl, fallbackTts: false, gainDb: q("as-replay-gain").checked && s.recording ? Number(s.recording.playbackGainDb) || 0 : 0, durationMs: s.recording && s.recording.durationMs || undefined }); if (s === session && my === serial) message(result.status === "ended" ? "回放完成，可再錄一次。回放不計分。" : result.message || "回放已停止或目前無法播放。"); }
    catch (_) { if (s === session && my === serial) message("目前無法播放這份錄音，請重錄或換支援的瀏覽器。"); }
    finally { if (s === session && my === serial) { s.playing = false; render(); } }
  }
  function next() {
    if (!session || session.pending || session.playing || releasing || session.paused) return;
    const s = session; stopWork(s); releaseRecording(s); s.index++; s.comparison = null; s.partial = ""; s.message = ""; render();
  }
  function close() {
    const s = session; if (!s) return;
    stopWork(s); releaseRecording(s); session = null; el.hidden = true;
    if (s.previousFocus && s.previousFocus.isConnected) s.previousFocus.focus();
    if (typeof s.onClose === "function") s.onClose();
  }
  function build() {
    if (el) return;
    el = document.createElement("section"); el.id = "audio-session"; el.className = "audio-session"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "錄音與跟讀練習");
    el.innerHTML = '<div class="aus-inner"><header><button id="as-close" type="button">← 返回</button><h1 id="as-label">錄音與跟讀</h1><span id="as-count"></span></header><label class="aus-choice"><input id="as-listen-only" type="checkbox">聆聽模式（不收音、不計分）</label><p id="as-steps" class="aus-steps"></p><div id="as-paused" class="aus-pause" hidden><p>已停止播放與收音。回來後請自行繼續。</p><button id="as-resume" type="button">我準備好了</button></div><article class="aus-card"><h2 id="as-phase"></h2><p id="as-english" class="aus-english"></p><p id="as-chinese"></p><p id="as-partial" class="aus-partial" aria-live="polite"></p><div id="as-feedback" class="aus-feedback"></div><p id="as-message" class="aus-message" role="status"></p><div id="as-meter-wrap" hidden><label>收音音量 <meter id="as-meter" min="0" max="1" value="0"></meter></label></div><div class="aus-actions"><button id="as-demo" type="button">🔊 聽示範</button><button id="as-start" class="aus-primary" type="button">🎤 開始跟讀</button><button id="as-stop" class="aus-primary" type="button" hidden>說完了</button><button id="as-cancel" type="button" hidden>取消本次</button><button id="as-replay" type="button" hidden>▶ 播放我的錄音</button><button id="as-record-only" type="button">只錄音回放（不判讀）</button></div><label class="aus-choice"><input id="as-record-copy" type="checkbox" checked>跟讀時同時保留錄音（收音衝突時可關閉）</label><label class="aus-choice"><input id="as-replay-gain" type="checkbox" checked>回放音量平衡（裝置支援時）</label><p id="as-capability" class="aus-small"></p><div class="aus-actions"><button id="as-independent" type="button" hidden>試著自己念</button><button id="as-help" type="button" hidden>需要示範，回到跟讀</button><button id="as-next" class="aus-primary" type="button" hidden>下一項</button><button id="as-skip" type="button">略過這項（不計完成）</button></div></article><p class="aus-small">綠色表示語音辨識聽到這個字。漏字、不同詞和不確定都有文字提示；這不是精準音素、口音或句意評分；跟讀允許辨識器以同音字轉寫。錄音只保留在本次瀏覽器畫面，離開即釋放，不會自動上傳。</p></div>';
    document.body.appendChild(el);
    q("as-close").onclick = close; q("as-demo").onclick = playDemo; q("as-start").onclick = () => begin(false); q("as-record-only").onclick = () => begin(true); q("as-stop").onclick = stopCapture; q("as-replay").onclick = replay; q("as-next").onclick = next; q("as-skip").onclick = next;
    q("as-cancel").onclick = () => { stopWork(); releaseRecording(); message("這次已取消，沒有計入完成。可以準備好再試。"); render(); };
    q("as-independent").onclick = () => { if (!state() || !state().shadowPassed) return; stopWork(); releaseRecording(); state().phase = "independent"; session.comparison = null; session.partial = ""; message("現在看中文，自己說英文。這次不先播示範。"); render(); };
    q("as-help").onclick = () => { stopWork(); releaseRecording(); state().phase = "demo"; state().demoHeard = false; state().shadowPassed = false; session.comparison = null; message("回到跟讀，先聽示範再練習。這次沒有計獨立完成。"); render(); };
    q("as-resume").onclick = () => { if (!session) return; session.paused = false; message("準備好了，再按播放或收音按鈕開始。"); render(); };
    q("as-listen-only").onchange = () => { const value = q("as-listen-only").checked; stopWork(); releaseRecording(); session.listenOnly = value; session.comparison = null; session.partial = ""; message(value ? "現在只播放示範，不收音也不計分。" : "回到跟讀練習。"); render(); };
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === "Tab") {
        const nodes = [...el.querySelectorAll("button:not([disabled]),input:not([disabled])")].filter((n) => !n.hidden && n.offsetParent !== null);
        if (!nodes.length) return;
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes[nodes.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) { e.preventDefault(); nodes[0].focus(); }
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (!session || document.visibilityState !== "hidden") return;
      stopWork(); releaseRecording(); session.paused = true; session.comparison = null; session.partial = ""; message("切換畫面時已停止收音，回來後再自行開始。"); render();
    });
  }
  function open(opt = {}) {
    if (session) close(); build(); const a = api(); if (a && a.reset) a.reset();
    const items = (Array.isArray(opt.items) ? opt.items : []).filter((x) => x && typeof x.en === "string" && x.en.trim() && x.en.length <= 600).slice(0, 100).map((x, i) => ({ id: x.id == null ? String(i) : String(x.id), en: x.en.trim(), zh: typeof x.zh === "string" ? x.zh.slice(0, 1500) : "", audio: typeof x.audio === "string" ? x.audio : "", original: x }));
    session = { items, index: 0, label: String(opt.label || "錄音與跟讀"), states: items.map(() => ({ phase: "demo", demoHeard: false, shadowPassed: false, independentPassed: false, attempts: 0 })), completed: new Set(), pending: false, capture: "", playing: false, paused: false, listenOnly: false, comparison: null, partial: "", message: items.length ? "先聽示範，跟著念；辨識吻合後再試著自己念。" : "目前沒有可練習的內容。", recording: null, recordingUrl: "", onClose: opt.onClose, onResult: opt.onResult, previousFocus: document.activeElement };
    q("as-record-copy").checked = true; el.hidden = false; render(); q("as-close").focus();
    return true;
  }
  return { open, close, get isOpen() { return !!session && !!el && !el.hidden; } };
})();
