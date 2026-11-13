/* Full-screen RPG: maps, NPC scripts, story progress, HUD, menus and in-scene dialog.
   Rendering and movement live in world.js, battles and stats in battle.js, English questions in learn.js.
   Legacy pm-* learning records stay owned by index.html; this file only adds fields to pm-rpg-v1. */
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
  const PET = { fur: "#f3d7a8", ear: "#b07a4a", muzzle: "#fff6e8", scarf: "#e8737f" };
  const LEGACY = [
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

  /* ---------- new regions ---------- */
  const LAYOUT = {
    kk: [
      "TTTTTTTTTTTTTTTTTTTTTTTT",
      "T..HHH.....,....HHH...,T",
      "T..HHH..........HHH....T",
      "T...a............b.....T",
      "T..,..==========.......T",
      "T.....=........=....,..T",
      "T.m...=...,....=.......T",
      "T.....=...P....======@.T",
      "T.....=........=.......T",
      "T..,..==========...m...T",
      "T.........=............T",
      "T..HHH....=.....HHH....T",
      "T..HHH....=.....HHH..,.T",
      "T...c.....=......d.....T",
      "T.,....m..........m....T",
      "TTTTTTTTTTTTTTTTTTTTTTTT"
    ],
    wind: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TT.HHHHHH..T~~.HHHHHH....T~~T..HHHHHH.TT",
      "T..HHHHHH...~~.HHHHHH.....~~...HHHHHH..T",
      "T....a......~~...o........~~...HHHHHH..T",
      "T.....=.....~~...=.....m..~~.....h.....T",
      "T.,...=..m..~~...=........~~..,..=.....T",
      "T.....=.....~~...=....,...~~.....=.,...T",
      "T.....=.....~~...=........~~.....=.....T",
      "T.@.P=======11============22======.....T",
      "T...........~~..=.........~~.........,.T",
      "T..g.....,..~~..=.........~~...........T",
      "T...........~~.,=..HHHHHH.~~...,.......T",
      "T...,...m...~~..x..HHHHHH.~~........m..T",
      "T.T.........~~.......s..m.~~..m........T",
      "TT........T.~~T..........T~~.T........TT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
    ],
  };
  const look = (o) => ({ skin: "#ffe0c7", hair: "#5a3d2e", boots: "#6b4a3a", ...o });
  const KK = {
    id: "kk",
    icon: "🔤",
    name: "KK 新手村",
    region: "kk",
    palette: {
      grass: "#c7e6b3", grass2: "#bfe0aa", blade: "#9ccb85", path: "#f0dcae", pathDot: "#d8c08a",
      tree: ["#9bd27f", "#73b663"], fruit: "#ffb3c7", flower: ["#c9a7ff", "#ffd166", "#ffffff"],
      roof: ["#9b8ad6", "#7fb4e6", "#f08a8a", "#ffc46b"], edge: "#7fae6a", berry: "#b56be5",
    },
    layout: LAYOUT.kk,
    npcs: [
      { ch: "a", id: "vowel", name: "母音老師 Ava", look: look({ hair: "#f4eee8", earIn: "#ffc2cf", cloth: "#9b8ad6", accent: "#fff3b0", ears: "bunny" }) },
      { ch: "b", id: "consonant", name: "子音老師 Cody", look: look({ skin: "#e8c39e", hair: "#a8744c", earIn: "#f3d2b3", cloth: "#5b8fb5", accent: "#ffd25e", ears: "bear" }) },
      { ch: "c", id: "stress", name: "重音老師 Stella", look: look({ skin: "#fff1e4", hair: "#f08b47", cloth: "#e8737f", accent: "#fff3b0", ears: "fox" }) },
      { ch: "d", id: "word", name: "村長 Kai", look: look({ hair: "#8a8a8a", cloth: "#6b8f5a", accent: "#f3d27a", hat: "#4f6d8f" }) },
    ],
    mob: { name: "音節泡泡", shape: "bubble", colors: ["#c9b6ff", "#ffffff"], lv: 1, hp: 26, atk: 3, aggressive: false, resist: { phys: 0.6 } },
  };
  const WIND = {
    id: "wind",
    icon: "🌬️",
    name: "風之旅行群島",
    region: "wind",
    palette: {
      grass: "#c9e9cf", grass2: "#bfe3c6", blade: "#a0d0ae", path: "#ece2c6", pathDot: "#cfc3a3",
      tree: ["#9fd6b2", "#6fb58a"], flower: ["#a7c7ff", "#ffffff", "#ffd166"],
      roof: ["#7fb4e6", "#f2c14e", "#e98f73"], water: "#8ed2ee", edge: "#7cc0d8", berry: "#7d8bff",
    },
    layout: LAYOUT.wind,
    npcs: [
      { ch: "g", id: "guide", name: "嚮導 Wendy", look: look({ hair: "#f2c14e", cloth: "#7fb4e6", accent: "#ffffff", hat: "#f08a8a" }) },
      { ch: "a", id: "checkin", name: "報到櫃檯 Mia", look: look({ hair: "#3d2b24", cloth: "#3e4f92", accent: "#ffd25e", hat: "#3e4f92" }) },
      { ch: "o", id: "officer", name: "海關 Officer Lee", look: look({ hair: "#2b2b2b", cloth: "#2f3b55", accent: "#c9a45c", hat: "#2f3b55" }) },
      { ch: "s", id: "baggage", name: "行李服務 Sam", look: look({ hair: "#6b4a3a", cloth: "#e98f73", accent: "#ffffff" }) },
      { ch: "h", id: "hotel", name: "飯店櫃檯 Noah", look: look({ hair: "#3d2b24", cloth: "#b5384a", accent: "#f3d27a" }) },
    ],
    mob: { name: "紙飛鳥", shape: "bird", colors: ["#f6f3ff", "#b9a8ec"], lv: 3, hp: 40, atk: 5, aggressive: false, sprite: "mob-bird" },
  };
  const LEVELS = { 1: "初級", 2: "中級", 3: "高級" };
  const ELEMENTS = { wind: "風", kk: "音", fire: "火", wood: "木", water: "水", earth: "土" };
  /* Wind story stages. cat/scene point into data/scenes.json and are shared with the commute mode. */
  const STAGES = [
    { id: "checkin", npc: "checkin", cat: "travel", scene: "airport", title: "機場報到", learn: "回答護照、托運行李、座位與登機時間的問題", toeic: "多益準備目標：Part 2 應答問題中常見的機場報到問句" },
    { id: "customs", npc: "officer", cat: "travel", scene: "customs", title: "海關問答", learn: "說明來訪目的、停留天數、住宿地點與申報", toeic: "多益準備目標：Part 2 應答、Part 3 旅遊對話裡的入境情境" },
    { id: "baggage", npc: "baggage", cat: "travel", scene: "baggage", title: "找回行李", learn: "說明行李沒出現、描述行李外觀、請對方寄送", toeic: "多益準備目標：Part 3 客服對話與機場廣播常見用語" },
    { id: "hotel", npc: "hotel", cat: "travel", scene: "hotel", title: "抵達飯店", learn: "辦理入住、詢問早餐與退房時間", toeic: "多益準備目標：Part 2、Part 3 飯店櫃檯對話" },
  ];
  const KK_TASKS = [
    { id: "vowel", npc: "vowel", title: "母音", type: "vowel", learn: "認得 æ、ɛ、ɪ、ʌ 等母音符號，連到單字的發音" },
    { id: "consonant", npc: "consonant", title: "子音", type: "consonant", learn: "認得 θ、ʃ、tʃ、dʒ、ŋ 等子音符號" },
    { id: "stress", npc: "stress", title: "重音", type: "stress", learn: "看 ˋ 符號、聽發音，判斷重音在第幾個音節" },
    { id: "word", npc: "word", title: "整字發音", type: "word", learn: "聽單字選音標、看音標選單字" },
  ];

  const maps = [KK, WIND, ...LEGACY];
  const byId = (id) => maps.find((m) => m.id === id);
  const legacyIdx = (id) => LEGACY.findIndex((m) => m.id === id);

  /* ---------- save (pm-rpg-v1: legacy fields keep their meaning, new ones are added) ---------- */
  const raw = LS.get("pm-rpg-v1", null),
    hadSave = !!(raw && typeof raw === "object" && !Array.isArray(raw)),
    data = {
      version: 1,
      map: 0,
      positions: {},
      cleared: [],
      chests: [],
      ...(hadSave ? raw : {}),
    };
  data.cleared = Array.isArray(data.cleared) ? data.cleared.filter((x) => typeof x === "string") : [];
  data.chests = Array.isArray(data.chests) ? data.chests.filter((x) => LEGACY.some((m) => m.id === x)) : [];
  data.positions = data.positions && typeof data.positions === "object" ? data.positions : {};
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  data.world = obj(data.world);
  data.hero = obj(data.hero);
  data.kk = obj(data.kk);
  data.story = obj(data.story);
  data.story.wind = { stage: 0, ...obj(data.story.wind) };
  const save = () => LS.set("pm-rpg-v1", data);
  const legacyUnlocked = (i) => i === 0 || ["word", "sent"].every((k) => data.cleared.includes(LEGACY[i - 1].id + ":" + k));
  if (!Number.isInteger(data.map) || !LEGACY[data.map] || !legacyUnlocked(data.map)) data.map = 0;
  // Where to stand: new players start in the KK village; returning players keep their last map.
  if (!byId(data.at)) {
    const returning = hadSave || (P && (P.xp > 0 || P.rounds > 0));
    data.at = returning ? LEGACY[data.map].id : "kk";
  }
  const kkDone = () => !!data.kk.done;
  const unlocked = (id) => {
    if (id === "kk") return true;
    if (id === "wind") return kkDone();
    const i = legacyIdx(id);
    return i >= 0 && legacyUnlocked(i);
  };
  if (!unlocked(data.at)) data.at = "kk";
  const W = data.story.wind;

  /* ---------- shell helpers ---------- */
  let mounted = null,
    statusTimer = 0;
  const cur = () => byId(data.at);
  function status(t, keep) {
    const el = $("hud-msg");
    if (!el) return;
    el.textContent = t || "";
    el.hidden = !t;
    clearTimeout(statusTimer);
    if (t && !keep) statusTimer = setTimeout(() => (el.hidden = true), 4500);
  }
  const busy = () => Battle.active || !$("dlg").hidden || !$("menu").hidden || !$("panel").hidden;
  function syncPause() {
    World.paused = busy();
  }

  /* ---------- in-scene dialog ---------- */
  const Talk = (() => {
    let open = false;
    function show(npc) {
      $("dlg").hidden = false;
      open = true;
      syncPause();
      World.clearKeys();
      $("dlg-name").textContent = npc ? npc.name : "";
      const cv = $("dlg-face");
      cv.hidden = !npc;
      if (npc) requestAnimationFrame(() => World.portrait(cv, "npc", npc.look, { zoom: 1.35 }));
    }
    function close() {
      $("dlg").hidden = true;
      $("dlg-body").innerHTML = "";
      open = false;
      syncPause();
      if (World.canvas) World.canvas.focus({ preventScroll: true });
      refresh();
    }
    /* A line of dialog. English lines are spoken; tap ▶ to continue. */
    function line(en, zh, opt = {}) {
      return new Promise((res) => {
        $("dlg-body").innerHTML = `${en ? `<p class="dlg-en">${esc(en)}</p>` : ""}${zh ? `<p class="dlg-zh">${zh}</p>` : ""}<div class="dlg-row">${en ? '<button class="dlg-say" type="button">🔊</button>' : ""}<button class="dlg-next" type="button">${esc(opt.next || "▶ 繼續")}</button></div>`;
        const say = $("dlg-body").querySelector(".dlg-say");
        if (say) say.onclick = () => speak(en);
        if (en && opt.speak !== false) speak(en);
        const nx = $("dlg-body").querySelector(".dlg-next");
        nx.onclick = () => res();
        nx.focus({ preventScroll: true });
      });
    }
    /* Choices: [{label, value, sub}] -> value */
    function choose(prompt, options) {
      return new Promise((res) => {
        $("dlg-body").innerHTML = `${prompt ? `<p class="dlg-zh">${prompt}</p>` : ""}<div class="dlg-choices">${options.map((o, i) => `<button type="button" data-i="${i}"${o.disabled ? " disabled" : ""}>${o.label}${o.sub ? `<small>${o.sub}</small>` : ""}</button>`).join("")}</div>`;
        $("dlg-body")
          .querySelectorAll("[data-i]")
          .forEach((b) => (b.onclick = () => res(options[+b.dataset.i].value)));
        const f = $("dlg-body").querySelector("[data-i]:not([disabled])");
        if (f) f.focus({ preventScroll: true });
      });
    }
    async function quiz(q, head) {
      const r = await Learn.ask($("dlg-body"), q, { src: "quest" });
      return r.ok;
    }
    /* A short English round inside the dialog: returns how many were right. */
    async function round(title, make, n) {
      let ok = 0;
      for (let i = 0; i < n; i++) {
        $("dlg-name").dataset.step = `${title} ${i + 1}/${n}`;
        if (await quiz(make(i))) ok++;
      }
      delete $("dlg-name").dataset.step;
      return ok;
    }
    return { show, close, line, choose, quiz, round, get open() { return open; } };
  })();

  /* ---------- sheets (menu, journal, world map, bag, mic check) ---------- */
  function sheet(html, onClose) {
    $("menu").hidden = false;
    $("menu-body").innerHTML = html;
    $("menu-close").onclick = () => closeSheet(onClose);
    syncPause();
    World.clearKeys();
  }
  function closeSheet(cb) {
    $("menu").hidden = true;
    $("menu-body").innerHTML = "";
    syncPause();
    if (cb) cb();
  }
  function openMenu() {
    const ctx = sceneContext();
    sheet(`<h3>☰ 選單</h3><div class="menu-grid">
      <button data-m="map">🗺️<b>世界地圖</b><small>${maps.filter((m) => unlocked(m.id)).length}/${maps.length} 區域</small></button>
      <button data-m="journal">📜<b>任務日誌</b><small>${esc(objective().short)}</small></button>
      <button data-m="drive">🚗<b>開車模式</b><small>${ctx ? "練這段：" + esc(ctx.label) : "聽中文、說英文"}</small></button>
      <button data-m="bag">🎒<b>背包</b><small>道具與素材</small></button>
      <button data-m="practice">📚<b>練習與成就</b><small>單字、句子、分級</small></button>
      <button data-m="book">🃏<b>卡冊</b><small>收集的單字卡</small></button>
      <button data-m="log">📈<b>學習紀錄</b><small>每天學了什麼</small></button>
      <button data-m="mic">🎤<b>麥克風檢查</b><small>收不到聲音時用</small></button>
      <button data-m="sound">${SND.on ? "🔊" : "🔇"}<b>音效</b><small>${SND.on ? "開" : "關"}</small></button>
    </div>`);
    $("menu-body")
      .querySelectorAll("[data-m]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const m = b.dataset.m;
            if (m === "map") return worldMap();
            if (m === "journal") return journal();
            if (m === "bag") return bag();
            if (m === "sound") {
              SND.toggle();
              paintMute();
              return openMenu();
            }
            closeSheet();
            if (m === "drive") return openDriveFrom(ctx);
            if (m === "mic") return openDriveFrom(ctx, true);
            openPanel(m === "practice" ? "p-play" : m === "book" ? "p-book" : "p-log");
          }),
      );
  }
  function worldMap() {
    sheet(`<h3>🗺️ 世界地圖</h3><p class="fine">新的冒險從 KK 新手村開始，接著前往風之旅行群島。下方五個主題區域保留原本的任務與進度。</p><div class="map-list">${maps
      .map((m) => {
        const on = unlocked(m.id),
          note = m.id === "kk" ? (kkDone() ? "已畢業" : `${KK_TASKS.filter((t) => data.kk[t.id]).length}/4 課`) : m.id === "wind" ? (W.done ? "故事完成" : on ? `${Math.min(W.stage, 4)}/4 段` : "完成新手村後開放") : `${["word", "sent"].filter((k) => data.cleared.includes(m.id + ":" + k)).length}/2 任務`;
        return `<button data-go="${m.id}" ${on ? "" : "disabled"} aria-current="${m.id === data.at}">${on ? m.icon : "🔒"} <b>${esc(m.name)}</b><small>${note}</small></button>`;
      })
      .join("")}</div>`);
    $("menu-body")
      .querySelectorAll("[data-go]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            closeSheet();
            travel(b.dataset.go);
          }),
      );
  }
  function stageMeta(s) {
    const sc = Learn.scene(s.cat, s.scene),
      cid = Learn.contentId(s.cat, s.scene),
      [el, , , lv] = cid.split("/");
    return { sc, cid, path: `${ELEMENTS[el] || el}／旅遊／${sc ? sc.name : s.title}／${LEVELS[lv] || "初級"}`, level: LEVELS[lv] || "初級" };
  }
  function journal() {
    const kkRows = KK_TASKS.map((t) => `<li class="${data.kk[t.id] ? "done" : ""}"><b>${data.kk[t.id] ? "✅" : "⬜"} ${t.title}</b><small>${t.learn}</small></li>`).join("");
    const windRows = STAGES.map((s, i) => {
      const m = stageMeta(s),
        done = W.stage > i || W.done;
      return `<li class="${done ? "done" : ""}"><b>${done ? "✅" : i === W.stage && kkDone() ? "▶️" : "⬜"} ${s.title}</b><small>會學：${s.learn}</small><small>內容：${esc(m.path)}（${m.sc ? m.sc.items.length : 0} 句）· 程度：${m.level}</small><small>${s.toeic}</small></li>`;
    }).join("");
    sheet(`<h3>📜 任務日誌</h3><p class="journal-now">目前目標：${esc(objective().text)}</p>
      <h4>🔤 KK 新手村 ${kkDone() ? "· 已畢業" : ""}</h4><ul class="journal">${kkRows}<li class="${data.kk.battle ? "done" : ""}"><b>${data.kk.battle ? "✅" : "⬜"} 教學戰鬥</b><small>用音標魔法打倒村口的音節泡泡</small></li></ul>
      <h4>🌬️ 風之旅行群島 ${W.done ? "· 故事完成" : ""}</h4><ul class="journal">${windRows}</ul>
      <p class="fine">多益準備目標只說明這段內容練的是哪一類題型，不代表考試分數，也不把遊戲等級換算成成績。</p>`);
  }
  function bag() {
    sheet(Battle.bagHTML());
    const bind = () =>
      $("menu-body")
        .querySelectorAll("[data-use]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              Battle.use(b.dataset.use);
              $("menu-body").innerHTML = Battle.bagHTML();
              bind();
            }),
        );
    bind();
  }
  function openPanel(tab) {
    showTab(tab);
    showScreen("home");
  }

  /* ---------- objective / quest tracker ---------- */
  function objective() {
    const at = data.at;
    if (at === "kk" || !kkDone()) {
      const next = KK_TASKS.find((t) => !data.kk[t.id]);
      if (next) return { text: `找${KK.npcs.find((n) => n.id === next.npc).name}上「${next.title}」課`, short: `KK：${next.title}`, npc: next.npc, map: "kk" };
      if (!data.kk.battle) return { text: data.kk.bubble ? "用音標魔法打倒村口的音節泡泡" : "找村長 Kai 報告", short: "KK：教學戰鬥", npc: data.kk.bubble ? null : "word", map: "kk" };
      if (!kkDone()) return { text: "回去找村長 Kai 領畢業證書", short: "KK：畢業", npc: "word", map: "kk" };
    }
    if (at === "kk") return { text: "走進村口東邊的傳送門，前往風之旅行群島", short: "前往風之群島", map: "kk" };
    if (at === "wind" || !W.done) {
      if (W.done) return { text: "風之旅行完成！可以在世界地圖選其他區域，或用開車模式複習", short: "風之旅行完成", map: "wind" };
      const s = STAGES[W.stage];
      if (s.id === "baggage" && W.bag === "search") return { text: "追上叼走行李箱的搗蛋海鷗（轉盤西邊）", short: "找回行李", map: "wind" };
      const npc = WIND.npcs.find((n) => n.id === s.npc);
      return { text: `${s.title}：找${npc.name}`, short: `風之旅行：${s.title}`, npc: s.npc, map: "wind" };
    }
    const m = cur();
    const left = ["word", "sent"].filter((k) => !data.cleared.includes(m.id + ":" + k)).length;
    return { text: left ? `找${m.person}接英文任務（還有 ${left} 項）` : `${m.name}的任務都完成了`, short: m.name, npc: left ? "main" : null, map: m.id };
  }
  function refresh() {
    const o = objective();
    $("quest-text").textContent = o.text;
    // "!" over whoever the current objective points to (or every legacy resident with work left)
    World.entities.filter((e) => e.kind === "npc").forEach((e) => (e.mark = o.map === data.at && e.id === o.npc));
    Battle.paint();
  }
  /* The scene the player is working on, for the commute mode switch. */
  function sceneContext() {
    if (data.at === "wind" && !W.done) {
      const s = STAGES[Math.min(W.stage, 3)],
        m = stageMeta(s);
      return { cat: s.cat, scene: s.scene, label: `風之旅行・${s.title}（${m.level}）`, cid: m.cid };
    }
    if (data.at === "wind") return { cat: "travel", scene: "", label: "風之旅行・全部旅遊情境", cid: "wind/travel" };
    return null;
  }
  function openDriveFrom(ctx, check) {
    openDrive({ from: "field", ctx, check: !!check });
  }

  /* ---------- maps and movement ---------- */
  function travel(id) {
    if (!unlocked(id)) {
      status("這個區域還沒開放。");
      return;
    }
    data.at = id;
    const li = legacyIdx(id);
    if (li >= 0) data.map = li;
    save();
    mount();
  }
  function mount() {
    const m = cur();
    mounted = m.id;
    World.heroLook = HERO;
    const def = m.region
      ? { ...m }
      : { ...m, npcLook: m.npcLook, npcName: m.person, mob: { ...m.mob, ...Battle.mobFor(legacyIdx(m.id)) } };
    World.mount($("stage-host"), { ...def, heroLook: HERO, petLook: PET }, {
      start: data.world[m.id],
      chestOpen: data.chests.includes(m.id),
      onTap: tapped,
      onEncounter: encounter,
      onMove: (x, y) => {
        data.world[m.id] = { x, y };
        save();
      },
      onStatus: status,
      onTick: Battle.tick,
      onRevive: () => {
        Battle.revive();
        refresh();
      },
      onSit: () => Battle.paint(),
      onPortal: portal,
      portalOn: () => (m.id === "kk" ? kkDone() : true),
      gateOpen: (c) => (c === "1" ? W.stage >= 1 : c === "2" ? W.stage >= 3 : false),
      onTarget: (e) => status(`前往 Lv.${e.look.lv} ${e.name}，碰到就開戰`),
      heroBars: Battle.bars,
      itemIcon: (k) => (Battle.ITEMS[k] || {}).icon,
    });
    $("hud-map").textContent = `${m.icon} ${m.name}`;
    spawnSpecials();
    refresh();
    status(m.id === "kk" && !KK_TASKS.some((t) => data.kk[t.id]) ? "歡迎來到 KK 新手村！點地面走路；按右下角 💬 會自動走到下一位老師。" : `${m.name}`);
  }
  function findChar(ch) {
    const L = cur().layout;
    for (let y = 0; y < L.length; y++) {
      const x = L[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
  }
  /* Story monsters that only exist at certain points. */
  function spawnSpecials() {
    if (data.at === "kk" && data.kk.bubble && !data.kk.battle) {
      const p = findChar("@");
      World.spawn({ name: "搗蛋音節泡泡", shape: "bubble", colors: ["#ff9fd0", "#ffffff"], lv: 2, hp: 40, atk: 3, resist: { phys: 0.5 } }, p.x - 3, p.y + 1, { unique: true, story: "tutorial" });
    }
    if (data.at === "wind" && W.stage === 2 && W.bag === "search") {
      const p = findChar("x");
      World.spawn({ name: "搗蛋海鷗", shape: "bird", colors: ["#ffffff", "#9aa3b5"], lv: 4, hp: 46, atk: 5, drop: "feather" }, p.x, p.y, { unique: true, story: "thief" });
    }
  }
  function portal() {
    if (data.at === "kk") {
      if (!kkDone()) return status("傳送門還沒啟動：先完成新手村的課程和教學戰鬥。");
      toast("🌬️", "前往風之旅行群島", "初級旅遊英文：報到、海關、飯店");
      return travel("wind");
    }
    if (data.at === "wind") {
      toast("🔤", "回到 KK 新手村", "隨時可以回來複習音標");
      travel("kk");
    }
  }
  function tapped(e) {
    if (Battle.active || Talk.open) return;
    if (e.kind === "chest") return openChest();
    if (e.kind === "npc") return talkTo(e);
  }
  function openChest() {
    const m = cur();
    if (data.chests.includes(m.id)) return toast("📭", "已領取這份禮物", "繼續尋找居民的任務吧");
    data.chests.push(m.id);
    save();
    World.setChest(true);
    addXP(15);
    toast("🎁", "發現探索禮物！", "獲得 15 XP", "newcard");
  }
  function interact() {
    if (busy()) return;
    const ents = World.entities,
      chest = ents.find((e) => e.kind === "chest" && World.near(e)),
      npc = ents.filter((e) => e.kind === "npc").sort((a, b) => dist(a) - dist(b))[0];
    if (chest) return openChest();
    // 💬 leads to whoever the current objective needs; otherwise it talks to the closest resident.
    const o = objective(),
      goal = o.map === data.at && o.npc && World.npc(o.npc),
      target = goal || npc;
    if (!target) return;
    if (World.near(target)) return talkTo(target);
    status(`走向 ${target.name}…`);
    World.approach(target);
  }
  const dist = (e) => Math.hypot(e.tx - World.hero.x, e.ty - World.hero.y);

  /* ---------- NPC scripts ---------- */
  async function talkTo(e) {
    const m = cur();
    Talk.show(e);
    try {
      if (m.id === "kk") await kkNpc(e);
      else if (m.id === "wind") await windNpc(e);
      else await legacyNpc(e);
    } finally {
      Talk.close();
    }
  }

  /* KK village */
  const kkMake = (type) => () => Learn.kkQuestion(type === "word" ? (Math.random() < 0.5 ? "listen" : "read") : type);
  async function kkNpc(e) {
    const task = KK_TASKS.find((t) => t.npc === e.id);
    if (e.id === "word" && data.kk.word) {
      if (KK_TASKS.every((t) => data.kk[t.id])) return chief();
      const left = KK_TASKS.filter((t) => !data.kk[t.id]).map((t) => t.title).join("、");
      return Talk.line("Finish your other lessons first.", `還有${left}課沒上完，完成後再來找我。`);
    }
    if (data.kk[task.id]) {
      const v = await Talk.choose(`${task.title}課已經完成了。要再複習一次嗎？`, [
        { label: "🔁 再練一次（5 題）", value: "again" },
        { label: "稍後再聊", value: "bye" },
      ]);
      if (v === "again") await lesson(task, true);
      return;
    }
    await lesson(task, false);
    if (e.id === "word" && KK_TASKS.every((t) => data.kk[t.id])) await chief();
  }
  const INTRO = {
    vowel: ["Vowels are the heart of every word.", "母音是單字的核心。KK 音標用 æ、ɛ、ɪ 這些符號表示不同的母音。我會先播一個<b>示範單字</b>，再請你找出含有同一個音的單字。"],
    consonant: ["Let's listen to the consonants.", "子音像 θ（think 的 th）、ʃ（fish 的 sh）。一樣先聽示範單字，再找出含有那個音的字。"],
    stress: ["Where is the stress?", "重音符號 ˋ 標在重讀音節的前面。聽聽看哪一段比較重、比較長。"],
    word: ["Now put it all together.", "最後是整個單字：聽發音選音標，或看音標選單字。"],
  };
  async function lesson(task, review) {
    const [en, zh] = INTRO[task.id];
    await Talk.line(en, zh);
    const ok = await Talk.round(`${task.title}練習`, kkMake(task.type), 5);
    Learn.flush("quest", `KK 新手村・${task.title}`);
    if (ok >= 3) {
      if (!data.kk[task.id]) {
        data.kk[task.id] = true;
        save();
        Battle.give("berry");
        toast("🔤", `${task.title}課完成`, `答對 ${ok}/5 題 · 獲得小紅莓`, "badge");
      }
      await Talk.line("Great job!", `答對 ${ok} 題，${review ? "複習完成" : "這堂課過關了"}！${KK_TASKS.every((t) => data.kk[t.id]) ? "" : "去找下一位老師吧。"}`);
    } else await Talk.line("Let's try again.", `答對 ${ok} 題，要答對 3 題才過關。聽示範單字多練幾次，再來找我。`);
    refresh();
  }
  async function chief() {
    if (!data.kk.bubble) {
      await Talk.line("You learned all four lessons!", "四堂課都完成了！不過村口有一隻<b>搗蛋音節泡泡</b>，把字典裡的音標弄亂了。");
      await Talk.line("Use phonics magic!", "戰鬥時選「✨ 技能 → 音標魔法」，答對音標題就能打出大傷害。泡泡不怕普通攻擊喔。");
      data.kk.bubble = true;
      save();
      spawnSpecials();
      status("村口出現了搗蛋音節泡泡！點它開始教學戰鬥。", true);
      return refresh();
    }
    if (!data.kk.battle) return Talk.line("The bubble is near the gate.", "泡泡在村口傳送門附近。用音標魔法打倒它再回來！");
    if (!kkDone()) {
      data.kk.done = true;
      save();
      World.refresh();
      addXP(20);
      toast("🎓", "KK 新手村畢業", "傳送門已啟動：前往風之旅行群島", "levelup");
      await Talk.line("You are ready to travel!", "你已經會看 KK 音標了。村口東邊的傳送門已經啟動，下一站是<b>風之旅行群島</b>：機場報到、海關、飯店，一路用英文闖關！");
      return refresh();
    }
    await Talk.line("Have a nice trip!", "旅途愉快！想複習音標，隨時回來找老師們。");
  }

  /* Wind islands */
  const sq = (s, i) => () => Learn.sceneQuestion(s.cat, s.scene, i);
  async function windNpc(e) {
    if (e.id === "guide") return guide();
    const idx = STAGES.findIndex((s) => s.npc === e.id);
    if (W.done || idx < W.stage) return Talk.line("Thank you!", `這一段已經完成了。${W.done ? "風之旅行故事完成！" : "繼續往下一個目標前進吧。"}`);
    if (idx > W.stage) return Talk.line("Please come back later.", "先完成前面的步驟再過來喔。");
    await ({ checkin, customs, baggage, hotel })[STAGES[idx].id]();
    refresh();
  }
  async function stageOffer(s) {
    const m = stageMeta(s);
    return Talk.choose(`<b>${s.title}</b> · ${m.level}<br><small>會學：${s.learn}</small><br><small>${s.toeic}</small>`, [
      { label: "▶ 開始對話", value: "go" },
      { label: "🚗 先用開車模式練這段", value: "drive", sub: `同一批 ${m.sc ? m.sc.items.length : 0} 句情境` },
      { label: "稍後再來", value: "later" },
    ]);
  }
  async function guide() {
    await Talk.line("Welcome to the Wind Islands!", "歡迎來到風之旅行群島！這裡練的是<b>初級旅遊英文</b>：先在機場報到，過橋到海關，再到飯店入住。");
    const v = await Talk.choose("想先做什麼？", [
      { label: "📜 看任務日誌", value: "journal" },
      { label: "🚗 用開車模式練目前這段", value: "drive" },
      { label: "出發吧", value: "bye" },
    ]);
    if (v === "journal") {
      Talk.close();
      journal();
    }
    if (v === "drive") {
      Talk.close();
      openDriveFrom(sceneContext());
    }
  }
  async function stagePass(s, ok, n, key) {
    Learn.flush("quest", `風之旅行・${s.title}`);
    return ok >= Math.ceil(n * 0.6);
  }
  async function checkin() {
    const s = STAGES[0],
      v = await stageOffer(s);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Good morning! Where are you flying today?", "櫃檯人員先問你要飛去哪裡。接下來看英文問題，選出最適合的回答。");
    const ok = await Talk.round("報到", (i) => sq(s, i)(), 4);
    const seat = await Talk.choose("最後她問你座位偏好（兩個都是好答案）：", [
      { label: "Can I have a window seat?", value: "window", sub: "靠窗" },
      { label: "Can I have an aisle seat, please?", value: "aisle", sub: "靠走道" },
    ]);
    W.seat = seat;
    if (!(await stagePass(s, ok, 4))) return Talk.line("Let's try once more.", `答對 ${ok}/4 題。多聽幾次對話再試一次（可以先用開車模式練習）。`);
    W.stage = 1;
    save();
    World.refresh();
    addXP(20);
    toast("🎫", "拿到登機證", `${seat === "window" ? "靠窗" : "靠走道"}座位 · 東邊的橋已開放`, "badge");
    await Talk.line(seat === "window" ? "Here is your boarding pass. Enjoy the view!" : "Here is your boarding pass. You have an aisle seat.", "報到完成！飛機起飛……抵達風之群島機場。走過東邊的橋，到海關排隊吧。");
  }
  async function customs() {
    const s = STAGES[1],
      v = await stageOffer(s);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Next, please. What is the purpose of your visit?", "海關問你來訪的目的。你的回答會改變接下來的問題。");
    const why = await Talk.choose("你要怎麼回答？", [
      { label: "I'm here for sightseeing.", value: "sightseeing", sub: "我是來觀光的" },
      { label: "I'm here on business.", value: "business", sub: "我是來出差的" },
    ]);
    W.purpose = why;
    save();
    // Follow-up questions depend on the answer (indexes into the customs scene, in conversation order).
    const follow = why === "business" ? [5, 2, 9] : [2, 3, 4];
    await Talk.line(why === "business" ? "On business? Let me ask a few more questions." : "Sightseeing, great. Just a few questions.", why === "business" ? "出差的話，海關會多問你的工作。" : "觀光的話，海關會問停留天數和住宿。");
    let ok = 0;
    for (let i = 0; i < follow.length; i++) if (await Talk.quiz(sq(s, follow[i])())) ok++;
    if (!(await stagePass(s, ok, 3))) return Talk.line("Please review and come back.", `答對 ${ok}/3 題。再練一下海關問答（可以切到開車模式）再回來。`);
    W.stage = 2;
    save();
    addXP(20);
    toast("🛂", "通過海關", why === "business" ? "Good luck with your meetings!" : "Enjoy your trip!", "badge");
    await Talk.line(why === "business" ? "Welcome. Good luck with your meetings." : "Welcome. Enjoy your trip!", "入境章蓋好了！去南邊的行李轉盤領行李吧，行李服務 Sam 在那裡。");
  }
  async function baggage() {
    const s = STAGES[2];
    if (W.bag === "search") return Talk.line("Did you find your bag?", "海鷗往轉盤西邊飛了！點牠就能開戰，把行李箱搶回來。");
    const v = await stageOffer(s);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("", "轉盤停了……你的行李箱沒有出現！旁邊好像有一隻海鷗叼著一個黑色行李箱飛走了。");
    const how = await Talk.choose("你要怎麼處理？", [
      { label: "🧾 到服務櫃檯用英文申報", value: "desk", sub: "回答 3 題，行李會送到飯店" },
      { label: "🏃 自己去追那隻海鷗", value: "search", sub: "戰鬥搶回行李，馬上拿到" },
    ]);
    if (how === "search") {
      W.bag = "search";
      save();
      spawnSpecials();
      status("搗蛋海鷗在轉盤西邊！點牠開始戰鬥。", true);
      return Talk.line("Hey, come back with my bag!", "去追那隻海鷗吧！牠就在轉盤西邊。");
    }
    await Talk.line("Hi, how can I help you?", "Sam 會問你行李的狀況，選出最適合的英文。");
    const ok = await Talk.round("申報行李", (i) => sq(s, [3, 5, 7][i])(), 3);
    if (!(await stagePass(s, ok, 3))) return Talk.line("Sorry, could you say that again?", `答對 ${ok}/3 題。Sam 沒聽懂，再試一次。`);
    W.bag = "desk";
    W.stage = 3;
    save();
    World.refresh();
    addXP(20);
    toast("🧳", "行李申報完成", "行李會送到飯店 · 東邊的橋已開放", "badge");
    await Talk.line("We'll send it to your hotel tonight.", "Sam 會把行李送到飯店。走過東邊的橋去飯店吧！");
  }
  async function hotel() {
    const s = STAGES[3],
      v = await stageOffer(s);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Good evening. How can I help you?", "飯店櫃檯 Noah 要幫你辦理入住。");
    const ok = await Talk.round("入住", (i) => sq(s, [0, 1, 2, 4][i])(), 4);
    if (!(await stagePass(s, ok, 4))) return Talk.line("Let's go over it again.", `答對 ${ok}/4 題，再練一次入住對話吧。`);
    if (W.bag === "desk") await Talk.line("Oh, and your suitcase arrived an hour ago.", "對了，機場送來的行李箱一小時前到了！申報行李的英文派上用場了。");
    else await Talk.line("Can I help you with your bag?", "你自己搶回了行李箱，Noah 幫你把它送上樓。");
    W.stage = 4;
    W.done = true;
    save();
    addXP(30);
    Battle.give("berry", 2);
    Battle.give("dew", 2);
    toast("🏨", "風之旅行完成！", "獲得小紅莓 ×2、藍露珠 ×2", "levelup");
    await Talk.line("Your room is on the fifth floor. Enjoy your stay!", "🎉 <b>風之旅行初級故事完成</b>：機場報到 → 海關 → 找回行李 → 飯店入住。可以在選單用開車模式複習全部旅遊情境。");
  }

  /* Legacy theme maps: the resident's two 10-question quests now run inside the dialog. */
  async function legacyNpc(e) {
    const m = cur();
    await Talk.line(m.line, esc(m.zh));
    const pick = await Talk.choose("每項任務 10 題，答對 7 題完成，首次完成獎勵 30 XP。", [
      ...["word", "sent"].map((k, i) => ({ label: `${data.cleared.includes(m.id + ":" + k) ? "✅" : "📜"} ${i ? "句子交流" : "主題單字"}`, value: k })),
      { label: "🧺 補給交換", value: "trade" },
      { label: "稍後再聊", value: "bye" },
    ]);
    if (pick === "trade") return tradeDialog();
    if (pick !== "word" && pick !== "sent") return;
    const route = SENT.some((s) => s.route === m.route && s.lv <= maxLv()) ? m.route : "daily";
    const make = pick === "word" ? () => Learn.wordQuestion((w) => w.th === m.id) : () => Learn.sentQuestion((s) => s.route === route);
    const ok = await Talk.round(pick === "word" ? "主題單字" : "句子交流", make, 10);
    Learn.flush("quest", `${m.name}・${pick === "word" ? "主題單字" : "句子交流"}`);
    const key = m.id + ":" + pick;
    if (ok < 7) return Talk.line("Let's practice more!", `答對 ${ok}/10 題，答對 7 題就能完成任務。`);
    if (data.cleared.includes(key)) return Talk.line("Well done!", `答對 ${ok}/10 題，複習完成！`);
    data.cleared.push(key);
    save();
    addXP(30);
    toast("✨", "居民任務完成！", "首次完成獲得 30 XP", "levelup");
    const i = legacyIdx(m.id);
    if (i < 4 && legacyUnlocked(i + 1)) toast(LEGACY[i + 1].icon, "新地圖解鎖", LEGACY[i + 1].name, "badge");
    await Talk.line("Thank you so much!", `答對 ${ok}/10 題，任務完成！`);
  }
  async function tradeDialog() {
    for (;;) {
      const can = Battle.matTotal() >= 3;
      const v = await Talk.choose(`🧺 補給交換：素材 ${Battle.matTotal()} 個，任何 3 個素材換 1 個補給。`, [
        { label: "🍓 換小紅莓", value: "berry", disabled: !can },
        { label: "💧 換藍露珠", value: "dew", disabled: !can },
        { label: "完成", value: "bye" },
      ]);
      if (v === "bye") return;
      Battle.trade(v);
    }
  }

  /* ---------- battles ---------- */
  function encounter(mob) {
    if (Battle.active || Talk.open || !$("menu").hidden || !$("panel").hidden) return;
    const m = cur(),
      region = m.region || m.id;
    let skills,
      tutorial = "";
    if (region === "kk") {
      skills = [
        { id: "kk", name: "音標魔法", icon: "🔤", mp: 5, kind: "attack", mult: 2.8, desc: "答對 KK 音標題，造成 2.8 倍傷害", make: () => Learn.kkQuestion(["vowel", "consonant", "stress", "listen", "read"][Math.floor(Math.random() * 5)]) },
        { id: "heal", name: "整字回復", icon: "💚", mp: 6, kind: "heal", heal: 0.4, desc: "答對整字發音題，回復 40% HP", make: () => Learn.kkQuestion("listen") },
      ];
      if (mob.story === "tutorial") tutorial = "教學：泡泡不怕普通攻擊。選「✨ 技能 → 🔤 音標魔法」，答對音標題就能打出大傷害！";
    } else if (region === "wind") {
      const s = STAGES[Math.min(W.stage, 3)];
      skills = [
        { id: "talk", name: "旅遊會話", icon: "💬", mp: 6, kind: "attack", mult: 2.4, desc: `${s.title}情境題，2.4 倍傷害`, make: () => Learn.sceneQuestion(s.cat, s.scene) },
        { id: "word", name: "單字飛彈", icon: "🔤", mp: 4, kind: "attack", mult: 1.8, desc: "旅行單字題，1.8 倍傷害", make: () => Learn.wordQuestion((w) => w.th === "transport") },
        { id: "heal", name: "治癒短句", icon: "💚", mp: 8, kind: "heal", heal: 0.4, desc: "旅遊情境題，回復 40% HP", make: () => Learn.sceneQuestion("travel", ["airport", "customs", "hotel"][Math.floor(Math.random() * 3)]) },
      ];
    } else {
      const route = SENT.some((s) => s.route === m.route && s.lv <= maxLv()) ? m.route : "daily";
      skills = [
        { id: "word", name: "單字飛彈", icon: "🔤", mp: 4, kind: "attack", mult: 1.8, desc: "主題單字題，1.8 倍傷害", make: () => Learn.wordQuestion((w) => w.th === m.id) },
        { id: "sent", name: "句子爆發", icon: "💥", mp: 8, kind: "attack", mult: 2.8, desc: "句子題，2.8 倍傷害", make: () => Learn.sentQuestion((s) => s.route === route) },
        { id: "heal", name: "治癒短句", icon: "💚", mp: 8, kind: "heal", heal: 0.4, desc: "句子題，回復 40% HP", make: () => Learn.sentQuestion() },
      ];
    }
    const look = mob.look.hp ? mob.look : { ...mob.look, hp: mob.maxHp };
    Battle.start({ ...mob, look }, {
      region,
      skills,
      tutorial,
      fleeAlways: mob.story === "tutorial",
      intro: mob.story === "thief" ? "搗蛋海鷗叼著你的行李箱！打倒牠把行李搶回來！" : "",
      onEnd(result) {
        if (result === "win") {
          World.defeat(mob);
          if (mob.story === "tutorial") {
            data.kk.battle = true;
            save();
            toast("🫧", "教學戰鬥勝利", "回去找村長 Kai 領畢業證書", "badge");
          }
          if (mob.story === "thief") {
            W.bag = "found";
            W.stage = 3;
            save();
            World.refresh();
            addXP(20);
            toast("🧳", "搶回行李箱了！", "東邊的橋已開放：前往飯店", "badge");
          }
        } else if (result === "flee") World.calm(3);
        else if (result === "down") World.knockout();
        refresh();
      },
    });
  }

  /* ---------- HUD wiring and public API ---------- */
  function bindHud() {
    $("hud-menu").onclick = openMenu;
    $("hud-quest").onclick = journal;
    $("act-talk").onclick = interact;
    $("act-fight").onclick = () => {
      if (busy()) return;
      if (!World.attackNearest()) status("附近沒有怪物。");
    };
    $("hud-berry").onclick = () => Battle.use("berry");
    $("hud-dew").onclick = () => Battle.use("dew");
    $("hud-sit").onclick = () => Battle.toggleSit();
    $("hud-bag").onclick = bag;
    $("menu").addEventListener("click", (e) => {
      if (e.target === $("menu")) closeSheet();
    });
  }
  function boot() {
    Battle.init(data.hero, save, status);
    Learn.setScenes(typeof SCENES !== "undefined" ? SCENES : []);
    bindHud();
    Battle.sync();
    mount();
  }
  /* Back from the learning panel / commute mode: same map, same spot, same quest. */
  function resume() {
    syncPause();
    Battle.sync();
    refresh();
    World.run();
  }
  const inField = (e) =>
    !busy() && !e.altKey && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && document.body.classList.contains("field");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("menu").hidden) return closeSheet();
    }
    if (!inField(e)) return;
    if (World.key(e, true)) return e.preventDefault();
    const act = { e: interact, f: () => World.attackNearest(), r: () => Battle.toggleSit(), b: bag, m: openMenu, j: journal, 1: () => Battle.use("berry"), 2: () => Battle.use("dew") }[e.key.toLowerCase()];
    if (act) {
      e.preventDefault();
      act();
    }
  });
  document.addEventListener("keyup", (e) => World.key(e, false));

  return {
    boot,
    resume,
    refresh,
    travel,
    maps,
    stages: STAGES,
    sceneContext,
    objective,
    openMenu,
    journal,
    get data() {
      return data;
    },
    get talking() {
      return Talk.open;
    },
    // Kept for index.html: the old in-page quests are now in-scene, so practice rounds are never "RPG" rounds.
    active: null,
    launching: false,
    matches: () => true,
    complete() {},
    render() {
      if (mounted) refresh();
    },
    loadArt: (m) => World.loadArt(m),
  };
})();
