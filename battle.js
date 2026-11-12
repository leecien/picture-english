/* RO-style combat rules (phase 2): hero HP/MP, items, recovery and knock-outs.
   Saved under pm-rpg-v1.hero (rpg.js owns the key). Learning progress makes the hero stronger
   because stats scale with the learning tier, but fighting never writes cards, badges or pm-log;
   English skills that do are phase 3. */
const Battle = (() => {
  const ITEMS = {
    berry: { name: "小紅莓", icon: "🍓", hp: 35, desc: "回復 35 HP" },
    dew: { name: "藍露珠", icon: "💧", mp: 20, desc: "回復 20 MP" },
    frosting: { name: "糖霜", icon: "🧁", mat: true, desc: "鬆餅仔的掉落物" },
    shell: { name: "橡實殼", icon: "🌰", mat: true, desc: "橡實寶的掉落物" },
    crystal: { name: "雨滴晶", icon: "💎", mat: true, desc: "雨滴精的掉落物" },
    feather: { name: "紙羽毛", icon: "🪶", mat: true, desc: "紙飛鳥的掉落物" },
    tealeaf: { name: "茶葉", icon: "🍃", mat: true, desc: "茶壺噗的掉落物" },
  };
  const MAT = { food: "frosting", animal: "shell", nature: "crystal", transport: "feather", things: "tealeaf" };
  const TRADE = 3; // materials per supply item at a resident
  // Monster strength per map, in unlock order. Maps 3+ have monsters that attack on sight.
  const MOBS = [
    { lv: 1, hp: 30, atk: 4, aggressive: false },
    { lv: 3, hp: 44, atk: 6, aggressive: false },
    { lv: 6, hp: 60, atk: 9, aggressive: true },
    { lv: 9, hp: 78, atk: 12, aggressive: true },
    { lv: 12, hp: 96, atk: 15, aggressive: true },
  ];
  let st = null,
    saveFn = null,
    saveTimer = 0,
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
    // A saved knock-out (page closed mid-fall) wakes up at half strength.
    if (st.hp === 0) st.hp = Math.ceil(s.maxHp / 2);
  }
  function persist() {
    paint();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveFn && saveFn(), 400);
  }
  const count = (k) => st.items[k] || 0;
  function give(k, n = 1) {
    st.items[k] = count(k) + n;
    persist();
  }

  /* ---------- world callbacks ---------- */
  const mobFor = (i) => MOBS[Math.min(i, MOBS.length - 1)];
  function heroHit() {
    const s = stats(),
      crit = rnd() < 0.12,
      dmg = Math.max(1, Math.round(s.atk * (0.85 + rnd() * 0.3) * (crit ? 1.5 : 1)));
    return { dmg, crit };
  }
  function mobHit(m) {
    if (rnd() < 0.1) return 0;
    const dmg = Math.max(1, Math.round(m.look.atk * (0.8 + rnd() * 0.4)));
    applyDamage(dmg);
    return dmg;
  }
  function applyDamage(dmg) {
    if (World.hero && World.hero.down) return;
    st.hp = Math.max(0, st.hp - dmg);
    if (st.hp === 0) {
      st.downs++;
      World.knockout();
      statusFn("你倒下了…稍後會在地圖入口醒來。學習紀錄和卡片都不受影響。");
    }
    persist();
  }
  function revive() {
    const s = stats();
    st.hp = Math.ceil(s.maxHp / 2);
    st.mp = Math.max(st.mp, Math.ceil(s.maxMp / 2));
    persist();
    toast("🌱", "在入口醒來了", "HP、MP 恢復一半，坐下休息可以更快回滿");
  }
  function kill(m, mapId) {
    st.kills++;
    const out = [];
    if (rnd() < 0.7) out.push(MAT[mapId] || "frosting");
    if (rnd() < 0.25) out.push("berry");
    if (rnd() < 0.15) out.push("dew");
    statusFn(`打倒了 ${m.name}！${out.length ? "走過去或點地上的道具就能撿起。" : ""}`);
    persist();
    return out;
  }
  function pick(item) {
    give(item);
    statusFn(`撿到 ${ITEMS[item].icon} ${ITEMS[item].name}`);
  }
  /* Recovery: sitting heals fast; standing outside combat heals slowly. */
  function tick(dt, fighting) {
    const s = stats(),
      h = World.hero;
    if (!h || h.down) return;
    acc += dt;
    const every = h.sit ? 2 : 6;
    if (acc < every) return;
    acc = 0;
    if (!h.sit && fighting) return;
    const hp0 = st.hp,
      mp0 = st.mp;
    st.hp = Math.min(s.maxHp, st.hp + (h.sit ? Math.max(4, Math.round(s.maxHp * 0.08)) : Math.max(1, Math.round(s.maxHp * 0.02))));
    st.mp = Math.min(s.maxMp, st.mp + (h.sit ? Math.max(2, Math.round(s.maxMp * 0.07)) : 1));
    if (st.hp !== hp0 || st.mp !== mp0) {
      if (h.sit && st.hp > hp0) World.heroFloat("+" + (st.hp - hp0), "#8dffa0");
      persist();
    }
  }

  /* ---------- player actions ---------- */
  function use(k) {
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
    World.heroFloat(it.hp ? "+" + it.hp : "+" + it.mp + " MP", it.hp ? "#8dffa0" : "#9fd0ff");
    SND.play("tap");
    persist();
    return true;
  }
  function toggleSit() {
    const on = !World.hero.sit;
    if (!World.sit(on)) return;
    acc = 0;
    statusFn(on ? "坐下休息中：HP、MP 回復較快。移動或被攻擊就會站起來。" : "站起來了。");
    paint();
  }
  const mats = () => Object.keys(ITEMS).filter((k) => ITEMS[k].mat);
  const matTotal = () => mats().reduce((n, k) => n + count(k), 0);
  /* Exchange any TRADE materials (largest stacks first) for one supply item. */
  function trade(k) {
    if (matTotal() < TRADE) return false;
    for (let left = TRADE; left > 0; ) {
      const top = mats().sort((a, b) => count(b) - count(a))[0];
      st.items[top]--;
      left--;
    }
    give(k);
    toast(ITEMS[k].icon, "補給交換成功", `${ITEMS[k].name} ×1`);
    return true;
  }

  /* ---------- status bar ---------- */
  function hudHTML() {
    return `<div class="hud" id="rpg-hud"><div class="hud-bars"><span class="hud-lv" id="hud-lv"></span><div class="hbar hp" role="meter" aria-label="HP" id="hud-hp"><i></i><b></b></div><div class="hbar mp" role="meter" aria-label="MP" id="hud-mp"><i></i><b></b></div></div><div class="hud-btns"><button id="hud-attack" aria-label="攻擊最近的怪物（F）" title="攻擊最近的怪物（F）">⚔️</button><button id="hud-berry" aria-label="使用小紅莓（1）" title="使用小紅莓（1）">🍓<small></small></button><button id="hud-dew" aria-label="使用藍露珠（2）" title="使用藍露珠（2）">💧<small></small></button><button id="hud-sit" aria-label="坐下休息（R）" title="坐下休息（R）">🧘</button><button id="hud-bag" aria-label="背包（B）" title="背包（B）">🎒</button></div></div>`;
  }
  function paint() {
    const el = $("rpg-hud");
    if (!el || !st) return;
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
    const sit = World.hero && World.hero.sit;
    $("hud-sit").setAttribute("aria-pressed", String(!!sit));
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
    return `<div class="npc-dialog bag" role="dialog" aria-label="背包"><h3>🎒 背包</h3><p class="bag-stat">Lv.${s.lv} · 攻擊 ${s.atk} · HP ${st.hp}/${s.maxHp} · MP ${st.mp}/${s.maxMp} · 打倒 ${st.kills} 隻</p><p class="fine">角色等級跟著學習程度成長：多答對英文題，打怪就更輕鬆。英文技能（耗 MP）將在下一階段開放。</p><ul class="bag-list">${rows}</ul><p class="fine">素材 ${matTotal()} 個：任何 ${TRADE} 個素材可以向地圖居民換 1 個小紅莓或藍露珠。</p><button id="bag-close">關閉</button></div>`;
  }
  function tradeHTML() {
    const n = matTotal();
    return `<p class="trade-note">🧺 補給交換：素材 ${n} 個（${TRADE} 個換 1 個）</p><button data-trade="berry" ${n >= TRADE ? "" : "disabled"}>🍓 換小紅莓</button><button data-trade="dew" ${n >= TRADE ? "" : "disabled"}>💧 換藍露珠</button>`;
  }

  return {
    ITEMS,
    init,
    sync,
    stats,
    mobFor,
    heroHit,
    mobHit,
    revive,
    kill,
    pick,
    tick,
    use,
    toggleSit,
    trade,
    hudHTML,
    paint,
    bagHTML,
    tradeHTML,
    get hp() {
      return st.hp;
    },
    get mp() {
      return st.mp;
    },
    count,
    bars() {
      const s = stats();
      return { hp: st.hp, maxHp: s.maxHp, mp: st.mp, maxMp: s.maxMp };
    },
    /* Test hook: deal damage as if a monster hit the hero. */
    hurt(n) {
      applyDamage(n);
    },
  };
})();
