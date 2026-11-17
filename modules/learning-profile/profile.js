/* LEARNING-PROFILE-01 熟悉度計算模組（外部 AI）。純函式，不讀寫 localStorage、不碰 DOM。
   Browser: window.LearningProfile；Node: module.exports。
   規則文件：RULES.md（lp-rules-v1.1，含協調人 2026-11-18 的五項決定）。所有門檻都在 RULES 常數。
   v1.1 相容性：compute() 的輸出只新增欄位（rawPct、displayPct、ratio、previous、channelLabel…），pct 仍等於 displayPct；
   事件格式只新增選填欄位（links、via）。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LearningProfile = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 864e5;
  const RULES = Object.freeze({
    version: "lp-rules-v1.1",
    trial: true, // v1 試行規則（協調人 2026-11-18 決定 1）
    spacingMs: DAY, // 同一題同一通道 24 小時內再作答，只算練習
    lookbackMs: 90 * DAY, // 只用最近 90 天的證據計算目前分數
    staleMs: 30 * DAY, // 最新證據超過 30 天：需要重新確認（保留上次結果）
    minItems: 5, // 至少 5 個不同題目
    minContexts: 2, // 至少 2 種情境（ctx）
    minDays: 2, // 跨至少 2 個日期（UTC 日期）
    topicMinSubtopics: 3, // 主題分數需要至少 3 個次主題各自達標
    weakBelow: 70, // 低於 70%（原始比例）才列弱項；資料不足不列
    displayStep: 5, // displayPct：原始比例以 5% 級距無條件捨去（83.3% → 80%）
    bands: [[85, "穩定"], [70, "熟悉"], [40, "發展中"], [0, "待加強"]],
    recentErrors: 10,
    maxEvents: 4000, // pm-ability-v1 最多保留最近 4000 筆（決定 4）
    secondaryTagsScore: true, // 附加主題標籤也計分；同一事件在同一主題最多計一次（決定 2）
  });
  const CHANNEL_ZH = { reading: "閱讀辨識", listening: "聽力理解", building: "句子組合", speaking: "獨立口說" };
  const GRAMMAR_CHANNEL_ZH = { reading: "文法辨識掌握度", listening: "聽力（文法）", building: "句型組合（語序）", speaking: "口說（文法）" };
  const SCORED = ["reading", "listening", "building", "speaking"];
  // sentence-level tests: count for topic familiarity (single words never do)
  const SENTENCE_TESTS = new Set(["sentence-meaning", "situational-response", "situational-vocab", "spoken-production", "word-order", "grammar-form"]);

  /* ---------- events: validation, trimming, backup merge ---------- */
  const RESULTS = new Set(["correct", "wrong", "timeout", "skipped"]);
  function validateEvent(e, qtypes) {
    const errs = [];
    if (!e || typeof e !== "object") return ["not an object"];
    if (typeof e.item !== "string" || !/^[swg]:./.test(e.item)) errs.push("item must be s:/w:/g: id");
    if (!Number.isFinite(e.at)) errs.push("at must be epoch ms");
    if (!qtypes[e.qtype]) errs.push("unknown qtype " + e.qtype);
    if (!RESULTS.has(e.result)) errs.push("result must be correct|wrong|timeout|skipped (first answer)");
    if (typeof e.ctx !== "string" || !e.ctx) errs.push("ctx required");
    if (e.links != null && typeof e.links !== "object") errs.push("links must be an object");
    return errs;
  }
  /* newest maxEvents, one per id (a later copy of the same id replaces the earlier: retries update the same event) */
  function trimEvents(events, max) {
    max = max || RULES.maxEvents;
    const byId = new Map();
    for (const e of events || []) if (e && e.id != null) byId.set(e.id, e);
    const out = [...byId.values()].sort((a, b) => a.at - b.at);
    return out.length > max ? out.slice(out.length - max) : out;
  }
  /* restore from a backup without losing newer events on this device */
  const mergeEvents = (current, backup, max) => trimEvents([...(backup || []), ...(current || [])], max);

  /* ---------- 1. classify every attempt ---------- */
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
      out.independent = true;
      out.evidence = e.result === "correct" && !e.retries && !(ch === "speaking" && !e.sr.matched) ? "correct" : "wrong";
      return out;
    });
  }

  /* ---------- 2. which abilities an attempt is evidence for (each at most once) ---------- */
  function topicsOf(e, tag, ctxMap, rules) {
    let t = ((tag && tag.topics) || []).filter((x) => rules.secondaryTagsScore || x.role !== "secondary");
    const c = ctxMap[e.ctx];
    if (c && c.topic && tag && tag.kind === "word" && !t.some((x) => x.topic === c.topic)) t = t.concat([{ topic: c.topic, sub: c.sub, role: "context" }]);
    // one subtopic per topic: an event never counts twice inside the same topic
    const seen = new Set();
    return t.filter((x) => (seen.has(x.topic) ? false : (seen.add(x.topic), true)));
  }
  function abilitiesOf(e, tag, ctxMap, rules) {
    const out = [];
    if (!tag) return out;
    const sentenceLevel = tag.kind !== "word" && SENTENCE_TESTS.has(e.tests);
    for (const t of topicsOf(e, tag, ctxMap, rules)) {
      if (!t.sub || t.sub === "unassigned" || t.sub === "general") continue;
      out.push({ kind: "topic", id: `${t.topic}/${t.sub}`, level: sentenceLevel ? "sentence" : "word" });
    }
    if (e.grammarEvidence === "target" && tag.target) {
      out.push({ kind: "grammar", id: tag.target, level: "sentence" });
      if (tag.form) out.push({ kind: "grammar", id: tag.form, level: "sentence" });
    } else if (e.grammarEvidence === "form-only" && tag.grammar && tag.grammarStatus === "reviewed") {
      for (const g of new Set(tag.grammar)) if (g.startsWith("form:")) out.push({ kind: "grammar", id: g, level: "sentence", partial: true });
    }
    const seen = new Set(); // never twice for the same ability
    return out.filter((a) => (seen.has(a.kind + a.id) ? false : (seen.add(a.kind + a.id), true)));
  }

  /* ---------- 3. score one ability × channel ---------- */
  const floorTo = (x, n) => Math.floor(x / n + 1e-9) * n;
  const band = (raw, rules) => rules.bands.find(([min]) => raw >= min)[1];
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  function tally(ind) {
    const byItem = new Map();
    for (const e of ind) byItem.set(e.item, e); // time-sorted: keeps the latest independent attempt per item
    const items = [...byItem.values()];
    const correct = items.filter((e) => e.evidence === "correct").length;
    return { items: items.length, correct, contexts: new Set(ind.map((e) => e.ctx)).size, days: new Set(ind.map((e) => day(e.at))).size };
  }
  function pctFields(t, rules) {
    const raw = (100 * t.correct) / t.items;
    const displayPct = floorTo(raw, rules.displayStep);
    return { rawPct: Math.round(raw * 10) / 10, displayPct, pct: displayPct, ratio: `${t.correct}/${t.items}`, band: band(raw, rules) };
  }
  function meets(t, rules) {
    return t.items >= rules.minItems && t.contexts >= rules.minContexts && t.days >= rules.minDays;
  }
  function score(evs, rules, now) {
    const allInd = evs.filter((e) => e.independent);
    const last = allInd.length ? Math.max(...allInd.map((e) => e.at)) : null;
    const recent = evs.filter((e) => now - e.at <= rules.lookbackMs);
    const ind = recent.filter((e) => e.independent);
    const t = tally(ind);
    const excluded = {};
    for (const e of recent) if (e.excluded) excluded[e.excluded] = (excluded[e.excluded] || 0) + 1;
    const answered = recent.filter((e) => e.result === "correct" || e.result === "wrong");
    const basis = {
      independentAttempts: ind.length, items: t.items, correctItems: t.correct, contexts: t.contexts, days: t.days,
      lastEvidence: last ? new Date(last).toISOString() : null, excluded, timeouts: excluded.timeout || 0,
      practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || e.final === "correct").length) / answered.length) : null,
      practiceAttempts: answered.length,
    };
    const need = { items: Math.max(0, rules.minItems - t.items), contexts: Math.max(0, rules.minContexts - t.contexts), days: Math.max(0, rules.minDays - t.days) };
    const out = { basis, need };
    if (last != null && now - last > rules.staleMs) {
      // keep history: what the score was at the time of the last evidence (90-day window ending then)
      out.status = "stale";
      const then = allInd.filter((e) => last - e.at <= rules.lookbackMs), pt = tally(then);
      out.previous = { asOf: new Date(last).toISOString(), items: pt.items, contexts: pt.contexts, days: pt.days, metMinimum: meets(pt, rules) };
      if (meets(pt, rules)) Object.assign(out.previous, pctFields(pt, rules));
      out.need = { items: rules.minItems, contexts: rules.minContexts, days: rules.minDays };
    } else if (!t.items) out.status = "none";
    else if (!meets(t, rules)) out.status = "insufficient";
    else Object.assign(out, { status: "scored" }, pctFields(t, rules));
    out.recentErrors = ind.filter((e) => e.evidence === "wrong").slice(-rules.recentErrors).reverse()
      .map((e) => ({ item: e.item, qtype: e.qtype, ctx: e.ctx, at: new Date(e.at).toISOString() }));
    return out;
  }

  /* ---------- 4. legacy saves: listed, never scored ---------- */
  function legacySummary(legacy) {
    if (!legacy) return null;
    const cards = legacy.cards || {}, sents = legacy.sents || {};
    return {
      wordsAnsweredRight: Object.values(cards).filter((c) => c && c.c > 0).length,
      sentencesAnsweredRight: Object.values(sents).filter((c) => c && c.c > 0).length,
      status: "none",
      note: "舊存檔只有答對次數，沒有作答時間、題型、提示與重試紀錄，無法推算能力；不列入百分比與覆蓋率，顯示「尚待評估」。",
    };
  }

  /* ---------- 5. whole profile ---------- */
  function compute(opt) {
    const rules = opt.rules || RULES, now = opt.now || Date.now();
    const qtypes = opt.qtypes, tags = opt.tags, ctxMap = {};
    for (const c of opt.contexts || []) ctxMap[c.ctx] = c;
    const invalid = [];
    const valid = trimEvents((opt.events || []).filter((e) => {
      const errs = validateEvent(e, qtypes);
      if (errs.length) invalid.push({ event: e, errors: errs });
      return !errs.length;
    }).map((e, i) => (e.id == null ? { ...e, id: "noid-" + i } : e)), rules.maxEvents);
    const evs = classify(valid, qtypes, rules);
    const buckets = new Map(); // kind|ability|channel|level -> events (each event at most once per bucket)
    const put = (k, e) => (buckets.has(k) ? buckets.get(k).push(e) : buckets.set(k, [e]));
    const wordDone = new Map(); // topic/sub -> Set of words independently right (item or linked word)
    for (const e of evs) {
      if (!SCORED.includes(e.channel)) continue;
      for (const a of abilitiesOf(e, tags[e.item], ctxMap, rules)) put(`${a.kind}|${a.id}|${e.channel}|${a.level}`, e);
      // coverage of a linked word (sentence-level event that also exercised a key word) — coverage only, never a score
      const lw = e.links && e.links.word;
      if (lw && e.evidence === "correct" && tags[lw]) {
        const c = ctxMap[e.ctx], wt = topicsOf(e, tags[lw], ctxMap, rules).concat(c && c.topic ? [{ topic: c.topic, sub: c.sub }] : []);
        for (const t of wt) if (t.sub && t.sub !== "unassigned" && t.sub !== "general") {
          const k = `${t.topic}/${t.sub}`;
          (wordDone.get(k) || wordDone.set(k, new Set()).get(k)).add(lw);
        }
      }
    }
    const get = (k) => buckets.get(k) || [];
    const channels = (kind, id, level, labels, allowed) => {
      const o = {};
      for (const ch of SCORED) {
        if (allowed && !allowed.includes(ch)) {
          o[ch] = { channelZh: labels[ch], status: "no-instrument", reason: "no-instrument-channel", basis: { items: 0, contexts: 0 }, need: {}, recentErrors: [] };
          continue;
        }
        o[ch] = { channelZh: labels[ch], ...score(get(`${kind}|${id}|${ch}|${level}`), rules, now) };
      }
      return o;
    };

    // grammar: tense nodes are tested only by grammar items (reading = 文法辨識掌握度); forms also by sentence ordering
    const instrumented = new Set(Object.values(tags).map((t) => t.target).filter(Boolean));
    const grammar = {};
    for (const n of opt.grammarNodes || []) {
      grammar[n.id] = { zh: n.zh, v1: !!n.v1, time: n.time, channels: channels("grammar", n.id, "sentence", GRAMMAR_CHANNEL_ZH, ["reading"]),
        note: "選擇題只代表文法辨識，不能推論成獨立造句或口說能力。" };
      if (!instrumented.has(n.id)) grammar[n.id].reason = "no-instrument";
    }
    for (const f of opt.grammarForms || []) {
      grammar[f.id] = { zh: f.zh, partial: true, channels: channels("grammar", f.id, "sentence", GRAMMAR_CHANNEL_ZH, ["reading", "building"]),
        note: "閱讀通道來自文法選擇題；句型組合來自句子排序（只證明語序，不證明時態）。" };
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
        const doneW = new Set([...evW.filter((e) => e.evidence === "correct").map((e) => e.item), ...(wordDone.get(`${tid}/${sid}`) || [])]);
        subs[sid] = {
          zh: sdef.zh, channels: channels("topic", `${tid}/${sid}`, "sentence", CHANNEL_ZH),
          coverage: { sentences: { done: doneS.size, total: totalS }, words: { done: doneW.size, total: totalW } },
          vocabOnly: !evS.length && (evW.length > 0 || doneW.size > 0),
        };
        if (!totalS) subs[sid].reason = "no-sentence-material";
      }
      const perCh = {};
      for (const ch of SCORED) {
        const scored = Object.entries(subs).filter(([, s]) => s.channels[ch].status === "scored");
        const o = { channelZh: CHANNEL_ZH[ch], scoredSubtopics: scored.map(([k]) => k), needSubtopics: Math.max(0, rules.topicMinSubtopics - scored.length) };
        if (scored.length >= rules.topicMinSubtopics) {
          const raw = scored.reduce((a, [, s]) => a + s.channels[ch].rawPct, 0) / scored.length;
          Object.assign(o, { status: "scored", rawPct: Math.round(raw * 10) / 10, displayPct: floorTo(raw, rules.displayStep), pct: floorTo(raw, rules.displayStep),
            band: band(raw, rules), formula: "已達標次主題的 rawPct 平均，再以 5% 級距無條件捨去" });
        } else o.status = Object.values(subs).some((s) => s.channels[ch].status !== "none") ? "insufficient" : "none";
        perCh[ch] = o;
      }
      topics[tid] = { zh: tdef.zh, channels: perCh, subtopics: subs };
    }

    // weak areas: scored and raw below 70 only
    const weak = [];
    const pushWeak = (kind, id, zh, ch, s) => {
      if (s.status === "scored" && s.rawPct < rules.weakBelow) weak.push({ kind, id, zh, channel: ch, pct: s.displayPct, rawPct: s.rawPct, items: s.recentErrors.map((x) => x.item) });
    };
    for (const [id, g] of Object.entries(grammar)) for (const ch of SCORED) pushWeak("grammar", id, g.zh, ch, g.channels[ch]);
    for (const [tid, t] of Object.entries(topics))
      for (const [sid, s] of Object.entries(t.subtopics)) for (const ch of SCORED) pushWeak("topic", `${tid}/${sid}`, `${t.zh}・${s.zh}`, ch, s.channels[ch]);
    weak.sort((a, b) => a.rawPct - b.rawPct);

    const answered = evs.filter((e) => e.result === "correct" || e.result === "wrong");
    return {
      rulesVersion: rules.version, trial: rules.trial, computedAt: new Date(now).toISOString(),
      totals: {
        attempts: evs.length, independent: evs.filter((e) => e.independent).length,
        timeouts: evs.filter((e) => e.result === "timeout").length,
        practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || e.final === "correct").length) / answered.length) : null,
        excluded: evs.reduce((m, e) => (e.excluded && (m[e.excluded] = (m[e.excluded] || 0) + 1), m), {}),
        invalidEvents: invalid.length, trimmedTo: rules.maxEvents,
      },
      speakingNote: "獨立口說只代表語音辨識吻合，不代表文法或發音完全正確。",
      grammar, topics, weak, legacy: legacySummary(opt.legacy), invalid,
    };
  }

  /* compact runtime index from item-tags.json (+ grammar-items.json) */
  function indexTags(itemTags, grammarItems) {
    const o = {};
    for (const it of itemTags.items || []) o[it.id] = { kind: it.kind, topics: it.topics, grammar: it.grammar.contains, grammarStatus: it.grammar.tagStatus };
    for (const g of (grammarItems && grammarItems.items) || [])
      o[g.id] = { kind: "grammar-item", topics: (g.topics || []).map((t) => ({ role: "primary", ...t })), target: g.target, form: g.form, grammar: [g.target, g.form].filter(Boolean), grammarStatus: "reviewed" };
    return o;
  }

  /* one consistent Chinese label for a panel cell. opt.detail adds the formula. */
  function describe(cell, reason, opt) {
    if (reason === "no-instrument") return "目前沒有能測這個文法的題目（尚待評估）";
    if (reason === "no-sentence-material") return "目前沒有這個次主題的情境句題目（尚待評估）";
    if (!cell) return "尚待評估";
    if (cell.reason === "no-instrument-channel") return "這個通道目前沒有題型（不從選擇題推論）";
    const b = cell.basis || {};
    if (cell.status === "scored") {
      const base = `${cell.displayPct}%（${cell.band}）· ${b.items != null ? b.items : cell.scoredSubtopics.length} ${b.items != null ? "題" : "個次主題"}${b.contexts != null ? `、${b.contexts} 種情境` : ""}`;
      return opt && opt.detail && cell.ratio ? `${base}；${b.items} 題中答對 ${b.correctItems} 題＝${cell.rawPct}%，以 5% 級距無條件捨去顯示 ${cell.displayPct}%` : base;
    }
    if (cell.status === "stale") {
      const p = cell.previous || {};
      const d = String(b.lastEvidence || "").slice(0, 10);
      return p.displayPct != null ? `需要重新確認（上次 ${p.displayPct}%，最後練習 ${d}）` : `需要重新確認（最後練習 ${d}，當時證據不足）`;
    }
    if (cell.needSubtopics != null) return cell.status === "none" ? "尚待評估" : `證據不足：還需要 ${cell.needSubtopics} 個次主題達標`;
    if (cell.status === "none") return "尚待評估";
    const n = cell.need || {}, parts = [];
    if (n.items) parts.push(`${n.items} 題`);
    if (n.contexts) parts.push(`${n.contexts} 種情境`);
    if (n.days) parts.push(`${n.days} 天`);
    return parts.length ? `證據不足：還需要 ${parts.join("、")}的獨立作答` : "證據不足";
  }

  return { RULES, CHANNEL_ZH, GRAMMAR_CHANNEL_ZH, validateEvent, trimEvents, mergeEvents, classify, compute, indexTags, legacySummary, describe };
});
