/* Full-screen RPG: maps, NPC scripts, story progress, HUD, menus and in-scene dialog.
   Rendering and movement live in world.js, battles and stats in battle.js, English questions in learn.js.
   Legacy pm-* learning records stay owned by index.html; this file only adds fields to pm-rpg-v1. */
const RPG = (() => {
  // One art language (#6): the hero is drawn like the NPCs; chestnut hair, cream tunic, teal cape, amber staff.
  const HERO = {
    skin: "#ffe0c7",
    hair: "#8a5a3c",
    cloth: "#f3ead6",
    accent: "#c9a45c",
    cape: "#3f9c94",
    boots: "#6b4a3a",
    staff: "#ffb84d",
  };
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
      "T.....=.....e..=....,..T",
      "T.m...=...,....=.......T",
      "T.....=...P....======@.T",
      "T.....=........=...m...T",
      "T..,..==========...m...T",
      "T.........=............T",
      "T..HHH....=.L...HHH....T",
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
      "T..g.....,..~~..=......L..~~...........T",
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
      { ch: "e", id: "echo", name: "音標圖鑑老師 Echo", look: look({ skin: "#f6dcc4", hair: "#3e5c8a", cloth: "#e9e2c8", accent: "#7fb4e6", hat: "#c9a45c" }) },
      { ch: "L", id: "lumi", name: "風之小精靈 露米", look: { kind: "sprite", name: "露米", skin: "#fff6f2", hair: "#bdeeff", cloth: "#8fd8e8", accent: "#ffffff", boots: "#7fb4e6", wing: "#c8f4ffb0" }, optional: true },
    ],
    mob: { name: "音節泡泡", shape: "bubble", colors: ["#c9b6ff", "#ffffff"], lv: 1, hp: 24, atk: 3, aggressive: false, kind: "phonics" },
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
      // shown only while she can still be invited (see companionNpc)
      { ch: "L", id: "lumi", name: "風之小精靈 露米", look: { kind: "sprite", name: "露米", skin: "#fff6f2", hair: "#bdeeff", cloth: "#8fd8e8", accent: "#ffffff", boots: "#7fb4e6", wing: "#c8f4ffb0" }, optional: true },
    ],
    // Each island has its own monster (see WIND_MOBS); x decides which one spawns.
    mob: null,
  };
  /* Test monsters (#6 / companion handoff): HP 24 / 40 / 55 / 80 / boss 120, starting values to tune by play. */
  const WIND_MOBS = {
    slime: { name: "草地史萊姆", shape: "slime", colors: ["#9bd68f", "#4f9a5c"], lv: 2, hp: 40, atk: 4, aggressive: false, kind: "word" },
    bird: { name: "旋風雀", shape: "bird", colors: ["#eaf6ff", "#7fb4e6"], lv: 3, hp: 55, atk: 5, aggressive: false, intents: ["attack", "charge", "attack"], kind: "listen" },
    turtle: { name: "岩甲龜", shape: "turtle", colors: ["#b3b3c0", "#7a8a5a"], lv: 4, hp: 80, atk: 6, aggressive: false, intents: ["guard", "attack", "attack"], shield: { name: "岩甲", icon: "🪨" }, kind: "scene" },
    wisp: { name: "晴空光靈", shape: "wisp", colors: ["#c8edff", "#6f9fca"], lv: 3, hp: 62, atk: 4, aggressive: false, intents: ["attack", "drain", "attack"], kind: "listen" },
    beetle: { name: "琥珀甲蟲", shape: "beetle", colors: ["#d7bc7d", "#7f915c"], lv: 4, hp: 92, atk: 5, aggressive: false, intents: ["attack", "mend", "guard"], kind: "scene" },
  };
  WIND.mob = WIND_MOBS.slime;
  // No field monsters before anything is taught; after the first unit, only taught sounds are asked.
  const spawnIndex = (m, p) => m.layout.flatMap((row, y) => [...row].flatMap((ch, x) => ch === "m" ? [{x,y}] : [])).findIndex((q) => q.x === p.x && q.y === p.y);
  KK.mobAt = (p) => NV.n01 ? (chDone("N12") ? [...NOVICE_MOBS, STRESS_MOB] : NOVICE_MOBS)[Math.max(0, spawnIndex(KK, p)) % (chDone("N12") ? 6 : NV.taught.length >= 13 ? 5 : NV.taught.length >= 7 ? 3 : 1)] : taughtUnits().length ? KK.mob : null;
  WIND.mobAt = (p) => Object.values(WIND_MOBS)[Math.max(0, spawnIndex(WIND, p)) % 5];
  /* Novice-village field monster (docs/NOVICE_VILLAGE_V1.md §8): only taught sounds, long time, low damage. */
  const ECHO_MOB = { name: "回音泡泡", shape: "bubble", colors: ["#bfe6ff", "#ffffff"], lv: 1, hp: 24, atk: 2, aggressive: false, kind: "sound" };
  const NOVICE_MOBS = [ECHO_MOB,
    { name: "拍翼音靈", shape: "bird", colors: ["#d9efff", "#7b9fc2"], lv: 2, hp: 32, atk: 3, aggressive: false, kind: "sound", intents: ["attack", "charge", "attack"] },
    { name: "護字龜", shape: "turtle", colors: ["#acc7a2", "#779b74"], lv: 2, hp: 44, atk: 3, aggressive: false, kind: "sound", intents: ["attack", "guard", "attack"] },
    { name: "流光音靈", shape: "wisp", colors: ["#d6c8fa", "#9291ce"], lv: 3, hp: 36, atk: 3, aggressive: false, kind: "sound", intents: ["attack", "drain", "attack"] },
    { name: "晶甲音靈", shape: "beetle", colors: ["#a7d9cf", "#618f99"], lv: 3, hp: 52, atk: 3, aggressive: false, kind: "sound", intents: ["attack", "mend", "guard"] },
  ];
  // after N12 (stress): one more field monster that asks "which syllable is stressed"
  const STRESS_MOB = { name: "鼓點石靈", shape: "guardian", colors: ["#d8c9a8", "#8a7a5a"], lv: 6, hp: 100, atk: 5, aggressive: false, kind: "stress" };
  /* 失音魔王: three seals of 10 questions; a seal locks on 6 first-try answers, never on damage. */
  const SILENCE_BOSS = { name: "失音魔王", shape: "guardian", colors: ["#d9c8ff", "#5b4a8a"], lv: 10, hp: 40, atk: 6, intents: ["attack", "charge", "attack", "attack"] };
  const BOSS_PHASES = ["聲音封印", "幻影封印", "詞語封印"];
  const GUARDIAN = { name: "風之守衛", shape: "guardian", colors: ["#e3f5ff", "#7fb4e6"], lv: 6, hp: 120, atk: 6, intents: ["attack", "charge", "attack", "guard"], shield: { name: "風之盾", icon: "🌀" } };
  const GULL = { name: "搗蛋海鷗", shape: "bird", colors: ["#ffffff", "#9aa3b5"], lv: 4, hp: 1, atk: 0 };
  const LEVELS = { 1: "初級", 2: "中級", 3: "高級" };
  const ELEMENTS = { wind: "風", kk: "音", fire: "火", wood: "木", water: "水", earth: "土", light: "光", metal: "金", star: "星" };
  /* Wind story stages. cat/scene point into data/scenes.json and are shared with the commute mode. */
  const STAGES = [
    { id: "checkin", npc: "checkin", cat: "travel", scene: "airport", targets: [0, 1, 2, 3], title: "機場報到", learn: "聽懂並回答目的地、護照、托運行李、行李秤重", toeic: "多益準備目標：Part 2 應答問題（機場報到的常見問句與回應）" },
    { id: "customs", npc: "officer", cat: "travel", scene: "customs", targets: [2, 3, 4], title: "海關問答", learn: "說明來訪目的（觀光或出差）、停留天數、住宿與申報", toeic: "多益準備目標：Part 2 應答問題（Wh- 問句與 Yes/No 問句）" },
    { id: "baggage", npc: "baggage", cat: "travel", scene: "lostbag", targets: [0, 1, 2, 3, 4], title: "找回行李", learn: "用簡單句說行李沒出來、描述行李、提供住宿地點", toeic: "多益準備目標：Part 2 應答問題（服務櫃檯的請求與回應）" },
    { id: "hotel", npc: "hotel", cat: "travel", scene: "hotel", targets: [0, 1, 2, 3], title: "抵達飯店", learn: "辦理入住、說訂房名字與住幾晚、詢問早餐", toeic: "多益準備目標：Part 2 應答問題（飯店櫃檯的常見問句）" },
  ];
  const KK_TASKS = [
    { id: "vowel", npc: "vowel", title: "母音", type: "vowel", learn: "三個對比單元：/i/ 和 /ɪ/、/æ/ 和 /ɛ/、/ɑ/ 和 /ʌ/" },
    { id: "consonant", npc: "consonant", title: "子音", type: "consonant", learn: "三個對比單元：/ʃ/ 和 /tʃ/、/r/ 和 /l/、/s/ 和 /z/" },
    { id: "stress", npc: "stress", title: "重音", type: "stress", learn: "看 ˋ 符號、聽發音，判斷兩音節與三音節單字的重音" },
    { id: "word", npc: "word", title: "整字發音", type: "word", learn: "用學過的母音：聽單字選音標、看音標選單字" },
  ];

  const maps = [KK, WIND, ...LEGACY, ...(typeof WorldRegions !== "undefined" ? WorldRegions.maps : [])];
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
  data.regions = obj(data.regions);
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
    if (typeof WorldRegions !== "undefined" && WorldRegions.has(id)) return kkDone();
    const i = legacyIdx(id);
    return i >= 0 && legacyUnlocked(i);
  };
  if (!unlocked(data.at)) data.at = "kk";
  const W = data.story.wind;
  /* Novice village v1 (pm-rpg-v1 .nv). track "v1": new players take the new course; "legacy": players who
     already started the old KK lessons keep them (the new unit is offered by Echo). Results per sound keep
     first-try right, right after a retry, wrong, timeout and assisted apart. */
  data.nv = { step: "", taught: [], passed: [], n01: false, field: false, lv: 1, rec: {}, n02: false, n02step: "", field2: false, ch: {}, field3: false, ...obj(data.nv) };
  const NV = data.nv;
  NV.taught = Array.isArray(NV.taught) ? NV.taught : [];
  NV.passed = Array.isArray(NV.passed) ? NV.passed : [];
  NV.rec = obj(NV.rec);
  NV.ch = obj(NV.ch); // later chapters: { N03: { step, done, full }, N04: { step, done, full, field }, … N12, seals }
  NV.boss = obj(NV.boss); // { phase: 0..3, tries }
  NV.lumi = Array.isArray(NV.lumi) ? NV.lumi : []; // village quest: sound fragments repaired
  const CH_ORDER = ["N04", "N05", "N06", "N07", "N08", "N09", "N10", "N11"];
  const TEACHER = { vowel: "母音老師 Ava", consonant: "子音老師 Cody", stress: "重音老師 Stella", word: "村長 Kai" };
  /* done / field-won for every chapter, keeping the original save fields of N01–N03 */
  function chDone(id) {
    if (id === "N01") return !!NV.n01;
    if (id === "N02") return !!NV.n02;
    return !!(NV.ch[id] && NV.ch[id].done);
  }
  function chField(id) {
    if (id === "N01") return !!NV.field;
    if (id === "N02") return !!NV.field2;
    if (id === "N03") return !!NV.field3;
    return !!(NV.ch[id] && NV.ch[id].field);
  }
  const ALL_CH = ["N01", "N02", "N03", ...CH_ORDER];
  const pendingField = () => ALL_CH.find((id) => chDone(id) && !chField(id));
  const sealsDone = () => !!(NV.ch.seals && NV.ch.seals.sound && NV.ch.seals.build && NV.ch.seals.rhythm);
  const bossReady = () => NV.track === "v1" && chField("N11") && chDone("N12") && sealsDone() && C.claimed;
  if (!NV.track) NV.track = data.kk.done || ["vowel", "consonant", "stress", "word"].some((k) => data.kk[k]) || Object.keys(obj(data.kk.units)).length ? "legacy" : "v1";
  function nvRec(sym, kind, ref) {
    const r = (NV.rec[sym] = { ind: 0, retry: 0, wrong: 0, timeout: 0, assist: 0, ...obj(NV.rec[sym]) });
    r[kind]++;
    // per word / spelling as well (nv.wrec.{sound,stress,spell,build}[key]); ref is the question or { cat, key }
    const cat = ref && (ref.cat || (sym === "ˋ" ? "stress" : "sound")),
      key = ref && (ref.key || ref.wordId);
    if (sym && key) nvWord(cat, key, kind);
  }
  function nvWord(cat, key, kind) {
    NV.wrec = obj(NV.wrec);
    const c = (NV.wrec[cat] = obj(NV.wrec[cat]));
    (c[key] = { ind: 0, retry: 0, wrong: 0, timeout: 0, assist: 0, ...obj(c[key]) })[kind]++;
  }
  /* Companion (pm-rpg-v1 .companion): earned in the find-luggage stage, never given at the start.
     bond grows from chats, wins and story; no feeding, no daily chores. */
  data.companion = { met: false, claimed: false, active: true, bond: 0, outfit: "", chat: {}, day: {}, ...obj(data.companion) };
  const C = data.companion;
  C.chat = obj(C.chat);
  C.day = obj(C.day);
  const LUMI = { kind: "sprite", name: "露米", skin: "#fff6f2", hair: "#bdeeff", cloth: "#8fd8e8", accent: "#ffffff", boots: "#7fb4e6", wing: "#c8f4ffb0" };
  const BOND_AT = [0, 12, 30, 55];
  const OUTFITS = [
    { id: "", name: "原本的樣子", lv: 1, look: {} },
    { id: "ribbon", name: "風之緞帶", lv: 2, look: { accent: "#ff9fc0" } },
    { id: "leaf", name: "葉子帽", lv: 3, look: { hat: "#7cc56a" } },
    { id: "star", name: "星光翅膀", lv: 4, look: { wing: "#ffe9a8c0" } },
  ];
  const ABILITIES = [
    { lv: 1, icon: "💡", name: "提示", desc: "每場一次，幫你排除一個錯誤選項（不替你答題）" },
    { lv: 1, icon: "🛡️", name: "風之護盾", desc: "連續答對累積 3 點能量，擋下下一次攻擊" },
    { lv: 2, icon: "💚", name: "微風治療", desc: "HP 低於 35% 時，每場回復一次 25%" },
    { lv: 3, icon: "💨", name: "追擊", desc: "你答對攻擊時，露米追加 4 點傷害" },
  ];
  const bondLv = () => BOND_AT.filter((t) => C.bond >= t).length;
  const lumiLook = () => ({ ...LUMI, ...((OUTFITS.find((o) => o.id === C.outfit && o.lv <= bondLv()) || OUTFITS[0]).look) });
  const withLumi = () => C.claimed && C.active;
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  function dayRec() {
    if (C.day.date !== today()) C.day = { date: today(), chats: {}, wins: 0 };
    return C.day;
  }

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
  const busy = () => Battle.active || !$("dlg").hidden || !$("menu").hidden || !$("panel").hidden || (typeof Atlas !== "undefined" && Atlas.isOpen) || (typeof Platform !== "undefined" && Platform.isOpen) || (typeof AudioSession !== "undefined" && AudioSession.isOpen) || (typeof Vocab !== "undefined" && Vocab.isOpen);
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
        $("dlg-body").innerHTML = `${en ? `<p class="dlg-en">${Learn.sayHTML(en)}</p>` : ""}${zh ? `<p class="dlg-zh">${zh}</p>` : ""}<div class="dlg-row">${en ? '<button class="dlg-say" type="button">🔊</button>' : ""}<button class="dlg-next" type="button">${esc(opt.next || "▶ 繼續")}</button></div>`;
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
        // o.say: an English choice gets its own 🔊 next to it (hearing it never picks it)
        $("dlg-body").innerHTML = `${prompt ? `<p class="dlg-zh">${prompt}</p>` : ""}<div class="dlg-choices">${options.map((o, i) => `${o.say ? '<div class="qz-opt">' : ""}<button type="button" data-i="${i}"${o.disabled ? " disabled" : ""}>${o.label}${o.sub ? `<small>${o.sub}</small>` : ""}</button>${o.say ? Pron.hear(o.say, "", "聽這句") + "</div>" : ""}`).join("")}</div>`;
        $("dlg-body")
          .querySelectorAll("[data-i]")
          .forEach((b) => (b.onclick = () => res(options[+b.dataset.i].value)));
        const f = $("dlg-body").querySelector("[data-i]:not([disabled])");
        if (f) f.focus({ preventScroll: true });
      });
    }
    /* resolves {ok, tries}; opt.retry gives one more try after a miss */
    async function quiz(q, opt = {}) {
      return Learn.ask($("dlg-body"), q, { src: "quest", ...opt });
    }
    /* Free-form teaching panel: buttons with data-say play a recorded word. */
    function panel(html, next) {
      return new Promise((res) => {
        $("dlg-body").innerHTML = `${html}<div class="dlg-row"><button class="dlg-next" type="button">${esc(next || "▶ 繼續")}</button></div>`;
        $("dlg-body")
          .querySelectorAll("[data-say]")
          .forEach((b) => {
            const w = Learn.wordBy(b.dataset.say);
            b.onclick = () => w && speak(w.w, w.au);
          });
        const nx = $("dlg-body").querySelector(".dlg-next");
        nx.onclick = () => res();
        nx.focus({ preventScroll: true });
      });
    }
    /* A short English round inside the dialog: returns how many were right. */
    async function round(title, make, n) {
      let ok = 0;
      for (let i = 0; i < n; i++) {
        $("dlg-name").dataset.step = `${title} ${i + 1}/${n}`;
        if ((await quiz(make(i))).ok) ok++;
      }
      delete $("dlg-name").dataset.step;
      return ok;
    }
    return { show, close, line, choose, quiz, round, panel, get open() { return open; } };
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
      <button data-m="atlas">🌏<b>九元素世界</b><small>故事、主題與生活情境</small></button>
      <button data-m="map">🗺️<b>世界地圖</b><small>${maps.filter((m) => unlocked(m.id)).length}/${maps.length} 區域</small></button>
      <button data-m="journal">📜<b>任務日誌</b><small>${esc(objective().short)}</small></button>
      <button data-m="drive">🚗<b>開車模式</b><small>${ctx ? "練這段：" + esc(ctx.label) : "聽中文、說英文"}</small></button>
      <button data-m="record">🎙️<b>錄音跟讀</b><small>聽示範、逐字回饋、回放自己的聲音</small></button>
      ${C.claimed ? `<button data-m="buddy">🧚<b>旅伴</b><small>露米・默契 Lv.${bondLv()}</small></button>` : ""}
      <button data-m="bag">🎒<b>背包</b><small>道具與素材</small></button>
      <button data-m="life">🛒<b>生活情境學英語</b><small>餐廳、超市、機場…從句子認識單字</small></button>
      <button data-m="practice">📚<b>練習與成就</b><small>單字、句子、分級</small></button>
      <button data-m="vocab">📖<b>單字學習</b><small>${typeof Vocab !== "undefined" ? Vocab.count : 80} / 3000 可玩單字</small></button>
      <button data-m="book">🃏<b>卡冊</b><small>收集的單字卡</small></button>
      <button data-m="log">📈<b>學習紀錄</b><small>每天學了什麼</small></button>
      <button data-m="ability">📊<b>我的英語能力</b><small>文法、主題、四種能力</small></button>
      <button data-m="mic">🎤<b>麥克風檢查</b><small>收不到聲音時用</small></button>
      <button data-m="platform">📱<b>App 與存檔</b><small>安裝、離線與備份</small></button>
      <button data-m="start">🧭<b>回到入口</b><small>卡住時回到地圖起點</small></button>
      <button data-m="sound">${SND.on ? "🔊" : "🔇"}<b>音效</b><small>${SND.on ? "開" : "關"}</small></button>
    </div>`);
    $("menu-body")
      .querySelectorAll("[data-m]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const m = b.dataset.m;
            if (m === "atlas") return openAtlas();
            if (m === "platform") return openPlatform();
            if (m === "map") return worldMap();
            if (m === "journal") return journal();
            if (m === "bag") return bag();
            if (m === "buddy") return buddy();
            if (m === "ability") return abilityPanel();
            if (m === "life") {
              closeSheet();
              World.paused = true;
              return Life.open({ onClose: () => (syncPause(), refresh()) });
            }
            if (m === "start") {
              closeSheet();
              World.toStart();
              status("回到這張地圖的入口了。");
              return refresh();
            }
            if (m === "sound") {
              SND.toggle();
              paintMute();
              return openMenu();
            }
            closeSheet();
            if (m === "drive") return openDriveFrom(ctx);
            if (m === "record") return openRecordingPractice(ctx);
            if (m === "vocab") return openVocabulary();
            if (m === "mic") return openDriveFrom(ctx, true);
            openPanel(m === "practice" ? "p-play" : m === "book" ? "p-book" : "p-log");
          }),
      );
  }
  /* ---------- 我的英語能力: answer → event → analysis → weak practice (in place) → analysis again ---------- */
  async function abilityPanel() {
    sheet(Ability.panelHTML());
    if (!Ability.data) await Ability.ready, $("menu").hidden || sheet(Ability.panelHTML());
    $("menu-body")
      .querySelectorAll(".ab-row[data-k], .ab-sub[data-k]")
      .forEach((b) => (b.onclick = () => abilityDetail(b.dataset.k, b.dataset.id)));
  }
  function abilityDetail(kind, id) {
    sheet(Ability.detailHTML(kind, id));
    $("menu-body").querySelector(".ab-back").onclick = abilityPanel;
    const go = $("menu-body").querySelector(".ab-practice");
    if (go) go.onclick = () => practiceWeak(kind, id);
  }
  /* A question for a logged item id ("g:…", "s:<line>", "w:<word>") inside a sub-topic's scenes. */
  function questionFor(id, scenes) {
    const D = Ability.data;
    if (id.startsWith("g:")) return D && D.byId[id] ? Ability.grammarQuestion(D.byId[id]) : null;
    const text = id.slice(2);
    if (id.startsWith("w:")) return Learn.wordQuestion((w) => w.w === text, "pic", "ability");
    for (const [cat, scene] of scenes) {
      const sc = Learn.scene(cat, scene),
        i = sc ? sc.items.findIndex((x) => x.en === text) : -1;
      if (i >= 0) return Learn.sceneQuestion(cat, scene, i, { mode: "listen", ctx: `scene:${scene}` });
    }
    return SENT.some((x) => x.en === text) ? Learn.sentQuestion((x) => x.en === text, "ability") : null;
  }
  /* 練習弱項: grammar → its form-choice items; a sub-topic → its recent errors, its scenes and its grammar items. */
  async function practiceWeak(kind, id) {
    await Ability.ready;
    const p = Ability.profile(),
      D = Ability.data;
    let qs = [];
    if (kind === "grammar") qs = Ability.grammarItems({ target: id }, 5).map((g) => Ability.grammarQuestion(g));
    else {
      const [topic, sub] = id.split("/"),
        scenes = D.contexts.filter((c) => c.topic === topic && c.sub === sub && /^scene:/.test(c.ctx)).map((c) => c.source.split("/"));
      const errs = [...new Set((p.weak.find((w) => w.kind === "topic" && w.id === id) || { items: [] }).items)];
      qs = errs.map((x) => questionFor(x, scenes)).filter(Boolean);
      for (const [cat, scene] of shuffle(scenes.slice())) {
        if (qs.length >= 3) break;
        const sc = Learn.scene(cat, scene);
        if (sc) qs.push(Learn.sceneQuestion(cat, scene, Math.floor(Math.random() * sc.items.length), { mode: "listen", ctx: `scene:${scene}` }));
      }
      qs.push(...Ability.grammarItems({ topic, sub }, 5 - qs.length).map((g) => Ability.grammarQuestion(g)));
    }
    qs = qs.filter(Boolean).slice(0, 5);
    if (!qs.length) return status("這一項目前沒有可以練的題目。");
    closeSheet();
    await quizRound("能力練習", qs, "練習弱項", "practice");
    abilityDetail(kind, id); // back where the player was, with the analysis updated
  }
  /* A short round of prepared questions in a dialog, in place (the hero does not move). */
  async function quizRound(who, qs, title, via) {
    Talk.show({ name: who, look: LUMI });
    Ability.setVia(via || "practice");
    let first = 0;
    try {
      await Talk.line("", `${title}：${qs.length} 題。作答後會顯示正確句子、中文、發音與簡短說明。`);
      for (let i = 0; i < qs.length; i++) {
        $("dlg-name").dataset.step = `${title} ${i + 1}/${qs.length}`;
        const r = await Talk.quiz(qs[i]);
        if (r.ok && !r.tries) first++;
      }
      delete $("dlg-name").dataset.step;
      await Talk.line("", `第一次就答對 ${first} / ${qs.length} 題。結果已記進「我的英語能力」。`);
    } finally {
      Talk.close();
      Ability.setVia("");
    }
    return first;
  }
  /* Region stories use the same map locks and learning entrypoints as the field. */
  function openAtlas() {
    if (typeof Atlas === "undefined") return worldMap();
    closeSheet();
    World.clearKeys();
    World.paused = true;
    const onClose = () => { syncPause(); refresh(); };
    return Atlas.open({
      onClose,
      currentMapId: data.at,
      getStatus: (region) => {
        const complete = [];
        if (NV.n01 && NV.field) complete.push("sound-first-word");
        if (NV.n02 && NV.field2) complete.push("sound-path");
        if (W.stage >= 2) complete.push("wind-arrival");
        if (W.stage >= 3) complete.push("wind-baggage");
        if (W.done) complete.push("wind-stay");
        const regionMapIds = (region.maps || []).map((m) => m.id);
        const addedMap = regionMapIds.find((id) => typeof WorldRegions !== "undefined" && WorldRegions.has(id));
        const addedStatus = addedMap ? WorldRegions.status(addedMap, data.regions) : null;
        if (addedMap) (data.regions.completed && data.regions.completed[addedMap] || []).forEach((id) => {
          const i = WorldRegions.map(addedMap).quests.findIndex((q) => q.id === id);
          if (i >= 0 && region.stages[i]) complete.push(region.stages[i].id);
        });
        const legacyDone = regionMapIds.reduce((n, id) => n + ["word", "sent"].filter((k) => data.cleared.includes(id + ":" + k)).length, 0);
        return {
          unlockedMapIds: maps.filter((m) => unlocked(m.id)).map((m) => m.id),
          completedStoryIds: complete,
          progressLabel: region.id === "sound" ? (NV.track === "v1" ? `目前課程已教 ${NV.taught.length} / 41 音` : "保留舊課程進度，可回 Echo 學新版課程") : region.id === "wind" ? (W.done ? "旅行故事已完成" : `旅行主線 ${Math.min(W.stage, 4)} / 4 段`) : addedStatus ? `居民任務 ${(data.regions.completed && data.regions.completed[addedMap] || []).length} / 3` : regionMapIds.some((id) => legacyIdx(id) >= 0) ? `原主題任務已完成 ${legacyDone} 項` : "此區場景仍在製作，可先練現有生活情境",
        };
      },
      travel: (id) => { travel(id); },
      openLife: (scene, opt = {}) => {
        World.paused = true;
        return Life.open({ scene, mode: opt.mode || "explore", onClose });
      },
      openDrive: (ctx) => { openDriveFrom(ctx); },
      openPractice: (opt = {}) => {
        const theme = opt.theme;
        const pool = WORDS.filter((w) => (!theme || w.th === theme) && avail(w));
        if (opt.kind === "word" && pool.length >= 4) {
          RPG.launching = true;
          RPG.active = { source: "atlas", theme };
          try { start("word"); } finally { RPG.launching = false; }
        } else {
          openPanel("p-play");
          status("已開啟練習頁，請選擇目前可用的題型。");
        }
      },
    }).catch((error) => { onClose(); status("世界資料暫時無法載入，請稍後重試。"); console.warn(error); });
  }
  function openPlatform() {
    if (typeof Platform === "undefined") return status("App 設定暫時無法開啟。");
    closeSheet();
    World.clearKeys();
    World.paused = true;
    Platform.open({ onClose: () => { syncPause(); refresh(); } });
  }
  function worldMap() {
    sheet(`<h3>🗺️ 世界地圖</h3><p class="fine">新的冒險從 KK 新手村開始，接著前往風之旅行群島。主題區域保留原本進度；水、光、金、星各有三段居民任務與守衛試煉。</p><div class="map-list">${maps
      .map((m) => {
        const on = unlocked(m.id),
          note = m.id === "kk" ? (kkDone() ? "已畢業" : `${KK_TASKS.filter((t) => data.kk[t.id]).length}/4 課`) : m.id === "wind" ? (W.done ? "故事完成" : on ? `${Math.min(W.stage, 4)}/4 段` : "完成新手村後開放") : typeof WorldRegions !== "undefined" && WorldRegions.has(m.id) ? `${WorldRegions.status(m.id, data.regions).completedCount}/3 居民任務` : `${["word", "sent"].filter((k) => data.cleared.includes(m.id + ":" + k)).length}/2 任務`;
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
    const kkRows = KK_TASKS.map((t) => {
      const us = LESSON_UNITS[t.id],
        n = us.filter((u) => data.kk.units[u.id] || data.kk[t.id]).length;
      return `<li class="${data.kk[t.id] ? "done" : ""}"><b>${data.kk[t.id] ? "✅" : n ? "▶️" : "⬜"} ${t.title}（${n}/${us.length} 單元）</b><small>${t.learn}</small></li>`;
    }).join("");
    const due = Learn.soundsDue();
    const windRows = STAGES.map((s, i) => {
      const m = stageMeta(s),
        done = W.stage > i || W.done;
      return `<li class="${done ? "done" : ""}"><b>${done ? "✅" : i === W.stage && kkDone() ? "▶️" : "⬜"} ${s.title}</b><small>會學：${s.learn}</small><small>內容：${esc(m.path)}（${m.sc ? m.sc.items.length : 0} 句）· 程度：${m.level}</small><small>${s.toeic}</small></li>`;
    }).join("");
    sheet(`<h3>📜 任務日誌</h3><p class="journal-now">目前目標：${esc(objective().text)}</p>
      <h4>🐱 音之新手村（新版）· 冒險 Lv.${NV.lv}</h4><ul class="journal"><li class="${NV.n01 ? "done" : ""}"><b>${NV.n01 ? "✅" : NV.step ? "▶️" : "⬜"} N00＋N01 第一個字 cat</b><small>字母、聲音、KK 的不同；/k/ /æ/ /t/；先聽後選；組出 cat</small></li><li class="${NV.field ? "done" : ""}"><b>${NV.field ? "✅" : "⬜"} 回聲原野：回音泡泡</b><small>只考已教的音；答錯不公布答案，之後換別的字再出現</small></li><li class="${NV.n02 ? "done" : ""}"><b>${NV.n02 ? "✅" : NV.n02step ? "▶️" : "⬜"} N02 聲音小路 /m/ /n/ /s/ /f/</b><small>找子音老師 Cody：教學卡、先聽後選、字母組合配對（ph 也念 /f/）、補空格組音</small></li><li class="${NV.field2 ? "done" : ""}"><b>${NV.field2 ? "✅" : "⬜"} 回聲原野：7 個音的戰鬥</b><small>/k/ /æ/ /t/ /m/ /n/ /s/ /f/</small></li><li class="${n03done() ? "done" : ""}"><b>${n03done() ? "✅" : NV.ch.N03 ? "▶️" : "⬜"} N03 子音工具箱 /p/ /b/ /d/ /g/ /h/ /l/</b><small>找子音老師 Cody：無聲／有聲成對（p–b、t–d、k–g）、pp／ll 的寫法、用學過的音組整個字</small></li><li class="${NV.field3 ? "done" : ""}"><b>${NV.field3 ? "✅" : "⬜"} 回聲原野：13 個音的戰鬥</b><small>/k æ t m n s f p b d g h l/</small></li>${CH_ORDER.map((id) => `<li class="${chDone(id) && chField(id) ? "done" : ""}"><b>${chDone(id) ? "✅" : NV.ch[id] ? "▶️" : "⬜"} ${Novice.PLAN[id].title} ${Novice.PLAN[id].groups.flat().map((x) => `/${x}/`).join(" ")}</b><small>${TEACHER[Novice.PLAN[id].teacher]}${chDone(id) ? (chField(id) ? "・原野戰鬥 ✅" : "・原野戰鬥待完成") : ""}</small></li>`).join("")}
      <li class="${C.claimed ? "done" : ""}"><b>${C.claimed ? "✅" : "⬜"} 夥伴：露米</b><small>N06 原野戰鬥後，修好露米的聲音徽章</small></li>
      <li class="${chDone("N12") ? "done" : ""}"><b>${chDone("N12") ? "✅" : "⬜"} N12 音節與重音</b><small>重音老師 Stella</small></li>
      <li class="${sealsDone() ? "done" : ""}"><b>${sealsDone() ? "✅" : "⬜"} N13 三枚印記</b><small>辨音 ${NV.ch.seals && NV.ch.seals.sound ? "✅" : "⬜"}・組音 ${NV.ch.seals && NV.ch.seals.build ? "✅" : "⬜"}・節奏 ${NV.ch.seals && NV.ch.seals.rhythm ? "✅" : "⬜"}</small></li>
      <li class="${NV.grad ? "done" : ""}"><b>${NV.grad ? "✅" : "⬜"} 失音魔王（三個封印 × 10 題）</b><small>已完成 ${NV.boss.phase || 0}/3 封印</small></li>
      <li class="${NV.reviews ? "done" : ""}"><b>${NV.grad ? (NV.reviews ? "✅" : "▶️") : "⬜"} 正式複習</b><small>畢業後開放：依首次答錯、重試、超時、夥伴補正排序</small></li></ul>
      <h4>🔤 KK 新手村 ${kkDone() ? "· 已畢業" : ""}</h4>${due.length ? `<p class="fine">需要多練的音：${due.map((x) => `/${esc(x)}/`).join(" ")}（找對應的老師選「練需要加強的音」）</p>` : ""}<ul class="journal">${kkRows}<li class="${data.kk.battle ? "done" : ""}"><b>${data.kk.battle ? "✅" : "⬜"} 教學戰鬥</b><small>答音標題打倒村口的音節泡泡</small></li></ul>
      <h4>🌬️ 風之旅行群島 ${W.done ? "· 故事完成" : ""}</h4><ul class="journal">${windRows}</ul>
      ${typeof WorldRegions !== "undefined" ? `<h4>✨ 共鳴印記</h4><ul class="journal">${WorldRegions.maps.map((m) => { const s = WorldRegions.status(m.id, data.regions); return `<li class="${s.done ? "done" : ""}"><b>${s.seal ? "✨" : "⬜"} ${esc(m.name)} ${s.completedCount}/3</b><small>${s.seal ? esc(s.seal.name) + "已取得" : s.next ? esc(s.next.title) : "尚未開始"}</small></li>`; }).join("")}</ul>` : ""}
      <h4>🧚 旅伴</h4><ul class="journal"><li class="${C.claimed ? "done" : ""}"><b>${C.claimed ? `✅ 露米同行中・默契 Lv.${bondLv()}` : W.stage >= 3 ? "▶️ 露米在行李轉盤等你" : "⬜ 完成「找回行李」後相遇"}</b><small>戰鬥中提供提示與護盾，也能一起用英文聊天</small></li></ul>
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
    if (typeof WorldRegions !== "undefined" && WorldRegions.has(at)) {
      const q = WorldRegions.next(at, data.regions), m = WorldRegions.map(at);
      return q ? { text: `${q.title}：找${m.npcs.find((n) => n.id === q.npcId).name}`, short: q.title, npc: q.npcId, map: at } : { text: `${m.name}的共鳴印記已取得，可以從世界圖鑑選下一站。`, short: "地區故事完成", map: at };
    }
    if (NV.track === "v1" && !kkDone()) {
      if (!NV.n01) return { text: "找村長 Kai：學第一個字 cat（字母、聲音、KK）", short: "新手村：cat", npc: "word", map: "kk" };
      if (!NV.field) return { text: "到村子的回聲原野，用學過的 /k/ /æ/ /t/ 打倒一隻回音泡泡", short: "原野戰鬥", npc: null, map: "kk", mob: true };
      if (!NV.n02) return { text: "找子音老師 Cody：N02 聲音小路 /m/ /n/ /s/ /f/", short: "N02 聲音小路", npc: "consonant", map: "kk" };
      if (!NV.field2) return { text: "回聲原野：用學過的 7 個音再打倒一隻回音泡泡", short: "原野戰鬥 2", npc: null, map: "kk", mob: true };
      if (!n03done()) return { text: "找子音老師 Cody：N03 子音工具箱 /p/ /b/ /d/ /g/ /h/ /l/", short: "N03 子音工具箱", npc: "consonant", map: "kk" };
      if (!NV.field3) return { text: "回聲原野：用學過的 13 個音打倒一隻回音泡泡", short: "原野戰鬥 3", npc: null, map: "kk", mob: true };
      for (const id of CH_ORDER) {
        const P = Novice.PLAN[id],
          sounds = P.groups.flat().map((x) => `/${x}/`).join(" ");
        if (!chDone(id)) return { text: `找${TEACHER[P.teacher]}：${P.title} ${sounds}`, short: P.title, npc: P.teacher, map: "kk" };
        if (!chField(id)) return { text: `回聲原野：用學過的 ${NV.taught.length} 個音打倒一隻怪物`, short: `原野戰鬥（${P.title.split(" ")[0]}）`, npc: null, map: "kk", mob: true };
        if (id === "N06" && !C.claimed) return { text: "找風之小精靈露米：幫牠修好聲音徽章，邀請牠一起冒險", short: "夥伴任務", npc: "lumi", map: "kk" };
      }
      if (!chDone("N12")) return { text: "找重音老師 Stella：N12 音節與重音", short: "N12 音節與重音", npc: "stress", map: "kk" };
      if (!sealsDone()) return { text: "找村長 Kai：N13 組音實戰，拿到辨音、組音、節奏三枚印記", short: "N13 三枚印記", npc: "word", map: "kk" };
      if (!C.claimed) return { text: "找風之小精靈露米：幫牠修好聲音徽章，邀請牠一起冒險", short: "夥伴任務", npc: "lumi", map: "kk" };
      return { text: `挑戰村口的失音魔王：三個封印各 10 題，每個封印第一次答對 6 題才鎖上（已完成 ${NV.boss.phase || 0}/3）`, short: "失音魔王", npc: null, map: "kk", boss: true };
    }
    if ((at === "kk" || !kkDone()) && !(NV.track === "v1" && kkDone())) {
      // the old four-lesson path (legacy saves); a v1 graduate skips it
      const next = KK_TASKS.find((t) => !data.kk[t.id]);
      if (next) return { text: `找${KK.npcs.find((n) => n.id === next.npc).name}上「${next.title}」課`, short: `KK：${next.title}`, npc: next.npc, map: "kk" };
      if (!data.kk.battle) return { text: data.kk.bubble ? "答音標題打倒村口的音節泡泡" : "找村長 Kai 報告", short: "KK：教學戰鬥", npc: data.kk.bubble ? null : "word", map: "kk" };
      if (!kkDone()) return { text: "回去找村長 Kai 領畢業證書", short: "KK：畢業", npc: "word", map: "kk" };
    }
    if (at === "kk") return { text: "走進村口東邊的傳送門，前往風之旅行群島", short: "前往風之群島", map: "kk" };
    if (at === "wind" || !W.done) {
      if (W.done && !C.claimed) return { text: "到行李轉盤找風之小精靈露米，邀請牠同行", short: "邀請露米", npc: "lumi", map: "wind" };
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
  /* The one main button: talk if someone is next to you, otherwise walk to whoever the objective needs. */
  function primary() {
    if (!World.hero) return { label: "說話" };
    const ents = World.entities,
      chest = ents.find((e) => e.kind === "chest" && !e.open && World.near(e));
    if (chest) return { label: "打開禮物", icon: "🎁" };
    const o = objective(),
      goal = o.map === data.at && o.npc && World.npc(o.npc);
    if (goal) return World.near(goal) ? { label: "對話", icon: "💬" } : { label: `前往 ${goal.name.split(" ").pop()}`, icon: "🧭" };
    const npc = ents.filter((e) => e.kind === "npc").sort((a, b) => dist(a) - dist(b))[0];
    return npc && World.near(npc) ? { label: "對話", icon: "💬" } : { label: npc ? `找 ${npc.name.split(" ").pop()}` : "說話", icon: "💬" };
  }
  function paintPrimary() {
    const p = primary();
    $("act-label").textContent = p.label;
    $("act-talk").firstElementChild.textContent = p.icon || "💬";
    const b = Battle.bars();
    $("hud-berry").hidden = !(b.hp / b.maxHp < 0.3 || $("hud-more").getAttribute("aria-expanded") === "true");
  }
  function refresh() {
    const o = objective();
    $("quest-text").textContent = o.text;
    paintPrimary();
    // "!" over whoever the current objective points to (or every legacy resident with work left)
    World.entities.filter((e) => e.kind === "npc").forEach((e) => (e.mark = o.map === data.at && e.id === o.npc));
    Battle.paint();
  }
  /* The scene the player is working on, for the commute mode switch. */
  function sceneContext() {
    if (typeof WorldRegions !== "undefined" && WorldRegions.has(data.at)) {
      const m = WorldRegions.map(data.at), q = WorldRegions.next(data.at, data.regions) || m.quests.at(-1), ref = q.questionRefs[0];
      return { cat: ref.cat, scene: ref.scene, label: `${m.name}・${q.title}`, cid: `regions/${q.id}` };
    }
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
    if (def.npcs) def.npcs = def.npcs.filter((n) => !n.optional || (n.id === "lumi" && lumiWaiting()));
    World.mount($("stage-host"), { ...def, heroLook: HERO, petLook: withLumi() ? lumiLook() : null }, {
      start: data.world[m.id],
      chestOpen: data.chests.includes(m.id),
      onTap: tapped,
      onEncounter: encounter,
      onMove: (x, y) => {
        data.world[m.id] = { x, y };
        save();
        paintPrimary();
      },
      guide: () => {
        const o = objective();
        return o.map === data.at && o.npc ? World.npc(o.npc) : o.boss && data.at === "kk" ? World.entities.find((e) => e.story === "boss") : o.mob && data.at === "kk" ? World.entities.filter((e) => e.kind === "mob" && !e.dead).sort((a, b) => dist(a) - dist(b))[0] : data.kk.bubble && !data.kk.battle && data.at === "kk" ? World.entities.find((e) => e.story === "tutorial") : W.bag === "search" && data.at === "wind" ? World.entities.find((e) => e.story === "thief") : null;
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
      World.spawn({ name: "搗蛋音節泡泡", shape: "bubble", colors: ["#ff9fd0", "#ffffff"], lv: 2, hp: 24, atk: 3, shield: { name: "泡泡膜", icon: "🫧" } }, p.x - 3, p.y + 1, { unique: true, story: "tutorial" });
    }
    if (data.at === "kk" && bossReady() && (NV.boss.phase || 0) < 3) {
      const p = findChar("@");
      World.spawn({ ...SILENCE_BOSS }, p.x - 2, p.y - 1, { unique: true, story: "boss" });
    }
    if (data.at === "wind" && W.stage === 2 && W.bag === "search") {
      const p = findChar("x");
      World.spawn(GULL, p.x, p.y, { unique: true, story: "thief" });
    }
  }
  function portal() {
    if (typeof WorldRegions !== "undefined" && WorldRegions.has(data.at)) return openAtlas();
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
    if (e.kind === "pet" && withLumi()) return buddy();
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
      else if (typeof WorldRegions !== "undefined" && WorldRegions.has(m.id)) await regionNpc(e);
      else await legacyNpc(e);
    } finally {
      Talk.close();
    }
    if (afterTalk) {
      const f = afterTalk;
      afterTalk = null;
      f();
    }
  }
  let afterTalk = null;

  /* New regions keep their quest state inside the existing RPG save. A passed
     quiz and a real guardian victory are separate requirements. */
  async function regionNpc(npc) {
    const id = data.at, m = WorldRegions.map(id), q = WorldRegions.next(id, data.regions);
    if (!q) return Talk.line(m.ending.en, `${esc(m.ending.zh)}<br>✅ ${esc(m.name)}的三段任務與印記已完成。`);
    if (npc.id !== q.npcId) return Talk.line("One step at a time.", `先找${esc(m.npcs.find((n) => n.id === q.npcId).name)}完成「${esc(q.title)}」，再繼續這裡的故事。`);
    const ctx = { ...q.questionRefs[0], label: `${m.name}・${q.title}` };
    const pick = await Talk.choose(`<h3>${esc(q.title)}</h3><p>${esc(q.introZh)}</p><p class="fine">5 題至少 4 題獨立答對${q.battleRequired ? "，再通過守衛戰" : ""}。答題中途會保存，失敗可以再練。</p>`, [
      { label: "▶ 繼續任務", value: "quest" },
      { label: "🚗 練同一個情境", value: "drive" },
      { label: "🎙️ 錄音跟讀", value: "record" },
      { label: "先離開", value: "bye" },
    ]);
    if (pick === "drive" || pick === "record") { afterTalk = () => pick === "drive" ? openDriveFrom(ctx) : openRecordingPractice(ctx); return; }
    if (pick !== "quest") return;
    const begun = WorldRegions.start(id, data.regions, q.id);
    if (!begun.ok) return Talk.line("Let's try again later.", "任務狀態需要重新確認，請再找老師一次。");
    data.regions = begun.state; save();
    let state = WorldRegions.status(id, data.regions);
    while (state.active && state.active.index < q.questionRefs.length) {
      const index = state.active.index, question = WorldRegions.question(id, data.regions, Learn);
      if (!question) return Talk.line("Let's take a break.", "這道題目暫時沒有載入，進度已保留。");
      $("dlg-name").dataset.step = `${q.title} ${index + 1}/${q.questionRefs.length}`;
      const result = await Talk.quiz(question);
      const updated = WorldRegions.answer(id, data.regions, { index, correct: result.ok && !result.tries, assisted: !!question.assisted });
      if (!updated.ok) break;
      data.regions = updated.state; save();
      state = WorldRegions.status(id, data.regions);
    }
    delete $("dlg-name").dataset.step;
    Learn.flush("quest", `${m.name}・${q.title}`);
    if (state.result && state.result.passed && q.battleRequired && !state.result.battleWon) {
      const go = await Talk.choose(`<p>✅ 情境題已通過！接下來挑戰${esc(q.boss.name)}。每次答對攻擊，答錯或超時受到傷害；離開後可直接回來挑戰守衛。</p>`, [
        { label: "⚔️ 挑戰守衛", value: "battle" }, { label: "先補給，稍後再來", value: "bye" },
      ]);
      if (go === "battle") afterTalk = () => regionBoss(id, q);
      return;
    }
    const completed = WorldRegions.complete(id, data.regions);
    data.regions = completed.state; save();
    if (!completed.ok) return Talk.line("You can try again.", `這一輪獨立答對 ${state.result ? state.result.independent : 0} / ${q.questionRefs.length}，目標是 ${q.requiredCorrect} 題。可以再試一輪，前面的任務不會重來。`);
    grantRegionReward(completed);
    await Talk.line(q.finishEn, `${esc(q.finishZh)}<br>✅ 任務完成，獎勵已領取。`);
  }
  function grantRegionReward(completed) {
    if (!completed.reward) return;
    const reward = completed.reward;
    addXP(reward.xp);
    Object.entries(reward.items || {}).forEach(([id, n]) => Battle.give(id, n));
    if (reward.seal) toast("✨", `獲得${reward.seal.name}`, "故事完成；可以從世界圖鑑選下一站", "badge");
    else toast("✅", "居民任務完成", `XP +${reward.xp}，補給已放入背包`);
    save(); refresh();
  }
  function regionBoss(id, quest) {
    if (data.at !== id || !WorldRegions.status(id, data.regions).result?.passed) return;
    const region = WorldRegions.map(id);
    Battle.start({ look: { ...quest.boss }, name: quest.boss.name }, {
      region: id, companion: buddyCtx(),
      intro: `${quest.boss.name}的共鳴試煉：答對英文就攻擊，答錯或超時會受擊。`,
      make: (b) => { const r = quest.questionRefs[(b.turn - 1) % quest.questionRefs.length]; return Learn.sceneQuestion(r.cat, r.scene, r.index, {mode:r.mode,ctx:`region:${quest.id}:guardian`}); },
      onEnd: async (result) => {
        const recorded = WorldRegions.recordBattle(id, data.regions, { won: result === "win" });
        data.regions = recorded.state; save();
        if (result === "down") World.knockout();
        if (result !== "win") { World.calm(3); refresh(); return status("情境題的進度已保留，補給後找守望者再挑戰。"); }
        const completed = WorldRegions.complete(id, data.regions);
        data.regions = completed.state; save();
        if (!completed.ok) return refresh();
        grantRegionReward(completed); winBond();
        Talk.show({ name: region.name, look: region.npcs.at(-1).look });
        try { await Talk.line(region.ending.en, `${esc(region.ending.zh)}<br>✨ ${esc(completed.reward?.seal?.name || "共鳴印記")}已放入冒險紀錄。`); }
        finally { Talk.close(); refresh(); }
      },
    });
  }

  /* KK village: micro-lessons. Each unit demonstrates two sounds (recorded demo words + mouth/tongue hints),
     then asks the learner to tell them apart. A wrong answer brings back that unit's demo and a fresh question,
     never the whole lesson. Unit progress lives in data.kk.units; the four lesson flags keep their meaning. */
  const LESSON_UNITS = {
    vowel: Learn.UNITS.filter((u) => u.lesson === "vowel").map((u) => ({ ...u, type: "pair" })),
    consonant: Learn.UNITS.filter((u) => u.lesson === "consonant").map((u) => ({ ...u, type: "pair" })),
    stress: [
      { id: "s1", type: "stress", level: 1, title: "兩個音節的重音" },
      { id: "s2", type: "stress", level: 2, title: "三個音節的重音" },
    ],
    word: [
      { id: "w1", type: "word", kind: "listen", title: "聽發音選音標" },
      { id: "w2", type: "word", kind: "read", title: "看音標選單字" },
    ],
  };
  data.kk.units = obj(data.kk.units);
  /* Units taught so far (older saves: a finished lesson counts as all of its units taught). */
  function taughtUnits() {
    const out = Object.keys(data.kk.units).filter((k) => data.kk.units[k]);
    for (const t of ["vowel", "consonant"]) if (data.kk[t]) LESSON_UNITS[t].forEach((u) => out.includes(u.id) || out.push(u.id));
    return out;
  }
  const taughtVowels = () => new Set(LESSON_UNITS.vowel.filter((u) => taughtUnits().includes(u.id)).flatMap((u) => u.pair));
  const demoBtn = (word) => {
    const w = Learn.wordBy(word);
    return w ? `<button type="button" class="demo" data-say="${esc(w.w)}">🔊 ${esc(w.w)} <small class="qz-kk">${esc(w.kk)}</small></button>` : "";
  };
  function teachPairHTML(u) {
    return `<p class="dlg-zh">這一課：<b>${esc(u.title)}</b>。先聽示範單字（真人錄音），注意口形和舌頭位置。</p><div class="teach">${u.pair
      .map((s) => `<div class="teach-card"><b class="qz-sym big">/${esc(s)}/</b><p>${esc(Learn.SOUNDS[s].hint)}</p><div class="teach-demo">${Learn.SOUNDS[s].demo.map(demoBtn).join("")}</div></div>`)
      .join("")}</div>`;
  }
  async function teachUnit(u, again) {
    if (u.type === "pair") return Talk.panel(teachPairHTML(u), again ? "再試一題" : "▶ 我聽好了，開始練習");
    if (u.type === "stress")
      return Talk.panel(
        `<p class="dlg-zh">KK 用 <b>ˋ</b> 標出重音：它寫在<b>重讀音節的前面</b>。重讀的音節比較長、比較響亮。</p><div class="teach"><div class="teach-card"><b>banana</b> <span class="qz-kk big">[bəˋnænə]</span><p>ˋ 在 n 前面：重讀的是 <b class="qz-kk">${esc(Learn.stressSpan("[bəˋnænə]"))}</b>，第 2 個音節。</p>${demoBtn("banana")}</div><div class="teach-card"><b>apple</b> <span class="qz-kk big">[ˋæpḷ]</span><p>ˋ 在最前面：重音在第 1 個音節。</p>${demoBtn("apple")}</div></div>${u.level === 2 ? '<p class="dlg-zh">接下來是三個音節的字，一樣找 ˋ 的位置，再用耳朵確認。</p>' : ""}`,
        again ? "再試一題" : "▶ 開始練習",
      );
    return Talk.panel(
      `<p class="dlg-zh">把學過的音組成整個單字。${u.kind === "listen" ? "聽單字的發音，選出它的 KK 音標。" : "看 KK 音標，選出是哪個單字。"}這一課只用你學過的母音。</p><div class="teach"><div class="teach-card">${demoBtn("fish")}${demoBtn("cat")}${demoBtn("sun")}</div></div>`,
      again ? "再試一題" : "▶ 開始練習",
    );
  }
  function unitQuestion(u, i, avoid) {
    if (u.type === "pair") {
      const q = Learn.unitQuestion(u, i % 2 ? "find" : "which", avoid);
      q.retryHint = `再聽一次：/${u.pair[0]}/ ${Learn.SOUNDS[u.pair[0]].hint} /${u.pair[1]}/ ${Learn.SOUNDS[u.pair[1]].hint}`;
      return q;
    }
    if (u.type === "stress") return Learn.stressQuestion(u.level);
    return Learn.wordKK(u.kind, taughtVowels());
  }
  /* One unit: teach, then 3 correct answers. Misses get a hint and a retry, then the unit's demo again. */
  async function runUnit(u, title) {
    await teachUnit(u);
    let ok = 0,
      asked = 0,
      lastWord = "";
    while (ok < 3 && asked < 8) {
      $("dlg-name").dataset.step = `${title}：${u.title} ${ok}/3`;
      const q = unitQuestion(u, asked++, lastWord);
      lastWord = q.item.w;
      const r = await Talk.quiz(q, { retry: true });
      if (r.ok && !r.tries) ok++;
      else if (r.ok) ok += 0.5;
      else await teachUnit(u, true);
    }
    delete $("dlg-name").dataset.step;
    data.kk.units[u.id] = true;
    save();
  }
  async function kkNpc(e) {
    if (e.id === "echo") return echo();
    if (e.id === "word" && NV.track === "v1" && !NV.n01) return noviceUnit();
    if (e.id === "consonant" && NV.n01 && !NV.n02 && (NV.track === "v1" || NV.n02step)) return noviceN02();
    if (e.id === "consonant" && NV.n02 && NV.field2 && !n03done() && (NV.track === "v1" || NV.ch.N03)) return noviceN03();
    if (e.id === "lumi") return lumiQuest(e);
    if (NV.track === "v1" && !kkDone()) {
      const o = objective();
      if (o.npc === e.id && e.id !== "word" && CH_ORDER.some((id) => !chDone(id) && Novice.PLAN[id].teacher === e.id)) return runChapter(CH_ORDER.find((id) => !chDone(id)));
      if (o.npc === e.id && e.id === "stress") return runN12();
      if (o.npc === e.id && e.id === "word") return seals();
      if (NV.n01) return Talk.line("Keep going!", `繼續加油！目前的目標：${esc(o.text)}`);
    }
    if (NV.grad && (e.id === "word" || e.id === "vowel" || e.id === "consonant" || e.id === "stress")) return review();
    const task = KK_TASKS.find((t) => t.npc === e.id);
    if (e.id === "word" && data.kk.word) {
      if (KK_TASKS.every((t) => data.kk[t.id])) return chief();
      const left = KK_TASKS.filter((t) => !data.kk[t.id]).map((t) => t.title).join("、");
      return Talk.line("Finish your other lessons first.", `還有${left}課沒上完，完成後再來找我。`);
    }
    if (data.kk[task.id]) {
      const due = Learn.soundsDue().filter((s) => LESSON_UNITS[task.id].some((u) => u.pair && u.pair.includes(s)));
      const v = await Talk.choose(`${task.title}課已經完成了。${due.length ? `還需要多練的音：${due.map((s) => `/${s}/`).join(" ")}` : ""}`, [
        ...(due.length ? [{ label: "🎯 練需要加強的音", value: "due" }] : []),
        { label: "🔁 從頭複習這一課", value: "again" },
        { label: "稍後再聊", value: "bye" },
      ]);
      if (v === "due") await lesson(task, LESSON_UNITS[task.id].filter((u) => u.pair && u.pair.some((s) => due.includes(s))));
      if (v === "again") await lesson(task, LESSON_UNITS[task.id]);
      return;
    }
    await lesson(task);
    if (e.id === "word" && KK_TASKS.every((t) => data.kk[t.id])) await chief();
  }
  const INTRO = {
    vowel: ["Vowels are the heart of every word.", "母音課有三個小單元，每次只學兩個容易搞混的音。先聽示範，再分辨。"],
    consonant: ["Let's listen to the consonants.", "子音課也是三個小單元：/ʃ/ 和 /tʃ/、/r/ 和 /l/、/s/ 和 /z/。"],
    stress: ["Where is the stress?", "重音課：先學看 ˋ 符號，再用耳朵確認重讀的音節。"],
    word: ["Now put it all together.", "最後把學過的音組起來：聽單字選音標、看音標選單字。"],
  };
  async function lesson(task, only) {
    const [en, zh] = INTRO[task.id];
    await Talk.line(en, zh);
    const units = only || LESSON_UNITS[task.id].filter((u) => !data.kk.units[u.id]);
    for (let i = 0; i < units.length; i++) {
      await runUnit(units[i], task.title);
      if (i < units.length - 1) {
        const v = await Talk.choose(`「${units[i].title}」完成！`, [
          { label: `▶ 下一個：${units[i + 1].title}`, value: "next" },
          { label: "先休息，稍後再來（進度會保留）", value: "later" },
        ]);
        if (v === "later") return finishSummary(`KK 新手村・${task.title}`, "回來找老師就能接著上下一個單元。");
      }
    }
    const first = !data.kk[task.id];
    if (first && LESSON_UNITS[task.id].every((u) => data.kk.units[u.id])) {
      data.kk[task.id] = true;
      save();
      Battle.give("berry");
      toast("🔤", `${task.title}課完成`, "獲得小紅莓", "badge");
    }
    const next = KK_TASKS.find((t) => !data.kk[t.id]);
    await finishSummary(`KK 新手村・${task.title}`, next ? `下一步：找${KK.npcs.find((n) => n.id === next.npc).name}上「${next.title}」課。` : "四課都完成了，找村長 Kai 吧！");
    refresh();
  }
  /* ---------- 音之新手村 v1: N00 + N01 (cat) ---------- */
  const NV_STEPS = ["intro", "k", "æ", "check1", "t", "check2", "build"];
  /* Plays a word's recording slowed down (labelled as such: it is not a single-sound recording). */
  function slowWord(w) {
    const it = Novice.word(w);
    if (!it) return;
    if (typeof AudioBus !== "undefined") return AudioBus.play({ text: it.w, url: it.au || "", lang: "en-US", rate: 0.6 });
    try {
      VOICE.pause();
      VOICE.src = it.au;
      VOICE.currentTime = 0;
      VOICE.defaultPlaybackRate = VOICE.playbackRate = 0.6;
      VOICE.onended = () => (VOICE.defaultPlaybackRate = VOICE.playbackRate = 1);
      const p = VOICE.play();
      if (p) p.catch(() => {});
    } catch (e) {}
  }
  function bindNv() {
    $("dlg-body").querySelectorAll("[data-slow]").forEach((b) => (b.onclick = () => slowWord(b.dataset.slow)));
    $("dlg-body").querySelectorAll("[data-tts]").forEach((b) => (b.onclick = () => Pron.play(b.dataset.tts, "")));
  }
  const exampleBtn = (w, sym) => {
    const it = Novice.word(w);
    return it ? `<button type="button" class="demo" data-say="${esc(w)}">🔊 ${Novice.splitHTML(w, sym)} <small class="qz-kk">${esc(it.kk)}</small></button>` : "";
  };
  async function nvPanel(html, next) {
    const p = Talk.panel(html, next);
    bindNv();
    return p;
  }
  /* Untimed teaching panel for one taught sound: hear (example words), how, spelling, examples. */
  function soundCardHTML(sym) {
    const S = Novice.SOUNDS[sym];
    return `<div class="nv-card"><p class="dlg-zh">新的音：<b class="qz-sym big">/${esc(sym)}/</b>（${S.kind}）</p>
      <p><b>① 聽聲音</b>　單音錄音還沒有，先聽含有這個音的例字：標起來的字母就是 /${esc(sym)}/。</p>
      <p><b>② 怎麼發</b>　${esc(S.how)}</p>
      <p><b>③ 怎麼寫</b>　${S.spell.map(([l, ex]) => `<b class="nv-hit">${esc(l)}</b>（${esc(ex)}）`).join("　")}</p>
      <p><b>④ 聽例字</b>（每個都可以重複點）</p><div class="teach-demo">${S.examples.map((w) => exampleBtn(w, sym)).join("")}<button type="button" class="demo" data-slow="${esc(S.examples[0])}">🐢 放慢的整字 ${esc(S.examples[0])}<small>錄音 0.6 倍速，不是單音</small></button></div></div>`;
  }
  async function nvStepDone(label) {
    const v = await Talk.choose(`「${label}」完成！進度已保存。`, [
      { label: "▶ 繼續下一步", value: "next" },
      { label: "先休息（回來找 Kai 會接著上）", value: "later" },
    ]);
    return v === "next";
  }
  /* First recognition: hear, then pick (untimed). A target counts only when it is right on the first try. */
  async function nvCheck(targets, label) {
    const need = targets.filter((t) => !NV.passed.includes(t));
    let asked = 0,
      last = "";
    while (need.length && asked < 10) {
      const target = need[asked % need.length];
      const q = Novice.soundQuestion(NV.taught, { target, avoid: last, ctx: "novice" });
      last = q.wordId;
      $("dlg-name").dataset.step = `${label}：還要 ${need.length} 個音`;
      const r = await Talk.quiz(q);
      asked++;
      nvRec(target, r.tries ? "retry" : "ind", q);
      if (!r.tries) {
        NV.passed.push(target);
        need.splice(need.indexOf(target), 1);
      }
      save();
    }
    delete $("dlg-name").dataset.step;
    return !need.length;
  }
  /* Picture → put the taught sounds into the slots → confirm. Wrong slots stay open; the word is revealed only when right. */
  /* Untaught sounds of the word are placed for you and locked (labelled); only taught sounds are chosen. */
  function nvBuild(w) {
    Novice.lastBuild = w; // test hook only: never rendered
    const it = Novice.word(w),
      target = Novice.kkSounds(it.kk),
      given = target.map((x) => !NV.taught.includes(x));
    return new Promise((res) => {
      let tries = 0;
      const slots = target.map((x, i) => (given[i] ? x : null));
      const need = [...new Set(target.filter((x, i) => !given[i]))],
        extra = NV.taught.filter((x) => !need.includes(x)).sort(() => Math.random() - 0.5).slice(0, Math.max(0, 4 - need.length)),
        chips = [...need, ...extra].sort(() => Math.random() - 0.5);
      const paint = (marks) => {
        $("dlg-body").innerHTML = `<p class="dlg-zh">看圖，把這個字的聲音依順序放進格子，再按確認。（不會先播答案）</p><div class="nv-pic" aria-label="圖片題">${pic(it)}</div>
          <div class="nv-slots${slots.length > 5 ? " long" : ""}">${slots.map((x, i) => (given[i] ? `<button type="button" class="nv-slot given" disabled aria-label="第 ${i + 1} 格：還沒教的音，先幫你放好">/${esc(x)}/<small>還沒教</small></button>` : `<button type="button" class="nv-slot ${marks ? marks[i] : ""}" data-slot="${i}" aria-label="第 ${i + 1} 格">${x ? `/${esc(x)}/` : "＿"}${marks && marks[i] === "bad" ? "<sup>✕</sup>" : marks && marks[i] === "good" ? "<sup>✓</sup>" : ""}</button>`)).join("")}</div>${given.some(Boolean) ? '<p class="fine">灰色格子是還沒教的音，先幫你放好，不算在這題裡。</p>' : ""}
          <div class="nv-chips${chips.length > 5 ? " long" : ""}">${chips.map((c) => `<button type="button" class="nv-chip" data-chip="${esc(c)}">/${esc(c)}/</button>`).join("")}</div>
          <div class="qz-f" role="status">${marks ? "<b class='bad'>✕ 還沒組對</b><small>標 ✕ 的格子清空了，再聽想一想。對的格子留著。</small>" : ""}</div>
          <div class="dlg-row"><button type="button" class="dlg-next" id="nv-ok" ${slots.every(Boolean) ? "" : "disabled"}>確認</button></div>`;
        $("dlg-body").querySelectorAll("[data-chip]").forEach((b) => (b.onclick = () => {
          const i = slots.indexOf(null);
          if (i < 0) return;
          slots[i] = b.dataset.chip;
          paint();
        }));
        $("dlg-body").querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => {
          slots[+b.dataset.slot] = null;
          paint();
        }));
        $("nv-ok").onclick = () => {
          const ok = slots.every((x, i) => x === target[i]);
          if (!ok) {
            if (!tries) Learn.grade({ recK: "w", item: it, ctx: "novice-build" }, false, "quest");
            tries++;
            SND.play("wrong");
            const marks = slots.map((x, i) => (given[i] ? "" : x === target[i] ? "good" : "bad"));
            slots.forEach((x, i) => marks[i] === "bad" && (slots[i] = null));
            return paint(marks);
          }
          if (!tries) Learn.grade({ recK: "w", item: it, ctx: "novice-build" }, true, "quest");
          SND.play("correct");
          speak(it.w, it.au);
          $("dlg-body").innerHTML = `<p class="dlg-zh"><b class="good">✓ 組對了${tries ? "（重試後）" : ""}！</b></p><div class="nv-reveal"><span class="nv-pic">${pic(it)}</span><span class="nv-word">${Learn.sayHTML(it.w, it.au)}</span><span class="qz-kk big">${esc(it.kk)}</span>${Novice.breakdownHTML(w)}</div>
            <div class="teach-demo"><button type="button" class="demo" data-say="${esc(w)}">🔊 正常速度 ${esc(w)}（錄音）</button><button type="button" class="demo" data-slow="${esc(w)}">🐢 放慢的整字（錄音 0.6 倍速）</button></div><p class="fine">單音一個一個接起來的錄音還沒有；這裡播放的都是整字錄音。</p>
            <div class="dlg-row"><button type="button" class="dlg-next" id="nv-done">▶ 繼續</button></div>`;
          $("dlg-body").querySelectorAll("[data-say]").forEach((b) => (b.onclick = () => speak(it.w, it.au)));
          bindNv();
          $("nv-done").onclick = () => {
            nvWord("build", w, tries ? "retry" : "ind");
            for (let k = 0; k < tries; k++) nvWord("build", w, "wrong");
            save();
            res({ ok: true, tries });
          };
        };
      };
      paint();
    });
  }
  async function noviceUnit() {
    if (!NV.step) NV.step = "intro";
    const at = () => NV_STEPS.indexOf(NV.step);
    if (at() <= 0) {
      await Talk.line("Hello! Let's start with one word: cat.", "歡迎來到<b>音之新手村</b>！村裡的聲音都跑散了。我們先從一個字開始：<b>cat</b>。");
      await nvPanel(`<p class="dlg-zh">同一個字有三種「樣子」，它們不是同一件事：</p><div class="teach">
        <div class="teach-card"><b>① 字母（拼字）</b><p class="nv-big">c　a　t</p><p>每個字母有自己的名字：c 念 see、a 念 ay、t 念 tee。</p><button type="button" class="demo" data-tts="C. A. T.">🔤 聽字母名字（裝置語音）</button></div>
        <div class="teach-card"><b>② 聲音</b><p class="nv-big">${pic(Novice.word("cat"))}</p><p>念 cat 的時候，不是把三個字母的名字念出來。</p><button type="button" class="demo" data-say="cat">🔊 聽整字 cat（錄音）</button></div>
        <div class="teach-card"><b>③ KK 音標</b><p class="qz-kk big">[kæt]</p><p>KK 記的是<b>聲音</b>：cat 有三個音 /k/ /æ/ /t/。</p></div></div>
        <p class="dlg-zh">所以：字母 c 的名字是 see，但在 cat 裡，它發的是 <b class="qz-sym">/k/</b> 的聲音。接下來一次學一個音。</p>`, "▶ 我懂了，學第一個音");
      NV.step = "k";
      save();
    }
    for (const sym of ["k", "æ"]) {
      if (NV.step !== sym) continue;
      await nvPanel(soundCardHTML(sym), "▶ 我聽好了");
      if (!NV.taught.includes(sym)) NV.taught.push(sym);
      NV.step = sym === "k" ? "æ" : "check1";
      save();
      if (!(await nvStepDone(`/${sym}/`))) return finishSummary("音之新手村・cat", "回來找村長 Kai 會接著上。");
    }
    if (NV.step === "check1") {
      await Talk.line("Listen, then choose.", "來試試看：<b>先聽一個字，再選它的音</b>。不限時；選錯不會公布答案，可以再聽再選。");
      if (!(await nvCheck(["k", "æ"], "辨認 /k/ /æ/"))) return finishSummary("音之新手村・cat", "還有音要再認一次。回來找 Kai 會接著練。");
      NV.step = "t";
      save();
      if (!(await nvStepDone("辨認 /k/ /æ/"))) return finishSummary("音之新手村・cat", "回來找村長 Kai 會接著上。");
    }
    if (NV.step === "t") {
      await nvPanel(soundCardHTML("t"), "▶ 我聽好了");
      if (!NV.taught.includes("t")) NV.taught.push("t");
      NV.step = "check2";
      save();
    }
    if (NV.step === "check2") {
      if (!(await nvCheck(["k", "æ", "t"], "辨認 /k/ /æ/ /t/"))) return finishSummary("音之新手村・cat", "還有音要再認一次。回來找 Kai 會接著練。");
      NV.step = "build";
      save();
      if (!(await nvStepDone("辨認 /k/ /æ/ /t/"))) return finishSummary("音之新手村・cat", "回來找村長 Kai 會接著上。");
    }
    if (NV.step === "build") {
      await Talk.line("", "最後，把三個音接起來：<b>看圖組音標</b>。");
      await nvBuild("cat");
      NV.step = "done";
      NV.n01 = true;
      NV.lv = Math.max(NV.lv, 2);
      save();
      addXP(15);
      toast("🐱", "第一個字 cat 完成", "冒險 Lv.2 · 回聲原野出現了回音泡泡", "levelup");
      await finishSummary("音之新手村・N01 cat", "下一步：到回聲原野，用 /k/ /æ/ /t/ 打倒一隻回音泡泡。Echo 可以隨時查音和查字。");
      afterTalk = mount; // field monsters appear now that sounds are taught
    }
  }
  /* ---------- N02 聲音小路 /m n s f/ (子音老師 Cody) ---------- */
  const N02_STEPS = ["intro", "mn", "check-mn", "sf", "check-sf", "match", "build", "done"];
  /* Spelling ↔ sound matching: tap a spelling, then its sound. ph and f both go to /f/. First tries are recorded. */
  function nvMatch(pairs) {
    Novice.lastMatch = pairs; // test hook only: never rendered
    return new Promise((res) => {
      const left = pairs.slice().sort(() => Math.random() - 0.5),
        sounds = [...new Set(pairs.map((p) => p[1]))].sort(() => Math.random() - 0.5),
        done = new Set(),
        missed = new Set();
      let pick = null;
      const paint = (fb) => {
        $("dlg-body").innerHTML = `<p class="dlg-zh">配對：先點左邊的<b>字母／字母組合</b>，再點右邊它發的<b>聲音</b>。同一個聲音可以有不同拼法。</p>
          <div class="nv-match"><div>${left.map((p, i) => `<button type="button" class="nv-sp ${done.has(i) ? "good" : pick === i ? "sel" : ""}" data-l="${i}" ${done.has(i) ? "disabled" : ""}>${esc(p[0])}${done.has(i) ? `<small>${esc(p[2])}</small>` : ""}</button>`).join("")}</div>
          <div>${sounds.map((x) => `<button type="button" class="nv-sd" data-s="${esc(x)}">/${esc(x)}/</button>`).join("")}</div></div>
          <div class="qz-f" role="status">${fb || ""}</div><p class="fine">配對成功會播放含有這個拼法的例字（整字錄音）。</p>`;
        $("dlg-body").querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => ((pick = +b.dataset.l), paint())));
        $("dlg-body").querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => {
          if (pick == null) return paint("<small>先點左邊的拼法。</small>");
          const p = left[pick];
          if (p[1] === b.dataset.s) {
            done.add(pick);
            nvRec(p[1], missed.has(pick) ? "retry" : "ind", { cat: "spell", key: `${p[0]}|${p[1]}|${p[2]}` });
            const w = Novice.word(p[2]);
            if (w) speak(w.w, w.au);
            SND.play("correct");
            pick = null;
            if (done.size === left.length) {
              save();
              return res({ missed: missed.size });
            }
            return paint(`<b class="good">✓ ${esc(p[0])} → /${esc(p[1])}/</b>（${esc(p[2])}）`);
          }
          missed.add(pick);
          SND.play("wrong");
          paint(`<b class="bad">✕ ${esc(p[0])} 不是發 /${esc(b.dataset.s)}/</b><small>想想例字裡它怎麼念，再試一次。</small>`);
        }));
      };
      paint();
    });
  }
  /* One runner for the consonant chapters taught by Cody. Steps are saved as they finish, so a chapter
     resumes where it stopped. N02 keeps its original save fields (n02step / n02) for existing saves. */
  const CHAPTER_RUN = {
    N02: {
      title: "N02 聲音小路",
      intro: ["Let's learn four new sounds!", "N02 聲音小路：這一章學 4 個子音 <b>/m/ /n/ /s/ /f/</b>，一次兩個。學過的 /k/ /æ/ /t/ 也會一起出現。"],
      groups: [{ sounds: ["m", "n"], card: "mn", check: "check-mn" }, { sounds: ["s", "f"], card: "sf", check: "check-sf" }],
      matchLine: "拼字和聲音不是一對一：<b>f</b> 和 <b>ph</b> 都念 /f/。來配對看看。",
      buildLine: "最後：<b>看圖，補上學過的音</b>。還沒教的音會先幫你放好（灰色），只考學過的。",
      builds: ["sun", "phone"], fallback: ["moon", "map"],
      get: () => NV.n02step || "intro", set: (x) => (NV.n02step = x),
      finish: () => (NV.n02 = true),
      toast: ["🛤️", "N02 聲音小路完成", "回聲原野：7 個音的戰鬥"],
      next: "下一步：到回聲原野，用 7 個學過的音打倒一隻回音泡泡。",
    },
    N03: {
      title: "N03 子音工具箱",
      intro: ["Six more sounds, two at a time!", "N03 子音工具箱：這一章學 6 個子音 <b>/p/ /b/ /d/ /g/ /h/ /l/</b>，一次兩個。/p/ 和 /b/、/t/ 和 /d/、/k/ 和 /g/ 嘴形一樣，差在喉嚨有沒有振動。"],
      groups: [{ sounds: ["p", "b"], card: "pb", check: "check-pb" }, { sounds: ["d", "g"], card: "dg", check: "check-dg" }, { sounds: ["h", "l"], card: "hl", check: "check-hl" }],
      matchLine: "配對：同一個聲音可能有兩種寫法，<b>p</b> 和 <b>pp</b>、<b>l</b> 和 <b>ll</b>。",
      buildLine: "最後：<b>看圖，用學過的音組出整個字</b>。每個音你都學過了，沒有先放好的格子。要有<b>兩個不同的字，各自第一次送出就組對</b>才算完成。",
      // A-N03-02: full builds only (every sound taught, no slot given); two different words, each right on its
      // first submit. Passed words are saved, so leaving or reloading cannot skip the requirement.
      full: { need: 2, words: ["map", "hat", "cat"] },
      get: () => (NV.ch.N03 && NV.ch.N03.step) || "intro", set: (x) => (NV.ch.N03 = { ...(NV.ch.N03 || {}), step: x }),
      state: () => NV.ch.N03 || {}, saveState: (x) => ((NV.ch.N03 = { ...(NV.ch.N03 || {}), ...x }), save()),
      finish: () => (NV.ch.N03 = { ...(NV.ch.N03 || {}), done: true }),
      toast: ["🧰", "N03 子音工具箱完成", "回聲原野：13 個音的戰鬥"],
      next: "下一步：到回聲原野，用 13 個學過的音打倒一隻回音泡泡。",
    },
  };
  async function runChapter(id) {
    const C = CHAPTER_RUN[id],
      step = C.get,
      go = (x) => (C.set(x), save()),
      label = "音之新手村・" + C.title,
      who = TEACHER[C.teacher || "consonant"],
      rest = () => finishSummary(label, `回來找${who}會接著上。`);
    if (step() === "intro") {
      await Talk.line(C.intro[0], C.intro[1]);
      go(C.groups[0].card);
    }
    for (let g = 0; g < C.groups.length; g++) {
      const { sounds, card, check } = C.groups[g],
        after = g + 1 < C.groups.length ? C.groups[g + 1].card : "match";
      if (step() === card) {
        for (const sym of sounds) {
          await nvPanel(soundCardHTML(sym), "▶ 我聽好了");
          if (!NV.taught.includes(sym)) NV.taught.push(sym);
          save();
        }
        go(check);
      }
      if (step() === check) {
        const names = sounds.map((x) => `/${x}/`).join(" 和 ");
        await Talk.line("Listen, then choose.", `先聽一個字，選出它的音。這次的重點是 <b>${names}</b>。不限時；選錯不會公布答案。`);
        if (!(await nvCheck(sounds, `辨認 ${names}`))) return finishSummary(label, `還有音要再認一次。回來找${who}會接著練。`);
        go(after);
        if (!(await nvStepDone(`辨認 ${names}`))) return rest();
      }
    }
    if (step() === "match") {
      await Talk.line("", C.matchLine);
      await nvMatch(Novice.MATCH[id]);
      go("build");
      if (!(await nvStepDone("字母組合配對"))) return rest();
    }
    if (step() === "build" && C.full) {
      await Talk.line("", C.buildLine);
      const st = C.state(),
        got = new Set(st.full || []),
        // a word only counts when every one of its sounds has been taught (nothing pre-placed)
        pool = (typeof C.full.words === "function" ? C.full.words() : C.full.words).filter((w) => Novice.kkSounds(Novice.word(w).kk).every((x) => NV.taught.includes(x)));
      // N04+: the counted words must also cover at least two different new sounds of the chapter (not two /ɪ/ words)
      const cover = C.full.cover || [],
        needCover = Math.min(2, cover.length),
        newIn = (w) => Novice.kkSounds(Novice.word(w).kk).filter((x) => cover.includes(x)),
        covered = () => new Set([...got].flatMap(newIn)),
        ok = () => got.size >= C.full.need && covered().size >= needCover,
        tried = new Set();
      while (!ok()) {
        const left = pool.filter((w) => !got.has(w) && !tried.has(w)),
          // while coverage is short, only a word with an uncovered new sound can help
          w = covered().size < needCover ? left.find((w) => newIn(w).some((x) => !covered().has(x))) : left[0];
        if (!w) break;
        tried.add(w);
        const r = await nvBuild(w);
        if (!r.tries) {
          got.add(w);
          C.saveState({ full: [...got] });
        }
      }
      if (!ok()) {
        const done = [...got];
        return finishSummary(label, `完整組音要兩個不同的字各自第一次就組對${needCover > 1 ? `，而且要用到至少兩個不同的新音（${cover.map((x) => `/${x}/`).join(" ")}）` : ""}。${done.length ? `已完成：${done.join("、")}${needCover > 1 ? `（用到 ${[...covered()].map((x) => `/${x}/`).join(" ") || "—"}）` : ""}。` : "這次還沒有字一次組對。"}回來找${who}再試（已完成的字不會再考）。`);
      }
      C.finish();
      go("done");
      addXP(15);
      toast(C.toast[0], C.toast[1], `已教 ${NV.taught.length} / 41 個音 · 回聲原野戰鬥`, "levelup");
      await finishSummary(label, C.next);
      afterTalk = mount; // new monsters may appear
    } else if (step() === "build") {
      await Talk.line("", C.buildLine);
      let independent = 0;
      for (const w of C.builds) {
        const r = await nvBuild(w);
        if (!r.tries) independent++;
      }
      if (!independent) {
        // finishing is not enough: at least one word has to be right on the first try
        await Talk.line("", "兩個字都是重試後才組對的。再練一個字：");
        for (const w of C.fallback) {
          const r = await nvBuild(w);
          if (!r.tries) {
            independent++;
            break;
          }
        }
        if (!independent) return finishSummary(label, "組音還要再練一次。回來找 Cody 會接著練。");
      }
      C.finish();
      go("done");
      addXP(15);
      toast(C.toast[0], C.toast[1], C.toast[2], "levelup");
      await finishSummary(label, C.next);
    }
  }
  // N04–N11 from Novice.PLAN; each chapter keeps its state in nv.ch[id] = { step, done, full, field }
  for (const id of CH_ORDER) {
    const P = Novice.PLAN[id],
      sounds = P.groups.flat();
    CHAPTER_RUN[id] = {
      title: P.title,
      teacher: P.teacher,
      intro: ["Let's learn new sounds!", `<b>${P.title}</b>：${P.line}`],
      groups: P.groups.map((g, i) => ({ sounds: g, card: "c" + i, check: "k" + i })),
      matchLine: "配對：拼字和聲音不是一對一。先點拼法，再點它發的聲音。",
      buildLine: `最後：<b>看圖，用學過的音組出整個字</b>。每個音都學過了，沒有先放好的格子。要有<b>兩個不同的字，各自第一次送出就組對</b>，而且兩個字<b>用到至少兩個不同的新音</b>（${sounds.map((x) => `/${x}/`).join(" ")}）才算完成。`,
      full: { need: 2, cover: sounds, words: () => Novice.fullWords(NV.taught, sounds) },
      get: () => (NV.ch[id] && NV.ch[id].step) || "intro",
      set: (x) => (NV.ch[id] = { ...(NV.ch[id] || {}), step: x }),
      state: () => NV.ch[id] || {},
      saveState: (x) => ((NV.ch[id] = { ...(NV.ch[id] || {}), ...x }), save()),
      finish: () => (NV.ch[id] = { ...(NV.ch[id] || {}), done: true }),
      toast: ["🔤", `${P.title}完成`, `已教 ${NV.taught.length} 個音 · 回聲原野戰鬥`],
      next: "下一步：到回聲原野，用學過的音打倒一隻怪物。",
    };
  }
  const noviceN02 = () => runChapter("N02");
  const noviceN03 = () => runChapter("N03");
  const n03done = () => !!(NV.ch.N03 && NV.ch.N03.done);

  /* ---------- 新手村夥伴：修好聲音徽章（after the N06 field battle） ---------- */
  const LUMI_FRAGMENTS = ["map", "book", "cake"];
  async function lumiQuest(e) {
    if (C.claimed) return Talk.line("Let's go!", "露米：「我們一起出發吧！」");
    if (data.at === "wind") return lumiInvite(e);
    if (NV.lumi.length < LUMI_FRAGMENTS.length) {
      await Talk.line("Can you help me?", "一隻小小的<b>風之小精靈</b>：「我叫<b>露米</b>。我的聲音徽章碎成三片了……每一片是一個字，你能用學過的音把它們組回來嗎？」");
      for (const w of LUMI_FRAGMENTS) {
        if (NV.lumi.includes(w)) continue;
        await Talk.line("", `第 ${NV.lumi.length + 1} 片碎片：看圖，把這個字的聲音組回來（可以重試）。`);
        await nvBuild(w);
        NV.lumi.push(w);
        save();
      }
      toast("✨", "聲音徽章修好了", "露米的聲音回來了", "badge");
      await Talk.line("Thank you! My voice is back!", "露米：「我的聲音回來了！謝謝你！」");
    }
    await lumiInvite(e, "village");
    if (C.claimed && data.at === "kk") afterTalk = mount;
  }

  /* ---------- N12 音節與重音（重音老師 Stella）: listen first, the KK only after answering ---------- */
  async function runN12() {
    const st = (NV.ch.N12 = { ...(NV.ch.N12 || {}) });
    if (!st.step) {
      await Talk.line("Where is the stress?", "<b>N12 音節與重音</b>：41 個音都學過了，現在聽一個字有幾個「拍子」（音節），哪一拍最重。");
      await nvPanel(`<div class="nv-card"><p><b>音節不是字母數</b>：banana 有 6 個字母、3 個音節；apple 有 5 個字母、2 個音節。</p>
        <p><b>ˋ</b> 寫在<b>主重音</b>音節的前面：banana [bəˋnænə] 重音在第 2 個音節；apple [ˋæpḷ] 在第 1 個。<b>ˏ</b> 是次重音，比較輕：suitcase [ˋsutˏkes]。</p>
        <p>不重讀的音節常常變成弱母音 /ə/（banana 頭尾的 a）。apple 的 [ḷ] 是「成音節的 l」：沒有母音也算一拍。</p>
        <div class="teach-demo">${exampleBtn("banana", "")}${exampleBtn("apple", "")}${exampleBtn("tiger", "")}</div></div>`, "▶ 開始練習");
      st.step = "check";
      save();
    }
    if (st.step === "check") {
      let first = 0,
        three = false,
        asked = 0,
        last = "";
      while ((first < 3 || !three) && asked < 12) {
        const q = Novice.stressQuestion({ avoid: last, syl: asked % 3 === 2 ? 3 : null });
        last = q.wordId;
        $("dlg-name").dataset.step = `重音：首次答對 ${first}/3`;
        const r = await Talk.quiz(q);
        asked++;
        nvRec("ˋ", r.tries ? "retry" : "ind", q);
        if (!r.tries) {
          first++;
          if (q.options.length >= 3) three = true;
        }
      }
      delete $("dlg-name").dataset.step;
      save();
      if (first < 3 || !three) return finishSummary("音之新手村・N12 音節與重音", "需要 3 題第一次就答對（至少一題是三個音節的字）。回來找 Stella 再練。");
      st.step = "second";
      save();
      if (!(await nvStepDone("主重音"))) return;
    }
    if (st.step === "second") {
      await nvPanel(`<div class="nv-card"><p><b>次重音 ˏ</b>：長一點的字常有兩個比較用力的音節。最響的是<b>主重音 ˋ</b>，另一個比較輕的是<b>次重音 ˏ</b>。</p>
        <p>suitcase [ˋsutˏkes]：suit 最響，case 第二。pineapple [ˋpaɪnˏæpḷ]：pine 最響，ap 第二。</p>
        <div class="teach-demo">${exampleBtn("suitcase", "")}${exampleBtn("pineapple", "")}${exampleBtn("rainbow", "")}</div></div>`, "▶ 開始練習");
      let first = 0,
        asked = 0,
        last = "";
      while (first < 2 && asked < 8) {
        const q = Novice.secondaryQuestion({ avoid: last });
        last = q.wordId;
        $("dlg-name").dataset.step = `次重音：首次答對 ${first}/2`;
        const r = await Talk.quiz(q);
        asked++;
        nvRec("ˋ", r.tries ? "retry" : "ind", q);
        if (!r.tries) first++;
      }
      delete $("dlg-name").dataset.step;
      save();
      if (first < 2) return finishSummary("音之新手村・N12 次重音", "次重音要 2 題第一次就答對。回來找 Stella 會從次重音接著練。");
      st.step = "magic";
      save();
      if (!(await nvStepDone("次重音"))) return;
    }
    if (st.step === "magic") {
      await nvPanel(`<div class="nv-card"><p><b>Magic E（字尾不發音的 e）</b>：母音＋子音＋e 的字，e 自己<b>不發音</b>，常常讓前面的母音念成<b>字母本身的名字</b>：cat /æ/ → cake /e/、kit → kite /aɪ/。</p>
        <p><b>不是每個字都這樣</b>：have [hæv]、give [gɪv] 的 e 也不發音，但母音沒有變長。看到 e 結尾先想到這個規律，再用耳朵確認。</p>
        <div class="teach-demo">${exampleBtn("cat", "æ")}${exampleBtn("cake", "e")}${exampleBtn("bike", "aɪ")}${exampleBtn("phone", "o")}</div></div>`, "▶ 開始配對");
      await Talk.line("", "配對：同一個字母，有沒有 Magic E，聲音不一樣。");
      await nvMatch(Novice.N12_MATCH.magic);
      // then split and rebuild a Magic E word (all of its sounds taught): one has to be right on the first try
      let ok = false;
      for (const w of shuffle(["grape", "cake", "bike", "phone"]).slice(0, 3)) {
        const r = await nvBuild(w);
        if (!r.tries) {
          ok = true;
          break;
        }
      }
      if (!ok) return finishSummary("音之新手村・Magic E", "Magic E 的字要有一個第一次就組對。回來找 Stella 會從 Magic E 接著練。");
      st.step = "cg";
      save();
      if (!(await nvStepDone("Magic E"))) return;
    }
    if (st.step === "cg") {
      await nvPanel(`<div class="nv-card"><p><b>軟硬 C／G</b>：c 和 g 後面接 <b>e、i、y</b> 時，常常念軟音 c→/s/（city、rice）、g→/dʒ/（page、bridge）；其他時候多半是硬音 c→/k/（cat）、g→/g/（gift）。</p>
        <p><b>例外</b>：get [gɛt]、give [gɪv]、girl [gɝl] 的 g 後面雖然是 e、i，還是硬音。規律幫你猜，聽才是準的。</p>
        <p class="fine">city、rice、page 目前沒有正式錄音，用裝置語音念整個字。</p>
        <div class="teach-demo">${exampleBtn("cat", "k")}${exampleBtn("city", "s")}${exampleBtn("gift", "g")}${exampleBtn("page", "dʒ")}</div></div>`, "▶ 開始配對");
      await Talk.line("", "配對：先點拼法（括號是例字），再點它在這個字裡的聲音。");
      await nvMatch(Novice.N12_MATCH.cg);
      st.done = true;
      st.step = "done";
      save();
      addXP(15);
      toast("🥁", "N12 音節與重音完成", "下一步：找村長 Kai 拿三枚印記", "levelup");
      await finishSummary("音之新手村・N12 音節、重音與拼字規律", "主重音、次重音、Magic E、軟硬 C／G 都完成了。下一步：找村長 Kai，完成 N13 組音實戰的三枚印記。");
      afterTalk = mount;
    }
  }

  /* ---------- N13 組音實戰：三枚印記（村長 Kai） ---------- */
  async function seals() {
    const S = (NV.ch.seals = { ...(NV.ch.seals || {}) });
    const v = await Talk.choose("N13 組音實戰：三枚印記都拿到，才能挑戰失音魔王。", [
      { label: `${S.sound ? "✅" : "🎧"} 辨音印記`, value: "sound", sub: "10 題聽音選音標，第一次答對 8 題", disabled: S.sound },
      { label: `${S.build ? "✅" : "🧩"} 組音印記`, value: "build", sub: `三個不同的完整字各自一次組對（已完成 ${(S.buildWords || []).length}/3）`, disabled: S.build },
      { label: `${S.rhythm ? "✅" : "🥁"} 節奏印記`, value: "rhythm", sub: "6 題重音，第一次答對 5 題", disabled: S.rhythm },
      { label: "稍後再來", value: "bye" },
    ]);
    if (v === "sound") {
      let first = 0,
        last = "";
      const all = Novice.ALL41(),
        vowels = shuffle(all.filter((x) => Novice.VOWELS.includes(x))),
        cons = shuffle(all.filter((x) => !Novice.VOWELS.includes(x)));
      for (let i = 0; i < 10; i++) {
        const q = Novice.soundQuestion(all, { target: (i % 2 ? vowels : cons)[Math.floor(i / 2)], avoid: last, ctx: "seal" }) || Novice.soundQuestion(all, { avoid: last, ctx: "seal" });
        last = q.wordId;
        $("dlg-name").dataset.step = `辨音印記 ${i + 1}/10（首次答對 ${first}）`;
        const r = await Talk.quiz(q);
        nvRec(q.targetSound, r.tries ? "retry" : "ind", q);
        if (!r.tries) first++;
      }
      delete $("dlg-name").dataset.step;
      if (first >= 8) (S.sound = true), toast("🎧", "辨音印記", `首次答對 ${first}/10`, "badge");
      save();
      await finishSummary("N13・辨音印記", first >= 8 ? `拿到辨音印記（首次答對 ${first}/10）。` : `首次答對 ${first}/10，需要 8。再挑戰一次。`);
    }
    if (v === "build") {
      S.buildWords = S.buildWords || [];
      const pool = shuffle(Novice.fullWords(Novice.ALL41()).filter((w) => !S.buildWords.includes(w) && Novice.kkSounds(Novice.word(w).kk).length >= 3)).slice(0, 4);
      for (const w of pool) {
        if (S.buildWords.length >= 3) break;
        const r = await nvBuild(w);
        if (!r.tries) S.buildWords.push(w);
        save();
      }
      if (S.buildWords.length >= 3) (S.build = true), toast("🧩", "組音印記", S.buildWords.join("、"), "badge");
      save();
      await finishSummary("N13・組音印記", S.build ? `拿到組音印記：${S.buildWords.join("、")}。` : `已一次組對 ${S.buildWords.length}/3 個字。再來挑戰剩下的。`);
    }
    if (v === "rhythm") {
      let first = 0,
        last = "";
      for (let i = 0; i < 6; i++) {
        const q = Novice.stressQuestion({ avoid: last, ctx: "seal" });
        last = q.wordId;
        $("dlg-name").dataset.step = `節奏印記 ${i + 1}/6（首次答對 ${first}）`;
        const r = await Talk.quiz(q);
        nvRec("ˋ", r.tries ? "retry" : "ind", q);
        if (!r.tries) first++;
      }
      delete $("dlg-name").dataset.step;
      if (first >= 5) (S.rhythm = true), toast("🥁", "節奏印記", `首次答對 ${first}/6`, "badge");
      save();
      await finishSummary("N13・節奏印記", first >= 5 ? `拿到節奏印記（首次答對 ${first}/6）。` : `首次答對 ${first}/6，需要 5。再挑戰一次。`);
    }
    if (sealsDone() && NV.lv < 10) {
      NV.lv = 10;
      save();
      toast("🏅", "三枚印記到齊 · 冒險 Lv.10", C.claimed ? "失音魔王出現在村口" : "還要找露米一起去", "levelup");
      afterTalk = mount;
    }
  }

  /* ---------- 失音魔王：three seals × 10 questions, saved per seal ---------- */
  const BOSS_PAIRS = [["i", "ɪ"], ["ɛ", "æ"], ["ɑ", "ʌ"], ["u", "ʊ"], ["s", "z"], ["f", "v"], ["θ", "ð"], ["ʃ", "ʒ"], ["tʃ", "dʒ"], ["l", "r"], ["n", "ŋ"], ["p", "b"], ["t", "d"], ["k", "g"], ["ɝ", "ɚ"], ["e", "ɛ"], ["o", "ɔ"], ["aɪ", "ɔɪ"]];
  function bossFight(mob) {
    const phase = NV.boss.phase || 0,
      all = Novice.ALL41();
    let last = "",
      i = 0;
    const vowels = shuffle(all.filter((x) => Novice.VOWELS.includes(x))),
      cons = shuffle(all.filter((x) => !Novice.VOWELS.includes(x))),
      pairs = shuffle(BOSS_PAIRS.slice());
    const make = () => {
      let q = null;
      for (let t = 0; t < 8 && !q; t++) {
        if (phase === 0) q = Novice.soundQuestion(all, { target: (i % 2 ? vowels : cons)[Math.floor(i / 2) % 20], avoid: last, ctx: "boss" });
        else if (phase === 1) {
          const [a, b] = pairs[i % pairs.length],
            [x, y] = Math.random() < 0.5 ? [a, b] : [b, a];
          q = Novice.soundQuestion(all, { target: x, partnerOnly: y, avoid: last, ctx: "boss" });
        } else q = Novice.kkQuestion({ avoid: last });
        if (!q) i++;
      }
      q = q || Novice.soundQuestion(all, { avoid: last, ctx: "boss" });
      last = q.wordId;
      i++;
      return q;
    };
    Battle.start({ ...mob, look: { ...SILENCE_BOSS, hp: 40 }, maxHp: 40 }, {
      region: "kk",
      intro: `失音魔王偷走了村子的聲音！第 ${phase + 1} 個封印：${BOSS_PHASES[phase]}。10 題中第一次答對 6 題就能鎖上封印；HP 打光也要答完 10 題。`,
      quota: { n: 10, need: 6, label: `第 ${phase + 1}/3 封印・${BOSS_PHASES[phase]}` },
      make,
      companion: buddyCtx(),
      onSettle: (q, kind) => (nvRec(q.targetSound, kind === "right" ? (q.assisted ? "assist" : "ind") : kind, q), save()),
      onAssist: (q) => (nvRec(q.targetSound, "assist", q), save()),
      async onEnd(result) {
        NV.boss.tries = (NV.boss.tries || 0) + 1;
        if (result === "win") {
          NV.boss.phase = phase + 1;
          save();
          if (NV.boss.phase >= 3) {
            World.defeat(mob);
            return graduate();
          }
          toast("🔒", `${BOSS_PHASES[phase]}完成`, `下一個封印：${BOSS_PHASES[phase + 1]}（已存檔）`, "badge");
        } else if (result === "down") World.knockout();
        else World.calm(3);
        save();
        refresh();
      },
    });
  }
  async function graduate() {
    NV.grad = true;
    data.kk.done = true;
    save();
    World.refresh();
    addXP(30);
    toast("🎓", "新手村畢業：旅人證", "傳送門已啟動 · 正式複習已開放", "levelup");
    Talk.show(World.npc("word"));
    try {
      await Talk.line("You did it!", "三個封印都鎖上了，村子的聲音回來了！這是你的<b>旅人證</b>。村口的傳送門已啟動；想複習時，找任何一位老師都能開「正式複習」。");
    } finally {
      Talk.close();
    }
    refresh();
  }

  /* ---------- 正式複習（畢業後）: first wrong / retry / timeout / assisted sounds first, new words each time ---------- */
  /* Formal review (after graduation only): four kinds, each starting from the player's own misses, retries,
     timeouts and companion fixes (nv.rec per sound, nv.wrec per word / spelling). Not a memory card game. */
  const missScore = (r) => 2 * (r.wrong || 0) + (r.retry || 0) + (r.timeout || 0) + 2 * (r.assist || 0);
  const ranked = (o) => Object.entries(obj(o)).map(([k, r]) => [k, missScore(r)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  async function review() {
    const W = obj(NV.wrec),
      snd = ranked(NV.rec).filter((x) => Novice.ALL41().includes(x)),
      spell = ranked(W.spell).filter((k) => k.split("|").length === 3),
      build = ranked(W.build).filter((w) => Novice.word(w)),
      stress = ranked(W.stress),
      sym = (xs) => xs.slice(0, 4).map((x) => `/${x}/`).join(" "),
      sp = (xs) => xs.slice(0, 3).map((k) => { const [l, x] = k.split("|"); return `${l}→/${x}/`; }).join("、");
    const v = await Talk.choose(`📝 正式複習：從你答錯、重試、超時或夥伴補正過的地方開始。${snd.length ? `目前最需要練的音：${sym(snd)}` : ""}`, [
      { label: "🔤 音標：聽字選音（10 題）", value: "snd", sub: snd.length ? `最需要練：${sym(snd)}` : "目前沒有需要複習的音", disabled: !snd.length },
      { label: "🔡 拼字：拼法配聲音", value: "spell", sub: spell.length ? `曾配錯：${sp(spell)}` : "配對都一次就對", disabled: !spell.length },
      { label: "🧩 組音：看圖組整個字", value: "build", sub: build.length ? `曾重試：${build.slice(0, 4).join("、")}` : "組音都一次就對", disabled: !build.length },
      { label: "🥁 重音：聽字選重讀音節（6 題）", value: "stress", sub: stress.length || missScore(obj(NV.rec["ˋ"])) ? `曾答錯或重試 ${stress.length || 1} 個字` : "重音都一次就對", disabled: !(stress.length || missScore(obj(NV.rec["ˋ"]))) },
      { label: "稍後再來", value: "bye" },
    ]);
    if (v === "bye" || !v) return;
    const res = { ind: 0, retry: 0 };
    let last = "";
    if (v === "snd" || v === "stress") {
      const n = v === "snd" ? 10 : 6,
        targets = snd.slice(0, 5);
      for (let i = 0; i < n; i++) {
        const q = v === "snd" ? Novice.soundQuestion(Novice.ALL41(), { target: targets[i % targets.length], avoid: last, ctx: "review" }) : Novice.stressQuestion({ avoid: last, ctx: "review" });
        if (!q) continue;
        last = q.wordId;
        $("dlg-name").dataset.step = `正式複習 ${i + 1}/${n}`;
        const r = await Talk.quiz(q);
        res[r.tries ? "retry" : "ind"]++;
        nvRec(v === "snd" ? q.targetSound : "ˋ", r.tries ? "retry" : "ind", q);
      }
    } else if (v === "spell") {
      // the missed spellings plus others from the same matching sets, so there is still something to choose between
      const want = spell.slice(0, 4).map((k) => k.split("|")),
        pairs = want.slice();
      for (const [l, x] of want) {
        const set = Object.values(Novice.MATCH).find((m) => m.some((p) => p[0] === l && p[1] === x)) || [];
        for (const p of set) if (pairs.length < 6 && !pairs.some((q) => q[0] === p[0] && q[1] === p[1])) pairs.push(p);
      }
      const r = await nvMatch(pairs);
      res[r.missed ? "retry" : "ind"]++;
    } else if (v === "build") {
      for (const w of build.slice(0, 3)) {
        const r = await nvBuild(w);
        res[r.tries ? "retry" : "ind"]++;
      }
    }
    delete $("dlg-name").dataset.step;
    NV.reviews = (NV.reviews || 0) + 1;
    save();
    await finishSummary("音之新手村・正式複習", `獨立答對 ${res.ind} 題、重試後答對 ${res.retry} 題。之後的複習會換別的字和位置。`);
  }

  /* Echo: the sound picture-dictionary. Every one of the 41 sounds can be previewed; only taught ones are practised. */
  function pickFrom(html) {
    return new Promise((res) => {
      $("dlg-body").innerHTML = `${html}<div class="dlg-row"><button type="button" class="dlg-next" data-v="">↩ 回上一層</button></div>`;
      $("dlg-body").querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => res(b.dataset.v)));
    });
  }
  async function echo() {
    for (;;) {
      const v = await Talk.choose("我是 <b>Echo</b>，音標圖鑑老師。想查什麼？", [
        { label: "🔤 選一個音：它常出現在哪些字？", value: "snd", sub: "41 個音都能預覽" },
        { label: "📖 選一個字：它是哪些聲音組成的？", value: "word", sub: "只列出人工核對過拆音的字" },
        ...(NV.track === "legacy" && !NV.n01 ? [{ label: "🐱 上新版入門課：cat", value: "unit", sub: "字母、聲音、KK＋/k/ /æ/ /t/" }] : []),
        ...(NV.track === "legacy" && NV.n01 && !NV.n02 ? [{ label: "🛤️ 上新版 N02：/m/ /n/ /s/ /f/", value: "n02", sub: "教學卡、配對、組音" }] : []),
        ...(NV.track === "legacy" && NV.n02 && !n03done() ? [{ label: "🧰 上新版 N03：/p/ /b/ /d/ /g/ /h/ /l/", value: "n03", sub: "教學卡、配對、組音" }] : []),
        ...(() => {
          const next = NV.track === "legacy" && n03done() && CH_ORDER.find((id) => !chDone(id));
          return next ? [{ label: `🔤 上新版 ${Novice.PLAN[next].title}`, value: "ch:" + next, sub: Novice.PLAN[next].groups.flat().map((x) => `/${x}/`).join(" ") }] : [];
        })(),
        ...(NV.grad ? [{ label: "📝 正式複習", value: "review", sub: "從最需要練的音開始" }] : []),
        { label: "再見", value: "bye" },
      ]);
      if (v === "bye") return;
      if (v === "unit") return noviceUnit();
      if (v.startsWith("ch:")) return runChapter(v.slice(3));
      if (v === "review") return review();
      if (v === "n03") {
        NV.ch.N03 = NV.ch.N03 || { step: "intro" };
        return noviceN03();
      }
      if (v === "n02") {
        NV.n02step = NV.n02step || "intro";
        return noviceN02();
      }
      if (v === "snd") {
        const grid = (title, list) => `<h4 class="nv-h">${title}</h4><div class="nv-grid">${list.map((x) => `<button type="button" data-v="${esc(x)}" class="${NV.taught.includes(x) ? "taught" : ""}">/${esc(x)}/${NV.taught.includes(x) ? "<small>已學</small>" : ""}</button>`).join("")}</div>`;
        const all = Novice.CHAPTERS.flatMap((c) => c.sounds);
        const sym = await pickFrom(`<p class="dlg-zh">41 個音（17 母音＋24 子音）。已學的音可以練習；其他的先預覽。</p>${grid("母音", all.filter((x) => Novice.VOWELS.includes(x)))}${grid("子音", all.filter((x) => !Novice.VOWELS.includes(x)))}`);
        if (!sym) continue;
        if (Novice.SOUNDS[sym] && NV.taught.includes(sym)) {
          const r = await pickFrom(`${soundCardHTML(sym)}${NV.taught.length >= 2 ? '<div class="dlg-row"><button type="button" class="dlg-next" data-v="practice">🎯 開始練習（3 題，不限時）</button></div>' : '<p class="fine">再學一個音之後就能在這裡練習。</p>'}`);
          if (r === "practice") {
            let last = "";
            for (let i = 0; i < 3; i++) {
              const q = Novice.soundQuestion(NV.taught, { target: i === 1 ? null : sym, avoid: last, ctx: "echo" });
              last = q.wordId;
              const res = await Talk.quiz(q);
              nvRec(q.targetSound, res.tries ? "retry" : "ind", q);
            }
            save();
            await finishSummary(`Echo・/${sym}/ 練習`, "可以再查其他的音或字。");
          }
          continue;
        }
        const ch = Novice.chapterOf(sym);
        await pickFrom(`<div class="nv-card"><p class="dlg-zh"><b class="qz-sym big">/${esc(sym)}/</b>（${Novice.VOWELS.includes(sym) ? "母音" : "子音"}）</p><p>預覽：會在 <b>${esc(ch.id)} ${esc(ch.title)}</b> 教。</p><p>規劃例字：${esc(Novice.PLAN_EXAMPLES[sym] || "")}<small>（發音說明、例字錄音與拆音核對完成後才開放教學與出題）</small></p></div>`);
        continue;
      }
      const w = await pickFrom(`<p class="dlg-zh">選一個字，看它由哪些聲音組成：</p><div class="nv-grid words">${Object.keys(Novice.WORDS_SPLIT).map((x) => `<button type="button" data-v="${esc(x)}">${pic(Novice.word(x))} ${esc(x)}</button>`).join("")}</div>`);
      if (!w) continue;
      const it = Novice.word(w);
      await pickFrom(`<div class="nv-reveal"><span class="nv-pic">${pic(it)}</span><span class="nv-word">${Learn.sayHTML(it.w, it.au)}</span><span class="qz-kk big">${esc(it.kk)}</span>${Novice.breakdownHTML(w)}</div>
        <div class="teach-demo"><button type="button" class="demo" data-say="${esc(w)}">🔊 正常速度（整字錄音）</button><button type="button" class="demo" data-slow="${esc(w)}">🐢 放慢（整字錄音 0.6 倍速）</button><button type="button" class="demo" disabled>單音錄音：尚未提供</button></div><p class="fine">「放慢」只是把整字錄音放慢，不是把單音一個一個接起來。</p>`);
    }
  }
  /* bind data-say / data-slow inside Echo's pages too */
  new MutationObserver(() => {
    const b = $("dlg-body");
    b.querySelectorAll("[data-say]:not([data-bound])").forEach((x) => {
      x.dataset.bound = "1";
      if (!x.onclick && !x.classList.contains("say-s") && !x.classList.contains("say-btn") && !x.classList.contains("qz-hear")) x.onclick = () => {
        const w = Learn.wordBy(x.dataset.say) || Novice.word(x.dataset.say);
        if (w) speak(w.w, w.au);
      };
    });
    b.querySelectorAll("[data-slow]:not([data-bound])").forEach((x) => ((x.dataset.bound = "1"), (x.onclick = () => slowWord(x.dataset.slow))));
  }).observe($("dlg-body"), { childList: true, subtree: true });

  /* End-of-section summary: what was used, what still needs practice, what to do next. */
  async function finishSummary(label, nextText) {
    const s = Learn.flush("quest", label);
    if (!s) return;
    const sounds = s.sounds.length ? `<p>還要多練的音：${s.sounds.map((x) => `<b class="qz-kk">/${esc(x)}/</b>`).join(" ")}（之後的戰鬥和複習會再出現）</p>` : "";
    await Talk.panel(
      `<div class="summary"><h4>📋 ${esc(label)}</h4><p>答對 ${s.ok}/${s.n} 題。</p>${s.good.length ? `<p>這段練到：${s.good.slice(0, 6).map((x) => `<span class="chip-en">${esc(x)}</span>`).join(" ")}</p>` : ""}${s.weak.length ? `<p>待複習：${s.weak.slice(0, 6).map((x) => `<span class="chip-en weak">${esc(x)}</span>`).join(" ")}</p>` : ""}${sounds}<p class="next">${esc(nextText)}</p></div>`,
      "▶ 好",
    );
  }
  async function chief() {
    if (!data.kk.bubble) {
      await Talk.line("You learned all four lessons!", "四堂課都完成了！不過村口有一隻<b>搗蛋音節泡泡</b>，把字典裡的音標弄亂了。");
      await Talk.line("Answer to attack!", "戰鬥時每回合一題：<b>答對就攻擊，答錯或時間到會被攻擊</b>。泡泡有一層「泡泡膜」，第一次答對會先戳破它。教學的前三題時間比較多，也可以切換成不計時的練習模式。");
      data.kk.bubble = true;
      save();
      spawnSpecials();
      status("村口出現了搗蛋音節泡泡！點它開始教學戰鬥。", true);
      return refresh();
    }
    if (!data.kk.battle) return Talk.line("The bubble is near the gate.", "泡泡在村口傳送門附近。答對音標題就能打倒它，再回來找我！");
    if (!kkDone()) {
      data.kk.done = true;
      save();
      World.refresh();
      addXP(20);
      toast("🎓", "KK 新手村畢業", "傳送門已啟動：前往風之旅行群島", "levelup");
      await Talk.line("You are ready to travel!", "你已經會看 KK 音標了。村口東邊的傳送門已經啟動，下一站是<b>風之旅行群島</b>：機場報到、海關、找回行李、飯店，一路用英文闖關！");
      return refresh();
    }
    await Talk.line("Have a nice trip!", "旅途愉快！想複習音標，隨時回來找老師們。");
  }

  /* Wind islands: listen first, then answer. Each stage practises 3–5 target expressions from its scene. */
  const sq = (s, i) => Learn.sceneQuestion(s.cat, s.scene, i, { mode: "listen", ctx: `story:${s.id}` });
  async function windNpc(e) {
    if (e.id === "guide") return guide();
    if (e.id === "lumi") return lumiInvite(e);
    const idx = STAGES.findIndex((s) => s.npc === e.id);
    if (W.done || idx < W.stage) return Talk.line("Thank you!", `這一段已經完成了。${W.done ? "風之旅行故事完成！" : "繼續往下一個目標前進吧。"}`);
    if (idx > W.stage) return Talk.line("Please come back later.", "先完成前面的步驟再過來喔。");
    await ({ checkin, customs, baggage, hotel })[STAGES[idx].id]();
    refresh();
  }
  function targetsHTML(s, idxs) {
    const sc = Learn.scene(s.cat, s.scene);
    if (!sc) return "";
    return `<ul class="targets">${idxs
      .map((i) => sc.items[i])
      .filter(Boolean)
      .map((it) => `<li>${it.q ? `<small>🗣️ ${esc(it.q)}</small>` : ""}<b>${esc(it.en)}</b> <span>${esc(it.zh)}</span></li>`)
      .join("")}</ul>`;
  }
  async function stageOffer(s, idxs) {
    const m = stageMeta(s);
    return Talk.choose(`<b>${s.title}</b> · ${m.level}<br><small>會學：${s.learn}</small><br><small>${s.toeic}</small><details class="qz-cue"><summary>這段要用的 ${idxs.length} 句（可先看）</summary>${targetsHTML(s, idxs)}</details>`, [
      { label: "▶ 開始對話", value: "go", sub: "先聽對方說英文，再選你的回答" },
      { label: "🚗 先用開車模式練這段", value: "drive", sub: `同一批情境（${m.sc ? m.sc.items.length : 0} 句）` },
      { label: "稍後再來", value: "later" },
    ]);
  }
  async function guide() {
    await Talk.line("Welcome to the Wind Islands!", "歡迎來到風之旅行群島！這裡練的是<b>初級旅遊英文</b>：機場報到 → 過橋到海關 → 找回行李 → 飯店入住。每一段會先聽對方說，再選你的回答。");
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
  /* Play the stage's lines in order; a miss gets one retry with the Chinese cue opened. */
  async function stageTalk(s, idxs) {
    let ok = 0;
    for (let k = 0; k < idxs.length; k++) {
      $("dlg-name").dataset.step = `${s.title} ${k + 1}/${idxs.length}`;
      const q = sq(s, idxs[k]);
      q.retryHint = "打開「中文提示」看看對方的意思，再選一次。";
      const r = await Talk.quiz(q, { retry: true });
      if (r.ok) ok++;
    }
    delete $("dlg-name").dataset.step;
    return ok;
  }
  async function stageEnd(s, ok, n, nextText) {
    const pass = ok >= Math.ceil(n * 0.6);
    await finishSummary(`風之旅行・${s.title}`, pass ? nextText : "再練一次這段（可以先用開車模式聽熟），回來找同一位 NPC。");
    return pass;
  }
  async function checkin() {
    const s = STAGES[0],
      v = await stageOffer(s, s.targets);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Good morning! Welcome to Wind Air.", "櫃檯人員 Mia 會用英文問你問題。先聽，再選出最適合的回答。");
    const ok = await stageTalk(s, s.targets);
    const seat = await Talk.choose("最後她問你座位偏好。兩個都是好答案，選你想要的：", [
      { label: "Can I have a window seat?", value: "window", sub: "靠窗", say: "Can I have a window seat?" },
      { label: "Can I have an aisle seat, please?", value: "aisle", sub: "靠走道", say: "Can I have an aisle seat, please?" },
    ]);
    W.seat = seat;
    save();
    if (!(await stageEnd(s, ok, s.targets.length, "下一步：走過東邊的橋，到海關找 Officer Lee。"))) return;
    W.stage = 1;
    save();
    World.refresh();
    addXP(20);
    toast("🎫", "拿到登機證", `${seat === "window" ? "靠窗" : "靠走道"}座位 · 東邊的橋已開放`, "badge");
    await Talk.line(seat === "window" ? "Here is your boarding pass. Enjoy the view!" : "Here is your boarding pass. You have an aisle seat.", "報到完成！飛機起飛……抵達風之群島機場。走過東邊的橋，到海關排隊吧。");
  }
  async function customs() {
    const s = STAGES[1],
      v = await stageOffer(s, [2, 3, 4, 5, 9]);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Next, please. What is the purpose of your visit?", "海關問你來訪的目的。<b>觀光和出差都是正確的回答</b>，你的選擇會改變接下來的問題。");
    const why = await Talk.choose("你要怎麼回答？", [
      { label: "I'm here for sightseeing.", value: "sightseeing", sub: "我是來觀光的", say: "I'm here for sightseeing." },
      { label: "I'm here on business.", value: "business", sub: "我是來出差的", say: "I'm here on business." },
    ]);
    W.purpose = why;
    save();
    await Talk.line(why === "business" ? "On business? Please answer a few more questions." : "Sightseeing? Please answer a few more questions.", "櫃檯後面捲起一陣風……<b>風之守衛</b>出現了！這是「入境考驗」：分三個階段問你<b>來訪目的、住宿、停留天數</b>。答對就削弱守衛，Officer Lee 不是攻擊目標。");
    afterTalk = customsTrial;
  }
  /* Customs boss: three phases by HP, each asking that part of the immigration interview. */
  const CUSTOMS_POOLS = () => [W.purpose === "business" ? [1, 5, 6] : [0, 4, 6], [3, 9], [2, 7]];
  function customsTrial() {
    const s = STAGES[1],
      pools = CUSTOMS_POOLS();
    Battle.start({ look: { ...GUARDIAN }, maxHp: GUARDIAN.hp, story: "customs" }, {
      region: "wind",
      intro: "入境考驗開始！聽守衛的問題，選出你的回答。",
      phases: [
        { until: 0.66, label: "入境考驗 1/3：來訪目的" },
        { until: 0.33, label: "入境考驗 2/3：住宿" },
        { until: -1, label: "入境考驗 3/3：停留天數" },
      ],
      companion: buddyCtx(),
      make: (B) => {
        const pool = pools[B.phaseIdx || 0];
        return Learn.sceneQuestion(s.cat, s.scene, pool[B.turn % pool.length], { mode: "listen", ctx: "story:customs" });
      },
      onEnd: async (result) => {
        if (result === "down") World.knockout();
        if (result !== "win") {
          status("入境考驗還沒通過：可以先用開車模式練海關對話，再找 Officer Lee。", true);
          return refresh();
        }
        W.stage = 2;
        save();
        addXP(20);
        bondUp(4, "一起通過入境考驗");
        toast("🛂", "通過入境考驗", W.purpose === "business" ? "Good luck with your meetings!" : "Enjoy your trip!", "badge");
        const officer = World.npc("officer");
        Talk.show(officer);
        await Talk.line(W.purpose === "business" ? "Welcome. Good luck with your meetings." : "Welcome. Enjoy your trip!", "入境章蓋好了！去南邊的行李轉盤領行李吧，行李服務 Sam 在那裡。");
        Talk.close();
      },
    });
  }
  async function baggage() {
    const s = STAGES[2];
    if (W.bag === "search") return Talk.line("Did you find your bag?", "海鷗往轉盤西邊飛了！點牠就能開戰，把行李箱搶回來。");
    const v = await stageOffer(s, s.targets);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("", "轉盤停了……你的行李箱沒有出現！旁邊好像有一隻海鷗叼著一個黑色行李箱飛走了。");
    if (!C.met) {
      C.met = true;
      save();
    }
    await Talk.line("Hi! I saw it! A gull took your bag!", "一隻小小的<b>風之小精靈</b>從轉盤上飄了下來：「我叫<b>露米</b>！我看到了，是海鷗叼走的！」");
    const how = await Talk.choose("你要怎麼處理？", [
      { label: "🧾 到服務櫃檯用英文申報", value: "desk", sub: `回答 ${s.targets.length} 句，行李會送到飯店` },
      { label: "🏃 自己去追那隻海鷗", value: "search", sub: "戰鬥搶回行李，馬上拿到" },
    ]);
    if (how === "search") {
      W.bag = "search";
      save();
      spawnSpecials();
      status("搗蛋海鷗在轉盤西邊！點牠開始追逐。", true);
      return Talk.line("It flew west. Let's go!", "露米：「牠往西邊飛了！答對就追近一步，答錯牠會飛遠一點。」");
    }
    await Talk.line("Hello. Can I help you?", "Sam 會用英文問你行李的狀況。先聽，再選最適合的回答。");
    const ok = await stageTalk(s, s.targets);
    if (!(await stageEnd(s, ok, s.targets.length, "下一步：走過東邊的橋，到飯店找櫃檯的 Noah。"))) return;
    W.bag = "desk";
    W.stage = 3;
    save();
    World.refresh();
    addXP(20);
    toast("🧳", "行李申報完成", "行李會送到飯店 · 東邊的橋已開放", "badge");
    await Talk.line("We will send it to your hotel tonight.", "Sam 會把行李送到飯店。走過東邊的橋去飯店吧！");
    await lumiInvite();
  }
  async function hotel() {
    const s = STAGES[3],
      v = await stageOffer(s, s.targets);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("Good evening. Welcome to the Sea Breeze Hotel.", "飯店櫃檯 Noah 要幫你辦理入住。先聽，再選回答。");
    const ok = await stageTalk(s, s.targets);
    if (!(await stageEnd(s, ok, s.targets.length, "下一步：故事完成！可以用開車模式複習全部旅遊情境。"))) return;
    if (W.bag === "desk") await Talk.line("Oh, and your suitcase arrived an hour ago.", "對了，機場送來的行李箱一小時前到了！申報行李的英文派上用場了。");
    else await Talk.line("Can I help you with your bag?", "你自己搶回了行李箱，Noah 幫你把它送上樓。");
    W.stage = 4;
    W.done = true;
    save();
    bondUp(4, "一起完成風之旅行");
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
      { label: "📝 時態小任務", value: "grammar", sub: "5 題：看情境選正確的形式" },
      { label: "🧺 補給交換", value: "trade" },
      { label: "稍後再聊", value: "bye" },
    ]);
    if (pick === "trade") return tradeDialog();
    if (pick === "grammar") return grammarQuest(m);
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
    bondUp(4, "一起完成居民任務");
    toast("✨", "居民任務完成！", "首次完成獲得 30 XP", "levelup");
    const i = legacyIdx(m.id);
    if (i < 4 && legacyUnlocked(i + 1)) toast(LEGACY[i + 1].icon, "新地圖解鎖", LEGACY[i + 1].name, "badge");
    await Talk.line("Thank you so much!", `答對 ${ok}/10 題，任務完成！`);
  }
  /* NPC task (teaching first; battles use what was learned later): five grammar form-choice items, from this
     map's topic when there are some. The tense name is never shown before answering. */
  async function grammarQuest(m) {
    await Ability.ready;
    const topic = { food: "food", transport: "travel" }[m.id];
    let items = Ability.grammarItems(topic ? { topic } : {}, 5);
    if (items.length < 5) items = items.concat(Ability.grammarItems({}, 5 - items.length).filter((g) => !items.includes(g)));
    if (!items.length) return Talk.line("", "時態題目還在準備中。");
    await Talk.line("Which one sounds right?", `${esc(m.person || "居民")}：「先看情境和時間線索，再選正確的形式。答完我會告訴你為什麼。」`);
    const first = await quizRound(m.person || "居民", items.map((g) => Ability.grammarQuestion(g, g.ctx)), "時態小任務", `npc:grammar-${m.id}`);
    Talk.show(null);
    await Talk.line("Nice work!", first >= 4 ? "看得很準！之後在戰鬥裡也會遇到這些句型。" : "可以從☰「我的英語能力」看哪些形式要再練。");
    Talk.close();
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

  /* ---------- battles: one question per turn (Battle.start ctx.make) ---------- */
  function buddyCtx() {
    return withLumi() ? { name: "露米", bond: bondLv(), look: lumiLook() } : null;
  }
  function encounter(mob) {
    if (Battle.active || Talk.open || !$("menu").hidden || !$("panel").hidden) return;
    if (mob.story === "thief") return gullChase(mob);
    if (mob.story === "boss") return bossFight(mob);
    const m = cur(),
      region = m.region || m.id,
      look = mob.look.hp ? mob.look : { ...mob.look, hp: mob.maxHp };
    let make,
      tutorial = "";
    if (region === "kk" && look.kind === "stress") {
      let lastWord = "";
      make = () => {
        const q = Novice.stressQuestion({ ctx: "battle", avoid: lastWord });
        lastWord = q.wordId;
        return q;
      };
    } else if (region === "kk" && look.kind === "sound") {
      let lastWord = "";
      make = () => {
        const newest = [...ALL_CH].reverse().find((id) => chDone(id) && id !== "N01") || "";
        const q = Novice.soundQuestion(NV.taught, { ctx: "battle", avoid: lastWord, prefer: newest ? Novice.CHAPTERS.find((c) => c.id === newest).sounds : [] });
        lastWord = q.wordId;
        return q;
      };
    } else if (region === "kk") {
      const taught = taughtUnits();
      make = (B) => (B.turn % 3 === 0 ? Learn.wordKK("listen", taughtVowels()) : Learn.phonicsQuestion(taught));
      if (mob.story === "tutorial") tutorial = "教學：答對就攻擊，第一次答對會先戳破泡泡膜；答錯或時間到會被攻擊。前三題時間比較多，傷害也比較低。";
    } else if (region === "wind") {
      const s = STAGES[Math.min(W.stage, 3)],
        done = STAGES.slice(0, Math.max(1, Math.min(W.stage + 1, 4))),
        kind = look.kind || "word";
      make =
        kind === "word"
          ? () => Learn.wordQuestion((w) => w.th === "transport", null, "battle")
          : kind === "listen"
            ? () => Learn.sceneQuestion(s.cat, s.scene, null, { mode: "listen", ctx: "battle" })
            : () => {
                const t = done[Math.floor(Math.random() * done.length)];
                return Learn.sceneQuestion(t.cat, t.scene, null, { mode: "listen", ctx: "battle" });
              };
    } else if (typeof WorldRegions !== "undefined" && WorldRegions.has(m.id)) {
      const quest = WorldRegions.next(m.id, data.regions) || m.quests.at(-1);
      make = (b) => { const ref = quest.questionRefs[(b.turn - 1) % quest.questionRefs.length]; return Learn.sceneQuestion(ref.cat, ref.scene, ref.index, {mode:ref.mode,ctx:`region:${m.id}:field`}); };
    } else {
      const route = SENT.some((s) => s.route === m.route && s.lv <= maxLv()) ? m.route : "daily";
      make = (B) => (B.turn % 2 ? Learn.wordQuestion((w) => w.th === m.id, null, "battle") : Learn.sentQuestion((s) => s.route === route, "battle"));
    }
    Battle.start({ ...mob, look }, {
      region,
      make,
      tutorial,
      companion: buddyCtx(),
      onSettle: look.kind === "sound" || look.kind === "stress" ? (q, kind) => (nvRec(q.targetSound, kind === "right" ? (q.assisted ? "assist" : "ind") : kind, q), save()) : null,
      onAssist: (q) => (nvRec(q.targetSound, "assist", q), save()),
      onEnd(result) {
        if (result === "win") {
          World.defeat(mob);
          winBond();
          const pf = look.kind === "sound" && pendingField();
          if (pf) {
            // the field battle that follows each chapter (once): adventure level per PR #9 §10
            if (pf === "N01") NV.field = true;
            else if (pf === "N02") (NV.field2 = true), (NV.lv = Math.max(NV.lv, 3));
            else if (pf === "N03") (NV.field3 = true), (NV.lv = Math.max(NV.lv, 4));
            else (NV.ch[pf] = { ...NV.ch[pf], field: true }), (NV.lv = Math.max(NV.lv, Novice.PLAN[pf].lv));
            save();
            toast("🫧", `${pf} 原野戰鬥勝利`, `冒險 Lv.${NV.lv} · ${objective().short}`, "badge");
            if (pf === "N06" && lumiWaiting() && !World.npc("lumi")) mount(); // Lumi appears in the village now
          }
          if (mob.story === "tutorial") {
            data.kk.battle = true;
            save();
            toast("🫧", "教學戰鬥勝利", "回去找村長 Kai 領畢業證書", "badge");
          }
        } else if (result === "flee") World.calm(3);
        else if (result === "down") World.knockout();
        refresh();
      },
    });
  }
  /* Gull chase: right answers close the gap, wrong ones let it fly further. No damage either way. */
  function gullChase(mob) {
    const s = STAGES[2];
    Battle.start({ ...mob, look: { ...GULL } }, {
      region: "wind",
      intro: "搗蛋海鷗叼著你的行李箱！答對就追近一步，答錯牠會飛遠一點。",
      chase: { start: 3, max: 6 },
      companion: buddyCtx(),
      make: (B) => Learn.sceneQuestion(s.cat, s.scene, (B.turn - 1) % 5, { mode: "listen", ctx: "story:baggage" }),
      async onEnd(result) {
        if (result !== "win") {
          World.calm(3);
          status("海鷗飛遠了。休息一下再點牠追一次。", true);
          return refresh();
        }
        World.defeat(mob);
        W.bag = "found";
        W.stage = 3;
        save();
        World.refresh();
        addXP(20);
        toast("🧳", "搶回行李箱了！", "東邊的橋已開放：前往飯店", "badge");
        Talk.show({ name: "風之小精靈 露米", look: LUMI });
        try {
          await Talk.line("You got your bag back!", "露米：「你拿回行李了！英文好厲害！」");
          await lumiInvite();
        } finally {
          Talk.close();
        }
      },
    });
  }

  /* ---------- companion: 露米 ---------- */
  const lumiWaiting = () => !C.claimed && ((data.at === "wind" && W.stage >= 3) || (data.at === "kk" && NV.track === "v1" && chField("N06")));
  function bondUp(n, why) {
    if (!C.claimed) return;
    const before = bondLv();
    C.bond += n;
    save();
    const after = bondLv();
    if (after > before) {
      const unlock = [...ABILITIES.filter((a) => a.lv === after).map((a) => a.icon + a.name), ...OUTFITS.filter((o) => o.lv === after).map((o) => "👗" + o.name)];
      toast("🧚", `和露米的默契 Lv.${after}`, unlock.length ? "解鎖：" + unlock.join("、") : why, "levelup");
    }
  }
  function winBond() {
    if (!withLumi()) return;
    const d = dayRec();
    if (d.wins >= 5) return;
    d.wins++;
    bondUp(1, "一起打贏");
  }
  /* The invitation after the find-luggage stage (both endings), or later from the carousel. */
  async function lumiInvite(npc, place) {
    if (C.claimed) return;
    if (place === "village") await Talk.line("Can I come with you?", "露米：「我可以跟你一起冒險嗎？我會在戰鬥裡幫你——但答案要你自己選喔。」");
    else if (npc) await Talk.line("Hi again! Can I travel with you?", "露米在轉盤旁邊等你：「我可以跟你一起旅行嗎？」");
    else await Talk.line("Can I travel with you?", "露米飄到你身邊：「你好厲害！我可以跟你一起旅行嗎？」");
    await Talk.panel(
      `<div class="buddy-card"><p class="dlg-zh"><b>🧚 旅伴・露米</b>：會跟著你冒險、陪你用英文聊天。<b>牠不會替你答題</b>，但會在戰鬥中幫忙：</p><ul class="ability">${ABILITIES.map((a) => `<li>${a.icon} <b>${a.name}</b>${a.lv > 1 ? `（默契 Lv.${a.lv}）` : ""}：${a.desc}</li>`).join("")}</ul><p class="fine">一起聊天和冒險會增加默契，解鎖新台詞、外觀和能力。不用餵食，也不用每天登入照顧。</p></div>`,
      "▶ 繼續",
    );
    const v = await Talk.choose("要邀請露米同行嗎？", [
      { label: "🧚 一起走吧！", value: "yes", sub: "Let's travel together!" },
      { label: "等一下再說", value: "later", sub: place === "village" ? "之後可以回來找牠" : "之後可以回行李轉盤找牠" },
    ]);
    C.met = true;
    if (v !== "yes") {
      save();
      return Talk.line("Okay! I'll wait here.", place === "village" ? "露米：「好呀，我會在這裡等你。」" : "露米：「好呀，我會在行李轉盤這裡等你。」");
    }
    C.claimed = true;
    C.active = true;
    save();
    World.setCompanion(lumiLook());
    const n = World.npc("lumi");
    if (n) World.remove(n);
    toast("🧚", "露米加入了！", "點露米可以聊天、看默契與能力", "badge");
    await Talk.line("Yay! Let's go together!", "露米加入旅伴！在地圖上點牠，或從選單的「🧚 旅伴」就能聊天、看默契和能力。");
    refresh();
  }
  const chatScenes = () => ((typeof SCENES !== "undefined" && SCENES.find((c) => c.id === "companion")) || { scenes: [] }).scenes;
  function buddy() {
    if (Battle.active || Talk.open) return;
    if (!C.claimed) return status(C.met ? "露米在風之群島的行李轉盤等你。" : "完成「找回行李」後會遇到新的旅伴。");
    const lv = bondLv(),
      next = BOND_AT[lv],
      base = BOND_AT[lv - 1],
      d = dayRec(),
      pct = next ? Math.round(((C.bond - base) / (next - base)) * 100) : 100;
    sheet(`<h3>🧚 旅伴・露米</h3><div class="buddy-card"><canvas id="buddy-face" width="72" height="72"></canvas><div><p><b>默契 Lv.${lv}</b> ${next ? `（${C.bond}/${next}）` : "（最高）"}</p><div class="bond"><i style="width:${pct}%"></i></div><p class="fine">聊天（每個話題每天第一次 +3）、一起打贏（每天最多 +5）、完成故事任務（+4）都會增加默契。</p></div></div>
      <h4>聊天話題（每次 3–5 輪）</h4><div class="menu-grid">${chatScenes()
        .map((sc) => `<button data-chat="${esc(sc.id)}">💬<b>${esc(sc.name)}</b><small>${d.chats[sc.id] ? "今天聊過了（可以再聊）" : C.chat[sc.id] ? `聊過 ${C.chat[sc.id]} 次` : "新話題"}</small></button>`)
        .join("")}</div>
      <h4>支援能力</h4><ul class="ability">${ABILITIES.map((a) => `<li class="${a.lv <= lv ? "" : "locked"}">${a.lv <= lv ? a.icon : "🔒"} <b>${a.name}</b>${a.lv > lv ? `（默契 Lv.${a.lv}）` : ""}：${a.desc}</li>`).join("")}</ul>
      <h4>外觀</h4><div class="outfits">${OUTFITS.map((o) => `<button data-outfit="${o.id}" ${o.lv <= lv ? "" : "disabled"} aria-pressed="${(C.outfit || "") === o.id}">${o.lv <= lv ? "" : "🔒 "}${o.name}${o.lv > 1 ? `<small>Lv.${o.lv}</small>` : ""}</button>`).join("")}</div>
      <div class="menu-grid"><button data-buddy="drive">🚗<b>用開車模式練聊天</b><small>聽露米說、用英文回答</small></button><button data-buddy="toggle">${C.active ? "😴<b>讓露米休息</b><small>不跟隨、不參加戰鬥</small>" : "🧚<b>叫露米一起走</b><small>跟隨並在戰鬥中幫忙</small>"}</button></div>`);
    requestAnimationFrame(() => {
      const cv = $("buddy-face");
      if (cv) World.portrait(cv, "pet", lumiLook(), { zoom: 1.2 });
    });
    const body = $("menu-body");
    body.querySelectorAll("[data-chat]").forEach((b) => (b.onclick = () => (closeSheet(), chat(b.dataset.chat))));
    body.querySelectorAll("[data-outfit]").forEach(
      (b) =>
        (b.onclick = () => {
          C.outfit = b.dataset.outfit;
          save();
          if (withLumi()) World.setCompanion(lumiLook());
          buddy();
        }),
    );
    body.querySelector('[data-buddy="toggle"]').onclick = () => {
      C.active = !C.active;
      save();
      World.setCompanion(withLumi() ? lumiLook() : null);
      status(C.active ? "露米回到你身邊了。" : "露米先休息，需要時從選單叫牠。");
      buddy();
    };
    body.querySelector('[data-buddy="drive"]').onclick = () => {
      closeSheet();
      const sc = chatScenes()[0];
      openDriveFrom({ cat: "companion", scene: "", label: "旅伴聊天・全部話題", cid: Learn.contentId("companion", sc ? sc.id : "greet") });
    };
  }
  /* A short friend chat: Lumi asks, you pick a reply. Several replies can be right; an off-topic one gets a gentle fix. */
  async function chat(topic) {
    const sc = Learn.scene("companion", topic);
    if (!sc) return;
    const lv = bondLv(),
      pool = sc.items.map((it, i) => ({ it, i })).filter((x) => !x.it.bond || x.it.bond <= lv),
      n = Math.min(pool.length, 3 + Math.floor(Math.random() * 3)),
      picked = [pool[0], ...shuffle(pool.slice(1)).slice(0, n - 1)].sort((a, b) => a.i - b.i).map((x) => x.it),
      others = chatScenes().filter((x) => x.id !== topic).flatMap((x) => x.items);
    Talk.show({ name: "旅伴 露米", look: lumiLook() });
    let ok = 0;
    try {
      for (let k = 0; k < picked.length; k++) {
        const it = picked[k],
          off = others[Math.floor(Math.random() * others.length)],
          opts = shuffle([{ en: it.en, zh: it.zh, react: it.react, ok: true }, ...(it.alt || []).slice(0, 1).map((a) => ({ ...a, ok: true })), { en: off.en, zh: off.zh, ok: false }]);
        $("dlg-name").dataset.step = `${sc.name} ${k + 1}/${picked.length}`;
        speak(it.q);
        const wait = Talk.choose(
          `<p class="dlg-en">${Learn.sayHTML(it.q)}</p><details class="qz-cue"><summary>中文提示</summary>${esc(it.zh)}</details><p class="dlg-zh">你要怎麼回？（可能不只一個好回答）</p>`,
          opts.map((o, i) => ({ label: esc(o.en), value: i, say: o.en })),
        );
        const pick = opts[await wait],
          q = { kind: "s", recK: "s", item: { en: it.en, zh: it.zh, q: it.q }, ctx: `companion:${topic}` };
        Learn.track(q);
        Learn.grade(q, pick.ok, "quest");
        if (typeof Ability !== "undefined") Ability.log(q, { result: pick.ok ? "correct" : "wrong", qtype: "scene:listen", ctx: `companion:${topic}` });
        if (pick.ok) {
          ok++;
          SND.play("correct");
          await Talk.line(pick.react || "Nice!", `你說：${esc(pick.en)}（${esc(pick.zh)}）`);
        } else {
          SND.play("wrong");
          await Talk.line("Hmm? " + it.q, `這句接不太上喔。可以回答：<b>${esc(it.en)}</b>（${esc(it.zh)}）`);
        }
      }
      delete $("dlg-name").dataset.step;
      const d = dayRec(),
        first = !d.chats[topic];
      d.chats[topic] = true;
      C.chat[topic] = (C.chat[topic] || 0) + 1;
      save();
      if (first) bondUp(3, "一起聊天");
      await finishSummary(`旅伴聊天・${sc.name}`, first ? "默契 +3。也可以用開車模式練同一批對話。" : "今天這個話題的默契已經加過了，練習紀錄照樣保留。");
    } finally {
      delete $("dlg-name").dataset.step;
      Talk.close();
    }
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
    $("hud-more").onclick = () => {
      const open = $("hud-more").getAttribute("aria-expanded") !== "true";
      $("hud-more").setAttribute("aria-expanded", String(open));
      $("hud-tray").hidden = !open;
      paintPrimary();
    };
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
    say: (t) => status(t, true),
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
    matches: (kind, item) => !RPG.active || RPG.active.source !== "atlas" || kind !== "w" || !RPG.active.theme || item.th === RPG.active.theme,
    complete() {},
    render() {
      if (mounted) refresh();
    },
    loadArt: (m) => World.loadArt(m),
  };
})();
