/* 生活情境找物 (PR #10, data/life-scenes.json): six realistic everyday scenes, six target words each.
   Four ways to use one picture:
     explore  – tap an object: outline, word, meaning, KK (only when the word bank has it) and its sound
     listen   – hear a word first (answering opens only after it played), then tap the object; nothing is named before
     spell    – find the object from its Chinese name, then spell it with letter tiles (long words: find and hear only)
     mission  – a small everyday task: find the 2–3 things it needs
   Touch: drag pans, pinch / ＋ － zooms, a tap is a tap only when the finger did not move; small objects get a
   44 px tolerance and an ambiguous tap zooms in instead of guessing. One sound at a time (Pron.play).
   Records (pm-life-v1): first-try right, right after a retry, and wrong are kept apart; words that are in the
   word bank also update the shared card book. Words without a KK entry say so; their sound is the device
   voice reading the whole word (labelled), never a made-up KK. */
const Life = (() => {
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const store = () => {
    const d = (typeof LS !== "undefined" && LS.get("pm-life-v1", null)) || {};
    return { v: 1, found: {}, res: {}, missions: {}, ...d };
  };
  let DATA = null,
    ST = store(),
    el = null,
    scene = null,
    mode = "explore",
    view = { z: 1, tx: 0, ty: 0, w: 0, h: 0, W: 0, H: 0 },
    round = null,
    onClose = null;
  const save = () => typeof LS !== "undefined" && LS.set("pm-life-v1", ST);
  const bankWord = (w) => (typeof WORDS !== "undefined" ? WORDS.find((x) => x.w === w) : null);
  async function load() {
    if (DATA) return DATA;
    const r = await fetch("data/life-scenes.json");
    DATA = await r.json();
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
    el.setAttribute("aria-label", "生活情境找物");
    el.innerHTML = `<div class="life-top"><button type="button" id="life-back">← 返回</button><b id="life-title">生活情境</b><span id="life-count"></span></div>
      <div class="life-tabs" id="life-tabs" hidden>${[["explore", "👆 探索"], ["listen", "🎧 聽音找物"], ["spell", "🔤 找物拼字"], ["mission", "🧺 生活任務"]].map(([k, l]) => `<button type="button" data-mode="${k}">${l}</button>`).join("")}</div>
      <div class="life-stage" id="life-stage" hidden><div class="life-layer" id="life-layer"><img id="life-img" alt="" draggable="false"><svg id="life-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg></div>
        <div class="life-zoom"><button type="button" id="life-in" aria-label="放大">＋</button><button type="button" id="life-out" aria-label="縮小">－</button><button type="button" id="life-fit" aria-label="看整張">⤢</button></div><div class="life-toast" id="life-toast" hidden></div></div>
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
    await load();
    if (opt.scene) return openScene(opt.scene, opt.mode);
    pickScene();
  }
  function close() {
    if (typeof Pron !== "undefined") Pron.closeWord();
    if (scene && typeof Learn !== "undefined") Learn.flush("quest", "生活情境・" + scene.title);
    el.hidden = true;
    scene = null;
    document.body.classList.remove("life-open");
    if (onClose) onClose();
  }
  function pickScene() {
    if (scene && typeof Learn !== "undefined") Learn.flush("quest", "生活情境・" + scene.title);
    scene = null;
    round = null;
    $l("life-title").textContent = "生活情境找物";
    $l("life-count").textContent = "";
    $l("life-tabs").hidden = true;
    $l("life-stage").hidden = true;
    $l("life-panel").innerHTML = `<p class="life-lead">每張圖固定 6 個單字。先點物件聽發音，再挑一種玩法：聽音找物、找物拼字或生活任務。</p><div class="life-scenes">${DATA.scenes
      .map((s) => `<button type="button" data-scene="${s.id}"><img src="${ESC(s.image)}" alt="" loading="lazy"><b>${ESC(s.title)}</b><small>找到 ${(ST.found[s.id] || []).length} / ${s.targets.length}</small></button>`)
      .join("")}</div>`;
    $l("life-panel").querySelectorAll("[data-scene]").forEach((b) => (b.onclick = () => openScene(b.dataset.scene)));
  }
  function openScene(id, m) {
    scene = DATA.scenes.find((s) => s.id === id);
    if (!scene) return pickScene();
    $l("life-title").textContent = scene.title;
    $l("life-tabs").hidden = false;
    $l("life-stage").hidden = false;
    const img = $l("life-img");
    img.onload = () => fit();
    img.src = scene.image;
    if (img.complete && img.naturalWidth) requestAnimationFrame(() => fit());
    paintOutlines();
    setMode(m || "explore");
  }
  const found = () => (ST.found[scene.id] = ST.found[scene.id] || []);
  function count() {
    $l("life-count").textContent = `找到 ${found().length} / ${scene.targets.length}`;
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
    mode = m;
    el.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    if (typeof Pron !== "undefined") Pron.closeWord();
    count();
    ({ explore, listen, spell, mission })[m]();
  }
  function explore() {
    if (view.w) fit();
    round = {
      marks: Object.fromEntries(found().map((id) => [id, "found"])),
      onTap(t) {
        if (!t) return toast("這裡不是練習物件，換個地方點點看");
        const first = !found().includes(t.id);
        if (first) {
          found().push(t.id);
          note(t, "seen");
          if (typeof addXP === "function") addXP(2);
        }
        round.marks[t.id] = "found";
        paintOutlines();
        count();
        say(t);
        panel(`${card(t, first ? '<small class="life-new">✨ 第一次找到</small>' : "")}<p class="life-hint">繼續點其他物件。找到 ${found().length} / ${scene.targets.length}${found().length === scene.targets.length ? "，六個都找到了！可以試試上面的其他玩法。" : ""}</p>`);
      },
    };
    paintOutlines();
    panel(`<p class="life-hint">👆 點圖裡的物件，聽它的英文。拖曳可以移動，＋／－可以放大。已經找到 ${found().length} / ${scene.targets.length}。</p>`);
  }
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const roundOf = (n, filter) => shuffle(scene.targets.filter(filter || (() => true))).slice(0, n);
  function summary(title, rows, again) {
    round = { marks: round ? round.marks : {}, locked: true, onTap() {} };
    panel(`<div class="life-sum"><b>${title}</b><ul>${rows.join("")}</ul><span class="dlg-row"><button type="button" id="life-again">▶ 再來一輪</button></span></div>`);
    $l("life-again").onclick = again;
  }
  const rowOf = (t, r) => `<li>${r === "ind" ? "✓" : r === "retry" ? "↻" : "✕"} ${ESC(t.word)} ${ESC(t.zh)}<small>${r === "ind" ? "一次就對" : r === "retry" ? "再試後找到" : "這次沒有完成"}</small></li>`;

  /* listen: hear first; answering opens only after the word has played; nothing named before the answer */
  function listen() {
    const list = roundOf(3),
      res = [];
    let i = -1;
    const next = () => {
      i++;
      if (i >= list.length) return summary("🎧 聽音找物：這一輪完成", list.map((t, k) => rowOf(t, res[k])), listen);
      const t = list[i];
      let tries = 0;
      fit();
      round = {
        target: t.id, // test hook only: never rendered
        marks: {},
        locked: true,
        onTap(x) {
          if (!x) return toast("這裡沒有練習物件，再找找看");
          if (x !== t) {
            if (!tries) note(t, "wrong");
            tries++;
            round.marks = { [x.id]: "bad" };
            paintOutlines();
            setTimeout(() => {
              if (round && round.marks[x.id] === "bad") (delete round.marks[x.id], paintOutlines());
            }, 700);
            if (typeof SND !== "undefined") SND.play("wrong");
            $l("life-fb").innerHTML = `<b class="bad">✕ 不是這個</b><small>再聽一次，再找找看。</small>`;
            return;
          }
          res[i] = tries ? "retry" : "ind";
          if (!tries) note(t, "ind");
          else note(t, "retry");
          if (!found().includes(t.id)) found().push(t.id), save();
          round.locked = true;
          round.marks = { [t.id]: "good" };
          paintOutlines();
          count();
          if (typeof SND !== "undefined") SND.play("correct");
          say(t);
          panel(`<p class="life-hint">第 ${i + 1} / ${list.length} 題 · <b class="good">✓ 找到了${tries ? "（再試後）" : ""}</b></p>${card(t)}<span class="dlg-row"><button type="button" id="life-next">▶ 下一題</button></span>`);
          $l("life-next").onclick = next;
        },
      };
      paintOutlines();
      panel(`<p class="life-hint">第 ${i + 1} / ${list.length} 題 · 🎧 聽單字，點出這個物件</p><span class="dlg-row"><button type="button" id="life-replay">🔊 再聽一次</button></span><p class="life-wait" id="life-wait">播放中…聽完才可以點圖。</p><div class="qz-f" id="life-fb"></div>`);
      const play = () => {
        round.locked = true;
        $l("life-wait").hidden = false;
        $l("life-wait").textContent = "播放中…聽完才可以點圖。";
        say(t).then((ok) => {
          if (!round || round !== cur) return;
          if (!ok) {
            $l("life-wait").textContent = "聲音沒有播出來。按「🔊 再聽一次」重試；聽到之前不能作答。";
            return;
          }
          $l("life-wait").hidden = true;
          round.locked = false;
        });
      };
      const cur = round;
      $l("life-replay").onclick = play;
      play();
    };
    next();
  }

  /* spell: find from the Chinese name, then spell with tiles (only short words; long ones are find + hear) */
  const SPELL_MAX = 6;
  function spell() {
    const list = roundOf(3),
      res = [];
    let i = -1;
    const next = () => {
      i++;
      if (i >= list.length) return summary("🔤 找物拼字：這一輪完成", list.map((t, k) => rowOf(t, res[k])), spell);
      const t = list[i],
        long = t.word.length > SPELL_MAX;
      let tries = 0;
      fit(); // each question starts from the whole picture
      round = {
        marks: {},
        locked: false,
        onTap(x) {
          if (!x) return toast("這裡沒有練習物件，再找找看");
          if (x !== t) {
            tries++;
            if (typeof SND !== "undefined") SND.play("wrong");
            $l("life-fb").innerHTML = `<b class="bad">✕ 不是這個</b><small>找的是「${ESC(t.zh)}」。</small>`;
            return;
          }
          round.locked = true;
          round.marks = { [t.id]: "good" };
          paintOutlines();
          focus(t);
          if (!found().includes(t.id)) found().push(t.id), save();
          count();
          if (long) {
            res[i] = tries ? "retry" : "ind";
            note(t, tries ? "retry" : "ind");
            say(t);
            panel(`<p class="life-hint">第 ${i + 1} / ${list.length} 題 · <b class="good">✓ 找到了</b></p><p class="life-hint">這個字比較長，這一輪先練辨識和發音，不考拼字。</p>${card(t)}<span class="dlg-row"><button type="button" id="life-next">▶ 下一題</button></span>`);
            $l("life-next").onclick = next;
            return;
          }
          tiles(t, (ok) => {
            res[i] = ok ? (tries ? "retry" : "ind") : "wrong";
            note(t, res[i]);
          });
        },
      };
      paintOutlines();
      panel(`<p class="life-hint">第 ${i + 1} / ${list.length} 題 · 找到「<b>${ESC(t.zh)}</b>」${long ? "（這個字比較長：找到後聽發音）" : "，再拼出它的英文"}</p><div class="qz-f" id="life-fb"></div>`);
    };
    function tiles(t, done) {
      const letters = t.word.split(""),
        extra = shuffle("abcdefghijklmnopqrstuvwxyz".split("").filter((c) => !letters.includes(c))).slice(0, 2),
        pool = shuffle([...letters, ...extra]).map((c, k) => ({ c, k })),
        slots = letters.map(() => null);
      const paint = () => {
        panel(`<p class="life-hint">拼出「${ESC(t.zh)}」的英文：點字母放進格子，點格子拿回來。送出後才會顯示答案。</p>
          <div class="life-slots">${slots.map((x, k) => `<button type="button" class="life-slot" data-slot="${k}" aria-label="第 ${k + 1} 格">${x ? ESC(x.c) : "＿"}</button>`).join("")}</div>
          <div class="life-tiles">${pool.map((x) => `<button type="button" class="life-tile" data-tile="${x.k}" ${slots.includes(x) ? "disabled" : ""}>${ESC(x.c)}</button>`).join("")}</div>
          <span class="dlg-row"><button type="button" id="life-submit" ${slots.every(Boolean) ? "" : "disabled"}>送出</button></span>`);
        $l("life-panel").querySelectorAll("[data-tile]").forEach((b) => (b.onclick = () => {
          const k = slots.indexOf(null);
          if (k < 0) return;
          slots[k] = pool.find((x) => x.k === +b.dataset.tile);
          paint();
        }));
        $l("life-panel").querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => {
          slots[+b.dataset.slot] = null;
          paint();
        }));
        $l("life-submit").onclick = () => {
          const got = slots.map((x) => x.c).join(""),
            ok = got === t.word;
          done(ok);
          if (typeof SND !== "undefined") SND.play(ok ? "correct" : "wrong");
          say(t);
          panel(`<p class="life-hint">${ok ? '<b class="good">✓ 拼對了</b>' : `<b class="bad">✕ 還沒拼對</b>：你拼的是 <span class="life-mine">${letters.map((c, k) => `<span class="${slots[k].c === c ? "ok" : "no"}">${ESC(slots[k].c)}</span>`).join("")}</span>`}</p>${card(t)}<span class="dlg-row"><button type="button" id="life-next">▶ 下一題</button></span>`);
          $l("life-next").onclick = next;
        };
      };
      paint();
    }
    next();
  }

  /* mission: find what the task needs, in any order */
  function mission(idx) {
    const ms = scene.missions || [];
    if (idx == null) {
      fit();
      round = { marks: {}, locked: true, onTap() {} };
      paintOutlines();
      const done = ST.missions[scene.id] || [];
      panel(`<p class="life-hint">🧺 選一個生活任務：</p><div class="life-missions">${ms.map((m, k) => `<button type="button" data-mission="${k}"><b>${done.includes(k) ? "✅ " : ""}${ESC(m.title)}</b><small>${ESC(m.prompt)}</small></button>`).join("")}</div>`);
      $l("life-panel").querySelectorAll("[data-mission]").forEach((b) => (b.onclick = () => mission(+b.dataset.mission)));
      return;
    }
    const m = ms[idx],
      need = m.targets.map((id) => scene.targets.find((t) => t.id === id)),
      got = [];
    fit();
    const paint = (fb) => panel(`<p class="life-hint"><b>${ESC(m.title)}</b>：${ESC(m.prompt)}</p><ul class="life-check">${need.map((t) => `<li class="${got.includes(t) ? "done" : ""}">${got.includes(t) ? "✅" : "⬜"} ${ESC(t.zh)}${got.includes(t) ? ` <b>${ESC(t.word)}</b>` : ""}</li>`).join("")}</ul><div class="qz-f" id="life-fb">${fb || ""}</div>`);
    round = {
      marks: {},
      locked: false,
      onTap(x) {
        if (!x) return toast("這裡沒有練習物件");
        if (!need.includes(x)) return paint(`<b class="bad">✕ 這個任務用不到它</b><small>再看看任務需要什麼。</small>`);
        if (got.includes(x)) return say(x);
        got.push(x);
        round.marks[x.id] = "good";
        paintOutlines();
        if (!found().includes(x.id)) found().push(x.id), save();
        count();
        say(x);
        if (got.length < need.length) return paint(`<b class="good">✓ ${ESC(x.word)}</b> <span>${ESC(x.zh)}</span>`);
        ST.missions[scene.id] = [...new Set([...(ST.missions[scene.id] || []), idx])];
        save();
        if (typeof addXP === "function") addXP(5);
        round.locked = true;
        panel(`<div class="life-sum"><b>🎉 任務完成：${ESC(m.title)}</b><ul>${need.map((t) => `<li>✓ ${ESC(t.word)} ${ESC(t.zh)} <button type="button" class="life-say" data-say-word="${ESC(t.id)}">🔊</button></li>`).join("")}</ul><span class="dlg-row"><button type="button" id="life-again">▶ 選其他任務</button></span></div>`);
        $l("life-again").onclick = () => mission();
      },
    };
    paintOutlines();
    paint();
  }

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
