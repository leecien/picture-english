/* Hero stats, items, recovery, and the turn-based English battle.
   Saved under pm-rpg-v1.hero (rpg.js owns the key). Stats grow with the learning tier.
   Fighting itself never writes learning records: only English answered in battle does, through Learn.grade. */
const Battle = (() => {
  const ITEMS = {
    berry: { name: "小紅莓", icon: "🍓", hp: 35, desc: "回復 35 HP" },
    dew: { name: "藍露珠", icon: "💧", mp: 20, desc: "回復 20 MP" },
    frosting: { name: "糖霜", icon: "🧁", mat: true, desc: "美食市場的掉落物" },
    shell: { name: "橡實殼", icon: "🌰", mat: true, desc: "動物森林的掉落物" },
    crystal: { name: "雨滴晶", icon: "💎", mat: true, desc: "自然湖畔的掉落物" },
    feather: { name: "紙羽毛", icon: "🪶", mat: true, desc: "風之群島、旅行車站的掉落物" },
    tealeaf: { name: "茶葉", icon: "🍃", mat: true, desc: "生活小鎮的掉落物" },
    bubble: { name: "音節泡泡", icon: "🫧", mat: true, desc: "KK 新手村的掉落物" },
  };
  const MAT = { food: "frosting", animal: "shell", nature: "crystal", transport: "feather", things: "tealeaf", wind: "feather", kk: "bubble" };
  const TRADE = 3;
  // Legacy-map monster strength, in unlock order.
  const MOBS = [
    { lv: 1, hp: 30, atk: 4, aggressive: false },
    { lv: 3, hp: 44, atk: 6, aggressive: false },
    { lv: 6, hp: 60, atk: 9, aggressive: true },
    { lv: 9, hp: 78, atk: 12, aggressive: true },
    { lv: 12, hp: 96, atk: 15, aggressive: true },
  ];
  let st = null,
    saveFn = null,
    acc = 0,
    statusFn = () => {};
  const rnd = () => Math.random();

  function stats() {
    const t = tierIdx(P.xp);
    return { lv: t + 1, maxHp: 80 + t * 12, maxMp: 30 + t * 6, atk: 7 + t * 2 };
  }
  function init(store, save, status) {
    st = store;
    saveFn = save;
    statusFn = status || statusFn;
    st.items = st.items && typeof st.items === "object" && !Array.isArray(st.items) ? st.items : { berry: 3, dew: 2 };
    for (const k of Object.keys(st.items)) if (!ITEMS[k] || !(st.items[k] >= 0)) delete st.items[k];
    st.kills = st.kills | 0;
    st.downs = st.downs | 0;
  }
  /* Levels load asynchronously, so HP/MP are defaulted and clamped once the field is shown. */
  function sync() {
    const s = stats();
    if (!Number.isFinite(st.hp)) st.hp = s.maxHp;
    if (!Number.isFinite(st.mp)) st.mp = s.maxMp;
    clamp();
    paint();
  }
  function clamp() {
    const s = stats();
    st.hp = Math.max(0, Math.min(s.maxHp, Math.round(st.hp)));
    st.mp = Math.max(0, Math.min(s.maxMp, Math.round(st.mp)));
    if (st.hp === 0) st.hp = Math.ceil(s.maxHp / 2);
  }
  /* Save at once: a phone can close the page right after a fight, and the save is a small JSON write. */
  function persist() {
    paint();
    if (saveFn) saveFn();
  }
  const count = (k) => st.items[k] || 0;
  function give(k, n = 1) {
    st.items[k] = count(k) + n;
    persist();
  }
  const mobFor = (i) => MOBS[Math.min(i, MOBS.length - 1)];
  function revive() {
    const s = stats();
    st.hp = Math.ceil(s.maxHp / 2);
    st.mp = Math.max(st.mp, Math.ceil(s.maxMp / 2));
    persist();
    toast("🌱", "在入口醒來了", "HP、MP 恢復一半，坐下休息可以更快回滿");
  }
  /* Recovery on the field: sitting heals fast; walking around heals slowly. */
  function tick(dt) {
    const s = stats(),
      h = World.hero;
    if (!h || h.down || World.paused) return;
    acc += dt;
    const every = h.sit ? 2 : 6;
    if (acc < every) return;
    acc = 0;
    const hp0 = st.hp,
      mp0 = st.mp;
    st.hp = Math.min(s.maxHp, st.hp + (h.sit ? Math.max(4, Math.round(s.maxHp * 0.08)) : Math.max(1, Math.round(s.maxHp * 0.02))));
    st.mp = Math.min(s.maxMp, st.mp + (h.sit ? Math.max(2, Math.round(s.maxMp * 0.07)) : 1));
    if (st.hp !== hp0 || st.mp !== mp0) {
      if (h.sit && st.hp > hp0) World.heroFloat("+" + (st.hp - hp0), "#8dffa0");
      persist();
    }
  }
  function useItem(k, onField = true) {
    const it = ITEMS[k],
      s = stats();
    if (!it || it.mat) return false;
    if (!count(k)) {
      statusFn(`沒有 ${it.name} 了。打倒怪物或找居民用素材交換。`);
      return false;
    }
    if ((it.hp && st.hp >= s.maxHp) || (it.mp && st.mp >= s.maxMp)) {
      statusFn(it.hp ? "HP 已經是滿的。" : "MP 已經是滿的。");
      return false;
    }
    st.items[k]--;
    if (it.hp) st.hp = Math.min(s.maxHp, st.hp + it.hp);
    if (it.mp) st.mp = Math.min(s.maxMp, st.mp + it.mp);
    if (onField) World.heroFloat(it.hp ? "+" + it.hp : "+" + it.mp + " MP", it.hp ? "#8dffa0" : "#9fd0ff");
    SND.play("tap");
    persist();
    return true;
  }
  function toggleSit() {
    const on = !World.hero.sit;
    if (!World.sit(on)) return;
    acc = 0;
    statusFn(on ? "坐下休息中：HP、MP 回復較快。移動就會站起來。" : "站起來了。");
    paint();
  }
  const mats = () => Object.keys(ITEMS).filter((k) => ITEMS[k].mat);
  const matTotal = () => mats().reduce((n, k) => n + count(k), 0);
  function trade(k) {
    if (matTotal() < TRADE) return false;
    for (let left = TRADE; left > 0; left--) {
      const top = mats().sort((a, b) => count(b) - count(a))[0];
      st.items[top]--;
    }
    give(k);
    toast(ITEMS[k].icon, "補給交換成功", `${ITEMS[k].name} ×1`);
    return true;
  }
  function rollDrops(look, region) {
    const out = [];
    if (look.drop) out.push(look.drop);
    if (rnd() < 0.7) out.push(MAT[region] || "feather");
    if (rnd() < 0.3) out.push("berry");
    if (rnd() < 0.2) out.push("dew");
    return out;
  }

  /* ---------- status bar (always on top of the scene) ---------- */
  function paint() {
    if (!st || !$("hud-hp")) return;
    const s = stats();
    $("hud-lv").textContent = "Lv." + s.lv;
    [
      ["hud-hp", st.hp, s.maxHp, "HP"],
      ["hud-mp", st.mp, s.maxMp, "MP"],
    ].forEach(([id, v, m, n]) => {
      const b = $(id);
      b.querySelector("i").style.width = (v / m) * 100 + "%";
      b.querySelector("b").textContent = `${n} ${v}/${m}`;
      b.setAttribute("aria-valuenow", v);
      b.setAttribute("aria-valuemax", m);
      b.classList.toggle("low", v / m < 0.3);
    });
    $("hud-berry").querySelector("small").textContent = count("berry");
    $("hud-dew").querySelector("small").textContent = count("dew");
    $("hud-sit").setAttribute("aria-pressed", String(!!(World.hero && World.hero.sit)));
  }
  function bagHTML() {
    const s = stats(),
      rows = Object.entries(ITEMS)
        .filter(([k]) => count(k) || !ITEMS[k].mat)
        .map(
          ([k, it]) =>
            `<li><span class="bag-i">${it.icon}</span><span><b>${it.name} ×${count(k)}</b><small>${it.desc}</small></span>${it.mat ? "" : `<button data-use="${k}" ${count(k) ? "" : "disabled"}>使用</button>`}</li>`,
        )
        .join("");
    return `<h3>🎒 背包</h3><p class="bag-stat">Lv.${s.lv} · 攻擊 ${s.atk} · HP ${st.hp}/${s.maxHp} · MP ${st.mp}/${s.maxMp} · 打倒 ${st.kills} 隻</p><p class="fine">角色等級跟著學習程度成長：多答對英文，打怪就更輕鬆。</p><ul class="bag-list">${rows}</ul><p class="fine">素材 ${matTotal()} 個：任何 ${TRADE} 個素材可以向居民換 1 個小紅莓或藍露珠。</p>`;
  }
  function tradeHTML() {
    const n = matTotal();
    return `<p class="trade-note">🧺 補給交換：素材 ${n} 個（${TRADE} 個換 1 個）</p><div class="dlg-row"><button data-trade="berry" ${n >= TRADE ? "" : "disabled"}>🍓 換小紅莓</button><button data-trade="dew" ${n >= TRADE ? "" : "disabled"}>💧 換藍露珠</button></div>`;
  }

  /* ---------- timed English battle (#6) ----------
     Each turn is one question with at most three options and a countdown:
       right -> the hero attacks;  wrong or time out -> the foe attacks.  Settled exactly once per question.
     Listening questions start the clock only after the audio has finished and the options are usable.
     Hidden page, window blur (permission dialogs) and the pause button stop the clock; "準備好了" resumes.
     MP pays for optional help (heal / shield / +5 s) and never blocks answering; right answers restore a little MP.
     ctx: { region, make(B) -> question, tutorial, phases:[{until, label}], chase:{start,max}, companion, onEnd(result, drops) } */
  let B = null;
  const PREF = () => (st.pref = { practice: false, relaxed: false, ...(st.pref || {}) });
  const bar = (id, v, m) => {
    const el = $(id);
    el.style.width = Math.max(0, Math.min(100, (v / m) * 100)) + "%";
    el.parentElement.querySelector("span").textContent = `${Math.max(0, Math.round(v))}/${m}`;
  };
  function pop(side, text, cls) {
    const el = document.createElement("span");
    el.className = "bt-pop " + (cls || "");
    el.textContent = text;
    $(side === "foe" ? "bt-foe" : "bt-me").appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function shake(side) {
    const el = $(side === "foe" ? "bt-foe-cv" : "bt-me-cv");
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");
  }
  const log = (t) => ($("bt-log").textContent = t);
  const live = (tok) => B && B.tok === tok;
  function paintBattle() {
    if (!B) return;
    const s = stats();
    if (B.chase) {
      bar("bt-foe-hp", B.chase.max - B.dist, B.chase.max);
      $("bt-foe-hp").parentElement.querySelector("span").textContent = `距離 ${B.dist}`;
    } else bar("bt-foe-hp", B.hp, B.maxHp);
    bar("bt-me-hp", st.hp, s.maxHp);
    bar("bt-me-mp", st.mp, s.maxMp);
    const tags = [];
    if (B.foeShield) tags.push(`${(B.look.shield || {}).icon || "🛡️"} ${(B.look.shield || {}).name || "護盾"}：下一次答對只會破盾`);
    if (B.intent === "charge") tags.push("💨 準備衝刺：答錯會受到加倍傷害，答對就擋下");
    if (B.phase) tags.push(B.phase);
    $("bt-foe-shield").textContent = tags.join("　");
    $("bt-foe-shield").hidden = !tags.length;
    const me = [];
    if (B.combo) me.push(`🔥 連答 ${B.combo}`);
    if (B.power) me.push("⚡ 下一擊強化");
    if (B.guard) me.push("🛡️ 護盾");
    if (B.comp) me.push(`🧚 能量 ${B.comp.energy}/3`);
    $("bt-me-tags").textContent = me.join("　");
    paint();
  }
  function start(mob, ctx) {
    const s = stats();
    const tok = Math.random();
    B = {
      tok, mob, look: mob.look, hp: mob.look.hp || 30, maxHp: mob.look.hp || 30, ctx, turn: 0, combo: 0, power: false, guard: 0,
      foeShield: !!mob.look.shield, intent: "", phase: "", q: null, settled: true, paused: false, timer: null,
      chase: ctx.chase || null, dist: ctx.chase ? ctx.chase.start : 0,
      comp: ctx.companion ? { ...ctx.companion, energy: 0, hintLeft: 1, healed: false } : null,
    };
    PREF();
    World.paused = true;
    World.clearKeys();
    const el = $("battle");
    el.hidden = false;
    el.dataset.region = ctx.region || "";
    $("bt-foe-name").textContent = mob.look.name;
    $("bt-foe-lv").textContent = "Lv." + (mob.look.lv || 1);
    $("bt-me-lv").textContent = "Lv." + s.lv;
    $("bt-pause").hidden = true;
    requestAnimationFrame(() => {
      World.portrait($("bt-foe-cv"), "mob", mob.look, { dir: "down", zoom: 1.1 });
      World.portrait($("bt-me-cv"), "hero", World.heroLook, { dir: "up" });
      $("bt-buddy").hidden = !B || !B.comp;
      if (B && B.comp) World.portrait($("bt-buddy"), "pet", B.comp.look, { zoom: 1 });
    });
    paintBattle();
    log(ctx.intro || `Lv.${mob.look.lv || 1} ${mob.look.name} 擋住了去路！答對就攻擊，答錯或時間到會被攻擊。`);
    setTimeout(() => live(tok) && ask(), ctx.intro || ctx.tutorial ? 900 : 500);
  }
  /* Seconds for a question: 10 by default, 14 for sentences, more for long options and the tutorial. */
  function timeFor(q) {
    let t = q.recK === "s" ? 14 : 10;
    if (q.options.some((o) => String(o.html).replace(/<[^>]+>/g, "").length > 28)) t += 4;
    if (B.ctx.tutorial && B.turn <= 3) t *= 1.5;
    if (st.pref.relaxed) t *= 1.5;
    return Math.round(t);
  }
  /* Three clear options at most: the right one plus up to two wrong ones. */
  function trim(q) {
    const right = q.options.filter((o) => o.ok),
      wrong = q.options.filter((o) => !o.ok).slice(0, 2);
    q.options = shuffle([...right, ...wrong]);
    if (q.cols) q.cols = Math.min(q.cols, 3);
    return q;
  }
  function nextIntent() {
    const seq = B.look.intents;
    if (!seq || B.chase) return "";
    const it = seq[B.turn % seq.length];
    if (it === "guard") B.foeShield = true;
    return it === "charge" ? "charge" : "";
  }
  function ask() {
    if (!B) return;
    if (B.chase ? B.dist <= 0 : B.hp <= 0) return victory();
    if (st.hp <= 0) return defeat();
    B.turn++;
    if (B.ctx.phases) {
      const f = B.hp / B.maxHp,
        ph = B.ctx.phases.find((p) => f > p.until) || B.ctx.phases[B.ctx.phases.length - 1];
      B.phase = ph.label;
      B.phaseIdx = B.ctx.phases.indexOf(ph);
    }
    B.intent = nextIntent();
    const q = trim(B.ctx.make(B));
    B.q = q;
    B.settled = false;
    B.used = {};
    Learn.track(q);
    paintBattle();
    render(q);
  }
  function render(q) {
    const tok = B.tok,
      practice = st.pref.practice,
      m = stats();
    const help = [
      ["heal", "💚 補血", 8, st.hp >= m.maxHp],
      ["shield", "🛡️ 護盾", 6, B.guard > 0],
      ["time", "⏳ +5 秒", 4, practice],
    ];
    $("bt-act").innerHTML = `<div class="bt-q">
      <div class="bt-top"><span class="bt-turn">第 ${B.turn} 題${B.chase ? " · 追海鷗" : ""}</span><button type="button" id="bt-mode" class="bt-mini">${practice ? "🌱 練習（不限時）" : "⏱ 限時"}</button><button type="button" id="bt-hold" class="bt-mini" aria-label="暫停">⏸</button><button type="button" id="bt-run" class="bt-mini">🏃 逃跑</button></div>
      <div class="bt-clock" ${practice ? "hidden" : ""}><i id="bt-clock-bar"></i><span id="bt-clock-n"></span></div>
      <div class="qz-p">${q.prompt}</div>
      ${q.audio ? `<button class="qz-say" type="button" id="bt-say">🔊 ${esc(q.audio.label || "再聽一次")}</button>` : ""}
      <div class="qz-o${q.options.some((o) => o.wide) ? " wide" : ""}${q.cols ? " c" + q.cols : ""}">${Learn.optionsHTML(q, true)}</div>
      <div class="qz-f" role="status" id="bt-feedback"></div>
      <div class="bt-help">${help.map(([k, label, mp, off]) => `<button type="button" data-help="${k}" ${st.mp < mp || off ? "disabled" : ""}>${label}<small>MP ${mp}</small></button>`).join("")}<button type="button" data-help="berry" ${count("berry") && st.hp < m.maxHp ? "" : "disabled"}>🍓<small>×${count("berry")}</small></button>${B.comp ? `<button type="button" data-help="hint" class="bt-buddy-hint" ${B.comp.hintLeft ? "" : "disabled"}>🧚 提示<small>每場 ${B.comp.hintLeft} 次</small></button>` : ""}</div>
    </div>`;
    $("bt-mode").onclick = () => {
      st.pref.practice = !st.pref.practice;
      persist();
      $("bt-mode").textContent = st.pref.practice ? "🌱 練習（不限時）" : "⏱ 限時（下一題起）";
      if (st.pref.practice) stopClock();
    };
    $("bt-hold").onclick = () => hold("已暫停");
    $("bt-run").onclick = flee;
    $("bt-act").querySelectorAll("[data-help]").forEach((b) => (b.onclick = () => helpAct(b.dataset.help)));
    $("bt-act").querySelectorAll(".qz-o button").forEach((b) => (b.onclick = () => settle(q.options[+b.dataset.i].ok ? "right" : "wrong", +b.dataset.i)));
    if (B.ctx.tutorial && B.turn === 1) log(B.ctx.tutorial);
    else if (B.intent === "charge") log(`${B.look.name} 準備衝刺！答對就能擋下。`);
    else if (B.foeShield) log(`${B.look.name} 展開了${(B.look.shield || {}).name || "護盾"}，答對可以破盾。`);
    else if (!B.chase) log(`${B.look.name} 等著你的答案……`);
    // Listening: clock starts only after the audio has really played and the options are usable.
    const go = () => {
      if (!live(tok) || B.q !== q || B.settled) return;
      $("bt-act").querySelectorAll(".qz-o button").forEach((b) => (b.disabled = false));
      startClock(timeFor(q));
    };
    const sayBtn = $("bt-say");
    let audioRun=0, started=false;
    const choices=$("bt-act").querySelector('.qz-o');
    const listenFirst=async()=>{
      const run=++audioRun;
      B.loading=true; choices.hidden=true;
      $("bt-clock-n").textContent='播放中…';
      const ok=await playAwait(q.audio);
      if(!live(tok)||B.q!==q||run!==audioRun)return;
      if(!ok){
        $("bt-feedback").innerHTML='<b class="bad">聲音沒有播出來，請點「再聽一次」重試。</b>'+(q.kind==='kk'?'':'<button id="bt-read" type="button">改看文字</button>');
        if($("bt-read"))$("bt-read").onclick=()=>{$("bt-feedback").textContent="題目文字："+q.audio.text;B.loading=false;choices.hidden=false;if(!started){started=true;go()}};
        return;
      }
      B.loading=false; choices.hidden=false; $("bt-feedback").textContent='';
      if(!started){started=true;go();}
      if(B.waitingAudio){B.waitingAudio=false;after();}
    };
    if(sayBtn)sayBtn.onclick=listenFirst;
    if(q.audio&&q.autoplay)listenFirst();else go();
  }

  /* Resolves true once the clip (or speech) has played to the end, false if it could not play. */
  function playAwait(a) { return Learn.playAudio(a); }
  function startClock(sec) {
    stopClock();
    if (st.pref.practice) {
      $("bt-clock-n") && ($("bt-clock-n").textContent = "");
      return;
    }
    const tok = B.tok;
    B.timer = { left: sec, total: sec };
    const paintClock = () => {
      if (!$("bt-clock-bar")) return;
      $("bt-clock-bar").style.width = (B.timer.left / B.timer.total) * 100 + "%";
      $("bt-clock-bar").classList.toggle("low", B.timer.left <= 3);
      $("bt-clock-n").textContent = `${Math.ceil(B.timer.left)} 秒`;
    };
    paintClock();
    B.timer.iv = setInterval(() => {
      if (!live(tok) || !B.timer) return;
      if (B.paused || B.anim || B.hearing || B.loading || document.hidden) return;
      B.timer.left = Math.max(0, B.timer.left - 0.1);
      paintClock();
      if (B.timer.left <= 0) settle("timeout");
    }, 100);
  }
  function stopClock() {
    if (B && B.timer) {
      clearInterval(B.timer.iv);
      B.timer = null;
    }
  }
  /* Pause (button, hidden page, blur): freeze the clock and the fight until the player taps "準備好了". */
  function hold(why) {
    if (!B || B.paused) return;
    B.paused = true;
    $("bt-pause").hidden = false;
    $("bt-pause-why").textContent = why || "已暫停";
    $("bt-ready").onclick = () => {
      if (!B) return;
      B.paused = false;
      $("bt-pause").hidden = true;
      if(B.pendingAfter){B.pendingAfter=false;after();}
    };
  }
  document.addEventListener("visibilitychange", () => document.hidden && hold("畫面切換了，已暫停"));
  /* Tapping 🔊 or a word card (pron.js) stops the clock while it plays or stays open; no answer, no damage. */
  window.addEventListener("pron:busy", (e) => {
    if (B) { B.hearing = !!e.detail; if(!B.hearing && B.waitingAudio){B.waitingAudio=false;after();} }
  });
  window.addEventListener("blur", () => hold("已暫停"));
  /* Short animations (companion help) stop the clock while they play. */
  function anim(ms, fn) {
    B.anim = true;
    const tok = B.tok;
    setTimeout(() => {
      if (!live(tok)) return;
      B.anim = false;
      fn && fn();
    }, ms);
  }
  function helpAct(k) {
    if (!B || B.settled) return;
    const s = stats();
    if (k === "heal" && st.mp >= 8 && st.hp < s.maxHp) {
      st.mp -= 8;
      const h = Math.round(s.maxHp * 0.35);
      st.hp = Math.min(s.maxHp, st.hp + h);
      pop("me", "+" + h, "heal");
    } else if (k === "shield" && st.mp >= 6 && !B.guard) {
      st.mp -= 6;
      B.guard = 1;
      pop("me", "🛡️", "heal");
    } else if (k === "time" && st.mp >= 4 && B.timer) {
      st.mp -= 4;
      B.timer.left += 5;
      B.timer.total = Math.max(B.timer.total, B.timer.left);
    } else if (k === "berry" && count("berry") && st.hp < s.maxHp) {
      useItem("berry", false);
      pop("me", "+" + ITEMS.berry.hp, "heal");
    } else if (k === "hint" && B.comp && B.comp.hintLeft) return companionHint();
    else return;
    persist();
    paintBattle();
    refreshHelp();
  }
  function refreshHelp() {
    const s = stats(),
      need = { heal: 8, shield: 6, time: 4 };
    $("bt-act").querySelectorAll("[data-help]").forEach((b) => {
      const k = b.dataset.help;
      if (need[k]) b.disabled = st.mp < need[k] || (k === "heal" && st.hp >= s.maxHp) || (k === "shield" && B.guard > 0) || (k === "time" && !B.timer);
      if (k === "berry") {
        b.disabled = !count("berry") || st.hp >= s.maxHp;
        b.querySelector("small").textContent = "×" + count("berry");
      }
    });
  }
  /* Companion hint: removes one wrong option. If only one option is left, the question becomes assisted practice. */
  function companionHint() {
    const q = B.q,
      bs = [...$("bt-act").querySelectorAll(".qz-o button")],
      wrong = bs.filter((b) => !q.options[+b.dataset.i].ok && !b.classList.contains("gone"));
    if (!wrong.length) return;
    B.comp.hintLeft--;
    const b = wrong[Math.floor(Math.random() * wrong.length)];
    log(`🧚 ${B.comp.name}：「不是這個喔！」`);
    anim(600, () => {
      b.classList.add("gone");
      b.disabled = true;
      const left = bs.filter((x) => !x.classList.contains("gone")).length;
      if (left <= 1) {
        q.assisted = true;
        $("bt-feedback").innerHTML = "<small>只剩一個選項：這題算輔助練習，不列入掌握評估。</small>";
      }
      const h = $("bt-act").querySelector('[data-help="hint"]');
      if (h) {
        h.disabled = true;
        h.querySelector("small").textContent = "每場 0 次";
      }
    });
  }
  /* One settlement per question: double taps, an answer racing the timeout and replayed audio cannot repeat it. */
  function settle(kind, idx) {
    if (!B || B.settled || B.paused || B.loading) return;
    const q = B.q,
      tok = B.tok;
    B.settled = true;
    stopClock();
    const bs = [...$("bt-act").querySelectorAll(".qz-o button")];
    bs.forEach((b, i) => {
      b.disabled = true;
      if ((kind === "right" || q.kind !== "kk") && q.options[i].ok) b.classList.add("right");
    });
    if (kind === "wrong" && bs[idx]) bs[idx].classList.add("wrong");
    const ok = kind === "right";
    SND.play(ok ? "correct" : "wrong");
    // Records: answers through Learn; a timeout is metadata, not a language error; hinted-to-one is practice.
    if (kind === "timeout") Learn.timeout(q);
    else if (q.assisted && ok) Learn.assisted(q);
    else Learn.grade(q, ok, "battle");
    if (ok) heroHits();
    else foeHits(kind === "timeout");
    paintBattle();
    const a = q.answer || {};
    if (ok) {
      $("bt-feedback").innerHTML = `<b class="good">✓ 答對了！</b> ${Learn.answerHTML(a)} <span class="qz-zh">${esc(a.zh || "")}</span>`;
      setTimeout(() => live(tok) && after(), 900);
    } else {
      // The explanation is not timed: read it, then continue.
      $("bt-feedback").innerHTML = `<b class="bad">${kind === "timeout" ? "時間到" : "正確答案"}</b> ${Learn.answerHTML(a)}${a.kk ? ` <span class="qz-kk">${esc(a.kk)}</span>` : ""} <span class="qz-zh">${esc(a.zh || "")}</span>${q.explain ? `<small>${esc(q.explain)}</small>` : ""}${kind === "timeout" ? "<small>時間到不算英文答錯，這題會在之後的複習再出現。</small>" : ""}`;
      if(q.kind==='kk'){
        $("bt-feedback").innerHTML='<b class="bad">'+(kind==='timeout'?'時間到':'還沒選對')+'</b><p>答案暫不揭曉，可選擇查看示範。</p><button type="button" id="bt-assist">查看示範（輔助）</button>';
        $("bt-assist").onclick=()=>{
          $("bt-feedback").innerHTML=Learn.answerHTML(a)+(a.kk?' '+esc(a.kk):'');
          bs.forEach((b,i)=>{if(q.options[i].ok)b.classList.add('right')});
          Learn.assisted(q);speak(a.en,a.file||'');
        };
      }else if (a.en) speak(a.en, a.file || "");
      const go = document.createElement("button");
      go.type = "button";
      go.className = "qz-next";
      go.id = "bt-next";
      go.textContent = "下一題";
      go.onclick = () => live(tok) && after();
      $("bt-act").querySelector(".bt-q").insertBefore(go, $("bt-act").querySelector(".bt-help"));
      go.focus({ preventScroll: true });
    }
  }
  function heroHits() {
    const s = stats();
    B.combo++;
    st.mp = Math.min(s.maxMp, st.mp + 2);
    if (B.chase) {
      B.dist = Math.max(0, B.dist - 1);
      pop("foe", "拉近！", "crit");
      log(B.dist ? `追上了一點！還差 ${B.dist}。` : "抓到海鷗了！");
    } else if (B.foeShield) {
      B.foeShield = false;
      pop("foe", `${(B.look.shield || {}).icon || "🛡️"} 破盾！`, "crit");
      log(`答對了，${(B.look.shield || {}).name || "護盾"}被破除！`);
    } else {
      let dmg = s.atk * 2 * (0.9 + rnd() * 0.2) * (B.power ? 1.5 : 1);
      if (B.comp && B.comp.bond >= 3) dmg += 4;
      dmg = Math.max(1, Math.round(dmg));
      B.hp = Math.max(0, B.hp - dmg);
      shake("foe");
      pop("foe", (B.power ? "強化 " : "") + dmg, B.power ? "crit" : "");
      SND.play("hit");
      log(`${B.intent === "charge" ? "擋下衝刺，並且" : ""}命中！造成 ${dmg} 點傷害${B.comp && B.comp.bond >= 3 ? `（${B.comp.name}追擊 +4）` : ""}。`);
      B.power = false;
    }
    B.intent = "";
    if (B.combo % 3 === 0) {
      B.power = true;
      log(`連答 ${B.combo} 題！下一擊強化。`);
    }
    if (B.comp) {
      B.comp.energy++;
      if (B.comp.energy >= 3) {
        B.comp.energy = 0;
        B.guard = 1;
        pop("me", "🧚🛡️", "heal");
        log(`🧚 ${B.comp.name}放出風之護盾，擋下下一次攻擊！`);
      }
    }
  }
  function foeHits(timeout) {
    const s = stats();
    B.combo = 0;
    if (B.chase) {
      B.dist = Math.min(B.chase.max, B.dist + 1);
      pop("foe", "飛遠了", "miss");
      log(timeout ? "時間到，海鷗飛遠了一點。" : `海鷗飛遠了一點（距離 ${B.dist}）。`);
      return;
    }
    let dmg = (B.look.atk || 4) * (0.8 + rnd() * 0.4) * (B.intent === "charge" ? 1.8 : 1);
    if (B.ctx.tutorial && B.turn <= 3) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    if (B.guard) {
      B.guard = 0;
      pop("me", "擋下", "heal");
      log(`${timeout ? "時間到。" : ""}${B.look.name} 的攻擊被護盾擋下了。`);
    } else {
      st.hp = Math.max(0, st.hp - dmg);
      shake("me");
      pop("me", dmg, "hurt");
      log(`${timeout ? "時間到。" : ""}${B.look.name} ${B.intent === "charge" ? "衝刺撞來" : "發動攻擊"}，你受到 ${dmg} 點傷害。`);
    }
    B.intent = "";
    // Companion heal (bond 2+): once per battle when HP runs low.
    if (B.comp && B.comp.bond >= 2 && !B.comp.healed && st.hp > 0 && st.hp / s.maxHp < 0.35) {
      B.comp.healed = true;
      const h = Math.round(s.maxHp * 0.25);
      st.hp = Math.min(s.maxHp, st.hp + h);
      pop("me", "🧚+" + h, "heal");
      log(`🧚 ${B.comp.name}用微風幫你回復 ${h} HP。`);
    }
    persist();
  }
  function after() {
    if (!B) return;
    if(B.paused || document.hidden){B.pendingAfter=true;hold("已暫停");return;}
    if(B.hearing || B.loading){B.waitingAudio=true;return;}
    if (B.chase && B.dist >= B.chase.max) return escaped();
    if (B.chase ? B.dist <= 0 : B.hp <= 0) return victory();
    if (st.hp <= 0) return defeat();
    ask();
  }
  function flee() {
    if (!B) return;
    stopClock();
    log("成功離開了戰鬥。");
    end("flee");
  }
  function escaped() {
    stopClock();
    $("bt-act").innerHTML = `<div class="bt-end"><h3>💨 海鷗飛走了</h3><p>牠飛遠了，等一下再去追。練到的英文都已經記錄。</p><button id="bt-claim" class="qz-next">回到原地</button></div>`;
    $("bt-claim").onclick = () => end("escape");
  }
  function victory() {
    stopClock();
    st.kills++;
    const drops = B.chase ? [] : rollDrops(B.look, B.ctx.region);
    SND.play("roundend");
    log(B.chase ? "抓到海鷗了！" : `打倒了 ${B.look.name}！`);
    $("bt-act").innerHTML = `<div class="bt-end"><h3>🎉 ${B.chase ? "搶回行李了" : "勝利"}</h3><p>${drops.length ? "獲得：" + drops.map((d) => `${ITEMS[d].icon} ${ITEMS[d].name}`).join("、") : B.chase ? "行李箱回到你手上了。" : "沒有掉落物"}</p><p class="fine">學習經驗只來自答對的英文題。</p><button id="bt-claim" class="qz-next">收下並回到原地</button></div>`;
    $("bt-claim").onclick = () => {
      drops.forEach((d) => give(d));
      end("win", drops);
    };
    $("bt-claim").focus({ preventScroll: true });
  }
  function defeat() {
    stopClock();
    st.downs++;
    persist();
    log("你倒下了……");
    $("bt-act").innerHTML = `<div class="bt-end"><h3>💫 倒下了</h3><p>會在這張地圖的入口醒來，HP、MP 恢復一半。卡片和學習紀錄都不受影響。</p><button id="bt-wake" class="qz-next">在入口醒來</button></div>`;
    $("bt-wake").onclick = () => end("down");
  }
  function end(result, drops) {
    const b = B;
    stopClock();
    Learn.cancelAudio();
    B = null; // invalidates every pending timer and audio callback of this battle
    $("battle").hidden = true;
    $("bt-act").innerHTML = "";
    $("bt-pause").hidden = true;
    try {
      VOICE.onended = null;
    } catch (e) {}
    Learn.flush("battle", b.look.name);
    World.paused = false;
    persist();
    if (b.ctx.onEnd) b.ctx.onEnd(result, drops || []);
  }

  return {
    ITEMS, init, sync, stats, mobFor, revive, tick, toggleSit, trade, tradeHTML, bagHTML, paint, count, give, start, matTotal,
    use: (k) => useItem(k, true),
    get active() {
      return !!B;
    },
    /* true while a question is waiting for an answer (options usable, not paused) */
    get ready() {
      return !!B && !B.settled && !B.paused && !B.loading && !!document.querySelector(".qz-o button:not([disabled])");
    },
    get hp() {
      return st.hp;
    },
    get mp() {
      return st.mp;
    },
    get pref() {
      return PREF();
    },
    bars() {
      const s = stats();
      return { hp: st.hp, maxHp: s.maxHp, mp: st.mp, maxMp: s.maxMp };
    },
    /* Test hooks */
    setHp(v) {
      st.hp = v;
      persist();
    },
    setMp(v) {
      st.mp = v;
      persist();
    },
    get state() {
      return B && { hp: B.hp, maxHp: B.maxHp, name: B.look.name, shield: B.foeShield, combo: B.combo, power: B.power, guard: B.guard, intent: B.intent, dist: B.dist, turn: B.turn, paused: B.paused, settled: B.settled, left: B.timer ? B.timer.left : null, phase: B.phase, energy: B.comp ? B.comp.energy : null, hint: B.comp ? B.comp.hintLeft : null };
    },
    get foe() {
      return B && { hp: B.hp, maxHp: B.maxHp, name: B.look.name, shield: B.foeShield };
    },
    settleForTest: (k) => settle(k),
    /* tests only: keep a fight alive long enough to check every rule, or end it quickly */
    setFoeHp(n) {
      if (B) B.hp = B.maxHp = Math.max(1, n);
    },
    get mob() {
      return B && B.mob;
    },
  };
})();
