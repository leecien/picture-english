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

  /* ---------- turn-based battle ---------- */
  let B = null;
  const bar = (id, v, m) => {
    const el = $(id);
    el.style.width = Math.max(0, (v / m) * 100) + "%";
    el.parentElement.querySelector("span").textContent = `${Math.max(0, v)}/${m}`;
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
  function log(t) {
    $("bt-log").textContent = t;
  }
  function paintBattle() {
    const s = stats();
    bar("bt-foe-hp", B.hp, B.maxHp);
    bar("bt-me-hp", st.hp, s.maxHp);
    bar("bt-me-mp", st.mp, s.maxMp);
    $("bt-foe-shield").textContent = B.shield ? `${B.shield.icon} ${B.shield.name}：普攻減半，答對英文技能可破除` : "";
    $("bt-foe-shield").hidden = !B.shield;
    paint();
  }
  /* ctx: { region, skills:[{id,name,icon,mp,desc,learn,make:()=>question,kind:'attack'|'heal',mult,retry}],
          freeCasts, fleeAlways, tutorial, onEnd(result, drops) }
     look.shield {name, icon}: halves normal attacks until a correct English skill breaks it. */
  function start(mob, ctx) {
    const s = stats();
    B = { mob, look: mob.look, hp: mob.look.hp || 30, maxHp: mob.look.hp || 30, ctx, busy: false, answered: 0, free: ctx.freeCasts || 0, shield: mob.look.shield || null };
    World.paused = true;
    World.clearKeys();
    const el = $("battle");
    el.hidden = false;
    el.dataset.region = ctx.region || "";
    $("bt-foe-name").textContent = mob.look.name;
    $("bt-foe-lv").textContent = "Lv." + (mob.look.lv || 1);
    $("bt-me-lv").textContent = "Lv." + s.lv;
    requestAnimationFrame(() => {
      World.portrait($("bt-foe-cv"), "mob", mob.look, { dir: "down", zoom: 1.1 });
      World.portrait($("bt-me-cv"), "hero", World.heroLook, { dir: "up" });
    });
    paintBattle();
    log(ctx.intro || `Lv.${mob.look.lv || 1} ${mob.look.name} 擋住了去路！${B.shield ? `牠有${B.shield.name}，用英文技能破除！` : ""}`);
    menu();
  }
  function act(html) {
    $("bt-act").innerHTML = html;
  }
  /* One screen, one tap: attack, each English skill (cost, effect, what it practises), items, focus, flee. */
  function menu() {
    if (!B) return;
    B.busy = false;
    const s = stats(),
      low = B.ctx.skills.every((k) => !(B.free > 0) && st.mp < k.mp);
    act(`<div class="bt-menu"><button id="bt-attack" class="bt-main">⚔️ 攻擊<small>不耗 MP${B.shield ? " · 有盾時減半" : ""}</small></button>${B.ctx.skills
      .map((k, i) => {
        const free = B.free > 0,
          can = free || st.mp >= k.mp;
        return `<button data-k="${i}" class="bt-skill" ${can ? "" : "disabled"}><b>${k.icon} ${esc(k.name)}</b><small>${free ? "這次免費" : `MP ${k.mp}`} · ${esc(k.desc)}</small>${k.learn ? `<small class="bt-learn">練：${esc(k.learn)}</small>` : ""}</button>`;
      })
      .join("")}<button id="bt-item">🎒 道具<small>🍓${count("berry")} 💧${count("dew")}</small></button><button id="bt-focus">🧘 專注<small>回復 ${focusMp()} MP</small></button><button id="bt-run">🏃 逃跑</button></div>${low ? `<p class="bt-tip">MP 不夠施法：按「🧘 專注」或用藍露珠回復 MP，也可以先普通攻擊或逃跑。</p>` : ""}`);
    $("bt-attack").onclick = attack;
    $("bt-act")
      .querySelectorAll("[data-k]")
      .forEach((b) => (b.onclick = () => cast(B.ctx.skills[+b.dataset.k])));
    $("bt-item").onclick = items;
    $("bt-focus").onclick = focus;
    $("bt-run").onclick = flee;
    if (B.ctx.tutorial && !B.answered) log(B.ctx.tutorial);
  }
  const focusMp = () => Math.max(6, Math.round(stats().maxMp * 0.25));
  function focus() {
    if (B.busy) return;
    B.busy = true;
    const s = stats(),
      g = Math.min(focusMp(), s.maxMp - st.mp);
    st.mp += g;
    pop("me", `+${g} MP`, "heal");
    log(`集中精神，回復 ${g} MP。`);
    paintBattle();
    after();
  }
  function damageFoe(dmg, crit, label) {
    B.hp = Math.max(0, B.hp - dmg);
    shake("foe");
    pop("foe", (crit ? "暴擊 " : "") + dmg, crit ? "crit" : "");
    SND.play("hit");
    log(label + `，造成 ${dmg} 點傷害。`);
    paintBattle();
  }
  function attack() {
    if (B.busy) return;
    B.busy = true;
    const s = stats(),
      crit = rnd() < 0.12,
      phys = B.shield ? 0.5 : 1;
    const dmg = Math.max(1, Math.round(s.atk * (0.85 + rnd() * 0.3) * (crit ? 1.5 : 1) * phys));
    damageFoe(dmg, crit, B.shield ? `${B.shield.name}擋住了一半的力量` : "揮動法杖");
    after();
  }
  /* MP is spent only when the spell works: a wrong answer teaches the right one and costs a turn, not MP. */
  async function cast(k) {
    const free = B.free > 0;
    if (B.busy || (!free && st.mp < k.mp)) return;
    B.busy = true;
    log(`${k.icon} ${k.name}：答對就發動${free ? "（這次免費示範）" : `，成功才消耗 ${k.mp} MP`}。`);
    const q = k.make();
    B.answered++;
    await Learn.ask($("bt-act"), q, {
      src: "battle",
      next: "繼續戰鬥",
      retry: !!k.retry,
      onAnswer(ok) {
        if (!ok) {
          pop("me", "失敗", "miss");
          log(`咒語沒有成功，沒有消耗 MP。看一下正確答案，下次再試！`);
          return;
        }
        if (free) B.free--;
        else st.mp -= k.mp;
        if (B.shield) {
          pop("foe", `${B.shield.icon} 破盾！`, "crit");
          log(`${B.shield.name}被破除了！`);
          B.shield = null;
        }
        if (k.kind === "heal") {
          const s = stats(),
            h = Math.round(s.maxHp * (k.heal || 0.4));
          st.hp = Math.min(s.maxHp, st.hp + h);
          pop("me", "+" + h, "heal");
          log(`${k.name} 成功，回復 ${h} HP。`);
          paintBattle();
        } else {
          const s = stats(),
            dmg = Math.max(1, Math.round(s.atk * (k.mult || 2) * (0.9 + rnd() * 0.2)));
          damageFoe(dmg, false, `${k.name} 命中`);
        }
      },
    });
    after();
  }
  function items() {
    if (B.busy) return;
    const list = ["berry", "dew"]
      .map((k) => `<button data-i="${k}" ${count(k) ? "" : "disabled"}><b>${ITEMS[k].icon} ${ITEMS[k].name} ×${count(k)}</b><small>${ITEMS[k].desc}</small></button>`)
      .join("");
    act(`<div class="bt-list">${list}<button class="bt-back" id="bt-back">↩ 返回</button></div>`);
    $("bt-back").onclick = menu;
    $("bt-act")
      .querySelectorAll("[data-i]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const k = b.dataset.i,
              s = stats();
            const full = (ITEMS[k].hp && st.hp >= s.maxHp) || (ITEMS[k].mp && st.mp >= s.maxMp);
            if (full) {
              log(ITEMS[k].hp ? "HP 已經是滿的。" : "MP 已經是滿的。");
              return;
            }
            B.busy = true;
            useItem(k, false);
            pop("me", ITEMS[k].hp ? "+" + ITEMS[k].hp : "+" + ITEMS[k].mp + " MP", "heal");
            log(`使用了 ${ITEMS[k].name}。`);
            paintBattle();
            after();
          }),
      );
  }
  function flee() {
    if (B.busy) return;
    B.busy = true;
    if (B.ctx.fleeAlways || rnd() < 0.75) {
      log("成功逃走了！");
      setTimeout(() => end("flee"), 500);
      return;
    }
    log("沒逃掉！");
    after();
  }
  /* After the hero's action: win, or the foe answers with its own attack. */
  function after() {
    if (B.hp <= 0) return setTimeout(victory, 500);
    setTimeout(foeTurn, 650);
  }
  function foeTurn() {
    if (!B) return;
    if (rnd() < 0.1) {
      pop("me", "Miss", "miss");
      log(`${B.look.name} 的攻擊落空了。`);
    } else {
      const dmg = Math.max(1, Math.round((B.look.atk || 4) * (0.8 + rnd() * 0.4)));
      st.hp = Math.max(0, st.hp - dmg);
      shake("me");
      pop("me", dmg, "hurt");
      log(`${B.look.name} 發動攻擊，你受到 ${dmg} 點傷害。`);
      persist();
    }
    paintBattle();
    if (st.hp <= 0) return setTimeout(defeat, 500);
    setTimeout(menu, 350);
  }
  function victory() {
    st.kills++;
    const drops = rollDrops(B.look, B.ctx.region);
    SND.play("roundend");
    log(`打倒了 ${B.look.name}！`);
    act(`<div class="bt-end"><h3>🎉 勝利</h3><p>獲得：${drops.length ? drops.map((d) => `${ITEMS[d].icon} ${ITEMS[d].name}`).join("、") : "沒有掉落物"}</p><p class="fine">學習經驗只來自答對的英文題。</p><button id="bt-claim" class="qz-next">收下並回到原地</button></div>`);
    $("bt-claim").onclick = () => {
      drops.forEach((d) => give(d));
      end("win", drops);
    };
    $("bt-claim").focus({ preventScroll: true });
  }
  function defeat() {
    st.downs++;
    persist();
    log("你倒下了……");
    act(`<div class="bt-end"><h3>💫 倒下了</h3><p>會在這張地圖的入口醒來，HP、MP 恢復一半。卡片和學習紀錄都不受影響。</p><button id="bt-wake" class="qz-next">在入口醒來</button></div>`);
    $("bt-wake").onclick = () => end("down");
  }
  function end(result, drops) {
    const b = B;
    B = null;
    $("battle").hidden = true;
    $("bt-act").innerHTML = "";
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
    /* true while the action menu is waiting for the player */
    get ready() {
      return !!B && !B.busy && !!document.getElementById("bt-attack");
    },
    get hp() {
      return st.hp;
    },
    get mp() {
      return st.mp;
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
    get foe() {
      return B && { hp: B.hp, maxHp: B.maxHp, name: B.look.name, shield: !!B.shield };
    },
  };
})();
