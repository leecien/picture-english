/* Exploration is additive: legacy pm-* learning records remain owned by index.html.
   Scene rendering and movement live in world.js; this file holds map content, quests and the pm-rpg-v1 save. */
const RPG = (() => {
  const HERO = {
    skin: "#ffe0c7",
    hair: "#6b4a3a",
    cloth: "#6fa86a",
    accent: "#f3d27a",
    boots: "#7a5a44",
    staff: "#ffd25e",
    sprout: true,
  };
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
      color: "#bde4ad",
      npcLook: { skin: "#fff1e4", hair: "#f2a65a", cloth: "#ffffff", accent: "#e8737f", ears: "cat", sprite: "npc-cat" },
      mob: { name: "鬆餅仔", shape: "muffin", colors: ["#c98a52", "#ffb3c7"], lv: 1, sprite: "mob-muffin" },
      palette: {
        grass: "#b9e0a3", grass2: "#b2db9c", blade: "#93c47d", path: "#efd9a7", pathDot: "#d9bd84",
        tree: ["#8fcf72", "#6fb35a"], fruit: "#ff6b6b", flower: ["#ff8fab", "#ffd166", "#ffffff"],
        roof: ["#f08a8a", "#ffc46b", "#8fc7ef"], edge: "#78ab62", berry: "#e5677d",
      },
      layout: [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T,.....HHH....HHH....,.T",
        "T......HHH....HHH......T",
        "T..........N.......m...T",
        "T..B..=============....T",
        "T.....=.....=.....=..,.T",
        "T.m...=..,..=..B..=....T",
        "T.....=.....=.....=..C.T",
        "T.HH..==========P==....T",
        "T.HH........=.....=.m..T",
        "T.....,.....=..........T",
        "T..m....B...=....,..B..T",
        "T...........=..........T",
        "T,....m.....=.....m...,T",
        "T.......,...=..........T",
        "TTTTTTTTTTTTTTTTTTTTTTTT",
      ],
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
      color: "#a7d7b9",
      npcLook: { skin: "#fff6f0", hair: "#f4eee8", earIn: "#ffc2cf", cloth: "#8bc79a", accent: "#fff3b0", ears: "bunny", sprite: "npc-bunny" },
      mob: { name: "橡實寶", shape: "acorn", colors: ["#c78d55", "#7b5434"], lv: 1, sprite: "mob-acorn" },
      palette: {
        grass: "#a6d6a6", grass2: "#9fd09f", blade: "#7fb87f", path: "#e2cfa0", pathDot: "#c9b27d",
        tree: ["#79c07a", "#4f9a5c"], flower: ["#ffffff", "#ffd166", "#c9a7ff"],
        roof: ["#a8744c", "#d79a5f"], edge: "#4f8a55", berry: "#d9475c",
      },
      layout: [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T..TT....,.....TT.....,T",
        "T..TT...HHH....TT..m...T",
        "T.......HHH............T",
        "T,....,...N.......TT...T",
        "T.....========....TT...T",
        "TT....=......=.........T",
        "TT..m.=..TT..=====..C..T",
        "T.....=..TT......=.....T",
        "T..,..P..........=..m..T",
        "T.....=...,..TT..=.....T",
        "T.TT..=......TT..=..,..T",
        "T.TT..===========......T",
        "T..m.....,.....m....TT.T",
        "T,..................TT.T",
        "TTTTTTTTTTTTTTTTTTTTTTTT",
      ],
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
      color: "#b8dfeb",
      npcLook: { skin: "#9fd98a", hair: "#7cc46a", cloth: "#ffe08a", accent: "#7fb4e6", ears: "frog", sprite: "npc-frog" },
      mob: { name: "雨滴精", shape: "drop", colors: ["#7cc3f0", "#ffffff"], lv: 1, sprite: "mob-drop" },
      palette: {
        grass: "#b5e0c4", grass2: "#addbbd", blade: "#8cc6a1", path: "#e8dcb4", pathDot: "#cdbf93",
        tree: ["#8bd0a0", "#5fae7c"], flower: ["#a7c7ff", "#ffffff", "#ffb3c7"],
        roof: ["#7fb4e6", "#9fd1c9"], water: "#8fd0ec", edge: "#5e9c7c", berry: "#7d8bff",
      },
      layout: [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T.,.......HHH.......,..T",
        "T.........HHH..........T",
        "T....m.....N.....m.....T",
        "T......=========.......T",
        "T..~~~~=.......=..~~~..T",
        "T.~~~~~=.......=.~~~~~.T",
        "T.~~~~~=...P...=.~~~~~.T",
        "T..~~~.=.......=..~~~..T",
        "T......=========....C..T",
        "T.,.........=..........T",
        "T...m.......=......m...T",
        "T....R......=....R.....T",
        "T..,....~~~.=.~~~...,..T",
        "T.......~~~...~~~......T",
        "TTTTTTTTTTTTTTTTTTTTTTTT",
      ],
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
      color: "#ddd3ee",
      npcLook: { skin: "#fff1e4", hair: "#f08b47", cloth: "#5b6fb5", accent: "#ffd25e", ears: "fox", hat: "#3e4f92", sprite: "npc-fox" },
      mob: { name: "紙飛鳥", shape: "bird", colors: ["#f6f3ff", "#b9a8ec"], lv: 1, sprite: "mob-bird" },
      palette: {
        grass: "#cfe5b4", grass2: "#c8dfad", blade: "#aac98d", path: "#e6d8c0", pathDot: "#c8b8a0",
        tree: ["#a5d38a", "#78b467"], flower: ["#c9a7ff", "#ffffff", "#ffd166"],
        roof: ["#9b8ad6", "#e98f73"], fence: "#c79a6b", edge: "#8aae73", berry: "#b56be5",
      },
      layout: [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T..,....HHHHHH.....,...T",
        "T.......HHHHHH.........T",
        "T..m........N......m...T",
        "T......===========.....T",
        "FFFFFF.=.........=.FFFFF",
        "T......=....P....=.....T",
        "T..B...=.........=..C..T",
        "T......===========.....T",
        "FFFFFFFFF.......FFFFFFFF",
        "T..m........,......m...T",
        "T.....R.........R......T",
        "T.,.......=====........T",
        "T.........=...=....,...T",
        "T....m....=====.....B..T",
        "TTTTTTTTTTTTTTTTTTTTTTTT",
      ],
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
      color: "#efd4bb",
      npcLook: { skin: "#e8c39e", hair: "#a8744c", earIn: "#f3d2b3", cloth: "#4f6d8f", accent: "#f2c14e", ears: "bear", sprite: "npc-bear" },
      mob: { name: "茶壺噗", shape: "teapot", colors: ["#f2f0ea", "#8fc7ef"], lv: 1, sprite: "mob-teapot" },
      palette: {
        grass: "#d4e6b0", grass2: "#cde0a8", blade: "#b1cc8a", path: "#eadbc1", pathDot: "#cfbd9d",
        tree: ["#a9d48a", "#7fb46a"], flower: ["#ffb3c7", "#ffd166", "#ffffff"],
        roof: ["#e98f73", "#7fb4e6", "#f2c14e", "#9b8ad6"], edge: "#9bb47a", berry: "#e5677d",
      },
      layout: [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T.HHH....HHHH....HHH..,T",
        "T.HHH....HHHH....HHH...T",
        "T..=.......N......=..m.T",
        "T..=================...T",
        "T..........=...........T",
        "T.,.B......=.....B..,..T",
        "T...m......P.......m...T",
        "T..........=........C..T",
        "T.HHH......=.....HHH...T",
        "T.HHH..=========.HHH...T",
        "T......=.......=.......T",
        "T..m...=...,...=...m...T",
        "T......=========.......T",
        "T,.....................T",
        "TTTTTTTTTTTTTTTTTTTTTTTT",
      ],
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
  // Scene tile positions. `positions` keeps its PR #1 meaning (9×7 grid) and is left untouched.
  data.world =
    data.world && typeof data.world === "object" && !Array.isArray(data.world)
      ? data.world
      : {};
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
    loadArt: (m) => World.loadArt(m),
    maps,
  };
  const save = () => LS.set("pm-rpg-v1", data);
  const unlocked = (i) =>
    i === 0 ||
    ["word", "sent"].every((k) =>
      data.cleared.includes(maps[i - 1].id + ":" + k),
    );
  if (!Number.isInteger(data.map) || !maps[data.map] || !unlocked(data.map))
    data.map = 0;
  let mounted = null;
  const status = (t) => {
    const el = document.querySelector(".rpg-status");
    if (el) el.textContent = t;
  };
  const dialogOpen = () => !!($("rpg-dialog") && $("rpg-dialog").childElementCount);

  function render() {
    const root = $("rpg-root");
    if (!root || !maps.length) return;
    const m = maps[data.map];
    if (!root.querySelector(".adventure")) {
      mounted = null;
      root.innerHTML = `<section class="adventure" id="adventure" aria-label="RPG 地圖探索"><div class="rpg-heading"><div><small>ENGLISH · LITTLE ADVENTURES</small><h2 id="rpg-title"></h2></div><span class="rpg-passport" id="rpg-passport"></span></div><nav class="map-tabs" aria-label="旅行地圖" id="rpg-tabs"></nav><div class="rpg-stage" id="rpg-stage"></div><div class="rpg-status" role="status"></div><div class="rpg-controls"><p class="rpg-tip">點地面走路；點居民或寶箱會自動走過去。鍵盤可用方向鍵 / WASD，E 互動。</p><button class="interact" id="rpg-interact">💬 互動 / E</button></div><div id="rpg-dialog"></div><p class="rpg-foot" id="rpg-foot"></p></section>`;
      $("rpg-interact").onclick = interact;
    }
    $("rpg-title").textContent = `${m.icon} ${m.name}`;
    $("rpg-passport").textContent = `🗝️ ${maps.filter((_, i) => unlocked(i)).length}/5`;
    $("rpg-tabs").innerHTML = maps
      .map(
        (a, i) =>
          `<button data-map="${i}" ${unlocked(i) ? "" : "disabled"} aria-pressed="${i === data.map}">${unlocked(i) ? a.icon : "🔒"} ${esc(a.name)}<small>${["word", "sent"].filter((k) => data.cleared.includes(a.id + ":" + k)).length}/2 任務</small></button>`,
      )
      .join("");
    $("rpg-foot").textContent = `🎁 已找到 ${data.chests.length}/5 份探索禮物 · 📜 已完成 ${data.cleared.length}/10 項任務`;
    root.querySelectorAll("[data-map]").forEach(
      (b) =>
        (b.onclick = () => {
          const i = +b.dataset.map;
          if (unlocked(i) && i !== data.map) {
            data.map = i;
            $("rpg-dialog").innerHTML = "";
            World.paused = false;
            save();
            render();
          }
        }),
    );
    if (mounted !== m.id || !World.canvas || !World.canvas.isConnected) {
      mounted = m.id;
      World.mount($("rpg-stage"), { ...m, heroLook: HERO, npcName: m.person }, {
        start: data.world[m.id],
        chestOpen: data.chests.includes(m.id),
        onTap: tapped,
        onMove: (x, y) => {
          data.world[m.id] = { x, y };
          save();
        },
        onStatus: status,
      });
      status(`${m.person} 在等你 · 頭上有「!」的就是任務居民`);
    } else World.run();
    World.paused = dialogOpen();
  }
  function tapped(e) {
    if (e.kind === "npc") openNpc();
    else if (e.kind === "chest") openChest();
    else if (e.kind === "mob")
      status(`Lv.${e.look.lv} ${e.name}：戰鬥系統開發中（第二階段開放），目前先別打擾牠。`);
  }
  function openChest() {
    const m = maps[data.map];
    if (data.chests.includes(m.id)) {
      toast("📭", "已領取這份禮物", "繼續尋找居民的任務吧");
      return;
    }
    data.chests.push(m.id);
    save();
    World.setChest(true);
    addXP(15);
    toast("🎁", "發現探索禮物！", "獲得 15 XP", "newcard");
    updateHome();
  }
  function interact() {
    if (dialogOpen()) return;
    const ents = World.entities,
      npc = ents.find((e) => e.kind === "npc"),
      chest = ents.find((e) => e.kind === "chest");
    if (chest && World.near(chest)) return openChest();
    if (npc && World.near(npc)) return openNpc();
    // Not adjacent: walk to the resident (RO-style auto approach).
    if (npc) {
      status("正在走向居民…");
      World.approach(npc);
    }
  }
  function openNpc() {
    const m = maps[data.map];
    World.paused = true;
    World.clearKeys();
    $("rpg-dialog").innerHTML =
      `<div class="npc-dialog" role="dialog" aria-label="${esc(m.person)}"><h3>${m.npc} ${esc(m.person)}</h3><p>${esc(m.line)}</p><p>${esc(m.zh)}</p><button id="npc-say">🔊 聽對話</button><p>每項任務 10 題，答對 7 題即可完成。首次完成獎勵 30 XP。</p>${["word", "sent"].map((k, i) => `<button data-quest="${k}">${data.cleared.includes(m.id + ":" + k) ? "✅" : "📜"} ${i ? "句子交流" : "主題單字"}</button>`).join("")}<button id="npc-close">稍後再聊</button></div>`;
    $("npc-say").onclick = () => speak(m.line);
    $("npc-close").onclick = () => {
      $("rpg-dialog").innerHTML = "";
      World.paused = false;
      World.canvas && World.canvas.focus({ preventScroll: true });
    };
    document.querySelectorAll("[data-quest]").forEach(
      (b) =>
        (b.onclick = () => {
          $("rpg-dialog").innerHTML = "";
          World.paused = false;
          api.active = { map: data.map, kind: b.dataset.quest };
          api.launching = true;
          try {
            start(b.dataset.quest);
          } finally {
            api.launching = false;
          }
        }),
    );
    $("rpg-dialog").scrollIntoView({ block: "nearest" });
    $("npc-say").focus({ preventScroll: true });
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
  const inField = (e) =>
    !$("home").hidden &&
    !$("p-play").hidden &&
    $("rpg-root").children.length &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  document.addEventListener("keydown", (e) => {
    if (!inField(e) || dialogOpen()) return;
    if (World.key(e, true)) e.preventDefault();
    else if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      interact();
    }
  });
  document.addEventListener("keyup", (e) => World.key(e, false));
  return api;
})();
