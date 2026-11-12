/* Exploration is additive: legacy pm-* learning records remain owned by index.html. */
const RPG = (() => {
  const maps = [
    {
      id: "food",
      icon: "🍓",
      npc: "🐱",
      name: "莓果美食市場",
      person: "主廚 Momo",
      line: "Welcome! Can you help me at the market?",
      zh: "歡迎！幫我認識市場裡的食物吧。",
      route: "daily",
      decor: ["🍎", "🥕", "🥐"],
      color: "#bde4ad",
    },
    {
      id: "animal",
      icon: "🌳",
      npc: "🐰",
      name: "兔兔動物森林",
      person: "森林嚮導 Lily",
      line: "Hello, explorer! Let’s meet the animals.",
      zh: "嗨，小旅人！一起認識森林動物。",
      route: "school",
      decor: ["🌲", "🍄", "🌼"],
      color: "#a7d7b9",
    },
    {
      id: "nature",
      icon: "🌦️",
      npc: "🐸",
      name: "雨滴自然湖畔",
      person: "天氣博士 Pip",
      line: "Look at the sky! What can you see?",
      zh: "看看天空，你看到了什麼？",
      route: "daily",
      decor: ["💧", "🌷", "🌿"],
      color: "#b8dfeb",
    },
    {
      id: "transport",
      icon: "🎈",
      npc: "🦊",
      name: "微風旅行車站",
      person: "站長 Finn",
      line: "Where shall we go today?",
      zh: "今天想去哪裡旅行呢？",
      route: "travel",
      decor: ["🌲", "🧳", "🎈"],
      color: "#ddd3ee",
    },
    {
      id: "things",
      icon: "🏡",
      npc: "🐻",
      name: "星光生活小鎮",
      person: "鎮長 Bear",
      line: "Welcome to our town! Make yourself at home.",
      zh: "歡迎來到小鎮，和居民一起練英文吧。",
      route: "business",
      decor: ["🏡", "🌸", "🌷"],
      color: "#efd4bb",
    },
  ];
  const raw = LS.get("pm-rpg-v1", {}),
    data = {
      version: 1,
      map: 0,
      positions: {},
      cleared: [],
      chests: [],
      ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
    };
  data.cleared = Array.isArray(data.cleared)
    ? data.cleared.filter((x) => typeof x === "string")
    : [];
  data.chests = Array.isArray(data.chests)
    ? data.chests.filter((x) => maps.some((m) => m.id === x))
    : [];
  data.positions =
    data.positions && typeof data.positions === "object" ? data.positions : {};
  const api = {
    active: null,
    launching: false,
    matches(kind, x) {
      if (!api.active) return true;
      const m = maps[api.active.map];
      return kind === "w"
        ? x.th === m.id
        : x.route ===
            (SENT.some((s) => s.route === m.route && s.lv <= maxLv())
              ? m.route
              : "daily");
    },
    render,
    complete,
  };
  const save = () => LS.set("pm-rpg-v1", data);
  const unlocked = (i) =>
    i === 0 ||
    ["word", "sent"].every((k) =>
      data.cleared.includes(maps[i - 1].id + ":" + k),
    );
  if (!Number.isInteger(data.map) || !maps[data.map] || !unlocked(data.map))
    data.map = 0;
  function position() {
    const p = data.positions[maps[data.map].id];
    return p &&
      Number.isInteger(p.x) &&
      Number.isInteger(p.y) &&
      p.x >= 0 &&
      p.x < 9 &&
      p.y >= 0 &&
      p.y < 7 &&
      !blocked(p.x, p.y)
      ? p
      : { x: 4, y: 5 };
  }
  function blocked(x, y) {
    return (
      y === 0 ||
      y === 6 ||
      x === 0 ||
      x === 8 ||
      ((x === 2 || x === 6) && (y === 2 || y === 4))
    );
  }
  function render() {
    const root = $("rpg-root");
    if (!root || !maps.length) return;
    const m = maps[data.map],
      p = position();
    root.innerHTML = `<section class="adventure" aria-label="RPG 地圖探索"><div class="rpg-heading"><div><small>ENGLISH · LITTLE ADVENTURES</small><h2>${m.icon} ${m.name}</h2></div><span class="rpg-passport">🗝️ ${maps.filter((_, i) => unlocked(i)).length}/5</span></div><nav class="map-tabs" aria-label="旅行地圖">${maps.map((a, i) => `<button data-map="${i}" ${unlocked(i) ? "" : "disabled"} aria-pressed="${i === data.map}">${unlocked(i) ? a.icon : "🔒"} ${esc(a.name)}<small>${["word", "sent"].filter((k) => data.cleared.includes(a.id + ":" + k)).length}/2 任務</small></button>`).join("")}</nav><p class="rpg-tip">方向鍵 / WASD 或下方方向鈕移動。靠近居民與寶箱後互動。完成兩項任務即可解鎖下一站。</p><div class="rpg-map" tabindex="0" role="group" aria-label="探索地圖，使用方向鍵移動" style="--grass:${m.color}">${Array.from(
      { length: 63 },
      (_, i) => {
        const x = i % 9,
          y = Math.floor(i / 9);
        let art = "",
          cls = "";
        if (blocked(x, y)) {
          art = m.decor[(x + y) % m.decor.length];
          cls = "scenery";
        } else if (x === 4 && y === 1) {
          art = m.npc;
          cls = "resident";
        } else if (x === 7 && y === 3) {
          art = data.chests.includes(m.id) ? "📭" : "🎁";
          cls = "treasure";
        } else if (x === 4 || y === 3) cls = "path";
        return `<div class="rpg-tile ${cls}" style="grid-column:${x + 1};grid-row:${y + 1}" aria-hidden="true">${art}</div>`;
      },
    ).join(
      "",
    )}<div class="hero" style="grid-column:${p.x + 1};grid-row:${p.y + 1}" aria-label="你的位置"><span>🧙</span></div></div><div class="rpg-status" role="status">${esc(m.person)} 在北方等你 · 位置 ${p.x}, ${p.y}</div><div class="rpg-controls"><div class="dpad"><button data-move="0,-1" aria-label="向上">▲</button><button data-move="-1,0" aria-label="向左">◀</button><button data-move="0,1" aria-label="向下">▼</button><button data-move="1,0" aria-label="向右">▶</button></div><button class="interact" id="rpg-interact">💬 互動 / E</button></div><div id="rpg-dialog"></div><p class="rpg-foot">🎁 已找到 ${data.chests.length}/5 份探索禮物 · 📜 已完成 ${data.cleared.length}/10 項任務</p></section>`;
    root.querySelectorAll("[data-map]").forEach(
      (b) =>
        (b.onclick = () => {
          const i = +b.dataset.map;
          if (unlocked(i)) {
            data.map = i;
            save();
            render();
          }
        }),
    );
    root
      .querySelectorAll("[data-move]")
      .forEach(
        (b) =>
          (b.onclick = () => move(...b.dataset.move.split(",").map(Number))),
      );
    $("rpg-interact").onclick = interact;
  }
  function move(dx, dy) {
    if (
      $("home").hidden ||
      $("p-play").hidden ||
      !$("rpg-dialog") ||
      $("rpg-dialog").childElementCount
    )
      return;
    const p = position(),
      x = p.x + dx,
      y = p.y + dy;
    if (
      x < 0 ||
      y < 0 ||
      x > 8 ||
      y > 6 ||
      blocked(x, y) ||
      (x === 4 && y === 1) ||
      (x === 7 && y === 3)
    )
      return;
    data.positions[maps[data.map].id] = { x, y };
    save();
    const hero = document.querySelector(".hero");
    hero.style.gridColumn = x + 1;
    hero.style.gridRow = y + 1;
    document.querySelector(".rpg-status").textContent =
      `位置 ${x}, ${y} · 靠近居民或寶箱後按互動`;
  }
  function interact() {
    const p = position(),
      m = maps[data.map],
      near = (x, y) => Math.abs(p.x - x) + Math.abs(p.y - y) <= 1;
    if (near(7, 3)) {
      if (data.chests.includes(m.id)) {
        toast("📭", "已領取這份禮物", "繼續尋找居民的任務吧");
        return;
      }
      data.chests.push(m.id);
      save();
      addXP(15);
      toast("🎁", "發現探索禮物！", "獲得 15 XP", "newcard");
      updateHome();
      return;
    }
    if (!near(4, 1)) {
      document.querySelector(".rpg-status").textContent =
        "再靠近一點！居民在北方，禮物在東邊。";
      return;
    }
    $("rpg-dialog").innerHTML =
      `<div class="npc-dialog"><h3>${m.npc} ${esc(m.person)}</h3><p>${esc(m.line)}</p><p>${esc(m.zh)}</p><button id="npc-say">🔊 聽對話</button><p>每項任務 10 題，答對 7 題即可完成。首次完成獎勵 30 XP。</p>${["word", "sent"].map((k, i) => `<button data-quest="${k}">${data.cleared.includes(m.id + ":" + k) ? "✅" : "📜"} ${i ? "句子交流" : "主題單字"}</button>`).join("")}<button id="npc-close">稍後再聊</button></div>`;
    $("npc-say").onclick = () => speak(m.line);
    $("npc-close").onclick = () => {
      $("rpg-dialog").innerHTML = "";
    };
    document.querySelectorAll("[data-quest]").forEach(
      (b) =>
        (b.onclick = () => {
          api.active = { map: data.map, kind: b.dataset.quest };
          api.launching = true;
          try {
            start(b.dataset.quest);
          } finally {
            api.launching = false;
          }
        }),
    );
    $("npc-say").focus();
  }
  function complete() {
    if (!api.active) return;
    const { map, kind } = api.active;
    api.active = null;
    const key = maps[map].id + ":" + kind;
    if (S.score < 7) {
      toast("📜", "再試一次就更熟練了", "答對 7 題即可完成居民任務");
      return;
    }
    if (data.cleared.includes(key)) {
      toast("✅", "任務複習完成", "學習經驗與卡片已保留");
      return;
    }
    data.cleared.push(key);
    save();
    addXP(30);
    toast("✨", "居民任務完成！", "首次完成獲得 30 XP", "levelup");
    if (map < 4 && unlocked(map + 1))
      toast(maps[map + 1].icon, "新地圖解鎖", maps[map + 1].name, "badge");
  }
  document.addEventListener("keydown", (e) => {
    if (
      $("home").hidden ||
      $("p-play").hidden ||
      !$("rpg-root").children.length ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
    )
      return;
    const keys = {
      ArrowUp: [0, -1],
      w: [0, -1],
      ArrowDown: [0, 1],
      s: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      ArrowRight: [1, 0],
      d: [1, 0],
    };
    if (keys[e.key]) {
      e.preventDefault();
      move(...keys[e.key]);
    } else if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      interact();
    }
  });
  return api;
})();
