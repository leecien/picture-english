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
  };
  /* N02 spelling ↔ sound matching (each spelling has a recorded example with that spelling). */
  const MATCH = {
    N02: [["m", "m", "moon"], ["n", "n", "sun"], ["s", "s", "bus"], ["f", "f", "fish"], ["ph", "f", "phone"], ["c", "k", "cat"]],
    N03: [["p", "p", "map"], ["pp", "p", "apple"], ["b", "b", "bus"], ["d", "d", "dog"], ["g", "g", "gift"], ["h", "h", "hat"], ["l", "l", "lemon"], ["ll", "l", "ball"]],
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
  const word = (w) => bank().find((x) => x.w === w);
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
  function soundQuestion(taught, opt = {}) {
    const usable = POOL.filter(([w, , s]) => taught.includes(s) && word(w) && word(w).au && w !== opt.avoid);
    if (!usable.length) return null;
    let target = opt.target;
    if (!target) {
      const sounds = [...new Set(usable.map((x) => x[2]))],
        fresh = (opt.prefer || []).filter((x) => sounds.includes(x));
      target = fresh.length && Math.random() < 0.6 ? fresh[Math.floor(Math.random() * fresh.length)] : sounds[Math.floor(Math.random() * sounds.length)];
    }
    const pool = usable.filter((x) => x[2] === target);
    if (!pool.length) return null;
    const [w, place, sym] = pool[Math.floor(Math.random() * pool.length)],
      it = word(w),
      // the sound it is easily confused with comes first (m/n, s/f…), then the rest
      PARTNER = { m: "n", n: "m", s: "f", f: "s", k: "g", g: "k", t: "d", d: "t", p: "b", b: "p", h: "f", l: "n" },
      others = shuf(taught.filter((x) => x !== sym)),
      choices = [sym, ...(others.includes(PARTNER[sym]) ? [PARTNER[sym], ...others.filter((x) => x !== PARTNER[sym])] : others)].slice(0, 3);
    return {
      kind: "snd", type: "listen-sound", recK: "w", item: it, sym, targetSound: sym, wordId: w, place,
      prompt: `<p class="qz-ask">🎧 聽一個單字，選出它的<strong class="qz-focus">${PLACES[place]}${place === "vowel" ? "" : "的音"}</strong>。</p><p class="qz-hint">播放的是整個單字的錄音（單音錄音還沒有）。聽完才會出現選項。</p>`,
      audio: { text: it.w, file: it.au, label: "再聽一次" }, autoplay: true, noText: true, reveal: "right-only",
      options: shuf(choices).map((s) => ({ html: `<span class="qz-sym big">/${ESC(s)}/</span>`, ok: s === sym, label: `/${s}/` })),
      answer: { en: it.w, kk: it.kk, zh: it.z, file: it.au },
      explain: `${it.w} ${it.kk}：${PLACES[place]}是 /${sym}/。`,
      ctx: opt.ctx || "novice",
      time: 15,
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
  return { CHAPTERS, VOWELS, SOUNDS, WORDS_SPLIT, POOL, PLACES, PLAN_EXAMPLES, MATCH, BUILDS, soundQuestion, splitHTML, breakdownHTML, kkSounds, chapterOf, word };
})();
if (typeof module !== "undefined") module.exports = Novice;
