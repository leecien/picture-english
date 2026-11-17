/* LEARNING-PROFILE-01 熟悉度計算模組（外部 AI，2026-11-18）。純函式，不讀寫 localStorage、不碰 DOM。
   Browser: window.LearningProfile；Node: module.exports。
   規則文件：RULES.md。所有門檻都在 RULES 常數裡，面板顯示的「評估依據」直接取自計算結果，不另外推測。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LearningProfile = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 864e5;
  const RULES = Object.freeze({
    version: "lp-rules-v1",
    spacingMs: DAY, // 同一題同一能力 24 小時內再作答，只算練習，不算新的獨立證據
    lookbackMs: 90 * DAY, // 只看最近 90 天的證據
    staleMs: 30 * DAY, // 最新證據超過 30 天：顯示「需要重新確認」，不顯示百分比
    minItems: 5, // 至少 5 個不同題目
    minContexts: 2, // 至少 2 種情境（ctx）
    minDays: 2, // 至少 2 個不同日期
    topicMinSubtopics: 3, // 主題百分比需要至少 3 個次主題各自達標
    roundTo: 5, // 百分比以 5% 為單位無條件捨去（83% 顯示 80%）
    bands: [[85, "穩定"], [70, "熟悉"], [40, "發展中"], [0, "待加強"]],
    recentErrors: 10,
  });
  const CHANNEL_ZH = { reading: "閱讀辨識", listening: "聽力理解", building: "句子組合", speaking: "獨立口說" };
  const SCORED = ["reading", "listening", "building", "speaking"];
  const SENTENCE_TESTS = new Set(["sentence-meaning", "situational-response", "spoken-production", "word-order", "grammar-form"]);

  /* ---------- event validation ---------- */
  const RESULTS = new Set(["correct", "wrong", "timeout", "skipped"]);
  function validateEvent(e, qtypes) {
    const errs = [];
    if (!e || typeof e !== "object") return ["not an object"];
    if (typeof e.item !== "string" || !/^[swg]:./.test(e.item)) errs.push("item must be s:/w:/g: id");
    if (!Number.isFinite(e.at)) errs.push("at must be epoch ms");
    if (!qtypes[e.qtype]) errs.push("unknown qtype " + e.qtype);
    if (!RESULTS.has(e.result)) errs.push("result must be correct|wrong|timeout|skipped (first answer)");
    if (typeof e.ctx !== "string" || !e.ctx) errs.push("ctx required");
    return errs;
  }

  /* ---------- 1. classify every attempt ---------- */
  // Returns events annotated with: channel, independent (bool), excluded (reason), evidence ("correct"|"wrong"|null)
  function classify(events, qtypes, rules) {
    rules = rules || RULES;
    const sorted = events.slice().sort((a, b) => a.at - b.at);
    const lastSeen = new Map(); // item|channel -> time of the previous attempt (any result)
    return sorted.map((e) => {
      const qt = qtypes[e.qtype] || { channel: "none" };
      const ch = qt.channel;
      const key = e.item + "|" + ch;
      const prev = lastSeen.get(key);
      lastSeen.set(key, e.at);
      const out = { ...e, channel: ch, tests: qt.tests, grammarEvidence: qt.grammarEvidence, independent: false, excluded: null, evidence: null };
      if (!SCORED.includes(ch)) return (out.excluded = ch === "speaking-shadow" ? "shadowing" : "not-assessed"), out;
      if (e.result === "timeout") return (out.excluded = "timeout"), out;
      if (e.result === "skipped") return (out.excluded = "skipped"), out;
      if (prev != null && e.at - prev < rules.spacingMs) return (out.excluded = "repeat"), out;
      if (e.hint) return (out.excluded = "hint"), out;
      if (e.assisted) return (out.excluded = "assisted"), out;
      if (e.revealed) return (out.excluded = "revealed"), out;
      if (ch === "speaking" && !(e.sr && typeof e.sr.matched === "boolean")) return (out.excluded = "no-recognition"), out;
      // first answer decides; a retry that fixes it later does not turn it into a correct answer
      out.independent = true;
      out.evidence = e.result === "correct" && !(ch === "speaking" && !e.sr.matched) ? "correct" : "wrong";
      if (e.result === "correct" && e.retries) out.evidence = "wrong"; // defensive: a "correct" that needed retries is not first-try
      return out;
    });
  }

  /* ---------- 2. which abilities an attempt is evidence for ---------- */
  function topicsOf(e, tag, ctxMap) {
    const t = (tag && tag.topics) || [];
    const c = ctxMap[e.ctx];
    if (c && c.topic) {
      const hit = t.filter((x) => x.topic === c.topic && x.sub === c.sub);
      if (hit.length) return hit;
      if (tag && tag.kind === "word") return [{ topic: c.topic, sub: c.sub }]; // a word practised inside a situation
    }
    return t;
  }
  function abilitiesOf(e, tag, ctxMap) {
    const out = [];
    if (!tag) return out;
    const sentenceLevel = tag.kind !== "word" && SENTENCE_TESTS.has(e.tests);
    for (const t of topicsOf(e, tag, ctxMap)) {
      if (!t.sub || t.sub === "unassigned") continue;
      out.push({ kind: "topic", id: `${t.topic}/${t.sub}`, topic: t.topic, sub: t.sub, level: sentenceLevel ? "sentence" : "word" });
    }
    if (e.grammarEvidence === "target" && tag.target) {
      out.push({ kind: "grammar", id: tag.target, level: "sentence" });
      if (tag.form) out.push({ kind: "grammar", id: tag.form, level: "sentence" });
    } else if (e.grammarEvidence === "form-only" && tag.grammar && tag.grammarStatus === "reviewed") {
      for (const g of tag.grammar) if (g.startsWith("form:")) out.push({ kind: "grammar", id: g, level: "sentence", partial: true });
    }
    return out;
  }

  /* ---------- 3. score one ability × channel ---------- */
  const roundTo = (x, n) => Math.floor(x / n + 1e-9) * n; // 無條件捨去：寧可低估，不誇大
  const band = (pct, rules) => rules.bands.find(([min]) => pct >= min)[1];
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  function score(evs, rules, now) {
    const recent = evs.filter((e) => now - e.at <= rules.lookbackMs);
    const ind = recent.filter((e) => e.independent);
    const byItem = new Map();
    for (const e of ind) byItem.set(e.item, e); // events are time-sorted: keeps the latest independent attempt per item
    const items = [...byItem.values()];
    const correct = items.filter((e) => e.evidence === "correct").length;
    const contexts = new Set(ind.map((e) => e.ctx)).size;
    const days = new Set(ind.map((e) => day(e.at))).size;
    const last = ind.length ? Math.max(...ind.map((e) => e.at)) : null;
    const excluded = {};
    for (const e of recent) if (e.excluded) excluded[e.excluded] = (excluded[e.excluded] || 0) + 1;
    const answered = recent.filter((e) => e.result === "correct" || e.result === "wrong");
    const basis = {
      independentAttempts: ind.length, items: items.length, correctItems: correct, contexts, days,
      lastEvidence: last ? new Date(last).toISOString() : null, excluded,
      timeouts: excluded.timeout || 0,
      practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || (e.final === "correct")).length) / answered.length) : null,
      practiceAttempts: answered.length,
    };
    const need = { items: Math.max(0, rules.minItems - items.length), contexts: Math.max(0, rules.minContexts - contexts), days: Math.max(0, rules.minDays - days) };
    let status = "pending";
    if (!need.items && !need.contexts && !need.days) status = last != null && now - last > rules.staleMs ? "stale" : "scored";
    const out = { status, basis, need };
    if (status === "scored") {
      const raw = (100 * correct) / items.length;
      out.pct = roundTo(raw, rules.roundTo);
      out.band = band(raw, rules);
    }
    out.recentErrors = ind.filter((e) => e.evidence === "wrong").slice(-rules.recentErrors).reverse()
      .map((e) => ({ item: e.item, qtype: e.qtype, ctx: e.ctx, at: new Date(e.at).toISOString() }));
    return out;
  }

  /* ---------- 4. legacy saves: listed, never scored ---------- */
  function legacySummary(legacy) {
    if (!legacy) return null;
    const cards = legacy.cards || {}, sents = legacy.sents || {};
    const w = Object.values(cards).filter((c) => c && c.c > 0).length, s = Object.values(sents).filter((c) => c && c.c > 0).length;
    return {
      wordsAnsweredRight: w, sentencesAnsweredRight: s,
      status: "pending",
      note: "舊存檔只有答對次數，沒有作答時間、題型、提示與重試紀錄，無法判斷是否獨立掌握；不列入百分比與覆蓋率，尚待評估。",
    };
  }

  /* ---------- 5. whole profile ---------- */
  function compute(opt) {
    const rules = opt.rules || RULES, now = opt.now || Date.now();
    const qtypes = opt.qtypes, tags = opt.tags, ctxMap = {};
    for (const c of opt.contexts || []) ctxMap[c.ctx] = c;
    const invalid = [];
    const valid = (opt.events || []).filter((e) => {
      const errs = validateEvent(e, qtypes);
      if (errs.length) invalid.push({ event: e, errors: errs });
      return !errs.length;
    });
    const evs = classify(valid, qtypes, rules);
    const buckets = new Map(); // ability|channel|level -> events
    const put = (k, e) => (buckets.has(k) ? buckets.get(k).push(e) : buckets.set(k, [e]));
    for (const e of evs) {
      if (!SCORED.includes(e.channel)) continue;
      for (const a of abilitiesOf(e, tags[e.item], ctxMap)) put(`${a.kind}|${a.id}|${e.channel}|${a.level}`, { ...e, partial: !!a.partial });
    }
    const get = (k) => buckets.get(k) || [];
    const channels = (kind, id, level) => {
      const o = {};
      for (const ch of SCORED) o[ch] = { channelZh: CHANNEL_ZH[ch], ...score(get(`${kind}|${id}|${ch}|${level}`), rules, now) };
      return o;
    };

    // grammar: a node is "instrumented" only when some item can really test it (grammar items with that target)
    const instrumented = new Set(Object.values(tags).map((t) => t.target).filter(Boolean));
    const grammar = {};
    for (const n of opt.grammarNodes || []) {
      const anyEvidence = SCORED.some((ch) => get(`grammar|${n.id}|${ch}|sentence`).length);
      grammar[n.id] = { zh: n.zh, v1: !!n.v1, time: n.time, channels: channels("grammar", n.id, "sentence") };
      if (!instrumented.has(n.id)) grammar[n.id].reason = "no-instrument";
      else if (!anyEvidence) grammar[n.id].reason = "insufficient-evidence";
    }
    for (const f of opt.grammarForms || []) {
      grammar[f.id] = { zh: f.zh, channels: channels("grammar", f.id, "sentence"), partial: true,
        note: "只計句子排序（語序）與文法題；排序題不證明時態。" };
    }

    // topics
    const topics = {};
    for (const [tid, tdef] of Object.entries(opt.topicMap || {})) {
      const subs = {};
      for (const [sid, sdef] of Object.entries(tdef.sub)) {
        const total = Object.values(tags).filter((t) => (t.topics || []).some((x) => x.topic === tid && x.sub === sid));
        const totalS = total.filter((t) => t.kind !== "word").length, totalW = total.filter((t) => t.kind === "word").length;
        const evS = SCORED.flatMap((ch) => get(`topic|${tid}/${sid}|${ch}|sentence`));
        const evW = SCORED.flatMap((ch) => get(`topic|${tid}/${sid}|${ch}|word`));
        const doneS = new Set(evS.filter((e) => e.evidence === "correct").map((e) => e.item));
        const doneW = new Set(evW.filter((e) => e.evidence === "correct").map((e) => e.item));
        subs[sid] = {
          zh: sdef.zh, channels: channels("topic", `${tid}/${sid}`, "sentence"),
          coverage: { sentences: { done: doneS.size, total: totalS }, words: { done: doneW.size, total: totalW } },
          vocabOnly: !evS.length && evW.length > 0,
        };
        if (!totalS) subs[sid].reason = "no-sentence-material";
      }
      const perCh = {};
      for (const ch of SCORED) {
        const scored = Object.entries(subs).filter(([, s]) => s.channels[ch].status === "scored");
        const o = { channelZh: CHANNEL_ZH[ch], scoredSubtopics: scored.map(([k]) => k), needSubtopics: Math.max(0, rules.topicMinSubtopics - scored.length) };
        if (scored.length >= rules.topicMinSubtopics) {
          const raw = scored.reduce((a, [, s]) => a + s.channels[ch].pct, 0) / scored.length;
          Object.assign(o, { status: "scored", pct: roundTo(raw, rules.roundTo), band: band(raw, rules) });
        } else o.status = "pending";
        perCh[ch] = o;
      }
      topics[tid] = { zh: tdef.zh, channels: perCh, subtopics: subs };
    }

    // weak areas for "練習弱項"
    const weak = [];
    const pushWeak = (kind, id, zh, ch, s) => {
      if (s.status === "scored" && s.pct < 70) weak.push({ kind, id, zh, channel: ch, pct: s.pct, items: s.recentErrors.map((x) => x.item) });
    };
    for (const [id, g] of Object.entries(grammar)) for (const ch of SCORED) pushWeak("grammar", id, g.zh, ch, g.channels[ch]);
    for (const [tid, t] of Object.entries(topics))
      for (const [sid, s] of Object.entries(t.subtopics)) for (const ch of SCORED) pushWeak("topic", `${tid}/${sid}`, `${t.zh}・${s.zh}`, ch, s.channels[ch]);
    weak.sort((a, b) => a.pct - b.pct);

    const answered = evs.filter((e) => e.result === "correct" || e.result === "wrong");
    return {
      rulesVersion: rules.version, computedAt: new Date(now).toISOString(),
      totals: {
        attempts: evs.length, independent: evs.filter((e) => e.independent).length,
        timeouts: evs.filter((e) => e.result === "timeout").length,
        practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || e.final === "correct").length) / answered.length) : null,
        excluded: evs.reduce((m, e) => (e.excluded && (m[e.excluded] = (m[e.excluded] || 0) + 1), m), {}),
        invalidEvents: invalid.length,
      },
      speakingNote: "獨立口說只代表語音辨識吻合，不代表文法或發音完全正確。",
      grammar, topics, weak, legacy: legacySummary(opt.legacy), invalid,
    };
  }

  /* compact runtime index from item-tags.json (id -> tag used by compute) */
  function indexTags(itemTags, grammarItems) {
    const o = {};
    for (const it of itemTags.items || []) o[it.id] = { kind: it.kind, topics: it.topics, grammar: it.grammar.contains, grammarStatus: it.grammar.tagStatus };
    for (const g of (grammarItems && grammarItems.items) || []) o[g.id] = { kind: "grammar-item", topics: g.topics || [], target: g.target, form: g.form, grammar: [g.target, g.form].filter(Boolean), grammarStatus: "reviewed" };
    return o;
  }

  /* one consistent Chinese label for a panel cell */
  function describe(cell, reason) {
    if (reason === "no-instrument") return "目前沒有能測這個文法的題目（尚待評估）";
    if (reason === "no-sentence-material") return "目前沒有這個次主題的情境句題目（尚待評估）";
    if (!cell) return "尚待評估";
    const b = cell.basis || {};
    if (cell.status === "scored") return `${cell.pct}%（${cell.band}）· ${b.items} 題、${b.contexts} 種情境`;
    if (cell.status === "stale") return `需要重新確認（最新證據 ${String(b.lastEvidence || "").slice(0, 10)}）`;
    if (cell.status === "pending" && cell.needSubtopics != null) return `尚待評估：還需要 ${cell.needSubtopics} 個次主題達標`;
    const n = cell.need || {}, parts = [];
    if (n.items) parts.push(`${n.items} 題`);
    if (n.contexts) parts.push(`${n.contexts} 種情境`);
    if (n.days) parts.push(`${n.days} 天`);
    return parts.length ? `尚待評估：還需要 ${parts.join("、")}的獨立作答` : "尚待評估";
  }

  return { RULES, CHANNEL_ZH, validateEvent, classify, compute, indexTags, legacySummary, describe };
});
