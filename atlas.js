/* Nine-region world atlas. Real map access comes from RPG adapters; story plans never unlock maps or award XP. */
const Atlas = (() => {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const MODE_LABELS = { explore: "👆 探索找單字", listen: "🎧 聽音找物", spell: "🔤 找物拼字", mission: "🧺 生活小任務" };
  let DATA = null, loading = null, root = null, options = {}, selected = null, contextId = null, opened = false, launching = false, request = 0, previousFocus = null, wordOpened = false;

  function validate(data) {
    const errors = [], ids = new Set(), maps = new Set();
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.regions) || data.regions.length !== 9) return ["世界資料需要九個地區與版本 1。"];
    const text = (v) => typeof v === "string" && !!v.trim();
    for (const region of data.regions) {
      if (!region || !/^[a-z][a-z-]*$/.test(region.id || "") || ids.has(region.id)) errors.push("地區編號重複或無效。");
      ids.add(region && region.id);
      if (!region || ![region.name, region.element, region.icon, region.tagline, region.story].every(text) || !/^#[0-9a-f]{6}$/i.test(region.tone || "")) errors.push("地區文字或配色不完整。");
      if (!region || !Array.isArray(region.maps)) { errors.push("地圖對照缺漏。"); continue; }
      for (const map of region.maps) {
        if (!map || !text(map.id) || !text(map.label) || maps.has(map.id)) errors.push("地圖對照重複或無效。");
        maps.add(map && map.id);
      }
      if (!Array.isArray(region.learningGoals) || !region.learningGoals.length || !region.learningGoals.every(text)) errors.push("學習目標缺漏。");
      if (!Array.isArray(region.stages) || region.stages.length !== 3) errors.push("每區需要三個故事階段。");
      const stageIds = new Set();
      for (const stage of region.stages || []) {
        if (!stage || ![stage.id, stage.title, stage.plot, stage.learningGoal, stage.rewardIdea].every(text) || stageIds.has(stage.id) || !["planned", "partial", "existing"].includes(stage.implementation)) errors.push("故事階段缺漏或重複。");
        stageIds.add(stage && stage.id);
      }
      if (!Array.isArray(region.contexts) || !region.contexts.length) errors.push("情境入口缺漏。");
      const contexts = new Set();
      for (const context of region.contexts || []) {
        if (!context || !text(context.id) || !text(context.title) || contexts.has(context.id)) errors.push("情境編號缺漏或重複。");
        contexts.add(context && context.id);
        if (context && context.mapId && !region.maps.some((m) => m.id === context.mapId)) errors.push("情境指向不同地區的地圖。");
        if (context && context.drive && ![context.drive.cat, context.drive.scene].every(text)) errors.push("情境對話來源缺漏。");
        for (const word of (context && context.wordRefs) || []) {
          if (!word || !/^[a-z][a-z -]*$/.test(word.word || "") || !text(word.zh) || !["active-life-scene", "active-word-bank"].includes(word.source)) errors.push("單字引用缺漏或來源無效。");
        }
      }
    }
    return errors;
  }

  async function load() {
    if (DATA) return DATA;
    if (!loading) loading = fetch("data/worlds.json").then((r) => { if (!r.ok) throw new Error("world-data"); return r.json(); }).then((data) => {
      const errors = validate(data);
      if (errors.length) throw new Error(errors.join(" "));
      DATA = data;
      return DATA;
    }).finally(() => { loading = null; });
    return loading;
  }

  function statusFor(region) {
    let raw = {};
    try { if (typeof options.getStatus === "function") raw = options.getStatus(region) || {}; } catch (_) { raw = { readError: true }; }
    const permitted = new Set(Array.isArray(raw.unlockedMapIds) ? raw.unlockedMapIds : []);
    const unlockedMaps = region.maps.filter((m) => permitted.has(m.id));
    const hasStudy = region.contexts.some((c) => (c.lifeSceneId && typeof options.openLife === "function") || (c.drive && typeof options.openDrive === "function") || (c.wordPractice && typeof options.openPractice === "function"));
    const connected = typeof options.getStatus === "function";
    const kind = unlockedMaps.length ? "available" : region.maps.length ? (connected ? "locked" : "disconnected") : "planned";
    const label = kind === "available" ? "地圖可前往" : kind === "locked" ? "地圖未解鎖" : kind === "disconnected" ? "從冒險連接地圖" : hasStudy ? "情境可練・地區製作中" : "地區製作中";
    return { ...raw, unlockedMaps, hasStudy, kind, label, completed: new Set(Array.isArray(raw.completedStoryIds) ? raw.completedStoryIds : []) };
  }

  function build() {
    root = document.createElement("section");
    root.id = "atlas";
    root.className = "atlas";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "atlas-heading");
    root.innerHTML = `<header class="atlas-top"><button type="button" id="atlas-back">← 回到冒險</button><span class="atlas-top-label">世界圖鑑</span><button type="button" id="atlas-close" aria-label="關閉世界圖鑑">✕</button></header><main class="atlas-main" id="atlas-content" tabindex="-1"></main><div class="atlas-status" id="atlas-status" role="status" aria-live="polite"></div>`;
    document.body.appendChild(root);
    root.addEventListener("click", clicked);
  }
  const $ = (id) => root.querySelector("#" + id);

  async function open(opt = {}) {
    if (!root) build();
    const serial = ++request;
    if (!opened) previousFocus = document.activeElement;
    options = opt;
    opened = true;
    launching = false;
    selected = null;
    contextId = null;
    root.hidden = false;
    document.body.classList.add("atlas-open");
    document.addEventListener("keydown", keydown, true);
    $("atlas-content").innerHTML = '<h1 id="atlas-heading">共鳴群島</h1><p class="atlas-note">正在展開航圖…</p>';
    try {
      await load();
      if (!opened || serial !== request) return false;
      const region = opt.regionId && DATA.regions.find((r) => r.id === opt.regionId);
      if (region) detail(region.id); else overview();
      if (opt.message) announce(opt.message);
      $("atlas-content").focus();
      return true;
    } catch (_) {
      if (!opened || serial !== request) return false;
      $("atlas-content").innerHTML = '<h1 id="atlas-heading">航圖暫時沒有載入</h1><p class="atlas-note">請確認連線，再試一次。</p><button type="button" class="atlas-action" data-atlas-retry>重新載入</button>';
      $("atlas-content").focus();
      return false;
    }
  }

  function close(reason = "close") {
    if (!opened) return;
    const callback = options.onClose;
    opened = false;
    request++;
    root.hidden = true;
    document.body.classList.remove("atlas-open");
    document.removeEventListener("keydown", keydown, true);
    if (wordOpened && typeof Pron !== "undefined" && typeof Pron.closeWord === "function") Pron.closeWord();
    wordOpened = false;
    const focus = previousFocus;
    previousFocus = null;
    selected = null;
    contextId = null;
    options = {};
    if (focus && focus.isConnected && typeof focus.focus === "function") focus.focus();
    if (typeof callback === "function") callback({ reason });
  }

  function announce(text) { $("atlas-status").textContent = text; }
  function headingBack(detailView) {
    $("atlas-back").textContent = detailView ? "← 世界總覽" : "← 回到冒險";
    $("atlas-content").scrollTop = 0;
    announce("");
  }
  function overview() {
    selected = null;
    contextId = null;
    headingBack(false);
    root.style.setProperty("--atlas-accent", "#4f7363");
    const statuses = DATA.regions.map(statusFor);
    const accessible = statuses.filter((s) => s.unlockedMaps.length).length;
    const study = statuses.filter((s) => s.hasStudy).length;
    $("atlas-content").innerHTML = `<div class="atlas-intro"><p class="atlas-kicker">九枚印記・九種生活</p><h1 id="atlas-heading">${esc(DATA.title)}</h1><p>${esc(DATA.premise)}</p><div class="atlas-counts"><span>${accessible} 區可前往</span><span>${study} 區有練習入口</span><span>角色等級與英文程度分開</span></div><p class="atlas-note">${esc(DATA.progressNote)}</p></div><div class="atlas-grid">${DATA.regions.map((region, index) => {
      const state = statuses[index], current = region.maps.some((m) => m.id === options.currentMapId);
      return `<button type="button" class="atlas-region atlas-region-${state.kind}${current ? " atlas-current" : ""}" data-region="${esc(region.id)}" style="--atlas-region-accent:${region.tone}" aria-label="${esc(region.name + '，' + state.label)}"><span class="atlas-region-icon" aria-hidden="true">${esc(region.icon)}</span><span class="atlas-region-element">${esc(region.element)}之印記</span><strong>${esc(region.name)}</strong><span class="atlas-region-tagline">${esc(region.tagline)}</span><span class="atlas-badge">${esc(state.label)}</span>${current ? '<span class="atlas-here">目前所在地</span>' : ""}</button>`;
    }).join("")}</div><p class="atlas-note atlas-footer-note">印記與篇章的構想會逐區實作；當前任務進度保留在原本的任務日誌。</p>`;
  }

  function detail(id) {
    const region = DATA.regions.find((r) => r.id === id);
    if (!region) return overview();
    selected = id;
    contextId = region.contexts[0].id;
    headingBack(true);
    root.style.setProperty("--atlas-accent", region.tone);
    const state = statusFor(region);
    $("atlas-content").innerHTML = `<section class="atlas-region-intro"><p class="atlas-kicker">${esc(region.element)}之印記 <span class="atlas-badge">${esc(state.label)}</span></p><h1 id="atlas-heading"><span aria-hidden="true">${esc(region.icon)}</span> ${esc(region.name)}</h1><p class="atlas-lead">${esc(region.tagline)}</p><p>${esc(region.story)}</p>${state.progressLabel ? `<p class="atlas-progress">目前進度：${esc(state.progressLabel)}</p>` : ""}</section>
      <section class="atlas-section"><h2>目前可前往的地方</h2>${region.maps.length ? `<div class="atlas-map-actions">${region.maps.map((map) => {
        const on = state.unlockedMaps.some((m) => m.id === map.id) && typeof options.travel === "function";
        return `<button type="button" class="atlas-action" data-map="${esc(map.id)}" ${on ? "" : "disabled"}>${on ? "前往" : "🔒"} ${esc(map.label)}${options.currentMapId === map.id ? "・目前所在" : ""}</button>`;
      }).join("")}</div><p class="atlas-note">${state.unlockedMaps.length ? "地圖與原本任務進度相連，進入後繼續你的冒險。" : state.kind === "disconnected" ? "請從遊戲選單開啟航圖，連接目前的冒險進度。" : "完成原本的前置任務後開放；你仍可選擇下方已有的情境練習。"}</p>` : '<p class="atlas-note">這個地區的探索地圖正在製作。下方已開放的情境可以先練習。</p>'}</section>
      <section class="atlas-section"><h2>在這裡練習什麼</h2><ul class="atlas-goals">${region.learningGoals.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><div class="atlas-context-tabs" role="group" aria-label="選擇情境">${region.contexts.map((context) => `<button type="button" data-context="${esc(context.id)}" aria-pressed="${context.id === contextId}">${esc(context.title)}</button>`).join("")}</div><div id="atlas-practice"></div></section>
      <section class="atlas-section"><h2>居民與故事篇章</h2><div class="atlas-people">${region.npcs.map((n) => `<span><strong>${esc(n.name)}</strong><small>${esc(n.role)}${n.status === "planned" ? "・角色規劃中" : ""}</small></span>`).join("")}</div><ol class="atlas-stories">${region.stages.map((stage) => {
        const complete = stage.implementation !== "planned" && state.completed.has(stage.id);
        const label = complete ? "已完成" : stage.implementation === "planned" ? "故事藍圖" : stage.implementation === "partial" ? "部分內容已接入" : "已有主線任務";
        return `<li><span class="atlas-stage-label">${esc(label)}</span><h3>${esc(stage.title)}</h3><p>${esc(stage.plot)}</p><p class="atlas-story-goal">練習：${esc(stage.learningGoal)}</p><small>獎勵構想：${esc(stage.rewardIdea)}</small></li>`;
      }).join("")}</ol><p class="atlas-note">${esc(region.storyNotice)}</p></section>`;
    renderPractice(region);
  }

  function renderPractice(region) {
    const context = region.contexts.find((c) => c.id === contextId) || region.contexts[0];
    contextId = context.id;
    root.querySelectorAll("[data-context]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.context === context.id)));
    const state = statusFor(region), actions = [];
    if (context.lifeSceneId && typeof options.openLife === "function") for (const [mode, label] of Object.entries(MODE_LABELS)) actions.push(`<button type="button" class="atlas-action" data-life-mode="${mode}">${label}</button>`);
    if (context.drive && typeof options.openDrive === "function") actions.push('<button type="button" class="atlas-action atlas-action-secondary" data-drive>🚗 情境聆聽與跟讀</button>');
    if (context.wordPractice && typeof options.openPractice === "function") actions.push('<button type="button" class="atlas-action atlas-action-secondary" data-practice>📚 原有單字練習</button>');
    if (context.mapId && state.unlockedMaps.some((m) => m.id === context.mapId) && typeof options.travel === "function") actions.push(`<button type="button" class="atlas-action" data-map="${esc(context.mapId)}">前往聲音教室</button>`);
    const canHear = typeof options.openWord === "function" || (typeof Pron !== "undefined" && typeof Pron.openWord === "function");
    $("atlas-practice").innerHTML = `<div class="atlas-practice-card"><h3>${esc(context.title)}</h3>${context.arrivalHint ? `<p class="atlas-note">${esc(context.arrivalHint)}</p>` : ""}${context.wordRefs.length ? `<div class="atlas-words" aria-label="情境單字">${context.wordRefs.map((word) => canHear ? `<button type="button" data-atlas-word="${esc(word.word)}" aria-label="聽 ${esc(word.word)} 的發音"><strong>${esc(word.word)}</strong><span>${esc(word.zh)}</span></button>` : `<span><strong>${esc(word.word)}</strong><span>${esc(word.zh)}</span></span>`).join("")}</div>` : ""}<div class="atlas-practice-actions">${actions.join("")}</div>${actions.length ? '<p class="atlas-note">圖片單字的音標與聲音來源會在練習畫面標示；情境練習可依自己的需要選擇。</p>' : '<p class="atlas-note">這個情境的互動入口尚未接通，可以先從上方已開放的地圖繼續。</p>'}</div>`;
  }

  async function launch(action, payload, extra) {
    if (launching) return;
    const callback = options[action];
    if (typeof callback !== "function") return announce("這個入口尚未接通，請選擇其他已開放內容。");
    launching = true;
    const previousOptions = options, regionId = selected;
    close("action"); // The next adapter takes ownership of pausing its own screen.
    try {
      const result = await callback(payload, extra);
      if (result === false) await open({ ...previousOptions, regionId, message: "這個入口暫時無法開啟，請選擇其他內容。" });
    } catch (_) {
      await open({ ...previousOptions, regionId, message: "剛才的入口沒有開啟，請稍後再試。" });
    } finally { launching = false; }
  }

  function clicked(event) {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.id === "atlas-close") return close();
    if (button.id === "atlas-back") return selected ? overview() : close();
    if (button.hasAttribute("data-atlas-retry")) return open(options);
    if (button.dataset.region) return detail(button.dataset.region);
    const region = DATA && DATA.regions.find((r) => r.id === selected);
    if (!region) return;
    if (button.dataset.context) { contextId = button.dataset.context; return renderPractice(region); }
    if (button.dataset.map) {
      if (!statusFor(region).unlockedMaps.some((m) => m.id === button.dataset.map)) return announce("完成地圖前置任務後開放。");
      return launch("travel", button.dataset.map);
    }
    const context = region.contexts.find((c) => c.id === contextId);
    if (!context) return;
    if (button.dataset.lifeMode && context.lifeSceneId && Object.hasOwn(MODE_LABELS, button.dataset.lifeMode)) return launch("openLife", context.lifeSceneId, { mode: button.dataset.lifeMode });
    if (button.hasAttribute("data-drive") && context.drive) return launch("openDrive", { ...context.drive, label: region.name + "・" + context.title });
    if (button.hasAttribute("data-practice") && context.wordPractice) return launch("openPractice", { ...context.wordPractice, label: region.name + "・" + context.title });
    if (button.dataset.atlasWord && context.wordRefs.some((w) => w.word === button.dataset.atlasWord)) {
      wordOpened = true;
      if (typeof options.openWord === "function") return options.openWord(button.dataset.atlasWord);
      if (typeof Pron !== "undefined") {
        if (Pron.lookup && Pron.lookup(button.dataset.atlasWord)) return Pron.openWord(button.dataset.atlasWord);
        if (Pron.play) return Pron.play(button.dataset.atlasWord, "");
      }
    }
  }

  function keydown(event) {
    if (!opened) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopImmediatePropagation();
      const wordCard = document.querySelector(".wd-card:not([hidden])");
      if (wordOpened && wordCard && typeof Pron !== "undefined" && typeof Pron.closeWord === "function") { Pron.closeWord(); wordOpened = false; return; }
      return selected ? overview() : close();
    }
    if (event.key === "Tab") {
      const buttons = [...root.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter((node) => node.getClientRects().length);
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }

  return { open, close, validate, statusFor, get data() { return DATA; }, get isOpen() { return opened; }, get selectedRegion() { return selected; } };
})();
if (typeof module !== "undefined") module.exports = Atlas;
