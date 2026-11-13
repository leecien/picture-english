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
    mob: { name: "音節泡泡", shape: "bubble", colors: ["#c9b6ff", "#ffffff"], lv: 1, hp: 26, atk: 3, aggressive: false, shield: { name: "泡泡膜", icon: "🫧" } },
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
    mob: { name: "紙飛鳥", shape: "bird", colors: ["#f6f3ff", "#b9a8ec"], lv: 3, hp: 40, atk: 5, aggressive: false, sprite: "mob-bird", shield: { name: "風之盾", icon: "🌀" } },
  };
  const LEVELS = { 1: "初級", 2: "中級", 3: "高級" };
  const ELEMENTS = { wind: "風", kk: "音", fire: "火", wood: "木", water: "水", earth: "土" };
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
      <button data-m="map">🗺️<b>世界地圖</b><small>${maps.filter((m) => unlocked(m.id)).length}/${maps.length} 區域</small></button>
      <button data-m="journal">📜<b>任務日誌</b><small>${esc(objective().short)}</small></button>
      <button data-m="drive">🚗<b>開車模式</b><small>${ctx ? "練這段：" + esc(ctx.label) : "聽中文、說英文"}</small></button>
      <button data-m="bag">🎒<b>背包</b><small>道具與素材</small></button>
      <button data-m="practice">📚<b>練習與成就</b><small>單字、句子、分級</small></button>
      <button data-m="book">🃏<b>卡冊</b><small>收集的單字卡</small></button>
      <button data-m="log">📈<b>學習紀錄</b><small>每天學了什麼</small></button>
      <button data-m="mic">🎤<b>麥克風檢查</b><small>收不到聲音時用</small></button>
      <button data-m="start">🧭<b>回到入口</b><small>卡住時回到地圖起點</small></button>
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
      <h4>🔤 KK 新手村 ${kkDone() ? "· 已畢業" : ""}</h4>${due.length ? `<p class="fine">需要多練的音：${due.map((x) => `/${esc(x)}/`).join(" ")}（找對應的老師選「練需要加強的音」）</p>` : ""}<ul class="journal">${kkRows}<li class="${data.kk.battle ? "done" : ""}"><b>${data.kk.battle ? "✅" : "⬜"} 教學戰鬥</b><small>用音標魔法打倒村口的音節泡泡</small></li></ul>
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
        paintPrimary();
      },
      guide: () => {
        const o = objective();
        return o.map === data.at && o.npc ? World.npc(o.npc) : data.kk.bubble && !data.kk.battle && data.at === "kk" ? World.entities.find((e) => e.story === "tutorial") : W.bag === "search" && data.at === "wind" ? World.entities.find((e) => e.story === "thief") : null;
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
      World.spawn({ name: "搗蛋音節泡泡", shape: "bubble", colors: ["#ff9fd0", "#ffffff"], lv: 2, hp: 40, atk: 3, shield: { name: "泡泡膜", icon: "🫧" } }, p.x - 3, p.y + 1, { unique: true, story: "tutorial" });
    }
    if (data.at === "wind" && W.stage === 2 && W.bag === "search") {
      const p = findChar("x");
      World.spawn({ name: "搗蛋海鷗", shape: "bird", colors: ["#ffffff", "#9aa3b5"], lv: 4, hp: 46, atk: 5, drop: "feather", shield: { name: "風之盾", icon: "🌀" } }, p.x, p.y, { unique: true, story: "thief" });
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
      await Talk.line("Use phonics magic!", "泡泡有一層「泡泡膜」，普通攻擊只有一半效果。按「🔤 音標魔法」答對音標題就能戳破泡泡膜。第一次施法免費，答錯也能再試一次。");
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
      await Talk.line("You are ready to travel!", "你已經會看 KK 音標了。村口東邊的傳送門已經啟動，下一站是<b>風之旅行群島</b>：機場報到、海關、找回行李、飯店，一路用英文闖關！");
      return refresh();
    }
    await Talk.line("Have a nice trip!", "旅途愉快！想複習音標，隨時回來找老師們。");
  }

  /* Wind islands: listen first, then answer. Each stage practises 3–5 target expressions from its scene. */
  const sq = (s, i) => Learn.sceneQuestion(s.cat, s.scene, i, { mode: "listen", ctx: `story:${s.id}` });
  async function windNpc(e) {
    if (e.id === "guide") return guide();
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
      { label: "Can I have a window seat?", value: "window", sub: "靠窗" },
      { label: "Can I have an aisle seat, please?", value: "aisle", sub: "靠走道" },
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
      { label: "I'm here for sightseeing.", value: "sightseeing", sub: "我是來觀光的" },
      { label: "I'm here on business.", value: "business", sub: "我是來出差的" },
    ]);
    W.purpose = why;
    save();
    // Follow-up questions depend on the answer (indexes into the customs scene, in conversation order).
    const follow = why === "business" ? [5, 2, 9] : [2, 3, 4];
    await Talk.line(why === "business" ? "On business? I have a few more questions." : "Sightseeing, great. Just a few questions.", why === "business" ? "出差的話，海關會多問你的工作。" : "觀光的話，海關會問停留天數和住宿。");
    const ok = await stageTalk(s, follow);
    if (!(await stageEnd(s, ok, follow.length, "下一步：到南邊的行李轉盤，找行李服務 Sam。"))) return;
    W.stage = 2;
    save();
    addXP(20);
    toast("🛂", "通過海關", why === "business" ? "Good luck with your meetings!" : "Enjoy your trip!", "badge");
    await Talk.line(why === "business" ? "Welcome. Good luck with your meetings." : "Welcome. Enjoy your trip!", "入境章蓋好了！去南邊的行李轉盤領行李吧，行李服務 Sam 在那裡。");
  }
  async function baggage() {
    const s = STAGES[2];
    if (W.bag === "search") return Talk.line("Did you find your bag?", "海鷗往轉盤西邊飛了！點牠就能開戰，把行李箱搶回來。");
    const v = await stageOffer(s, s.targets);
    if (v === "drive") return Talk.close(), openDriveFrom(sceneContext());
    if (v !== "go") return;
    await Talk.line("", "轉盤停了……你的行李箱沒有出現！旁邊好像有一隻海鷗叼著一個黑色行李箱飛走了。");
    const how = await Talk.choose("你要怎麼處理？", [
      { label: "🧾 到服務櫃檯用英文申報", value: "desk", sub: `回答 ${s.targets.length} 句，行李會送到飯店` },
      { label: "🏃 自己去追那隻海鷗", value: "search", sub: "戰鬥搶回行李，馬上拿到" },
    ]);
    if (how === "search") {
      W.bag = "search";
      save();
      spawnSpecials();
      status("搗蛋海鷗在轉盤西邊！點牠開始戰鬥。", true);
      return Talk.line("Hey, come back with my bag!", "去追那隻海鷗吧！牠就在轉盤西邊。");
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
      tutorial = "",
      freeCasts = 0;
    if (region === "kk") {
      const taught = taughtUnits();
      skills = [
        { id: "kk", name: "音標魔法", icon: "🔤", mp: 5, kind: "attack", mult: 2.8, retry: true, desc: "2.8 倍傷害，可破泡泡膜", learn: taught.length ? "學過的音標對比" : "整字音標", make: () => Learn.phonicsQuestion(taught) },
        { id: "heal", name: "整字回復", icon: "💚", mp: 6, kind: "heal", heal: 0.4, retry: true, desc: "回復 40% HP", learn: "聽單字選音標", make: () => Learn.wordKK("listen", taughtVowels()) },
      ];
      if (mob.story === "tutorial") {
        freeCasts = 1;
        tutorial = "教學：泡泡膜讓普通攻擊只剩一半。按「🔤 音標魔法」，答對就能戳破泡泡膜！第一次施法免費，答錯可以再試一次。";
      }
    } else if (region === "wind") {
      const s = STAGES[Math.min(W.stage, 3)];
      skills = [
        { id: "talk", name: "旅遊會話", icon: "💬", mp: 6, kind: "attack", mult: 2.4, desc: "2.4 倍傷害，可破風之盾", learn: `${s.title}的對話`, make: () => Learn.sceneQuestion(s.cat, s.scene, null, { mode: "listen", ctx: "battle" }) },
        { id: "word", name: "單字飛彈", icon: "🔤", mp: 4, kind: "attack", mult: 1.8, desc: "1.8 倍傷害", learn: "交通與旅行單字", make: () => Learn.wordQuestion((w) => w.th === "transport", null, "battle") },
        { id: "heal", name: "治癒短句", icon: "💚", mp: 8, kind: "heal", heal: 0.4, desc: "回復 40% HP", learn: "已走過的旅遊情境", make: () => { const done = STAGES.slice(0, Math.max(1, Math.min(W.stage + 1, 4))); const t = done[Math.floor(Math.random() * done.length)]; return Learn.sceneQuestion(t.cat, t.scene, null, { mode: "listen", ctx: "battle" }); } },
      ];
    } else {
      const route = SENT.some((s) => s.route === m.route && s.lv <= maxLv()) ? m.route : "daily";
      skills = [
        { id: "word", name: "單字飛彈", icon: "🔤", mp: 4, kind: "attack", mult: 1.8, desc: "1.8 倍傷害", learn: `${m.name}的主題單字`, make: () => Learn.wordQuestion((w) => w.th === m.id, null, "battle") },
        { id: "sent", name: "句子爆發", icon: "💥", mp: 8, kind: "attack", mult: 2.8, desc: "2.8 倍傷害", learn: "句子填空與翻譯", make: () => Learn.sentQuestion((s) => s.route === route, "battle") },
        { id: "heal", name: "治癒短句", icon: "💚", mp: 8, kind: "heal", heal: 0.4, desc: "回復 40% HP", learn: "句子", make: () => Learn.sentQuestion(null, "battle") },
      ];
    }
    const look = mob.look.hp ? mob.look : { ...mob.look, hp: mob.maxHp };
    Battle.start({ ...mob, look }, {
      region,
      skills,
      tutorial,
      freeCasts,
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
    matches: () => true,
    complete() {},
    render() {
      if (mounted) refresh();
    },
    loadArt: (m) => World.loadArt(m),
  };
})();
