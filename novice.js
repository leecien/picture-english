/* 音之新手村 (docs/NOVICE_VILLAGE_V1.md): curriculum data and question builders.
   First vertical slice: N00 (letters vs sounds vs KK) and N01 (/k æ t/ → cat), the Echo picture-dictionary and
   the first field monster. The other chapters are listed so Echo can preview all 41 sounds, but nothing is
   taught or asked from them yet.
   Rules kept here so every screen follows them:
   - Only sounds that have been TAUGHT can be the target of a question.
   - Word → sound splits are hand-checked (see WORDS_SPLIT); tests/content.cjs checks each one against the
     word bank's KK. Nothing is derived letter by letter.
   - There are no single-sound recordings yet. Buttons say what they really play: the whole-word recording,
     or the whole word slowed down. A KK symbol is never read out by the device voice. */
const Novice = (() => {
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* The 41 sounds in teaching order (chapter → sounds). Examples are the plan's candidates; only words that are
     in the word bank with a recording can be played. */
  const CHAPTERS = [
    { id: "N00", title: "聲音入門：字母、拼字、KK", sounds: [] },
    { id: "N01", title: "第一個字 cat", sounds: ["k", "æ", "t"] },
    { id: "N02", title: "聲音小路", sounds: ["m", "n", "s", "f"] },
    { id: "N03", title: "子音工具箱", sounds: ["p", "b", "d", "g", "h", "l"] },
    { id: "N04", title: "短母音擴充", sounds: ["ɛ", "ɪ", "ɑ", "ʌ"] },
    { id: "N05", title: "圓唇與口形", sounds: ["ʊ", "ɔ"] },
    { id: "N06", title: "常見母音與拼字", sounds: ["i", "u", "e", "o"] },
    { id: "N07", title: "氣流與振動", sounds: ["v", "z", "θ", "ð"] },
    { id: "N08", title: "組合子音", sounds: ["ʃ", "ʒ", "tʃ", "dʒ"] },
    { id: "N09", title: "舌位與滑動", sounds: ["ŋ", "r", "w", "j"] },
    { id: "N10", title: "雙母音", sounds: ["aɪ", "aʊ", "ɔɪ"] },
    { id: "N11", title: "弱母音與捲舌母音", sounds: ["ə", "ɝ", "ɚ"] },
  ];
  const VOWELS = ["i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "o", "ʊ", "u", "ʌ", "ə", "ɝ", "ɚ", "aɪ", "aʊ", "ɔɪ"];
  const PLAN_EXAMPLES = {
    i: "key / tree", ɪ: "fish / milk", e: "cake / rain", ɛ: "egg / bread", æ: "cat / map", ɑ: "car / star", ɔ: "saw / ball", o: "phone / go",
    ʊ: "book / foot", u: "moon / shoe", ʌ: "sun / bus", ə: "banana / sofa", ɝ: "bird / nurse", ɚ: "teacher / tiger", aɪ: "bike / kite",
    aʊ: "house / mouth", ɔɪ: "boy / toy", p: "pen / map", b: "bus / book", t: "top / cat", d: "dog / bed", k: "cat / key", g: "gift / go",
    f: "fish / phone", v: "van / five", θ: "thin / think", ð: "this / that", s: "sun / bus", z: "zoo / cheese", ʃ: "shoe / fish",
    ʒ: "measure / vision", h: "hat / house", tʃ: "chair / cheese", dʒ: "jam / bridge", m: "moon / map", n: "nose / sun", ŋ: "sing / ring",
    l: "lemon / ball", r: "rain / red", w: "water / window", j: "yes / yellow",
  };
  /* Taught sounds: how to make them, how they are spelled, verified example words. */
  const SOUNDS = {
    k: {
      kind: "子音", how: "舌頭後半部抬起，頂住口腔後上方（軟顎），先擋住氣，再一下放開，送出一小股氣。聲帶不振動。",
      spell: [["c", "cat、cake、car"], ["k", "key、book"]], examples: ["cat", "key"],
    },
    æ: {
      kind: "母音", how: "嘴巴張大，嘴角往兩邊拉，舌頭放低、稍微往前。比 /ɛ/（egg）開得更大。",
      spell: [["a", "cat、map、hat、apple"]], examples: ["cat", "map"],
    },
    t: {
      kind: "子音", how: "舌尖頂住上排牙齒後面的牙齦，先擋住氣，再一下放開。聲帶不振動。",
      spell: [["t", "cat、hat、tree、tiger"]], examples: ["cat", "hat"],
    },
    // N02
    m: {
      kind: "子音", how: "雙唇輕輕閉上，聲音從鼻子出來，喉嚨有振動（摸喉嚨會感覺到）。",
      spell: [["m", "moon、map、milk"]], examples: ["moon", "map"],
    },
    n: {
      kind: "子音", how: "舌尖頂住上排牙齒後面的牙齦，嘴巴微開，聲音從鼻子出來，喉嚨有振動。和 /m/ 的差別：/m/ 閉嘴唇，/n/ 用舌尖。",
      spell: [["n", "sun、moon、rain、phone"]], examples: ["sun", "moon"],
    },
    s: {
      kind: "子音", how: "舌尖靠近上排牙齦但不碰到，留一條小縫，讓氣流出細細的「嘶」聲。聲帶不振動。",
      spell: [["s", "sun、star、bus"], ["se", "horse、house（字尾 e 不發音）"]], examples: ["sun", "bus"],
    },
    f: {
      kind: "子音", how: "上排牙齒輕碰下唇，氣從縫中吹出來。聲帶不振動。",
      spell: [["f", "fish、frog、flower"], ["ph", "phone"]], examples: ["fish", "phone"],
    },
    // N03 (voiceless / voiced pairs first: p–b; then d–g next to the taught t–k; then h and l)
    p: {
      kind: "子音", how: "雙唇閉起來擋住氣，再一下打開，送出一小股氣（手放在嘴前感覺得到）。聲帶不振動。",
      spell: [["p", "map、passport、pineapple"], ["pp", "apple"]], examples: ["map", "passport"],
    },
    b: {
      kind: "子音", how: "和 /p/ 一樣雙唇閉起再打開，但喉嚨要振動，送出的氣比較少。/p/ 是無聲、/b/ 是有聲。",
      spell: [["b", "bus、book、bird、ball"]], examples: ["bus", "book"],
    },
    d: {
      kind: "子音", how: "舌尖頂住上排牙齒後面的牙齦，擋住氣再放開，喉嚨振動。它是 /t/ 的有聲版。",
      spell: [["d", "dog、bird、bread"]], examples: ["dog", "bird"],
    },
    g: {
      kind: "子音", how: "舌頭後半部頂住口腔後上方，擋住氣再放開，喉嚨振動。它是 /k/ 的有聲版。",
      spell: [["g", "gift、dog、frog"]], examples: ["gift", "dog"],
    },
    h: {
      kind: "子音", how: "嘴巴張開，從喉嚨輕輕呼出一口氣，像對著手哈氣；舌頭和嘴唇都不擋氣。",
      spell: [["h", "hat、house、horse"]], examples: ["hat", "house"],
    },
    l: {
      kind: "子音", how: "舌尖頂住上排牙齒後面的牙齦，聲音從舌頭兩側流出來，喉嚨振動。",
      spell: [["l", "lemon、ladder"], ["ll", "ball"]], examples: ["lemon", "ball"],
    },
    // N04 短母音
    ɛ: { kind: "母音", how: "嘴巴半開、嘴角稍微往兩邊，舌頭在中間偏前；比 /æ/ 開得小一點。", spell: [["e", "egg、web"], ["ea", "bread"]], examples: ["egg", "bread"] },
    ɪ: { kind: "母音", how: "嘴巴微開、放鬆，舌頭前面抬高但不用力；聲音短而鬆。", spell: [["i", "milk、gift、fish"]], examples: ["milk", "gift"] },
    ɑ: { kind: "母音", how: "嘴巴往下張大，舌頭放低、往後，像看醫生時說「啊」。", spell: [["o", "clock、frog"], ["a", "car、star（ar）"]], examples: ["clock", "frog"] },
    ʌ: { kind: "母音", how: "嘴巴半開、放鬆，舌頭在中間，聲音短；比 /ɑ/ 開得小、比較輕。", spell: [["u", "sun、bus"], ["o", "mother"]], examples: ["sun", "bus"] },
    // N05 圓唇
    ʊ: { kind: "母音", how: "嘴唇稍微圓、不用力，舌頭後面抬高；聲音短而鬆。", spell: [["oo", "book、foot"]], examples: ["book", "foot"] },
    ɔ: { kind: "母音", how: "嘴唇圓、稍微往前，嘴巴開得比 /o/ 大，舌頭低而後。（有些美國口音會念得接近 /ɑ/。）", spell: [["o", "dog"], ["a", "ball、water"], ["aw", "saw"]], examples: ["dog", "ball"] },
    // N06 長母音
    i: { kind: "母音", how: "嘴角往兩邊拉、像微笑，舌頭前面抬高、用力，聲音拉長。和 /ɪ/ 比：/i/ 緊而長，/ɪ/ 鬆而短。", spell: [["ee", "tree、three"], ["ey", "key"], ["ea", "teacher"]], examples: ["tree", "key"] },
    u: { kind: "母音", how: "嘴唇圓、往前嘟，舌頭後面抬高、用力，聲音拉長。和 /ʊ/ 比：/u/ 緊而長。", spell: [["oo", "moon、zoo"], ["oe", "shoe"]], examples: ["moon", "shoe"] },
    e: { kind: "母音", how: "從 /ɛ/ 的嘴形開始，往 /ɪ/ 滑一點，像「ㄟ」。", spell: [["a…e", "cake（字尾 e 不發音）"], ["ai", "rain"]], examples: ["cake", "rain"] },
    o: { kind: "母音", how: "嘴唇圓，從 /o/ 往 /ʊ/ 滑一點，像「ㄡ」但嘴唇更圓。", spell: [["o…e", "phone"], ["o", "go"], ["ow", "window、yellow"]], examples: ["phone", "go"] },
    // N07 氣流與振動
    v: { kind: "子音", how: "上排牙齒輕碰下唇，像 /f/，但喉嚨要振動。/f/ 無聲、/v/ 有聲。", spell: [["v", "van、volcano、five"]], examples: ["van", "volcano"] },
    z: { kind: "子音", how: "和 /s/ 一樣留一條小縫吹氣，但喉嚨振動，像蜜蜂嗡嗡的聲音。", spell: [["z", "zoo"], ["s", "cheese（se）"]], examples: ["zoo", "cheese"] },
    θ: { kind: "子音", how: "舌尖輕放在上下排牙齒之間，往外吹氣；聲帶不振動。", spell: [["th", "thumb、three、thermometer"]], examples: ["thumb", "thermometer"] },
    ð: { kind: "子音", how: "舌尖一樣放在上下排牙齒之間，但喉嚨振動。/θ/ 無聲、/ð/ 有聲，拼字都是 th。", spell: [["th", "this、that、mother"]], examples: ["this", "that"] },
    // N08 組合子音
    ʃ: { kind: "子音", how: "嘴唇稍微往前圓，舌頭往後一點，吹出「噓」的聲音；聲帶不振動。", spell: [["sh", "shoe、fish"]], examples: ["shoe", "fish"] },
    ʒ: { kind: "子音", how: "和 /ʃ/ 一樣的嘴形，但喉嚨振動；很少出現在字的開頭。", spell: [["s", "measure、vision、treasure"]], examples: ["measure", "vision"] },
    tʃ: { kind: "子音", how: "先像 /t/ 擋住，再接 /ʃ/ 放開，嘴唇往前圓；聲帶不振動。", spell: [["ch", "chair、cheese、teacher"]], examples: ["chair", "cheese"] },
    dʒ: { kind: "子音", how: "先像 /d/ 擋住，再接 /ʒ/ 放開；喉嚨振動。字母 j 的名字不是這個音的念法。", spell: [["j", "jam"], ["dge", "bridge"]], examples: ["jam", "bridge"] },
    // N09 舌位與滑動
    ŋ: { kind: "子音", how: "舌頭後面頂住口腔後上方，聲音從鼻子出來，像「ㄥ」的尾音；後面不要多加 /g/。", spell: [["ng", "ring、sing"], ["n", "bank（k 前面）"]], examples: ["ring", "bank"] },
    r: { kind: "子音", how: "舌尖往上捲起但不碰到上面，嘴唇稍微圓；喉嚨振動。", spell: [["r", "rain、rabbit"]], examples: ["rain", "rabbit"] },
    w: { kind: "子音", how: "嘴唇先圓起來往前嘟，再很快放開，滑到後面的母音。", spell: [["w", "web、window、water"]], examples: ["web", "window"] },
    j: { kind: "子音", how: "舌頭前面往上靠近硬顎，再很快滑到後面的母音，像「一」很快帶過。這不是字母 J 的名字。", spell: [["y", "yes、yellow"]], examples: ["yes", "yellow"] },
    // N10 雙母音
    aɪ: { kind: "雙母音", how: "從嘴巴張大的 /a/ 滑到 /ɪ/，像「ㄞ」。", spell: [["i…e", "kite、bike、five"], ["i", "tiger"]], examples: ["bike", "kite"] },
    aʊ: { kind: "雙母音", how: "從 /a/ 滑到 /ʊ/，最後嘴唇圓起來，像「ㄠ」。", spell: [["ou", "house、mouth"], ["ow", "flower"]], examples: ["house", "flower"] },
    ɔɪ: { kind: "雙母音", how: "從嘴唇圓的 /ɔ/ 滑到 /ɪ/。", spell: [["oy", "boy、toy"], ["oi", "coin"]], examples: ["boy", "toy"] },
    // N11 弱母音與捲舌母音
    ə: { kind: "弱母音", how: "最放鬆的母音，嘴巴半開不用力、很短，只出現在不重讀的音節。", spell: [["a", "banana 的第一和最後一個 a、sofa"], ["o", "lemon"]], examples: ["banana", "sofa"] },
    ɝ: { kind: "捲舌母音", how: "重讀的捲舌母音：舌尖往上捲、嘴唇稍圓，聲音比較長。", spell: [["ir", "bird"], ["ur", "nurse"]], examples: ["bird", "nurse"] },
    ɚ: { kind: "捲舌母音", how: "不重讀的捲舌母音，比 /ɝ/ 短而輕。", spell: [["er", "teacher、tiger"], ["or", "doctor"]], examples: ["teacher", "doctor"] },
  };
  /* Hand-checked spelling → sound splits (spelling pieces join to the word; sounds join to its KK). */
  const WORDS_SPLIT = {
    cat: [["c", "k"], ["a", "æ"], ["t", "t"]],
    hat: [["h", "h"], ["a", "æ"], ["t", "t"]],
    map: [["m", "m"], ["a", "æ"], ["p", "p"]],
    key: [["k", "k"], ["ey", "i"]],
    cake: [["c", "k"], ["a", "e"], ["k", "k"], ["e", ""]],
    car: [["c", "k"], ["a", "ɑ"], ["r", "r"]],
    book: [["b", "b"], ["oo", "ʊ"], ["k", "k"]],
    tree: [["t", "t"], ["r", "r"], ["ee", "i"]],
    tiger: [["t", "t"], ["i", "aɪ"], ["g", "g"], ["er", "ɚ"]],
    apple: [["a", "æ"], ["pp", "p"], ["le", "ḷ"]],
    // N02
    moon: [["m", "m"], ["oo", "u"], ["n", "n"]],
    sun: [["s", "s"], ["u", "ʌ"], ["n", "n"]],
    bus: [["b", "b"], ["u", "ʌ"], ["s", "s"]],
    fish: [["f", "f"], ["i", "ɪ"], ["sh", "ʃ"]],
    phone: [["ph", "f"], ["o", "o"], ["n", "n"], ["e", ""]],
    milk: [["m", "m"], ["i", "ɪ"], ["l", "l"], ["k", "k"]],
    star: [["s", "s"], ["t", "t"], ["a", "ɑ"], ["r", "r"]],
    horse: [["h", "h"], ["o", "ɔ"], ["r", "r"], ["s", "s"], ["e", ""]],
    house: [["h", "h"], ["ou", "aʊ"], ["s", "s"], ["e", ""]],
    frog: [["f", "f"], ["r", "r"], ["o", "ɑ"], ["g", "g"]],
    flower: [["f", "f"], ["l", "l"], ["ow", "aʊ"], ["er", "ɚ"]],
    rain: [["r", "r"], ["ai", "e"], ["n", "n"]],
    // N03
    passport: [["p", "p"], ["a", "æ"], ["ss", "s"], ["p", "p"], ["o", "ɔ"], ["r", "r"], ["t", "t"]],
    dog: [["d", "d"], ["o", "ɔ"], ["g", "g"]],
    bird: [["b", "b"], ["ir", "ɝ"], ["d", "d"]],
    gift: [["g", "g"], ["i", "ɪ"], ["f", "f"], ["t", "t"]],
    lemon: [["l", "l"], ["e", "ɛ"], ["m", "m"], ["o", "ə"], ["n", "n"]],
    ball: [["b", "b"], ["a", "ɔ"], ["ll", "l"]],
    // N04–N11 (bank words)
    egg: [["e", "ɛ"], ["gg", "g"]],
    bread: [["b", "b"], ["r", "r"], ["ea", "ɛ"], ["d", "d"]],
    clock: [["c", "k"], ["l", "l"], ["o", "ɑ"], ["ck", "k"]],
    tree: [["t", "t"], ["r", "r"], ["ee", "i"]],
    shoe: [["sh", "ʃ"], ["oe", "u"]],
    volcano: [["v", "v"], ["o", "ɑ"], ["l", "l"], ["c", "k"], ["a", "e"], ["n", "n"], ["o", "o"]],
    cheese: [["ch", "tʃ"], ["ee", "i"], ["s", "z"], ["e", ""]],
    thermometer: [["th", "θ"], ["er", "ɚ"], ["m", "m"], ["o", "ɑ"], ["m", "m"], ["e", "ə"], ["t", "t"], ["er", "ɚ"]],
    chair: [["ch", "tʃ"], ["ai", "ɛ"], ["r", "r"]],
    bridge: [["b", "b"], ["r", "r"], ["i", "ɪ"], ["dge", "dʒ"]],
    bank: [["b", "b"], ["a", "æ"], ["n", "ŋ"], ["k", "k"]],
    rabbit: [["r", "r"], ["a", "æ"], ["bb", "b"], ["i", "ɪ"], ["t", "t"]],
    bike: [["b", "b"], ["i", "aɪ"], ["k", "k"], ["e", ""]],
    banana: [["b", "b"], ["a", "ə"], ["n", "n"], ["a", "æ"], ["n", "n"], ["a", "ə"]],
    doctor: [["d", "d"], ["o", "ɑ"], ["c", "k"], ["t", "t"], ["or", "ɚ"]],
    // supplement words (SUPPLEMENT below)
    foot: [["f", "f"], ["oo", "ʊ"], ["t", "t"]],
    go: [["g", "g"], ["o", "o"]],
    van: [["v", "v"], ["a", "æ"], ["n", "n"]],
    zoo: [["z", "z"], ["oo", "u"]],
    thumb: [["th", "θ"], ["u", "ʌ"], ["mb", "m"]],
    this: [["th", "ð"], ["i", "ɪ"], ["s", "s"]],
    that: [["th", "ð"], ["a", "æ"], ["t", "t"]],
    measure: [["m", "m"], ["ea", "ɛ"], ["s", "ʒ"], ["ure", "ɚ"]],
    vision: [["v", "v"], ["i", "ɪ"], ["s", "ʒ"], ["io", "ə"], ["n", "n"]],
    jam: [["j", "dʒ"], ["a", "æ"], ["m", "m"]],
    ring: [["r", "r"], ["i", "ɪ"], ["ng", "ŋ"]],
    web: [["w", "w"], ["e", "ɛ"], ["b", "b"]],
    window: [["w", "w"], ["i", "ɪ"], ["n", "n"], ["d", "d"], ["ow", "o"]],
    yes: [["y", "j"], ["e", "ɛ"], ["s", "s"]],
    yellow: [["y", "j"], ["e", "ɛ"], ["ll", "l"], ["ow", "o"]],
    boy: [["b", "b"], ["oy", "ɔɪ"]],
    toy: [["t", "t"], ["oy", "ɔɪ"]],
    coin: [["c", "k"], ["oi", "ɔɪ"], ["n", "n"]],
    nurse: [["n", "n"], ["ur", "ɝ"], ["s", "s"], ["e", ""]],
    teacher: [["t", "t"], ["ea", "i"], ["ch", "tʃ"], ["er", "ɚ"]],
    kite: [["k", "k"], ["i", "aɪ"], ["t", "t"], ["e", ""]],
    sing: [["s", "s"], ["i", "ɪ"], ["ng", "ŋ"]],
    three: [["th", "θ"], ["r", "r"], ["ee", "i"]],
    five: [["f", "f"], ["i", "aɪ"], ["v", "v"], ["e", ""]],
    mouth: [["m", "m"], ["ou", "aʊ"], ["th", "θ"]],
    sofa: [["s", "s"], ["o", "o"], ["f", "f"], ["a", "ə"]],
    saw: [["s", "s"], ["aw", "ɔ"]],
    water: [["w", "w"], ["a", "ɔ"], ["t", "t"], ["er", "ɚ"]],
    treasure: [["t", "t"], ["r", "r"], ["ea", "ɛ"], ["s", "ʒ"], ["ure", "ɚ"]],
    mother: [["m", "m"], ["o", "ʌ"], ["th", "ð"], ["er", "ɚ"]],
    bath: [["b", "b"], ["a", "æ"], ["th", "θ"]],
  };
  /* Words the 80-word bank does not have, needed for sounds it has no (or too few) examples of (/ð ʒ ɔɪ w j θ ʊ/…).
     KK as in standard American KK dictionaries; every split above must rebuild it (tests/content.cjs).
     No recordings yet: the device voice reads the WHOLE word (labelled), never a KK symbol. Pending curriculum review. */
  const SUPPLEMENT = [
    ["foot", "[fʊt]", "腳", "🦶"], ["go", "[go]", "去", "🏃"], ["van", "[væn]", "廂型車", "🚐"], ["zoo", "[zu]", "動物園", "🦓"],
    ["thumb", "[θʌm]", "大拇指", "👍"], ["this", "[ðɪs]", "這個", "👇"], ["that", "[ðæt]", "那個", "👉"], ["measure", "[ˋmɛʒɚ]", "測量", "📏"],
    ["vision", "[ˋvɪʒən]", "視力", "👁️"], ["jam", "[dʒæm]", "果醬", "🍓"], ["ring", "[rɪŋ]", "戒指", "💍"], ["web", "[wɛb]", "蜘蛛網", "🕸️"],
    ["window", "[ˋwɪndo]", "窗戶", "🪟"], ["yes", "[jɛs]", "是的", "✅"], ["yellow", "[ˋjɛlo]", "黃色", "💛"], ["boy", "[bɔɪ]", "男孩", "👦"],
    ["toy", "[tɔɪ]", "玩具", "🧸"], ["coin", "[kɔɪn]", "硬幣", "🪙"], ["nurse", "[nɝs]", "護理師", "🧑‍⚕️"], ["teacher", "[ˋtitʃɚ]", "老師", "🧑‍🏫"],
    ["kite", "[kaɪt]", "風箏", "🪁"], ["sing", "[sɪŋ]", "唱歌", "🎤"], ["three", "[θri]", "三", "3️⃣"], ["five", "[faɪv]", "五", "5️⃣"],
    ["mouth", "[maʊθ]", "嘴巴", "👄"], ["sofa", "[ˋsofə]", "沙發", "🛋️"], ["saw", "[sɔ]", "鋸子", "🪚"], ["water", "[ˋwɔtɚ]", "水", "💧"],
    ["treasure", "[ˋtrɛʒɚ]", "寶藏", "💎"], ["mother", "[ˋmʌðɚ]", "媽媽", "👩"], ["bath", "[bæθ]", "洗澡", "🛁"],
  ].map(([w, kk, z, e]) => ({ w, kk, z, e, au: "", sup: true }));
  /* N02 spelling ↔ sound matching (each spelling has a recorded example with that spelling). */
  const MATCH = {
    N02: [["m", "m", "moon"], ["n", "n", "sun"], ["s", "s", "bus"], ["f", "f", "fish"], ["ph", "f", "phone"], ["c", "k", "cat"]],
    N03: [["p", "p", "map"], ["pp", "p", "apple"], ["b", "b", "bus"], ["d", "d", "dog"], ["g", "g", "gift"], ["h", "h", "hat"], ["l", "l", "lemon"], ["ll", "l", "ball"]],
    N04: [["e", "ɛ", "egg"], ["ea", "ɛ", "bread"], ["i", "ɪ", "milk"], ["o", "ɑ", "clock"], ["u", "ʌ", "sun"], ["a", "æ", "cat"]],
    N05: [["oo", "ʊ", "book"], ["o", "ɔ", "dog"], ["aw", "ɔ", "saw"], ["u", "ʌ", "bus"]],
    N06: [["ee", "i", "tree"], ["ey", "i", "key"], ["oo", "u", "moon"], ["oe", "u", "shoe"], ["a…e", "e", "cake"], ["ai", "e", "rain"], ["o…e", "o", "phone"]],
    N07: [["v", "v", "van"], ["z", "z", "zoo"], ["se", "z", "cheese"], ["th（thumb）", "θ", "thumb"], ["th（this）", "ð", "this"]],
    N08: [["sh", "ʃ", "shoe"], ["s（measure）", "ʒ", "measure"], ["ch", "tʃ", "chair"], ["j", "dʒ", "jam"], ["dge", "dʒ", "bridge"]],
    N09: [["ng", "ŋ", "ring"], ["r", "r", "rain"], ["w", "w", "web"], ["y", "j", "yes"]],
    N10: [["i…e", "aɪ", "kite"], ["ou", "aʊ", "house"], ["ow", "aʊ", "flower"], ["oy", "ɔɪ", "boy"], ["oi", "ɔɪ", "coin"]],
    N11: [["a（sofa）", "ə", "sofa"], ["ir", "ɝ", "bird"], ["ur", "ɝ", "nurse"], ["er", "ɚ", "teacher"]],
  };
  /* Chapters N04–N11 (one runner in rpg.js): who teaches them, sound groups (1–2 at a time), adventure level after. */
  const PLAN = {
    N04: { teacher: "vowel", title: "N04 短母音擴充", groups: [["ɛ", "ɪ"], ["ɑ", "ʌ"]], lv: 5, line: "這一章學 4 個短母音。/ɛ/ 先和學過的 /æ/ 比：/æ/ 嘴巴開得更大。" },
    N05: { teacher: "vowel", title: "N05 圓唇與口形", groups: [["ʊ", "ɔ"]], lv: 6, line: "兩個嘴唇要圓起來的母音：短而鬆的 /ʊ/（book）和開口較大的 /ɔ/（dog）。" },
    N06: { teacher: "vowel", title: "N06 常見母音與拼字", groups: [["i", "u"], ["e", "o"]], lv: 7, line: "長母音 /i/ /u/，以及會滑動的 /e/ /o/。和 /ɪ/ /ʊ/ 比：長母音比較緊、比較長。字尾 e 常常不發音，但會讓前面的母音變成「長音」。" },
    N07: { teacher: "consonant", title: "N07 氣流與振動", groups: [["v", "z"], ["θ", "ð"]], lv: 8, line: "有聲的 /v/ /z/（對照學過的 /f/ /s/），以及舌尖放在牙齒間的 /θ/ /ð/，兩個都拼成 th。" },
    N08: { teacher: "consonant", title: "N08 組合子音", groups: [["ʃ", "ʒ"], ["tʃ", "dʒ"]], lv: 8, line: "sh、ch、j 這些字母組合的聲音。注意：字母 J 的名字和 /dʒ/ 的念法不一樣。" },
    N09: { teacher: "consonant", title: "N09 舌位與滑動", groups: [["ŋ", "r"], ["w", "j"]], lv: 8, line: "鼻音 /ŋ/（後面不加 /g/）、捲舌的 /r/，以及很快滑過去的 /w/ /j/。" },
    N10: { teacher: "vowel", title: "N10 雙母音", groups: [["aɪ", "aʊ"], ["ɔɪ"]], lv: 9, line: "雙母音是一個音裡面嘴形會滑動：ㄞ（/aɪ/）、ㄠ（/aʊ/）和 /ɔɪ/。" },
    N11: { teacher: "vowel", title: "N11 弱母音與捲舌母音", groups: [["ə"], ["ɝ", "ɚ"]], lv: 9, line: "最後 3 個音：不重讀的弱母音 /ə/，以及捲舌母音 /ɝ/（重讀）和 /ɚ/（不重讀）。學完就是 41 個音！" },
  };
  /* "Fill the taught slots": the word's untaught sounds are placed and locked (labelled), never asked. */
  const BUILDS = { N01: ["cat"], N02: ["sun", "phone", "moon", "map"], N03: ["map", "hat", "dog", "gift"] };
  /* Listen-first recognition: hear a whole word (its recording), pick the sound at a given place.
     The word, its picture and its KK are NOT shown until the answer is right. */
  const PLACES = { first: "開頭", last: "結尾", vowel: "中間的母音" };
  const POOL = [
    ["cat", "first", "k"], ["key", "first", "k"], ["cake", "first", "k"], ["car", "first", "k"],
    ["tree", "first", "t"], ["tiger", "first", "t"], ["apple", "first", "æ"],
    ["cat", "last", "t"], ["hat", "last", "t"], ["book", "last", "k"], ["cake", "last", "k"],
    ["cat", "vowel", "æ"], ["map", "vowel", "æ"], ["hat", "vowel", "æ"],
    // N02 (first / last sound, checked against each word's KK in tests/content.cjs)
    ["moon", "first", "m"], ["map", "first", "m"], ["milk", "first", "m"],
    ["sun", "last", "n"], ["moon", "last", "n"], ["rain", "last", "n"], ["phone", "last", "n"],
    ["sun", "first", "s"], ["star", "first", "s"],
    ["bus", "last", "s"], ["horse", "last", "s"], ["house", "last", "s"],
    ["fish", "first", "f"], ["frog", "first", "f"], ["flower", "first", "f"], ["phone", "first", "f"],
    // N03
    ["passport", "first", "p"], ["pineapple", "first", "p"], ["peacock", "first", "p"], ["map", "last", "p"], ["grape", "last", "p"],
    ["bus", "first", "b"], ["book", "first", "b"], ["ball", "first", "b"], ["bike", "first", "b"], ["bird", "first", "b"],
    ["dog", "first", "d"], ["doctor", "first", "d"], ["dolphin", "first", "d"], ["bread", "last", "d"], ["bird", "last", "d"],
    ["gift", "first", "g"], ["garlic", "first", "g"], ["grape", "first", "g"], ["dog", "last", "g"], ["egg", "last", "g"], ["frog", "last", "g"],
    ["hat", "first", "h"], ["house", "first", "h"], ["horse", "first", "h"], ["hospital", "first", "h"],
    ["lemon", "first", "l"], ["ladder", "first", "l"], ["ball", "last", "l"],
  ];
  const bank = () => (typeof WORDS !== "undefined" ? WORDS : []);
  const word = (w) => bank().find((x) => x.w === w) || SUPPLEMENT.find((x) => x.w === w);
  const shuf = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /* q: the shared question shape (Learn.ask / Battle). reveal "right-only": a wrong answer never lights up the
     right option or shows the word; noText: an audio failure offers replay only (the word would give it away). */
  /* Questions for N04 onward are generated from the KK of every word we have (recorded bank words first,
     supplement words only when a sound has no recorded example): its first sound, its last sound, the vowel of a
     one-vowel word, or — for sounds that never start or end a word here (/ʒ/…) — "which of these is in the word".
     N01–N03 keep their hand-picked POOL above. */
  const EARLY = ["k", "æ", "t", "m", "n", "s", "f", "p", "b", "d", "g", "h", "l"];
  const ALL41 = () => CHAPTERS.flatMap((c) => c.sounds);
  let AUTO = null;
  function autoPool() {
    if (AUTO) return AUTO;
    const S41 = new Set(ALL41()),
      words = [...bank().filter((w) => w.kk && w.au), ...SUPPLEMENT];
    AUTO = [];
    for (const it of words) {
      const ks = kkSounds(it.kk);
      if (!ks.length) continue;
      const vs = ks.filter((x) => VOWELS.includes(x));
      const add = (place, sym) => S41.has(sym) && !EARLY.includes(sym) && AUTO.push([it.w, place, sym, !it.au]);
      add("first", ks[0]);
      if (ks.length > 1) add("last", ks[ks.length - 1]);
      if (vs.length === 1 && ks.length > 1) add("vowel", vs[0]);
      new Set(ks).forEach((x) => add("has", x));
    }
    return AUTO;
  }
  const PLACE_ASK = { first: "開頭的音", last: "結尾的音", vowel: "中間的母音", has: "裡面有出現的音" };
  const PARTNER = { m: "n", n: "m", s: "f", f: "s", k: "g", g: "k", t: "d", d: "t", p: "b", b: "p", h: "f", l: "r", r: "l",
    ɛ: "æ", æ: "ɛ", ɪ: "i", i: "ɪ", ɑ: "ʌ", ʌ: "ɑ", ʊ: "u", u: "ʊ", ɔ: "o", o: "ɔ", e: "ɛ", v: "f", z: "s", θ: "s", ð: "d",
    ʃ: "s", ʒ: "ʃ", tʃ: "dʒ", dʒ: "tʃ", ŋ: "n", w: "v", j: "dʒ", aɪ: "e", aʊ: "o", ɔɪ: "aɪ", ə: "ʌ", ɝ: "ɚ", ɚ: "ɝ" };
  function soundQuestion(taught, opt = {}) {
    const curated = POOL.filter(([w, , s]) => taught.includes(s) && word(w) && word(w).au && w !== opt.avoid).map(([w, p, s]) => [w, p, s, false]);
    const auto = autoPool().filter(([w, , s]) => taught.includes(s) && w !== opt.avoid);
    const usable = [...curated, ...auto];
    if (!usable.length) return null;
    let target = opt.target;
    if (!target) {
      const sounds = [...new Set(usable.map((x) => x[2]))],
        fresh = (opt.prefer || []).filter((x) => sounds.includes(x));
      target = fresh.length && Math.random() < 0.6 ? fresh[Math.floor(Math.random() * fresh.length)] : sounds[Math.floor(Math.random() * sounds.length)];
    }
    let pool = usable.filter((x) => x[2] === target);
    // position questions before "is it in the word"; recorded words before the device voice
    const pick = (f) => pool.filter(f);
    pool = [pick((x) => x[1] !== "has" && !x[3]), pick((x) => x[1] !== "has"), pick((x) => !x[3]), pool].find((x) => x.length) || [];
    if (!pool.length) return null;
    const [w, place, sym] = pool[Math.floor(Math.random() * pool.length)],
      it = word(w),
      inWord = new Set(kkSounds(it.kk)),
      // a distractor must be wrong: for "has", it may not be in the word at all
      ok = (x) => x !== sym && (place !== "has" || !inWord.has(x)),
      others = shuf(taught.filter(ok)),
      partner = opt.partnerOnly || PARTNER[sym],
      choices = [sym, ...(others.includes(partner) ? [partner, ...others.filter((x) => x !== partner)] : others)].slice(0, 3);
    if (choices.length < 2) return null;
    return {
      kind: "snd", type: "listen-sound", recK: "w", item: it, sym, targetSound: sym, wordId: w, place,
      prompt: `<p class="qz-ask">🎧 聽一個單字，選出它<b class="qz-focus">${PLACE_ASK[place]}</b></p><p class="qz-hint">播放的是整個單字的${it.au ? "錄音" : "裝置語音（正式錄音待補）"}，不是單音。聽完才會出現選項。</p>`,
      audio: { text: it.w, file: it.au, label: "再聽一次" }, autoplay: true, noText: true, reveal: "right-only",
      options: shuf(choices).map((s) => ({ html: `<span class="qz-sym big">/${ESC(s)}/</span>`, ok: s === sym, label: `/${s}/` })),
      answer: { en: it.w, kk: it.kk, zh: it.z, file: it.au },
      explain: place === "has" ? `${it.w} ${it.kk} 裡有 /${sym}/。` : `${it.w} ${it.kk}：${PLACES[place] || "中間"}是 /${sym}/。`,
      ctx: opt.ctx || "novice",
      time: 15,
    };
  }
  /* Full-build words for a set of taught sounds: every sound taught, nothing syllabic (ḷ ṇ), at least one of `need`. */
  function fullWords(taught, need) {
    const T = new Set(taught);
    return [...bank().filter((w) => w.kk && w.au && WORDS_SPLIT[w.w]), ...SUPPLEMENT]
      .filter((w) => {
        const ks = kkSounds(w.kk);
        return ks.length >= 2 && ks.every((x) => T.has(x)) && (!need || ks.some((x) => need.includes(x)));
      })
      .map((w) => w.w);
  }
  /* Listen to a word, pick its stressed syllable (N12): the KK is shown only after answering. */
  function stressQuestion(opt = {}) {
    const pool = bank().filter((w) => w.kk && w.au && /ˋ/.test(w.kk)).map((w) => {
      const vs = kkSounds(w.kk.replace(/[ˏ]/g, "")).filter((x) => VOWELS.includes(x) || x === "ḷ" || x === "ṇ").length;
      const body = w.kk.replace(/[[\]]/g, ""),
        before = body.slice(0, body.indexOf("ˋ")),
        stress = kkSounds(before).filter((x) => VOWELS.includes(x) || x === "ḷ" || x === "ṇ").length + 1;
      return { w, syl: vs, stress };
    }).filter((x) => x.syl >= 2 && x.syl <= 4 && x.stress <= x.syl && x.w.w !== opt.avoid && (!opt.syl || x.syl === opt.syl));
    if (!pool.length) return null;
    const { w, syl, stress } = pool[Math.floor(Math.random() * pool.length)];
    return {
      kind: "stress", type: "listen-stress", recK: "w", item: w, wordId: w.w, targetSound: "ˋ",
      prompt: `<p class="qz-ask">🥁 聽一個單字（${syl} 個音節），重音在第幾個音節？</p><p class="qz-hint">重讀的音節比較長、比較響亮。聽完才會出現選項；音標在答完後才顯示。</p>`,
      audio: { text: w.w, file: w.au, label: "再聽一次" }, autoplay: true, noText: true, reveal: "right-only",
      options: Array.from({ length: syl }, (_, i) => ({ html: `第 ${i + 1} 音節`, ok: i + 1 === stress, label: `第 ${i + 1} 音節` })),
      answer: { en: w.w, kk: w.kk, zh: w.z, file: w.au },
      explain: `${w.w} ${w.kk}：ˋ 在第 ${stress} 個音節前面。`,
      ctx: opt.ctx || "novice",
      time: 15,
    };
  }
  /* Boss phase 3: hear a word, pick its whole KK; the two wrong ones change one sound to its confusable partner. */
  function kkQuestion(opt = {}) {
    const pool = bank().filter((w) => w.kk && w.au && w.w !== opt.avoid && kkSounds(w.kk).length >= 3 && kkSounds(w.kk).every((x) => ALL41().includes(x)));
    if (!pool.length) return null;
    const w = pool[Math.floor(Math.random() * pool.length)],
      kk = w.kk,
      seen = new Set([kk]),
      wrong = [];
    for (const x of shuf([...new Set(kkSounds(kk))])) {
      const p = PARTNER[x];
      if (!p || wrong.length >= 2) continue;
      const v = kk.replace(x, p);
      if (!seen.has(v) && v.replace(/[[\]ˋˏ]/g, "") !== w.w) (seen.add(v), wrong.push(v)); // never a variant that reads like the spelling
    }
    if (wrong.length < 2) return null;
    return {
      kind: "kkword", type: "listen-kk", recK: "w", item: w, wordId: w.w, targetSound: "kk",
      prompt: `<p class="qz-ask">🔤 聽一個單字，選出它的 KK 音標</p><p class="qz-hint">單字和圖片在答完後才顯示。</p>`,
      audio: { text: w.w, file: w.au, label: "再聽一次" }, autoplay: true, noText: true, reveal: "right-only",
      options: shuf([kk, ...wrong]).map((x) => ({ html: `<span class="qz-kk big">${ESC(x)}</span>`, ok: x === kk, label: x })),
      answer: { en: w.w, kk: w.kk, zh: w.z, file: w.au },
      ctx: opt.ctx || "boss",
      time: 18,
    };
  }
  /* Spelling pieces of a checked word, the piece for `sym` marked (colour plus underline and a label). */
  function splitHTML(w, sym) {
    const sp = WORDS_SPLIT[w];
    if (!sp) return ESC(w);
    return sp.map(([l, s]) => (s && s === sym ? `<mark class="nv-hit" title="/${ESC(s)}/">${ESC(l)}</mark>` : `<span class="nv-l">${ESC(l)}</span>`)).join("");
  }
  /* letter piece → sound table for a word (Echo "這個字怎麼拆") */
  function breakdownHTML(w) {
    const sp = WORDS_SPLIT[w];
    if (!sp) return "";
    return `<div class="nv-break">${sp.map(([l, s]) => `<span class="nv-pair"><b>${ESC(l)}</b><i>→</i><span class="qz-sym">${s ? "/" + ESC(s) + "/" : "（不發音）"}</span></span>`).join("")}</div>`;
  }
  /* KK of a word as a list of sounds (stress marks dropped), for the content checks. */
  const MULTI = ["aɪ", "aʊ", "ɔɪ", "tʃ", "dʒ"];
  function kkSounds(kk) {
    const s = String(kk).replace(/[[\]ˋˏ]/g, "");
    const out = [];
    for (let i = 0; i < s.length; ) {
      const two = s.slice(i, i + 2);
      if (MULTI.includes(two)) (out.push(two), (i += 2));
      else (out.push(s[i]), (i += 1));
    }
    return out;
  }
  const chapterOf = (sym) => CHAPTERS.find((c) => c.sounds.includes(sym));
  return { CHAPTERS, VOWELS, SOUNDS, WORDS_SPLIT, POOL, PLACES, PLAN_EXAMPLES, MATCH, BUILDS, PLAN, SUPPLEMENT, PARTNER, soundQuestion, stressQuestion, kkQuestion, fullWords, autoPool, splitHTML, breakdownHTML, kkSounds, chapterOf, word, ALL41 };
})();
if (typeof module !== "undefined") module.exports = Novice;
