/* Shared English questions for quests, battles and the KK village.
   Every answer goes through Learn.grade, which writes to the existing records (pm-cards / pm-sents via record(),
   P counters, XP, badges) and Learn.flush adds one pm-log entry per quest or battle.
   Anti-farming: the same item answered correctly again within 3 minutes gives no XP and no new card progress. */
const Learn = (() => {
  const COOLDOWN = 3 * 60 * 1000;
  const recent = new Map();
  const freshRep = () => ({ newW: new Map(), revW: new Map(), weakW: new Map(), newS: new Map(), revS: new Map(), weakS: new Map() });
  let rep = freshRep(),
    tally = { n: 0, ok: 0 };
  let SCN = [],
    last = null;
  const setScenes = (c) => (SCN = Array.isArray(c) ? c : []);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuf = (a) => shuffle(a.slice());
  const lvOk = (x) => x.lv <= maxLv();

  /* ---------- KK phonetics ---------- */
  const MULTI = ["tʃ", "dʒ", "aɪ", "aʊ", "ɔɪ"];
  const VOWELS = new Set(["i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "o", "ʊ", "u", "ʌ", "ə", "ɝ", "ɚ", "aɪ", "aʊ", "ɔɪ", "a"]);
  /* Parse "[bəˋnænə]" into phonemes, syllable count and stressed syllable (1-based). */
  function parseKK(kk) {
    const s = String(kk || "").normalize("NFD").replace(/[[\]\s]/g, "");
    const toks = [];
    let stress = 0,
      i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "ˋ") {
        stress = toks.filter((t) => t.v).length + 1;
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
    return { toks, syl, stress: stress || (syl === 1 ? 1 : 0), has: (sym) => toks.some((t) => t.p === sym) };
  }
  // Symbol, Chinese hint, preferred demo word (must contain the sound and have a recording).
  const KK_V = [
    ["i", "長音 i，像中文「衣」拉長", "tree"],
    ["ɪ", "短音 i，嘴巴放鬆", "fish"],
    ["e", "像「欸」", "cake"],
    ["ɛ", "嘴巴張大一點的「欸」", "egg"],
    ["æ", "嘴角往兩邊拉的「ㄝ＋ㄚ」", "apple"],
    ["ɑ", "嘴巴張大的「啊」", "car"],
    ["ɔ", "圓唇的「喔」", "dog"],
    ["o", "像「歐」", "phone"],
    ["ʊ", "短而放鬆的「ㄨ」", "book"],
    ["u", "長音「烏」", "moon"],
    ["ʌ", "短促的「ㄜ」", "sun"],
    ["ə", "輕聲的弱母音", "banana"],
    ["ɝ", "捲舌的重音「ㄦ」", "bird"],
    ["ɚ", "捲舌的輕音「ㄦ」", "tiger"],
    ["aɪ", "雙母音「愛」", "bike"],
    ["aʊ", "雙母音「凹」", "house"],
  ];
  const KK_C = [
    ["θ", "舌尖輕咬，吹氣不出聲", "thermometer"],
    ["ʃ", "像「噓」", "fish"],
    ["tʃ", "像「去」", "cheese"],
    ["dʒ", "像「居」", "bridge"],
    ["ŋ", "鼻音，像「ㄥ」的尾巴", "bank"],
    ["v", "上齒碰下唇，有聲", "volcano"],
    ["f", "上齒碰下唇，無聲", "flower"],
    ["r", "捲舌的 r", "rain"],
    ["l", "舌尖頂上齒後", "lemon"],
    ["z", "有聲的 s", "headphones"],
  ];
  const kkWords = () => WORDS.filter((w) => w.kk && w.au);
  function demoFor(sym, pref) {
    const ws = kkWords();
    return ws.find((w) => w.w === pref && parseKK(w.kk).has(sym)) || ws.find((w) => parseKK(w.kk).has(sym));
  }
  function symbols(group) {
    const ws = kkWords();
    return (group === "vowel" ? KK_V : KK_C).filter(([sym]) => {
      const n = ws.filter((w) => parseKK(w.kk).has(sym)).length;
      return n >= 2 && ws.length - n >= 2;
    });
  }
  const wordChip = (w, showKK = true) => `<span class="qz-e">${pic(w)}</span><b>${esc(w.w)}</b>${showKK ? `<small class="qz-kk">${esc(w.kk)}</small>` : ""}`;
  const wordAns = (w) => ({ en: w.w, kk: w.kk, zh: w.z, file: w.au });

  function kkQuestion(type) {
    const ws = kkWords();
    if (type === "vowel" || type === "consonant") {
      const [sym, hint, pref] = pick(symbols(type));
      const demo = demoFor(sym, pref),
        yes = shuf(ws.filter((w) => w !== demo && parseKK(w.kk).has(sym))),
        no = shuf(ws.filter((w) => !parseKK(w.kk).has(sym)));
      const right = yes.find(lvOk) || yes[0],
        opts = shuf([right, ...no.filter(lvOk).slice(0, 2).concat(no).slice(0, 2)]);
      return {
        kind: "kk",
        recK: "w",
        item: right,
        prompt: `<p class="qz-ask">哪個單字裡有 <b class="qz-sym">/${esc(sym)}/</b> 的音？</p><p class="qz-hint">${esc(hint)}。示範單字：<b>${esc(demo.w)}</b> <span class="qz-kk">${esc(demo.kk)}</span></p>`,
        audio: { text: demo.w, file: demo.au, label: `聽示範 ${demo.w}` },
        autoplay: true,
        options: opts.map((w) => ({ html: wordChip(w), ok: w === right })),
        answer: wordAns(right),
        explain: `${right.w} 的音標 ${right.kk} 裡有 /${sym}/。`,
      };
    }
    if (type === "stress") {
      const pool = ws.filter((w) => {
        const k = parseKK(w.kk);
        return k.syl >= 2 && k.syl <= 4 && k.stress >= 1;
      });
      const w = pick(pool.filter(lvOk).length ? pool.filter(lvOk) : pool),
        k = parseKK(w.kk);
      return {
        kind: "kk",
        recK: "w",
        item: w,
        prompt: `<div class="qz-big">${pic(w)}</div><p class="qz-ask"><b>${esc(w.w)}</b> 的重音在第幾個音節？</p><p class="qz-hint">共 ${k.syl} 個音節。聽聽看哪一段比較重、比較長。</p>`,
        audio: { text: w.w, file: w.au, label: `聽 ${w.w}` },
        autoplay: true,
        options: Array.from({ length: k.syl }, (_, i) => ({ html: `第 ${i + 1} 音節`, ok: i + 1 === k.stress })),
        answer: wordAns(w),
        explain: `重音符號 ˋ 標在第 ${k.stress} 個音節前面：${w.kk}`,
      };
    }
    if (type === "listen") {
      const w = pick(ws.filter(lvOk)),
        opts = shuf([w, ...shuf(ws.filter((x) => x !== w && x.kk !== w.kk)).slice(0, 2)]);
      return {
        kind: "kk",
        recK: "w",
        item: w,
        prompt: `<p class="qz-ask">聽發音，選出正確的 KK 音標</p>`,
        audio: { text: w.w, file: w.au, label: "再聽一次" },
        autoplay: true,
        options: opts.map((x) => ({ html: `<span class="qz-kk big">${esc(x.kk)}</span>`, ok: x === w })),
        answer: wordAns(w),
      };
    }
    // read: see KK, choose the word
    const w = pick(ws.filter(lvOk)),
      opts = shuf([w, ...shuf(ws.filter((x) => x !== w)).slice(0, 2)]);
    return {
      kind: "kk",
      recK: "w",
      item: w,
      prompt: `<p class="qz-ask">看音標，選出這個單字</p><p class="qz-sym big">${esc(w.kk)}</p>`,
      options: opts.map((x) => ({ html: wordChip(x, false), ok: x === w })),
      answer: wordAns(w),
      after: true,
    };
  }

  /* ---------- words and sentences ---------- */
  function wordQuestion(filter, mode) {
    const base = WORDS.filter((w) => lvOk(w) && (!filter || filter(w)));
    const w = pick(base.length ? base : WORDS.filter(lvOk)),
      others = shuf(WORDS.filter((x) => x !== w && lvOk(x))).slice(0, 3),
      opts = shuf([w, ...others]);
    mode = mode || pick(["pic", "pic", "listen", "zh"]);
    if (mode === "listen")
      return {
        kind: "w", recK: "w", item: w,
        prompt: `<p class="qz-ask">聽英文，選出對的圖</p>`,
        audio: { text: w.w, file: w.au, label: "再聽一次" }, autoplay: true,
        options: opts.map((x) => ({ html: `<span class="qz-e big">${pic(x)}</span>`, ok: x === w, label: x.w })),
        answer: wordAns(w), cols: 4,
      };
    if (mode === "zh")
      return {
        kind: "w", recK: "w", item: w,
        prompt: `<p class="qz-ask">「${esc(w.z)}」的英文是？</p>`,
        options: opts.map((x) => ({ html: `<b>${esc(x.w)}</b>`, ok: x === w })),
        answer: wordAns(w), after: true,
      };
    return {
      kind: "w", recK: "w", item: w,
      prompt: `<div class="qz-big">${pic(w)}</div><p class="qz-ask">這是哪個英文單字？</p>`,
      options: opts.map((x) => ({ html: `<b>${esc(x.w)}</b>`, ok: x === w })),
      answer: wordAns(w), after: true,
    };
  }
  function sentQuestion(filter) {
    const base = SENT.filter((s) => lvOk(s) && (!filter || filter(s)));
    const it = pick(base.length ? base : SENT.filter(lvOk));
    if (it.b && Math.random() < 0.6) {
      const html = esc(it.en).replace(new RegExp("\\b" + it.b + "\\b"), '<span class="qz-gap">＿＿＿</span>');
      return {
        kind: "s", recK: "s", item: it,
        prompt: `<div class="qz-big small">${pic(it)}</div><p class="qz-sent">${html}</p><p class="qz-hint">${esc(it.zh)}</p>`,
        options: shuf([it.b, ...it.o]).map((o) => ({ html: `<b>${esc(o)}</b>`, ok: o === it.b })),
        answer: { en: it.en, zh: it.zh, file: it.au }, after: true,
      };
    }
    const opts = shuf([it, ...shuf(SENT.filter((x) => x !== it && lvOk(x))).slice(0, 2)]);
    return {
      kind: "s", recK: "s", item: it,
      prompt: `<p class="qz-ask">「${esc(it.zh)}」英文怎麼說？</p>`,
      options: opts.map((x) => ({ html: esc(x.en), ok: x === it, wide: true })),
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
  /* Reply question: the other person speaks (English), you pick what to answer. */
  function sceneQuestion(catId, sceneId, idx) {
    const sc = scene(catId, sceneId);
    if (!sc) return wordQuestion();
    const items = sc.items,
      it = idx != null ? items[idx % items.length] : pick(items),
      wrong = shuf(items.filter((x) => x.en !== it.en)).slice(0, 2);
    const item = { en: it.en, zh: it.zh, q: it.q || "" };
    return {
      kind: "s", recK: "s", item,
      prompt: (it.q ? `<p class="qz-their">🗣️ ${esc(it.q)}</p>` : "") + `<p class="qz-ask">${it.q ? "你想回答" : "你想說"}：「${esc(it.zh)}」</p>`,
      audio: it.q ? { text: it.q, label: "再聽對方說" } : null,
      autoplay: !!it.q,
      options: shuf([it, ...wrong]).map((x) => ({ html: esc(x.en), ok: x.en === it.en, wide: true })),
      answer: { en: it.en, zh: it.zh },
      after: true,
    };
  }
  /* A free choice inside a conversation (both answers are fine English; the story branches on it). */

  /* ---------- grading ---------- */
  function grade(q, ok, src) {
    const key = q.recK + ":" + (q.item.w || q.item.en),
      now = Date.now(),
      fresh = !(recent.get(key) > now - COOLDOWN);
    tally.n++;
    if (ok) tally.ok++;
    if (ok && fresh) {
      P.correct++;
      P[q.recK === "s" ? "s" : "w"]++;
      addXP(src === "battle" ? 6 : 8);
      award("first");
      if (P.w >= 30) award("w30");
      if (P.s >= 30) award("s30");
      if (P.correct >= 100) award("c100");
      saveP();
    }
    if (fresh || !ok) {
      const saved = S.rep;
      S.rep = rep;
      try {
        record([{ k: q.recK, it: q.item, ok }]);
      } finally {
        S.rep = saved;
      }
    }
    if (ok) recent.set(key, now);
    return { fresh };
  }
  /* One pm-log entry for the quest or battle that just ended (only when English was answered). */
  function flush(m, label) {
    if (!tally.n) return false;
    const log = LS.get("pm-log", []);
    log.unshift({
      t: Date.now(), m, sc: tally.ok, tot: tally.n,
      n: [...rep.newW.keys(), ...rep.newS.keys()],
      r: rep.revW.size + rep.revS.size,
      w: [...rep.weakW.keys(), ...rep.weakS.keys()],
      ...(label ? { scn: label } : {}),
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
    tally = { n: 0, ok: 0 };
    return true;
  }

  /* ---------- question UI (dialog box and battle panel) ---------- */
  function play(a) {
    if (a) speak(a.text, a.file || "");
  }
  /* Renders q into el. Resolves {ok} after the player taps Continue (or at once with opt.auto).
     opt.onAnswer(ok) runs the moment an option is chosen, so battles can show the effect immediately. */
  function ask(el, q, opt = {}) {
    last = q; // test hook: lets automated tests pick an option; never rendered
    return new Promise((res) => {
      const wide = q.options.some((o) => o.wide);
      el.innerHTML = `<div class="qz"><div class="qz-p">${q.prompt}</div>${q.audio ? `<button class="qz-say" type="button">🔊 ${esc(q.audio.label || "再聽一次")}</button>` : ""}<div class="qz-o${wide ? " wide" : ""}${q.cols ? " c" + q.cols : ""}">${q.options.map((o, i) => `<button type="button" data-i="${i}"${o.label ? ` aria-label="${esc(o.label)}"` : ""}>${o.html}</button>`).join("")}</div><div class="qz-f" role="status"></div></div>`;
      const say = el.querySelector(".qz-say");
      if (say) say.onclick = () => play(q.audio);
      if (q.autoplay) setTimeout(() => play(q.audio), 250);
      const bs = [...el.querySelectorAll(".qz-o button")];
      bs.forEach(
        (b) =>
          (b.onclick = () => {
            const o = q.options[+b.dataset.i],
              ok = !!o.ok;
            bs.forEach((x, i) => {
              x.disabled = true;
              if (q.options[i].ok) x.classList.add("right");
            });
            if (!ok) b.classList.add("wrong");
            SND.play(ok ? "correct" : "wrong");
            const g = grade(q, ok, opt.src);
            const a = q.answer || {};
            el.querySelector(".qz-f").innerHTML = `<b class="${ok ? "good" : "bad"}">${ok ? "答對了！" : "正確答案"}</b> <span class="qz-ans">${esc(a.en || "")}</span>${a.kk ? ` <span class="qz-kk">${esc(a.kk)}</span>` : ""} <span class="qz-zh">${esc(a.zh || "")}</span>${q.explain ? `<small>${esc(q.explain)}</small>` : ""}${ok && !g.fresh ? "<small>剛剛練過這題，這次不重複計分。</small>" : ""}`;
            if (q.after || !ok || q.kind === "kk") speak(a.en, a.file || "");
            if (opt.onAnswer) opt.onAnswer(ok);
            if (opt.auto) return res({ ok });
            const go = document.createElement("button");
            go.type = "button";
            go.className = "qz-next";
            go.textContent = opt.next || "繼續";
            go.onclick = () => res({ ok });
            el.querySelector(".qz").appendChild(go);
            go.focus({ preventScroll: true });
          }),
      );
    });
  }

  return {
    parseKK, symbols, kkQuestion, wordQuestion, sentQuestion, sceneQuestion, scene, contentId, setScenes,
    grade, flush, ask, play,
    get scenes() {
      return SCN;
    },
    get last() {
      return last;
    },
    get tally() {
      return { ...tally };
    },
  };
})();
