/* Sentence-led everyday lessons: 12 scenes, 6 contextual sentences each.
   Pictures illustrate a situation; no object-location answers. Legacy pm-life-v1 records are preserved.
   Story → hear sentence/word → sentence gap practice; first attempts, retries and exposure stay separate. */
const Life = (() => {
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const store = () => {
    const d = (typeof LS !== "undefined" && LS.get("pm-life-v1", null)) || {};
    return { v: 1, found: {}, res: {}, missions: {}, ...d };
  };
  let CONTEXTS = null;
  let DATA = null,
    ST = store(),
    el = null,
    scene = null,
    mode = "explore",
    view = { z: 1, tx: 0, ty: 0, w: 0, h: 0, W: 0, H: 0 },
    round = null,
    onClose = null;
  const save = () => typeof LS !== "undefined" && LS.set("pm-life-v1", ST);
  const bankWord = (w) => (typeof Vocab !== "undefined" && Vocab.lookup(w)) || (typeof WORDS !== "undefined" ? WORDS.find((x) => x.w === w) : null);
  async function load() {
    if (DATA) return DATA;
    const r = await fetch("data/life-scenes.json");
    const nextData = await r.json();
    const contextResponse = await fetch("data/life-contexts.json");
    if (!contextResponse.ok) throw Error("情境教材載入失敗");
    CONTEXTS = (await contextResponse.json()).scenes;
    DATA = nextData;
    return DATA;
  }
  /* result bookkeeping: kind = ind | retry | wrong | seen */
  function note(t, kind) {
    const r = (ST.res[t.word] = { ind: 0, retry: 0, wrong: 0, seen: 0, ...(ST.res[t.word] || {}) });
    r[kind]++;
    // Words in the word bank share the card book, XP and anti-farming rules (Learn.grade); others are kept here only.
    const b = bankWord(t.word);
    if (b && (kind === "ind" || kind === "wrong") && typeof Learn !== "undefined") Learn.grade({ recK: "w", item: b, ctx: "life:" + scene.id }, kind === "ind", "quest");
    save();
  }
  const say = (t) => (typeof Pron !== "undefined" ? Pron.play(t.word, t.audio || "") : Promise.resolve(false));
  const soundNote = (t) => (t.audio ? "真人錄音" : "裝置語音念整個字（正式配音待補）");
  const kkHTML = (t) => (t.kk ? `<span class="life-kk">${ESC(t.kk)}</span>` : `<span class="life-nokk">音標待補（題庫還沒有這個字的 KK）</span>`);

  /* ---------- DOM ---------- */
  function build() {
    el = document.createElement("div");
    el.className = "life";
    el.id = "life";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "生活情境學英語");
    el.innerHTML = `<div class="life-top"><button type="button" id="life-back">← 返回</button><b id="life-title">生活情境</b><span id="life-count"></span></div>
      <div class="life-tabs" id="life-tabs" hidden>${[["story", "💬 情境故事"], ["practice", "✍️ 句子練習"]].map(([k, l]) => `<button type="button" data-mode="${k}">${l}</button>`).join("")}</div>
      <div class="life-stage" id="life-stage" hidden><div class="life-layer" id="life-layer"><img id="life-img" alt="" draggable="false"><svg id="life-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg></div>
        <div class="life-toast" id="life-toast" hidden></div></div>
      <div class="life-zoom" id="life-zoom" hidden><small>拖曳移動，雙指或按鈕縮放</small><button type="button" id="life-in" aria-label="放大">＋</button><button type="button" id="life-out" aria-label="縮小">－</button><button type="button" id="life-fit" aria-label="看整張">⤢</button></div>
      <div class="life-panel" id="life-panel"></div>`;
    document.body.appendChild(el);
    el.querySelector("#life-back").onclick = () => (scene ? pickScene() : close());
    el.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    el.querySelector("#life-in").onclick = () => zoomAt(view.W / 2, view.H / 2, view.z * 1.5);
    el.querySelector("#life-out").onclick = () => zoomAt(view.W / 2, view.H / 2, view.z / 1.5);
    el.querySelector("#life-fit").onclick = () => fit();
    bindTouch(el.querySelector("#life-stage"));
    window.addEventListener("resize", () => !el.hidden && scene && fit(true));
  }
  const $l = (id) => el.querySelector("#" + id);
  async function open(opt = {}) {
    if (!el) build();
    onClose = opt.onClose || null;
    el.hidden = false;
    document.body.classList.add("life-open");
    try { await load(); } catch (_) {
      $l("life-panel").textContent = "情境教材暫時無法載入，請返回後重試。";
      return;
    }
    if (opt.scene) return openScene(opt.scene, opt.mode);
    pickScene();
  }
  function close() {
    round = null;
    if (typeof AudioBus !== "undefined") AudioBus.stop();
    if (typeof Pron !== "undefined") Pron.closeWord();
    if (scene && typeof Learn !== "undefined") Learn.flush("quest", "生活情境・" + scene.title);
    el.hidden = true;
    scene = null;
    document.body.classList.remove("life-open");
    if (onClose) onClose();
  }
  function pickScene() {
    if (typeof AudioBus !== "undefined") AudioBus.stop();
    if (scene && typeof Learn !== "undefined") Learn.flush("quest", "生活情境・" + scene.title);
    scene = null;
    round = null;
    $l("life-title").textContent = "生活情境學英語";
    $l("life-count").textContent = "";
    $l("life-tabs").hidden = true;
    $l("life-stage").hidden = true;
    $l("life-zoom").hidden = true;
    $l("life-panel").innerHTML = `<p class="life-lead">走進生活情境，先聽一句話，認識其中的重點單字，再用句子練習。每個情境帶入 6 個字。</p><div class="life-scenes">${DATA.scenes
      .map((s) => `<button type="button" data-scene="${s.id}"><img src="${ESC(s.image)}" alt="" loading="lazy"><b>${ESC(s.title)}</b><small>已學 ${(ST.found[s.id] || []).length} / ${s.targets.length}</small></button>`)
      .join("")}</div>`;
    $l("life-panel").querySelectorAll("[data-scene]").forEach((b) => (b.onclick = () => openScene(b.dataset.scene)));
  }
  function openScene(id, m) {
    scene = DATA.scenes.find((s) => s.id === id);
    if (!scene) return pickScene();
    $l("life-title").textContent = scene.title;
    $l("life-tabs").hidden = false;
    $l("life-stage").hidden = false;
    $l("life-zoom").hidden = false;
    const img = $l("life-img");
    img.onload = () => fit();
    img.src = scene.image;
    if (img.complete && img.naturalWidth) requestAnimationFrame(() => fit());
    paintOutlines();
    setMode(m || "story");
  }
  const found = () => (ST.found[scene.id] = ST.found[scene.id] || []);
  function count() {
    $l("life-count").textContent = `已學 ${found().length} / ${scene.targets.length}`;
  }

  /* ---------- view: pan / zoom ---------- */
  function fit(keep) {
    const st = $l("life-stage"),
      W = st.clientWidth,
      H = st.clientHeight,
      a = (scene.width || 1536) / (scene.height || 1024);
    let h = H,
      w = H * a;
    if (w < W) (w = W), (h = W / a);
    Object.assign(view, { W, H, w, h });
    const L = $l("life-layer");
    L.style.width = w + "px";
    L.style.height = h + "px";
    if (keep) return apply();
    view.z = 1;
    view.tx = (W - w) / 2;
    view.ty = (H - h) / 2;
    apply();
  }
  function clamp() {
    const { W, H, w, h, z } = view;
    view.tx = w * z <= W ? (W - w * z) / 2 : Math.min(0, Math.max(W - w * z, view.tx));
    view.ty = h * z <= H ? (H - h * z) / 2 : Math.min(0, Math.max(H - h * z, view.ty));
  }
  function apply() {
    clamp();
    $l("life-layer").style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`;
  }
  function zoomAt(px, py, z) {
    z = Math.max(1, Math.min(4, z));
    const nx = (px - view.tx) / view.z,
      ny = (py - view.ty) / view.z;
    view.z = z;
    view.tx = px - nx * z;
    view.ty = py - ny * z;
    apply();
  }
  /* Bring a target into view (camera focus for spelling / reveal). */
  function focus(t) {
    const xs = t.polygon.map((p) => p[0]),
      ys = t.polygon.map((p) => p[1]);
    const bw = (Math.max(...xs) - Math.min(...xs)) * view.w,
      bh = (Math.max(...ys) - Math.min(...ys)) * view.h;
    const z = Math.max(1, Math.min(3, Math.min((view.W * 0.6) / bw, (view.H * 0.6) / bh)));
    const cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * view.w,
      cy = ((Math.min(...ys) + Math.max(...ys)) / 2) * view.h;
    view.z = z;
    view.tx = view.W / 2 - cx * z;
    view.ty = view.H / 2 - cy * z;
    apply();
  }
  /* A tap is a tap only when the finger barely moved; drags pan, two fingers zoom. */
  function bindTouch(st) {
    const pts = new Map();
    let start = null,
      moved = false,
      pinch = null;
    st.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".life-zoom")) return;
      st.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) (start = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }), (moved = false);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
        moved = true;
      }
    });
    st.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()],
          r = st.getBoundingClientRect();
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 8) moved = true;
      if (moved) {
        view.tx = start.tx + dx;
        view.ty = start.ty + dy;
        apply();
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        if (!moved && start) {
          const r = st.getBoundingClientRect();
          tap(e.clientX - r.left, e.clientY - r.top);
        }
        start = null;
      }
    };
    st.addEventListener("pointerup", up);
    st.addEventListener("pointercancel", (e) => {
      pts.delete(e.pointerId);
      start = null;
      pinch = null;
    });
  }

  /* ---------- hit testing ---------- */
  function inside(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i],
        [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /* distance on screen (CSS px) from a point to a polygon's edge */
  function screenDist(p, poly) {
    const S = (q) => [q[0] * view.w * view.z, q[1] * view.h * view.z],
      P = S(p);
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const A = S(poly[j]),
        B = S(poly[i]),
        dx = B[0] - A[0],
        dy = B[1] - A[1],
        t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(P[0] - A[0] - t * dx, P[1] - A[1] - t * dy));
    }
    return best;
  }
  const TOL = 22; // half of a 44 px touch target
  /* -> {t} a target, {zoom:true} too close to call, or {} nothing there */
  function hit(px, py) {
    const p = [(px - view.tx) / view.z / view.w, (py - view.ty) / view.z / view.h];
    const order = scene.targets.slice().sort((a, b) => b.priority - a.priority);
    const direct = order.find((t) => inside(p, t.polygon));
    if (direct) return { t: direct };
    const near = order.map((t) => ({ t, d: screenDist(p, t.polygon) })).filter((x) => x.d <= TOL).sort((a, b) => a.d - b.d);
    if (!near.length) return {};
    if (near.length > 1 && near[1].d - near[0].d < 8 && near[1].t !== near[0].t) return { zoom: true };
    return { t: near[0].t };
  }
  function tap(px, py) {
    if (!scene || !round || round.locked) return;
    const h = hit(px, py);
    if (h.zoom) {
      zoomAt(px, py, Math.max(view.z * 2, 2));
      return toast("放大了，請再點一次");
    }
    round.onTap(h.t || null);
  }

  /* ---------- drawing ---------- */
  function paintOutlines() {
    const marks = (round && round.marks) || {};
    $l("life-svg").innerHTML = scene.targets
      .filter((t) => marks[t.id])
      .map((t) => `<polygon class="lo lo-${marks[t.id]}" points="${t.polygon.map((p) => p.join(",")).join(" ")}"/>`)
      .join("");
  }
  let toastT = 0;
  function toast(t) {
    const x = $l("life-toast");
    x.textContent = t;
    x.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (x.hidden = true), 1800);
  }
  function card(t, extra = "") {
    return `<div class="life-card"><b class="life-word">${ESC(t.word)}</b><span class="life-zh">${ESC(t.zh)}</span>${kkHTML(t)}<span class="dlg-row"><button type="button" class="life-say" data-say-word="${ESC(t.id)}">🔊 再聽一次</button><small>${soundNote(t)}</small></span>${extra}</div>`;
  }
  function bindSay(root) {
    root.querySelectorAll("[data-say-word]").forEach((b) => (b.onclick = () => say(scene.targets.find((t) => t.id === b.dataset.sayWord))));
  }
  const panel = (html) => {
    $l("life-panel").innerHTML = html;
    bindSay($l("life-panel"));
  };

  /* ---------- modes ---------- */
  function setMode(m) {
    mode = m === "practice" ? "practice" : "story";
    if (typeof AudioBus !== "undefined") AudioBus.stop();
    el.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    if (typeof Pron !== "undefined") Pron.closeWord();
    count();
    contextLesson(mode === "practice");
  }
  function contextLesson(practice) {
    const lessons = CONTEXTS[scene.id];
    let index = 0;
    const next = () => {
      if (typeof AudioBus !== "undefined") AudioBus.stop();
      if (index >= lessons.length) {
        round = {locked:true, marks:{}, onTap() {}};
        paintOutlines();
        panel(`<div class="life-sum"><b>${practice ? "句子練習完成" : "情境故事讀完了"}</b><p>這次在「${ESC(scene.title)}」認識了 ${lessons.length} 個字。</p><button type="button" id="context-practice">${practice ? "再練一輪" : "試試句子練習"}</button></div>`);
        $l("context-practice").onclick = () => setMode("practice");
        return;
      }
      const item = lessons[index], t = scene.targets.find(t => t.word === item.word);
      const cur = round = {locked:true, marks:{[t.id]:"found"}, onTap() {}};
      // The image illustrates the story; there is no hotspot answer or penalty.
      paintOutlines(); focus(t);
      let heard = false, settled = false, missed = false, ev = null, wrongs = 0;
      // 我的英語能力: one sentence-level event (item = the sentence, links.word = the key word). The sentence is
      // heard in full before the choices open, so the target English was heard first: revealed (practice, not
      // independent evidence, by the external rules).
      const logLife = (ok) => {
        if (typeof Ability === "undefined") return;
        if (!ev) ev = Ability.log({ recK: "s", item: { en: item.en } }, { result: ok ? "correct" : "wrong", qtype: "life:context-blank", ctx: "life:" + scene.id, via: practice ? "practice" : "lesson", revealed: true, links: { word: "w:" + t.word } });
        else if (ok) Ability.update(ev, { retries: wrongs, final: "correct" });
      };
      const reveal = () => {
        panel(`<p class="life-hint">${index+1} / ${lessons.length} · ${ESC(item.situation)}</p>
          <p class="life-context-line">${Learn.sayHTML(item.en, "")}</p><p>${ESC(item.zh)}</p>
          <p class="life-context-word"><b>${ESC(t.word)}</b>：${ESC(t.zh)}</p>
          <button type="button" id="context-hear">🔊 聽整句</button> <button type="button" id="context-word">🔊 聽 ${ESC(t.word)}</button>
          <p class="life-hint">${practice ? (missed ? "重試後答對，這次先記住這個用法。" : "✓ 答對了！") : "先在句子裡認識這個字，再練習怎麼使用。"}</p>
          <button type="button" id="context-next">${index+1===lessons.length ? "完成這個情境" : "繼續故事"}</button>`);
        $l("life-panel").querySelectorAll(".pw").forEach(n=>{if(n.dataset.w===t.word)n.classList.add("life-keyword");});
        $l("context-hear").onclick = () => Pron.play(item.en, "");
        $l("context-word").onclick = () => say(t);
        $l("context-next").onclick = () => {
          if (!found().includes(t.id)) {found().push(t.id); note(t,"seen");}
          count(); index++; next();
        };
      };
      if (!practice) return reveal();
      const gap = item.en.replace(new RegExp(String.raw`\b${t.word}\b`, "i"), "＿＿＿");
      const choices = shuffle([t,...shuffle(scene.targets.filter(x=>x!==t)).slice(0,3)]);
      panel(`<p class="life-hint">${index+1} / ${lessons.length} · ${ESC(item.situation)}</p><p class="life-context-line">${ESC(gap)}</p><p>${ESC(item.zh)}</p>
        <button type="button" id="context-hear">🔊 先聽情境句子</button><p id="context-status" role="status">聽完後，選字完成這句話。</p>
        <div class="life-context-choices">${choices.map(x=>`<button type="button" data-context-word="${ESC(x.word)}" disabled>${ESC(x.word)}</button>`).join("")}</div>`);
      if (typeof Ability !== "undefined") Ability.begin(); // a new question: nothing looked at yet
      $l("context-hear").onclick = async () => {
        const ok = await Pron.play(item.en, "");
        if (round !== cur || el.hidden) return;
        heard = !!ok;
        $l("context-status").textContent = heard ? "選字完成這句話。" : "聲音沒有播完，請再聽一次；這次不計錯。";
        $l("life-panel").querySelectorAll("[data-context-word]").forEach(b=>b.disabled=!heard);
      };
      $l("life-panel").querySelectorAll("[data-context-word]").forEach(b=>b.onclick=()=>{
        if (!heard || settled || round!==cur) return;
        if (b.dataset.contextWord !== t.word) {
          wrongs++; if (!ev) logLife(false);
          if (!missed) note(t,"wrong");
          missed=true; b.disabled=true;
          $l("context-status").textContent="再試一次：看看中文句意，想想這裡需要哪個字。";
          return;
        }
        settled=true; logLife(true); note(t,missed?"retry":"ind"); reveal();
      });
    };
    next();
  }

  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  return {
    open,
    close,
    get scene() {
      return scene && scene.id;
    },
    get mode() {
      return mode;
    },
    get state() {
      return ST;
    },
    get round() {
      return round;
    },
    get view() {
      return { ...view };
    },
    /* tests: a screen point (CSS px inside the stage) that taps this target: the tappable spot nearest its centre
       (a bed under a blanket is tapped on its visible frame, as the art notes say). */
    pointOf(id) {
      const t = scene.targets.find((x) => x.id === id),
        xs = t.polygon.map((p) => p[0]),
        ys = t.polygon.map((p) => p[1]),
        cx = xs.reduce((a, b) => a + b) / xs.length,
        cy = ys.reduce((a, b) => a + b) / ys.length,
        S = (x, y) => ({ x: view.tx + x * view.w * view.z, y: view.ty + y * view.h * view.z });
      let best = null;
      for (let i = 0; i <= 24; i++)
        for (let j = 0; j <= 24; j++) {
          const x = Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 24,
            y = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 24,
            p = S(x, y),
            h = hit(p.x, p.y);
          if (!h.t || h.t !== t) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (!best || d < best.d) best = { d, p };
        }
      return best ? best.p : S(cx, cy);
    },
    hit: (x, y) => (scene ? hit(x, y) : {}),
    get data() {
      return DATA;
    },
  };
})();
