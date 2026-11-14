/* Shared English questions for quests, battles, the KK village and the commute mode.
   Every answer goes through Learn.grade, which writes to the existing records (pm-cards / pm-sents via record(),
   P counters, XP, badges); Learn.flush adds one pm-log entry per quest or battle.
   Its own small state lives in a separate key, pm-learn-v1 (older pm-* keys keep their shape):
     recent  item -> time of the last correct answer (anti-farming, survives reloads, expired entries pruned)
     review  items answered wrong, waiting to come back later in a different context
     asked   the last items shown, so questions do not repeat back to back */
const Learn = (() => {
  const COOLDOWN = 3 * 60 * 1000,
    REVIEW_MAX = 80,
    REVIEW_DAYS = 21,
    ASKED_MAX = 24;
  const freshRep = () => ({ newW: new Map(), revW: new Map(), weakW: new Map(), newS: new Map(), revS: new Map(), weakS: new Map() });
  let rep = freshRep(),
    tally = { n: 0, ok: 0, items: [], timeouts: 0, assisted: 0 };
  let SCN = [],
    last = null;
  const setScenes = (c) => (SCN = Array.isArray(c) ? c : []);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuf = (a) => shuffle(a.slice());
  const lvOk = (x) => x.lv <= maxLv();

  /* ---------- persistent learning state ---------- */
  const ST = (() => {
    const raw = LS.get("pm-learn-v1", null),
      o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const now = Date.now();
    const recent = {};
    for (const [k, t] of Object.entries(o.recent || {})) if (t > now - COOLDOWN) recent[k] = t;
    const review = (Array.isArray(o.review) ? o.review : []).filter((r) => r && r.key && r.t > now - REVIEW_DAYS * 864e5).slice(-REVIEW_MAX);
    const asked = (Array.isArray(o.asked) ? o.asked : []).filter((k) => typeof k === "string").slice(-ASKED_MAX);
    const sounds = o.sounds && typeof o.sounds === "object" && !Array.isArray(o.sounds) ? o.sounds : {};
    return { v: 1, recent, review, asked, sounds };
  })();
  function store() {
    const now = Date.now();
    for (const [k, t] of Object.entries(ST.recent)) if (t <= now - COOLDOWN) delete ST.recent[k];
    ST.review = ST.review.slice(-REVIEW_MAX);
    ST.asked = ST.asked.slice(-ASKED_MAX);
    LS.set("pm-learn-v1", ST);
  }
  store();
  const keyOf = (recK, item) => recK + ":" + (item.w || item.en);
  /* Prefer items not shown recently; fall back to the whole pool rather than run dry. */
  function fresh(pool, recK) {
    const seen = new Set(ST.asked),
      f = pool.filter((x) => !seen.has(keyOf(recK, x)));
    return f.length ? f : pool;
  }
  function markAsked(q) {
    const k = keyOf(q.recK, q.item);
    ST.asked = ST.asked.filter((x) => x !== k).concat(k);
    store();
  }
  /* Review items due in a context other than where they were missed. */
  function dueItems(recK, ctx, filter) {
    const now = Date.now();
    return ST.review.filter((r) => r.recK === recK && r.ctx !== ctx && now - r.t > 60 * 1000 && (!filter || filter(r)));
  }

  /* ---------- KK phonetics ---------- */
  const MULTI = ["tʃ", "dʒ", "aɪ", "aʊ", "ɔɪ"];
  const VOWELS = new Set(["i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "o", "ʊ", "u", "ʌ", "ə", "ɝ", "ɚ", "aɪ", "aʊ", "ɔɪ", "a"]);
  /* Parse "[bəˋnænə]" into phonemes, syllable count and stressed syllable (1-based).
     Checked by hand against all 80 words of data/words.json (syllables and primary stress). */
  function parseKK(kk) {
    const s = String(kk || "").normalize("NFD").replace(/[[\]\s]/g, "");
    const toks = [];
    let stress = 0,
      stressAt = -1,
      i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "ˋ") {
        stress = toks.filter((t) => t.v).length + 1;
        stressAt = toks.length;
        i++;
        continue;
      }
      if (ch === "ˏ") {
        i++;
        continue;
      }
      if (/[̀-ͯ]/.test(ch)) {
        // combining dot below: syllabic l / n (ḷ ṇ)
        if (toks.length) toks[toks.length - 1].v = true;
        i++;
        continue;
      }
      const two = s.slice(i, i + 2);
      const p = MULTI.includes(two) ? two : ch;
      toks.push({ p, v: VOWELS.has(p) });
      i += p.length;
    }
    const syl = toks.filter((t) => t.v).length;
    return { toks, syl, stress: stress || (syl === 1 ? 1 : 0), stressAt, has: (sym) => toks.some((t) => t.p === sym) };
  }
  /* The stressed part of a KK string, for the explanation after a stress question: from ˋ through its vowel. */
  function stressSpan(kk) {
    const s = String(kk || "");
    const i = s.indexOf("ˋ");
    if (i < 0) return "";
    let j = i + 1,
      seenV = false;
    const chars = [...s.slice(i + 1).normalize("NFC")];
    let out = "ˋ";
    for (const c of chars) {
      if (c === "]" || c === "ˏ") break;
      const v = VOWELS.has(c) || /[ḷṇ]/.test(c);
      if (seenV && !v) break;
      if (v) seenV = true;
      out += c;
      j++;
    }
    return out;
  }

  /* KK micro-lessons: each unit teaches two sounds that learners often mix up.
     Hints describe the mouth and tongue; the sound itself is always a recorded demo word, never TTS of a symbol. */
  const SOUNDS = {
    i: { hint: "嘴角往兩旁拉開，舌頭前面抬高，聲音長而緊。", demo: ["tree", "key"] },
    ɪ: { hint: "比 /i/ 放鬆、短，嘴巴微開，舌頭稍微低一點。", demo: ["fish", "milk"] },
    æ: { hint: "下巴往下、嘴巴張大，嘴角往兩旁拉，舌頭平放在前面。", demo: ["cat", "apple"] },
    ɛ: { hint: "嘴巴半開，比 /æ/ 小，舌頭在中間偏前。", demo: ["egg", "bread"] },
    ɑ: { hint: "下巴放低、嘴巴張大，舌頭放低偏後。", demo: ["car", "star"] },
    ʌ: { hint: "嘴巴自然半開、放鬆，短促，舌頭在中間。", demo: ["sun", "bus"] },
    ʃ: { hint: "嘴唇往前微噘，舌面靠近上顎，持續送氣，喉嚨不振動。", demo: ["fish", "shoe"] },
    tʃ: { hint: "舌尖先貼住上排牙齦後方擋住氣，再一口氣放開，變成 /ʃ/。", demo: ["chair", "cheese"] },
    r: { hint: "舌尖往後捲或縮起，不碰到上顎，嘴唇微圓。", demo: ["rain", "tree"] },
    l: { hint: "舌尖頂住上排牙齦後方，聲音從舌頭兩側出來。", demo: ["lemon", "ball"] },
    s: { hint: "舌尖靠近上排牙齦，氣從縫隙吹出，喉嚨不振動。", demo: ["sun", "bus"] },
    z: { hint: "口形和 /s/ 一樣，但喉嚨會振動（摸喉嚨感覺得到）。", demo: ["cheese", "headphones"] },
  };
  const UNITS = [
    { id: "v1", lesson: "vowel", pair: ["i", "ɪ"], title: "長 /i/ 和短 /ɪ/" },
    { id: "v2", lesson: "vowel", pair: ["æ", "ɛ"], title: "/æ/ 和 /ɛ/" },
    { id: "v3", lesson: "vowel", pair: ["ɑ", "ʌ"], title: "/ɑ/ 和 /ʌ/" },
    { id: "c1", lesson: "consonant", pair: ["ʃ", "tʃ"], title: "/ʃ/ 和 /tʃ/" },
    { id: "c2", lesson: "consonant", pair: ["r", "l"], title: "/r/ 和 /l/" },
    { id: "c3", lesson: "consonant", pair: ["s", "z"], title: "/s/ 和 /z/" },
  ];
  const kkWords = () => WORDS.filter((w) => w.kk && w.au);
  const wordBy = (w) => kkWords().find((x) => x.w === w);
  /* Words that contain exactly one sound of the pair (so the answer is never ambiguous). */
  function pairWords(pair, sym) {
    const other = pair.find((p) => p !== sym);
    return kkWords().filter((w) => {
      const k = parseKK(w.kk);
      return k.has(sym) && !k.has(other);
    });
  }
  const wordChip = (w, showKK = true) => `<span class="qz-e">${pic(w)}</span><b>${esc(w.w)}</b>${showKK ? `<small class="qz-kk">${esc(w.kk)}</small>` : ""}`;
  const wordAns = (w) => ({ en: w.w, kk: w.kk, zh: w.z, file: w.au });
  /* Unit questions. kind "which": hear a word, pick which of the two sounds it has.
                      kind "find":  pick the word that has the target sound (the other option has the other sound). */
  function unitQuestion(unit, kind, avoid) {
    const [a, b] = unit.pair,
      sym = pick(unit.pair),
      other = sym === a ? b : a;
    const yes = fresh(pairWords(unit.pair, sym).filter((w) => w.w !== avoid), "w"),
      no = pairWords(unit.pair, other);
    const w = pick(yes.filter((x) => x.lv <= 2).length ? yes.filter((x) => x.lv <= 2) : yes);
    if (kind === "which")
      return {
        kind: "kk", recK: "w", item: w, sym, unit: unit.id,
        prompt: `<p class="qz-ask">聽 <b>${esc(w.w)}</b>，它有哪一個音？</p>`,
        audio: { text: w.w, file: w.au, label: `再聽 ${w.w}` }, autoplay: true,
        options: shuf(unit.pair).map((p) => ({ html: `<span class="qz-sym">/${esc(p)}/</span>`, ok: p === sym })),
        answer: wordAns(w),
        explain: `${w.w} ${w.kk} 裡的是 /${sym}/。`,
      };
    const n = pick(no.filter((x) => x.lv <= 2).length ? no.filter((x) => x.lv <= 2) : no);
    return {
      kind: "kk", recK: "w", item: w, sym, unit: unit.id,
      prompt: `<p class="qz-ask">哪個單字有 <b class="qz-sym">/${esc(sym)}/</b>？</p><p class="qz-hint">${esc(SOUNDS[sym].hint)}</p>`,
      options: shuf([w, n]).map((x) => ({ html: wordChip(x), ok: x === w, say: { text: x.w, file: x.au } })),
      answer: wordAns(w),
      explain: `${w.w} ${w.kk} 有 /${sym}/；${n.w} ${n.kk} 是 /${other}/。`,
      after: true,
    };
  }
  /* Stress question: two-syllable words first (level 1), then three. */
  function stressQuestion(level = 1) {
    const pool = kkWords().filter((w) => {
      const k = parseKK(w.kk);
      return k.stress >= 1 && (level === 1 ? k.syl === 2 : k.syl === 3);
    });
    const w = pick(fresh(pool.filter((x) => x.lv <= 2).length ? pool.filter((x) => x.lv <= 2) : pool, "w")),
      k = parseKK(w.kk);
    return {
      kind: "kk", recK: "w", item: w,
      prompt: `<div class="qz-big">${pic(w)}</div><p class="qz-ask"><b>${esc(w.w)}</b> <span class="qz-kk">${esc(w.kk)}</span> 的重音在第幾個音節？</p><p class="qz-hint">共 ${k.syl} 個音節。ˋ 標在重讀音節的前面；重讀的音節比較長、比較響亮。</p>`,
      audio: { text: w.w, file: w.au, label: `聽 ${w.w}` }, autoplay: true,
      options: Array.from({ length: k.syl }, (_, i) => ({ html: `第 ${i + 1} 音節`, ok: i + 1 === k.stress })),
      answer: wordAns(w),
      explain: `重讀部分是 ${stressSpan(w.kk)}：第 ${k.stress} 個音節。`,
    };
  }
  /* Whole-word questions, limited to words whose vowels were taught. */
  function wordKK(kind, taught) {
    const ok = (w) => parseKK(w.kk).toks.filter((t) => t.v && t.p !== "ə").every((t) => !taught || taught.has(t.p));
    let pool = kkWords().filter(ok);
    if (pool.length < 4) pool = kkWords();
    const w = pick(fresh(pool, "w"));
    const opts = dedupe([w, ...shuf(pool.filter((x) => x !== w && x.kk !== w.kk))], (x) => x.kk).slice(0, 3);
    if (kind === "listen")
      return {
        kind: "kk", recK: "w", item: w,
        prompt: `<p class="qz-ask">聽發音，選出正確的 KK 音標</p>`,
        audio: { text: w.w, file: w.au, label: "再聽一次" }, autoplay: true,
        options: shuf(opts).map((x) => ({ html: `<span class="qz-kk big">${esc(x.kk)}</span>`, ok: x === w })),
        answer: wordAns(w),
      };
    return {
      kind: "kk", recK: "w", item: w,
      prompt: `<p class="qz-ask">看音標，選出這個單字</p><p class="qz-sym big">${esc(w.kk)}</p>`,
      options: shuf(dedupe(opts, (x) => x.w)).map((x) => ({ html: wordChip(x, false), ok: x === w })),
      answer: wordAns(w),
      after: true,
    };
  }
  /* Battle phonics question: only from units already taught (prefer sounds due for review). */
  function phonicsQuestion(taughtUnits) {
    const units = UNITS.filter((u) => taughtUnits.includes(u.id));
    if (!units.length) return wordKK("listen");
    const due = units.filter((u) => u.pair.some((s) => soundDue(s)));
    return unitQuestion(pick(due.length ? due : units), Math.random() < 0.5 ? "which" : "find");
  }
  /* Per-sound mastery, kept in pm-learn-v1 next to the review list. */
  function soundMark(sym, ok) {
    ST.sounds = ST.sounds || {};
    const r = (ST.sounds[sym] = ST.sounds[sym] || { ok: 0, miss: 0, due: false }),
      now = Date.now();
    if (!ok) {
      r.miss++;
      r.due = true;
      r.missAt = now;
      r.later = 0;
    } else {
      r.ok++;
      // A missed sound clears only after two correct answers at least 10 minutes after the miss (a later review).
      if (r.due && now - (r.missAt || 0) > 10 * 60 * 1000 && ++r.later >= 2) r.due = false;
    }
    store();
  }
  const soundDue = (sym) => !!(ST.sounds && ST.sounds[sym] && ST.sounds[sym].due);
  const soundsDue = () => Object.entries(ST.sounds || {}).filter(([, r]) => r.due).map(([s]) => s);

  /* ---------- words and sentences ---------- */
  function dedupe(list, keyFn) {
    const seen = new Set();
    return list.filter((x) => {
      const k = keyFn(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function wordQuestion(filter, mode, ctx) {
    const base = WORDS.filter((w) => lvOk(w) && (!filter || filter(w)));
    const due = dueItems("w", ctx, (r) => base.some((w) => w.w === r.id)).map((r) => base.find((w) => w.w === r.id));
    const pool = base.length ? base : WORDS.filter(lvOk);
    const w = due.length && Math.random() < 0.5 ? pick(due) : pick(fresh(pool, "w"));
    const opts = dedupe([w, ...shuf(WORDS.filter((x) => x !== w && lvOk(x) && x.e !== w.e))], (x) => x.w).slice(0, 4);
    mode = mode || pick(["pic", "pic", "listen", "zh"]);
    if (mode === "listen")
      return {
        kind: "w", recK: "w", item: w,
        prompt: `<p class="qz-ask">聽英文，選出對的圖</p>`,
        audio: { text: w.w, file: w.au, label: "再聽一次" }, autoplay: true,
        options: shuf(opts).map((x) => ({ html: `<span class="qz-e big">${pic(x)}</span>`, ok: x === w, label: x.w })),
        answer: wordAns(w), cols: 4,
      };
    if (mode === "zh")
      return {
        kind: "w", recK: "w", item: w,
        prompt: `<p class="qz-ask">「${esc(w.z)}」的英文是？</p>`,
        options: shuf(opts).map((x) => ({ html: `<b>${esc(x.w)}</b>`, ok: x === w })),
        answer: wordAns(w), after: true,
      };
    return {
      kind: "w", recK: "w", item: w,
      prompt: `<div class="qz-big">${pic(w)}</div><p class="qz-ask">這是哪個英文單字？</p>`,
      options: shuf(opts).map((x) => ({ html: `<b>${esc(x.w)}</b>`, ok: x === w })),
      answer: wordAns(w), after: true,
    };
  }
  function sentQuestion(filter, ctx) {
    const base = SENT.filter((s) => lvOk(s) && (!filter || filter(s)));
    const pool = base.length ? base : SENT.filter(lvOk);
    const due = dueItems("s", ctx, (r) => pool.some((s) => s.en === r.id)).map((r) => pool.find((s) => s.en === r.id));
    const it = due.length && Math.random() < 0.5 ? pick(due) : pick(fresh(pool, "s"));
    if (it.b && Math.random() < 0.6) {
      const html = esc(it.en).replace(new RegExp("\\b" + it.b + "\\b"), '<span class="qz-gap">＿＿＿</span>');
      return {
        kind: "s", recK: "s", item: it,
        prompt: `<div class="qz-big small">${pic(it)}</div><p class="qz-sent">${html}</p><p class="qz-hint">${esc(it.zh)}</p>`,
        options: shuf(dedupe([it.b, ...it.o], (x) => x.toLowerCase())).map((o) => ({ html: `<b>${esc(o)}</b>`, ok: o === it.b })),
        answer: { en: it.en, zh: it.zh, file: it.au }, after: true,
      };
    }
    const opts = dedupe([it, ...shuf(SENT.filter((x) => x !== it && lvOk(x)))], (x) => x.en).slice(0, 3);
    return {
      kind: "s", recK: "s", item: it,
      prompt: `<p class="qz-ask">「${esc(it.zh)}」英文怎麼說？</p>`,
      options: shuf(opts).map((x) => ({ html: esc(x.en), ok: x === it, wide: true })),
      answer: { en: it.en, zh: it.zh, file: it.au }, after: true,
    };
  }

  /* ---------- scene conversation (shared with the commute mode) ---------- */
  const scene = (catId, sceneId) => {
    const c = SCN.find((x) => x.id === catId);
    return c && c.scenes.find((x) => x.id === sceneId);
  };
  const contentId = (catId, sceneId) => {
    const c = SCN.find((x) => x.id === catId),
      sc = scene(catId, sceneId);
    return c && sc ? `${c.element || c.id}/${c.id}/${sc.id}/${sc.lv || 1}` : "";
  };
  /* Reply question. mode "listen" (story default): hear what the other person says and choose a fitting reply;
     the Chinese cue stays folded until opened. Lines that answer the same question are all reasonable replies,
     so they are never offered as wrong options for each other. */
  function sceneQuestion(catId, sceneId, idx, opt = {}) {
    const sc = scene(catId, sceneId);
    if (!sc) return wordQuestion();
    const items = sc.items,
      ctx = opt.ctx || `scene:${sceneId}`;
    let it;
    if (idx != null) it = items[idx % items.length];
    else {
      const due = dueItems("s", ctx, (r) => items.some((x) => x.en === r.id));
      it = due.length && Math.random() < 0.6 ? items.find((x) => x.en === pick(due).id) : pick(fresh(items, "s"));
    }
    const sameQ = (x) => it.q && x.q && x.q === it.q;
    const wrong = shuf(items.filter((x) => x.en !== it.en && !sameQ(x))).slice(0, 2);
    const item = { en: it.en, zh: it.zh, q: it.q || "" };
    const listen = opt.mode === "listen" && it.q;
    return {
      kind: "s", recK: "s", item,
      prompt: listen
        ? `<p class="qz-their">🗣️ ${sayHTML(it.q)}</p><p class="qz-ask">你要怎麼回答？</p><details class="qz-cue"><summary>中文提示</summary>${esc(it.zh)}</details>`
        : (it.q ? `<p class="qz-their">🗣️ ${sayHTML(it.q)}</p>` : "") + `<p class="qz-ask">${it.q ? "你想回答" : "你想說"}：「${esc(it.zh)}」</p>`,
      audio: it.q ? { text: it.q, label: "再聽對方說" } : null,
      autoplay: !!it.q,
      options: shuf(dedupe([it, ...wrong], (x) => x.en)).map((x) => ({ html: esc(x.en), ok: x.en === it.en, wide: true })),
      answer: { en: it.en, zh: it.zh },
      after: true,
      ctx,
    };
  }

  /* ---------- grading ---------- */
  function grade(q, ok, src) {
    const key = keyOf(q.recK, q.item),
      now = Date.now(),
      isFresh = !(ST.recent[key] > now - COOLDOWN),
      ctx = q.ctx || src || "";
    tally.n++;
    if (ok) tally.ok++;
    tally.items.push({ en: q.item.w || q.item.en, ok, sym: q.sym });
    if (ok && isFresh) {
      P.correct++;
      P[q.recK === "s" ? "s" : "w"]++;
      addXP(src === "battle" ? 6 : 8);
      award("first");
      if (P.w >= 30) award("w30");
      if (P.s >= 30) award("s30");
      if (P.correct >= 100) award("c100");
      saveP();
    }
    if (isFresh || !ok) {
      const saved = S.rep;
      S.rep = rep;
      try {
        record([{ k: q.recK, it: q.item, ok }]);
      } finally {
        S.rep = saved;
      }
    }
    // Review list: wrong answers wait; a later correct answer in another context clears them.
    const id = q.item.w || q.item.en;
    if (!ok) {
      ST.review = ST.review.filter((r) => r.key !== key).concat({ key, recK: q.recK, id, ctx, t: now });
    } else {
      ST.review = ST.review.filter((r) => !(r.key === key && (r.ctx !== ctx || now - r.t > 10 * 60 * 1000)));
      ST.recent[key] = now;
    }
    if (q.sym) soundMark(q.sym, ok);
    store();
    return { fresh: isFresh };
  }
  /* One pm-log entry for the quest or battle that just ended (only when English was answered).
     Returns a summary for the end screen: what was used, what still needs practice. */
  function flush(m, label) {
    if (!tally.n && !tally.timeouts) return null;
    const summary = {
      ok: tally.ok,
      n: tally.n,
      good: [...new Set(tally.items.filter((x) => x.ok).map((x) => x.en))],
      weak: [...new Set(tally.items.filter((x) => !x.ok).map((x) => x.en))],
      sounds: [...new Set(tally.items.filter((x) => !x.ok && x.sym).map((x) => x.sym))],
    };
    const log = LS.get("pm-log", []);
    log.unshift({
      t: Date.now(), m, sc: tally.ok, tot: tally.n,
      n: [...rep.newW.keys(), ...rep.newS.keys()],
      r: rep.revW.size + rep.revS.size,
      w: [...rep.weakW.keys(), ...rep.weakS.keys()],
      ...(label ? { scn: label } : {}),
      ...(tally.timeouts ? { to: tally.timeouts } : {}),
      ...(tally.assisted ? { as: tally.assisted } : {}),
    });
    LS.set("pm-log", log.slice(0, 30));
    const days = LS.get("pm-days", []),
      today = dayKey(Date.now());
    if (!days.includes(today)) {
      days.push(today);
      LS.set("pm-days", days.slice(-400));
    }
    const sd = streakDays();
    if (sd >= 3) award("day3");
    if (sd >= 7) award("day7");
    rep = freshRep();
    tally = { n: 0, ok: 0, items: [], timeouts: 0, assisted: 0 };
    return summary;
  }

  /* ---------- question UI (dialog box and battle panel) ---------- */
  /* Tap-to-hear markup (pron.js); plain text when it is not loaded (e.g. the content checks). */
  const hasPron = () => typeof Pron !== "undefined";
  const sayHTML = (t, f) => (hasPron() ? Pron.sent(t, f) : esc(t));
  /* Each option: the answer button plus, for plain-English options, a separate 🔊 control next to it.
     Listening never submits; the 🔊 keeps working after the question is settled. */
  function optionsHTML(q, disabled) {
    return q.options
      .map((o, i) => {
        const s = hasPron() && Pron.optionText(o);
        return `<div class="qz-opt"><button type="button" data-i="${i}"${o.label ? ` aria-label="${esc(o.label)}"` : ""}${disabled ? " disabled" : ""}>${o.html}</button>${s ? Pron.hear(s.text, s.file) : ""}</div>`;
      })
      .join("");
  }
  /* The revealed answer: tap the line to hear it again, tap a word for its KK. */
  const answerHTML = (a) => (a.en ? `<span class="qz-ans">${sayHTML(a.en, a.file || "")}</span>` : "");
  function play(a) {
    if (a) speak(a.text, a.file || "");
  }
  /* Renders q into el. Resolves {ok} after the player taps Continue (or at once with opt.auto).
     opt.onAnswer(ok) runs the moment an option is chosen, so battles can show the effect immediately.
     opt.retry: on a wrong answer, offer one more try at the same question before revealing it. */
  function ask(el, q, opt = {}) {
    last = q; // test hook: lets automated tests pick an option; never rendered
    markAsked(q);
    return new Promise((res) => {
      const wide = q.options.some((o) => o.wide);
      el.innerHTML = `<div class="qz"><div class="qz-p">${q.prompt}</div>${q.audio ? `<button class="qz-say" type="button">🔊 ${esc(q.audio.label || "再聽一次")}</button>` : ""}<div class="qz-o${wide ? " wide" : ""}${q.cols ? " c" + q.cols : ""}">${optionsHTML(q)}</div><div class="qz-f" role="status"></div></div>`;
      const say = el.querySelector(".qz-say");
      if (say) say.onclick = () => play(q.audio);
      if (q.autoplay) setTimeout(() => play(q.audio), 250);
      const bs = [...el.querySelectorAll(".qz-o button")];
      let tries = 0;
      bs.forEach(
        (b) =>
          (b.onclick = () => {
            const o = q.options[+b.dataset.i],
              ok = !!o.ok;
            if (!ok && opt.retry && tries === 0) {
              // first miss: a hint and one more try, nothing recorded yet
              tries++;
              tally.items.push({ en: q.item.w || q.item.en, ok: false, sym: q.sym }); // shows up as "to review" in the summary
              if (q.sym) soundMark(q.sym, false);
              const k0 = keyOf(q.recK, q.item);
              ST.review = ST.review.filter((r) => r.key !== k0).concat({ key: k0, recK: q.recK, id: q.item.w || q.item.en, ctx: q.ctx || opt.src || "", t: Date.now() });
              store();
              b.disabled = true;
              b.classList.add("wrong");
              SND.play("wrong");
              el.querySelector(".qz-f").innerHTML = `<b class="bad">再試一次</b><small>${esc(q.retryHint || "再聽一次，注意剛剛示範的口形。")}</small>`;
              if (q.audio) play(q.audio);
              return;
            }
            bs.forEach((x, i) => {
              x.disabled = true;
              if (q.options[i].ok) x.classList.add("right");
            });
            if (!ok) b.classList.add("wrong");
            SND.play(ok ? "correct" : "wrong");
            const g = grade(q, ok, opt.src);
            const a = q.answer || {};
            el.querySelector(".qz-f").innerHTML = `<b class="${ok ? "good" : "bad"}">${ok ? (tries ? "答對了（第二次）" : "答對了！") : "正確答案"}</b> ${answerHTML(a)}${a.kk ? ` <span class="qz-kk">${esc(a.kk)}</span>` : ""} <span class="qz-zh">${esc(a.zh || "")}</span>${q.explain ? `<small>${esc(q.explain)}</small>` : ""}${ok && !g.fresh ? "<small>剛剛練過這題，這次不重複計分。</small>" : ""}`;
            if (q.after || !ok || q.kind === "kk") speak(a.en, a.file || "");
            if (opt.onAnswer) opt.onAnswer(ok);
            if (opt.auto) return res({ ok, tries });
            const go = document.createElement("button");
            go.type = "button";
            go.className = "qz-next";
            go.textContent = opt.next || "繼續";
            go.onclick = () => res({ ok, tries });
            el.querySelector(".qz").appendChild(go);
            go.focus({ preventScroll: true });
          }),
      );
    });
  }

  return {
    parseKK, stressSpan, SOUNDS, UNITS, wordBy, pairWords, unitQuestion, stressQuestion, wordKK, phonicsQuestion,
    soundDue, soundsDue, wordQuestion, sentQuestion, sceneQuestion, scene, contentId, setScenes,
    grade, flush, ask, play, dueItems, optionsHTML, answerHTML, sayHTML,
    /* A question shown outside Learn.ask (the timed battle) still counts as "recently asked". */
    track(q) {
      last = q;
      markAsked(q);
    },
    /* Time ran out: not a language error. Kept as review metadata only (why: "timeout"); cards and XP untouched. */
    timeout(q) {
      const key = keyOf(q.recK, q.item);
      tally.timeouts++;
      tally.items.push({ en: q.item.w || q.item.en, ok: false, timeout: true });
      ST.review = ST.review.filter((r) => r.key !== key).concat({ key, recK: q.recK, id: q.item.w || q.item.en, ctx: q.ctx || "battle", t: Date.now(), why: "timeout" });
      store();
    },
    /* Answered after a hint left only one option: practice, not a mastery check (no XP, no card progress). */
    assisted(q) {
      tally.assisted++;
      tally.items.push({ en: q.item.w || q.item.en, ok: true, assisted: true });
    },
    /* The commute mode's spoken answers update the review list only (it keeps its own XP and records). */
    note(recK, item, ok, ctx) {
      const key = keyOf(recK, item),
        now = Date.now();
      if (ok) ST.review = ST.review.filter((r) => !(r.key === key && r.ctx !== ctx));
      else ST.review = ST.review.filter((r) => r.key !== key).concat({ key, recK, id: item.w || item.en, ctx, t: now });
      store();
    },
    /* sentences waiting for review in one scene (for the commute mode's priority queue) */
    reviewIn(items) {
      const ids = new Set(ST.review.filter((r) => r.recK === "s").map((r) => r.id));
      return items.filter((x) => ids.has(x.en));
    },
    // Legacy helper kept for the old quest generator
    kkQuestion(type) {
      if (type === "stress") return stressQuestion(1);
      if (type === "listen" || type === "read") return wordKK(type);
      const units = UNITS.filter((u) => u.lesson === type);
      return unitQuestion(pick(units.length ? units : UNITS), "find");
    },
    get last() {
      return last;
    },
    get tally() {
      return { ...tally };
    },
    get state() {
      return ST;
    },
  };
})();
