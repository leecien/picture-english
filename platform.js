/* Web/App boundary. Existing game saves remain synchronous pm-* localStorage strings.
   Native recording is deliberately delegated to the external AudioPractice module. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Platform = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  const APP = "picture-english";
  const KEYS = Object.freeze(["pm-progress", "pm-cards", "pm-sents", "pm-days", "pm-log", "pm-sound", "pm-best-word", "pm-best-sent", "pm-best-place", "pm-rpg-v1", "pm-drive-pref", "pm-learn-v1", "pm-life-v1"]);
  const ALLOWED = new Set(KEYS), MAX_BYTES = 4 * 1024 * 1024, MAX_VALUE_BYTES = 2 * 1024 * 1024;
  const doc = root.document;
  const scriptBase = doc ? new URL(".", (doc.currentScript && doc.currentScript.src) || doc.baseURI).href : null;
  let panel = null, closeHandler = null, previousFocus = null, initialized = false, installPrompt = null, workerRegistration = null, audioProvider = null;
  let status = { offlineReady: false, updateReady: false, workerError: "" };
  const bytes = (s) => new TextEncoder().encode(s).length;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  function storageOf(storage) { return storage || root.localStorage; }
  function snapshot(storage) {
    const out = Object.create(null), s = storageOf(storage);
    KEYS.forEach((key) => { const value = s.getItem(key); if (value !== null) out[key] = value; });
    return out;
  }
  function backup(storage) {
    return { application: APP, schemaVersion: 1, encoding: "localStorage-raw-strings", createdAt: new Date().toISOString(), entries: snapshot(storage) };
  }
  function safeTree(value, depth = 0, budget = { n: 0 }) {
    if (depth > 32 || ++budget.n > 150000) throw new Error("存檔結構過大或巢狀太深。");
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("存檔含有無效數字。");
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("存檔包含不允許的欄位。");
        safeTree(value[key], depth + 1, budget);
      }
    }
  }
  function validateValue(key, raw) {
    if (typeof raw !== "string" || bytes(raw) > MAX_VALUE_BYTES) throw new Error("存檔欄位不是文字，或單項資料過大。");
    let value;
    try { value = JSON.parse(raw); } catch (_) { throw new Error(key + " 不是有效的存檔資料。"); }
    safeTree(value);
    if (key === "pm-sound") { if (typeof value !== "boolean") throw new Error("音效設定格式錯誤。"); }
    else if (key.startsWith("pm-best-")) { if (typeof value !== "number" || value < 0 || value > 1e9) throw new Error("最佳紀錄格式錯誤。"); }
    else if (key === "pm-days") {
      if (!Array.isArray(value) || value.length > 10000 || value.some((x) => typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x))) throw new Error("學習日期格式錯誤。");
    } else if (key === "pm-log") {
      if (!Array.isArray(value) || value.length > 10000 || value.some((x) => !plain(x))) throw new Error("學習紀錄格式錯誤。");
    } else {
      if (!plain(value)) throw new Error(key + " 必須是物件。");
      if (key === "pm-progress") {
        for (const field of ["xp", "correct", "w", "s", "rounds"]) if (own(value, field) && (typeof value[field] !== "number" || value[field] < 0)) throw new Error("學習進度數值格式錯誤。");
        for (const field of ["badges", "modes"]) if (own(value, field) && (!Array.isArray(value[field]) || value[field].some((x) => typeof x !== "string"))) throw new Error("成就或模式格式錯誤。");
      }
      if (key === "pm-rpg-v1" && own(value, "version") && value.version !== 1) throw new Error("此版本尚不支援這份 RPG 存檔版本。");
    }
  }
  function parseBackup(text) {
    if (typeof text !== "string" || bytes(text) > MAX_BYTES) throw new Error("備份必須是小於 4 MB 的 JSON 檔案。");
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error("無法讀取 JSON，請選擇遊戲匯出的備份檔。"); }
    if (!plain(data) || data.application !== APP || data.schemaVersion !== 1 || data.encoding !== "localStorage-raw-strings" || !plain(data.entries)) throw new Error("這不是支援的英語小旅人備份格式。");
    if (typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt))) throw new Error("備份日期格式錯誤。");
    safeTree(data);
    for (const key of Object.keys(data.entries)) {
      if (!ALLOWED.has(key)) throw new Error("備份包含不屬於本遊戲的鍵：" + key);
      validateValue(key, data.entries[key]);
    }
    return data;
  }
  function previewImport(text, storage) {
    const data = parseBackup(text), previous = snapshot(storage), names = Object.keys(data.entries);
    if (!names.length) throw new Error("這份備份沒有遊戲進度，不會清除目前存檔。");
    return { createdAt: data.createdAt, keys: names, add: names.filter((k) => !own(previous, k)), replace: names.filter((k) => own(previous, k)), remove: Object.keys(previous).filter((k) => !own(data.entries, k)) };
  }
  function restore(text, opt = {}) {
    if (opt.confirmed !== true) throw new Error("請先預覽備份，再明確確認還原。");
    const data = parseBackup(text), storage = storageOf(opt.storage), before = snapshot(storage);
    previewImport(text, storage); // Finish every check before any write.
    try {
      KEYS.forEach((k) => storage.removeItem(k));
      Object.entries(data.entries).forEach(([k, v]) => storage.setItem(k, v));
    } catch (error) {
      let rollbackError = null;
      try { KEYS.forEach((k) => storage.removeItem(k)); Object.entries(before).forEach(([k, v]) => storage.setItem(k, v)); }
      catch (e) { rollbackError = e; }
      const out = new Error(rollbackError ? "還原失敗，而且瀏覽器拒絕回復舊資料。請保留原備份，勿繼續答題。" : "還原失敗，已回復原存檔。可能是儲存空間不足或瀏覽器限制。");
      out.cause = error; out.rollbackFailed = !!rollbackError; throw out;
    }
    return { restored: Object.keys(data.entries).length, reloadRequired: true };
  }
  function trustedDeployment(location) {
    if (!location || !/^https?:$/.test(location.protocol)) return false;
    if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return true;
    return location.protocol === "https:" && location.hostname === "leecien.github.io" && location.pathname.startsWith("/picture-english/");
  }
  function capabilities() {
    let native = false;
    try { native = !!(root.Capacitor && typeof root.Capacitor.isNativePlatform === "function" && root.Capacitor.isNativePlatform()); } catch (_) {}
    return { container: native ? "native-shell" : "web", secure: !!root.isSecureContext, microphoneApi: !!(root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia), recordingBridge: !!(provider() && provider().startRecording), standalone: !!((root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || (root.navigator && root.navigator.standalone)), canInstall: !!installPrompt, ...status };
  }
  function provider() {
    if (audioProvider) return audioProvider;
    if (root.AudioPractice && typeof root.AudioPractice.play === "function") return root.AudioPractice;
    return null;
  }
  function setAudioProvider(value) {
    if (value !== null && (!value || typeof value.play !== "function" || typeof value.stop !== "function")) throw new Error("音訊介面必須提供 play 與 stop。");
    if (audioProvider && audioProvider !== value) audioProvider.stop();
    audioProvider = value;
  }
  function play(opt = {}) {
    const p = provider();
    if (p) return Promise.resolve().then(() => p.play(opt));
    if (typeof Pron !== "undefined" && typeof Pron.play === "function") return Promise.resolve(Pron.play(opt.text || "", opt.url || "")).then((ok) => ({ status: ok ? "ended" : "error" }));
    return Promise.resolve({ status: "unsupported", message: "發音模組尚未載入。" });
  }
  function stopAudio() {
    const p = provider();
    if (p && p.stop) { p.stop(); return { status: "stopped" }; }
    if (typeof Pron !== "undefined" && typeof Pron.stop === "function") { Pron.stop(); return { status: "stopped" }; }
    return { status: "unsupported", message: "目前發音入口尚未提供取消介面；需由整合時接上同一個音訊管理者。" };
  }
  function startRecording() { const p = provider(); return p && typeof p.startRecording === "function" ? Promise.resolve().then(() => p.startRecording()) : Promise.resolve({ status: "unsupported", message: "錄音模組尚未接入，可先使用原開車模式的麥克風檢查。" }); }
  function stopRecording() { const p = provider(); return p && typeof p.stopRecording === "function" ? Promise.resolve().then(() => p.stopRecording()) : Promise.resolve({ status: "unsupported", message: "錄音模組尚未接入。" }); }

  function refreshStatus() {
    if (!panel || panel.hidden) return;
    const c = capabilities();
    panel.querySelector("#pf-runtime").textContent = c.container === "native-shell" ? "偵測到 App 容器；實際原生功能仍依已接入模組提供。" : c.standalone ? "目前從主畫面以獨立視窗開啟。Android／iOS 商店版尚未建置。" : "目前是網頁版；支援的瀏覽器可加入主畫面。Android／iOS 商店版尚未建置。";
    panel.querySelector("#pf-offline").textContent = c.offlineReady ? "基本遊戲已備妥離線入口。語音辨識需要網路；未快取的圖片和配音不保證離線可用。" : "離線入口尚未備妥。首次請連網開啟；預覽網址不安裝離線快取。";
    panel.querySelector("#pf-update").hidden = !c.updateReady;
    panel.querySelector("#pf-install").hidden = !c.canInstall;
    panel.querySelector("#pf-mic").textContent = c.recordingBridge ? "已偵測到錄音模組；需要使用時才會詢問麥克風權限。" : c.microphoneApi ? "瀏覽器提供麥克風能力；新的錄音回放模組尚未接入。" : "此環境未提供瀏覽器麥克風介面；可使用支援的 HTTPS 瀏覽器測試。";
  }
  async function init() {
    if (initialized) return capabilities();
    initialized = true;
    if (root.addEventListener) {
      root.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; refreshStatus(); });
      root.addEventListener("appinstalled", () => { installPrompt = null; refreshStatus(); });
    }
    if (!trustedDeployment(root.location) || capabilities().container === "native-shell" || !root.navigator || !root.navigator.serviceWorker) return capabilities();
    status.offlineReady = !!root.navigator.serviceWorker.controller;
    try {
      workerRegistration = await root.navigator.serviceWorker.register(new URL("service-worker.js", scriptBase).href, { scope: scriptBase, updateViaCache: "none" });
      status.offlineReady = !!workerRegistration.active;
      status.updateReady = !!workerRegistration.waiting;
      const watch = () => {
        const worker = workerRegistration.installing;
        if (worker) worker.addEventListener("statechange", () => {
          if (worker.state === "installed") { status.updateReady = !!workerRegistration.waiting && !!root.navigator.serviceWorker.controller; status.offlineReady = true; refreshStatus(); }
        });
      };
      workerRegistration.addEventListener("updatefound", watch); watch();
      refreshStatus();
    } catch (e) { status.workerError = "目前無法建立離線入口。"; refreshStatus(); }
    return capabilities();
  }
  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
    const f = closeHandler; closeHandler = null;
    if (f) f();
  }
  function downloadBackup() {
    const data = JSON.stringify(backup(), null, 2), blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = doc.createElement("a");
    a.href = url; a.download = "picture-english-save-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function buildPanel() {
    if (panel) return;
    const style = doc.createElement("style"); style.textContent = ".pf[hidden]{display:none}.pf{position:fixed;inset:0;z-index:10000;background:#f5f6eb;color:#283724;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));box-sizing:border-box;font:17px/1.65 system-ui,sans-serif}.pf-inner{max-width:640px;margin:auto}.pf h1{font-size:25px}.pf section{background:#fffdf6;border:1px solid #c8d0b8;border-radius:18px;padding:16px;margin:16px 0}.pf button,.pf input{font:inherit}.pf button{min-height:46px;min-width:46px;border:1px solid #a9b598;border-radius:12px;padding:9px 14px;background:#eaf0dc;color:#283724;margin:4px 5px 4px 0}.pf button:focus-visible,.pf input:focus-visible{outline:3px solid #245ee0;outline-offset:3px}.pf button:disabled{background:#e8e8df;color:#5b6055;cursor:not-allowed}.pf input{max-width:100%}.pf small{display:block;color:#4f5c48}.pf .pf-warning{font-weight:700;color:#75441d}.pf #pf-message{white-space:pre-line}.pf #pf-confirm{background:#436031;color:#fff}.pf #pf-update{background:#2b55a0;color:#fff}";
    doc.head.appendChild(style);
    panel = doc.createElement("div"); panel.className = "pf"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "App 與存檔");
    panel.innerHTML = '<div class="pf-inner"><button id="pf-close" type="button">← 返回遊戲</button><h1>App 與存檔</h1><section><h2>主畫面與離線</h2><p id="pf-runtime"></p><p id="pf-offline"></p><button id="pf-install" type="button" hidden>加入主畫面</button><button id="pf-update" type="button" hidden>更新並重新載入</button><small>iPhone 可在 Safari 的分享選單選擇「加入主畫面」。瀏覽器是否提供此選項依版本而定。</small></section><section><h2>下載備份</h2><p>下載這個裝置的單字卡、課程與冒險進度。換手機或轉入 App 時可保留這份檔案。</p><button id="pf-export" type="button">下載遊戲備份</button><small>備份存放在你下載的檔案中，沒有自動雲端同步。</small></section><section><h2>還原備份</h2><p class="pf-warning">還原會取代目前的遊戲進度並重新載入。請先下載目前備份。</p><label>選擇遊戲備份 JSON <input id="pf-file" type="file" accept="application/json,.json"></label><p id="pf-preview" aria-live="polite">尚未選擇備份。</p><button id="pf-confirm" type="button" disabled>確認還原並重新載入</button></section><section><h2>聲音與麥克風</h2><p id="pf-mic"></p><small>這個設定頁不會自動啟動收音。</small></section><p id="pf-message" role="status"></p></div>';
    doc.body.appendChild(panel);
    const q = (id) => panel.querySelector("#" + id), message = (s) => { q("pf-message").textContent = s; };
    q("pf-close").onclick = close;
    q("pf-export").onclick = () => { try { downloadBackup(); message("已準備下載備份。請確認檔案已存到裝置。"); } catch (_) { message("目前無法讀取存檔或下載，請檢查瀏覽器儲存與下載權限。"); } };
    let pending = "", serial = 0;
    q("pf-file").onchange = async () => {
      const my = ++serial; pending = ""; q("pf-confirm").disabled = true;
      const file = q("pf-file").files[0]; if (!file) return;
      try {
        if (file.size > MAX_BYTES) throw new Error("備份超過 4 MB。");
        const text = await file.text(); if (my !== serial) return;
        const preview = previewImport(text); pending = text;
        q("pf-preview").textContent = "備份日期：" + new Date(preview.createdAt).toLocaleString("zh-TW") + "。共 " + preview.keys.length + " 項：新增 " + preview.add.length + "、取代 " + preview.replace.length + "、移除目前備份中沒有的 " + preview.remove.length + " 項遊戲資料。";
        q("pf-confirm").disabled = false; message("");
      } catch (e) { q("pf-preview").textContent = e.message; }
    };
    q("pf-confirm").onclick = () => { if (!pending) return; try { restore(pending, { confirmed: true }); root.location.reload(); } catch (e) { message(e.message); } };
    q("pf-install").onclick = async () => { if (!installPrompt) return; const p = installPrompt; installPrompt = null; await p.prompt(); await p.userChoice; refreshStatus(); };
    q("pf-update").onclick = () => {
      if (!workerRegistration || !workerRegistration.waiting) return;
      const reload = () => root.location.reload();
      root.navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
      workerRegistration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
    };
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === "Tab") {
        const items = [...panel.querySelectorAll("button:not([disabled]),input:not([disabled])")].filter((x) => !x.hidden && x.offsetParent !== null);
        if (!items.length) return;
        if (e.shiftKey && doc.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
      }
    });
  }
  function open(opt = {}) {
    if (!doc) return false;
    buildPanel(); if (panel.hidden) previousFocus = doc.activeElement; closeHandler = typeof opt.onClose === "function" ? opt.onClose : null;
    panel.hidden = false; refreshStatus(); panel.querySelector("#pf-close").focus();
    return true;
  }
  return { init, open, close, backup, previewImport, restore, capabilities, trustedDeployment, setAudioProvider, play, stopAudio, startRecording, stopRecording, saveKeys: KEYS, maxBackupBytes: MAX_BYTES, get isOpen() { return !!panel && !panel.hidden; } };
});
