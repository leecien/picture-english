/* LEARNING-PROFILE-01 熟悉度計算模組（外部 AI）。純函式，不讀寫 localStorage、不碰 DOM（atomicWrite 只操作呼叫端給的 storage）。
   Browser: window.LearningProfile；Node: module.exports。
   規則文件：RULES.md（lp-rules-v1.2 = 派工 revision 9）。所有門檻都在 RULES 常數。
   v1.2 相容性（與 v1.1 同欄位名）：
   - pct = displayPct = rawPct 四捨五入到整數（5/6 → 83）；只有四捨五入會跨過 40／70／85 門檻時，改顯示一位小數（與 rawPct 相同），
     例如 23/33 = 69.7 顯示 69.7，不顯示成 70；一位小數也會碰到門檻時（69.96）才無條件捨去成 69.9。rawPct（一位小數）不變，弱項與等級一律用原始比例判定。
   - 學習日期改用 Asia/Taipei 日曆日（事件 at 仍是 UTC epoch ms）。
   - 還原：不再提供「靜默合併」。previewRestore／mergeAbility／atomicWrite 配合平台的預覽＋明確確認流程；
     mergeEvents 保留舊名，只給明確選用的「僅合併能力紀錄」。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LearningProfile = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 864e5;
  const RULES = Object.freeze({
    version: "lp-rules-v1.2",
    trial: true, // v1 試行規則（派工 revision 9）
    spacingMs: DAY, // 同一題同一通道 24 小時內再作答，只算練習
    lookbackMs: 90 * DAY, // 只用最近 90 天的證據計算目前分數
    staleMs: 30 * DAY, // 最新證據超過 30 天：需要重新確認（保留上次結果）
    minItems: 5, // 至少 5 個不同題目
    minContexts: 2, // 至少 2 種情境（ctx）
    minDays: 2, // 跨至少 2 個學習日期（Asia/Taipei 日曆日；和 24 小時重複規則是兩件事）
    dayTimeZone: "Asia/Taipei",
    dayOffsetMs: 8 * 36e5, // Asia/Taipei = UTC+8，沒有日光節約時間
    topicMinSubtopics: 3, // 主題分數需要至少 3 個次主題各自達標
    weakBelow: 70, // 低於 70%（原始比例）才列弱項；資料不足不列
    display: "round-to-integer", // displayPct：原始比例四捨五入到整數（5/6 = 83.3% → 83%）；跨門檻時見 displayOf
    bands: [[85, "穩定"], [70, "熟悉"], [40, "發展中"], [0, "待加強"]],
    recentErrors: 10,
    maxEvents: 4000, // pm-ability-v1 最多保留最近 4000 筆（決定 4）
    secondaryTagsScore: true, // 副標籤也可引用這筆證據；同一事件在同一主題最多計一次，總事件／總題數不重複（revision 9）
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
  /* ---------- backup / restore (revision 9) ----------
     Two meanings, chosen explicitly by the player after a preview:
       "replace"        整份還原：備份裡的每個鍵（包含 pm-ability-v1）覆蓋裝置上的同名鍵；裝置上較新的能力紀錄不保留。v1 預設。
       "merge-ability"  僅合併能力紀錄：只動 pm-ability-v1，依事件 id 取聯集；其他鍵完全不動。
     Nothing merges silently. A conflict (same id, different content) is never guessed: it is listed in the preview and the
     device's copy is kept. Writes are all-or-nothing (atomicWrite). */
  const storeEvents = (v) => {
    if (v == null) return [];
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (_) { return null; } }
    if (Array.isArray(v)) return v;
    return v && Array.isArray(v.events) ? v.events : null;
  };
  /* same content? (key order does not matter) */
  const canon = (x) => (Array.isArray(x) ? "[" + x.map(canon).join(",") + "]" : x && typeof x === "object" ? "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}" : JSON.stringify(x));
  /* problems with a whole pm-ability-v1 value (array or { v, events }) before anything is written */
  function validateStore(value, qtypes, max) {
    max = max || RULES.maxEvents;
    const evs = storeEvents(value), errs = [];
    if (evs == null) return ["pm-ability-v1 must be an event array or { events: [...] }"];
    if (evs.length > max) errs.push(`${evs.length} events (max ${max})`);
    const ids = new Set();
    evs.forEach((e, i) => {
      const er = qtypes ? validateEvent(e, qtypes) : e && typeof e === "object" ? [] : ["not an object"];
      if (e && e.id == null) er.push("no id");
      else if (e && ids.has(e.id)) er.push("duplicate id " + e.id);
      else if (e) ids.add(e.id);
      if (er.length) errs.push(`event #${i}: ${er.join("; ")}`);
    });
    return errs;
  }
  /* 僅合併能力紀錄: union by id. Same id + same content = duplicate (kept once); same id + different content = conflict
     (the device's copy is kept, the conflict is reported). Newest max kept. Returns { events, preview }. */
  function mergeAbility(current, incoming, max) {
    max = max || RULES.maxEvents;
    const cur = storeEvents(current) || [], inc = storeEvents(incoming) || [];
    const byId = new Map(cur.filter((e) => e && e.id != null).map((e) => [e.id, e]));
    let add = 0, duplicate = 0;
    const conflicts = [];
    for (const e of inc) {
      if (!e || e.id == null) continue;
      const have = byId.get(e.id);
      if (!have) (byId.set(e.id, e), add++);
      else if (canon(have) === canon(e)) duplicate++;
      else conflicts.push({ id: e.id, device: have, backup: e });
    }
    const all = [...byId.values()].sort((a, b) => a.at - b.at);
    const trimmed = Math.max(0, all.length - max);
    const events = trimmed ? all.slice(trimmed) : all;
    return { events, preview: { mode: "merge-ability", device: cur.length, backup: inc.length, add, duplicate, conflicts, trimmed, result: events.length } };
  }
  /* What a restore would do, for the confirmation screen. backup / device: { key: value } maps (values as stored). */
  function previewRestore(device, backup, mode, opt) {
    opt = opt || {};
    const key = opt.key || "pm-ability-v1";
    const dEv = storeEvents(device && device[key]) || [], bEv = storeEvents(backup && backup[key]);
    const errors = bEv == null ? [key + ": unreadable"] : validateStore(backup[key], opt.qtypes, opt.max);
    if (mode === "merge-ability") {
      const m = mergeAbility(dEv, bEv || [], opt.max);
      return { ...m.preview, keys: [key], errors, ok: !errors.length };
    }
    if (mode !== "replace") throw new Error("mode must be replace or merge-ability");
    const keys = Object.keys(backup || {});
    const bIds = new Set((bEv || []).map((e) => e && e.id));
    return {
      mode, keys, errors, ok: !errors.length, device: dEv.length, backup: (bEv || []).length, result: (bEv || []).length,
      deviceOnlyLost: dEv.filter((e) => e && !bIds.has(e.id)).length, // shown to the player: these device events go away
    };
  }
  /* All-or-nothing write. storage: { getItem, setItem, removeItem } (localStorage works). entries: { key: string|null }.
     If any write throws (quota, …) every key written so far is put back and the error is rethrown. */
  function atomicWrite(storage, entries) {
    const before = {}, done = [];
    for (const k of Object.keys(entries)) before[k] = storage.getItem(k);
    try {
      for (const [k, v] of Object.entries(entries)) {
        if (v == null) storage.removeItem(k);
        else storage.setItem(k, v);
        done.push(k);
      }
    } catch (e) {
      for (const k of done.concat(Object.keys(entries).filter((k) => !done.includes(k))))
        try { before[k] == null ? storage.removeItem(k) : storage.setItem(k, before[k]); } catch (_) {}
      throw e;
    }
  }
  /* kept for v1.1 callers: the explicit 「僅合併能力紀錄」 only (conflicts keep the device copy) */
  const mergeEvents = (current, backup, max) => mergeAbility(current, backup, max).events;

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
  const band = (raw, rules) => rules.bands.find(([min]) => raw >= min)[1];
  /* learning date: the Asia/Taipei calendar day of an event stored in UTC */
  const dayOf = (t, rules) => new Date(t + (rules || RULES).dayOffsetMs).toISOString().slice(0, 10);
  const day = (t) => dayOf(t, RULES);
  /* shown number: rounded to a whole percent, unless rounding would cross a threshold the raw ratio has not reached
     (40 / 70 / 85, and the weak line) — then one decimal like rawPct (rounded down only if that too reaches the line),
     so the shown number and the label agree */
  function displayOf(raw, rules) {
    const r = Math.round(raw + 1e-9);
    const lines = rules.bands.map(([min]) => min).concat([rules.weakBelow, 100]).filter((x) => x > 0); // 100: never "100%" with a miss
    const cross = lines.filter((t) => raw < t && r >= t);
    if (!cross.length) return r;
    const d = Math.round(raw * 10 + 1e-9) / 10; // one decimal, same as rawPct …
    return cross.some((t) => d >= t) ? Math.floor(raw * 10 + 1e-9) / 10 : d; // … unless that too would reach the line (69.96 → 69.9)
  }
  function tally(ind, rules) {
    const byItem = new Map();
    for (const e of ind) byItem.set(e.item, e); // time-sorted: keeps the latest independent attempt per item
    const items = [...byItem.values()];
    const correct = items.filter((e) => e.evidence === "correct").length;
    return { items: items.length, correct, contexts: new Set(ind.map((e) => e.ctx)).size, days: new Set(ind.map((e) => dayOf(e.at, rules))).size };
  }
  function pctFields(t, rules) {
    const raw = (100 * t.correct) / t.items;
    const displayPct = displayOf(raw, rules);
    return { rawPct: Math.round(raw * 10) / 10, displayPct, pct: displayPct, ratio: `${t.correct}/${t.items}`, band: band(raw, rules), weak: raw < rules.weakBelow };
  }
  function meets(t, rules) {
    return t.items >= rules.minItems && t.contexts >= rules.minContexts && t.days >= rules.minDays;
  }
  function score(evs, rules, now) {
    const allInd = evs.filter((e) => e.independent);
    const last = allInd.length ? Math.max(...allInd.map((e) => e.at)) : null;
    const recent = evs.filter((e) => now - e.at <= rules.lookbackMs);
    const ind = recent.filter((e) => e.independent);
    const t = tally(ind, rules);
    const excluded = {};
    for (const e of recent) if (e.excluded) excluded[e.excluded] = (excluded[e.excluded] || 0) + 1;
    const answered = recent.filter((e) => e.result === "correct" || e.result === "wrong");
    const basis = {
      independentAttempts: ind.length, items: t.items, correctItems: t.correct, contexts: t.contexts, days: t.days,
      lastEvidence: last ? new Date(last).toISOString() : null, lastEvidenceDay: last ? dayOf(last, rules) : null, excluded, timeouts: excluded.timeout || 0,
      practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || e.final === "correct").length) / answered.length) : null,
      practiceAttempts: answered.length,
    };
    const need = { items: Math.max(0, rules.minItems - t.items), contexts: Math.max(0, rules.minContexts - t.contexts), days: Math.max(0, rules.minDays - t.days) };
    const out = { basis, need };
    if (last != null && now - last > rules.staleMs) {
      // keep history: what the score was at the time of the last evidence (90-day window ending then)
      out.status = "stale";
      const then = allInd.filter((e) => last - e.at <= rules.lookbackMs), pt = tally(then, rules);
      out.previous = { asOf: new Date(last).toISOString(), asOfDay: dayOf(last, rules), items: pt.items, contexts: pt.contexts, days: pt.days, metMinimum: meets(pt, rules) };
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
    const kept = (opt.events || []).filter((e) => {
      const errs = validateEvent(e, qtypes);
      if (errs.length) invalid.push({ event: e, errors: errs });
      return !errs.length;
    }).map((e, i) => (e.id == null ? { ...e, id: "noid-" + i } : e));
    // only the newest maxEvents exist (pm-ability-v1 keeps 4000): evidence older than that is gone, never reconstructed
    const valid = trimEvents(kept, rules.maxEvents);
    const trimmed = new Set(kept.map((e) => e.id)).size - valid.length;
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
          const shown = displayOf(raw, rules);
          Object.assign(o, { status: "scored", rawPct: Math.round(raw * 10) / 10, displayPct: shown, pct: shown,
            band: band(raw, rules), formula: "已達標次主題的原始比例平均，四捨五入到整數顯示" });
        } else o.status = Object.values(subs).some((s) => s.channels[ch].status !== "none") ? "insufficient" : "none";
        perCh[ch] = o;
      }
      topics[tid] = { zh: tdef.zh, channels: perCh, subtopics: subs };
    }

    // weak areas: scored and raw below 70 only
    const weak = [];
    const pushWeak = (kind, id, zh, ch, s) => {
      if (s.status === "scored" && s.weak) weak.push({ kind, id, zh, channel: ch, pct: s.displayPct, rawPct: s.rawPct, ratio: s.ratio, items: s.recentErrors.map((x) => x.item) });
    };
    for (const [id, g] of Object.entries(grammar)) for (const ch of SCORED) pushWeak("grammar", id, g.zh, ch, g.channels[ch]);
    for (const [tid, t] of Object.entries(topics))
      for (const [sid, s] of Object.entries(t.subtopics)) for (const ch of SCORED) pushWeak("topic", `${tid}/${sid}`, `${t.zh}・${s.zh}`, ch, s.channels[ch]);
    weak.sort((a, b) => a.rawPct - b.rawPct);

    const answered = evs.filter((e) => e.result === "correct" || e.result === "wrong");
    return {
      rulesVersion: rules.version, trial: rules.trial, computedAt: new Date(now).toISOString(),
      totals: {
        // every event once, whatever topics or secondary tags it is cited under
        attempts: evs.length, distinctItems: new Set(evs.map((e) => e.item)).size, independent: evs.filter((e) => e.independent).length,
        timeouts: evs.filter((e) => e.result === "timeout").length,
        practiceRate: answered.length ? Math.round((100 * answered.filter((e) => e.result === "correct" || e.final === "correct").length) / answered.length) : null,
        excluded: evs.reduce((m, e) => (e.excluded && (m[e.excluded] = (m[e.excluded] || 0) + 1), m), {}),
        invalidEvents: invalid.length, trimmedTo: rules.maxEvents, trimmed,
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

  /* one consistent Chinese label for a panel cell. opt.detail adds the formula.
     The UI may word things differently; what must agree is the number, the status and the evidence (RULES.md §9). */
  const pctText = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  function describe(cell, reason, opt) {
    if (reason === "no-instrument") return "未提供評估：目前沒有能測這個文法的題型";
    if (reason === "no-sentence-material") return "未提供評估：目前沒有這個次主題的情境句題目";
    if (!cell) return "尚待評估";
    if (cell.reason === "no-instrument-channel" || cell.status === "no-instrument") return "未提供評估：這個通道目前沒有題型（不從選擇題推論）";
    const b = cell.basis || {};
    if (cell.status === "scored") {
      const base = `${pctText(cell.displayPct)}%（${cell.band}）· ${b.items != null ? b.items : cell.scoredSubtopics.length} ${b.items != null ? "題" : "個次主題"}${b.contexts != null ? `、${b.contexts} 種情境` : ""}`;
      if (!(opt && opt.detail)) return base;
      if (cell.ratio) return `${base}；${b.items} 題中答對 ${b.correctItems} 題＝${cell.rawPct}%，四捨五入顯示 ${pctText(cell.displayPct)}%${cell.weak ? "（低於 70%，列為弱項）" : ""}`;
      return `${base}；${cell.formula || ""}`;
    }
    if (cell.status === "stale") {
      const p = cell.previous || {};
      const d = b.lastEvidenceDay || String(b.lastEvidence || "").slice(0, 10);
      return p.displayPct != null ? `需要重新確認（上次 ${pctText(p.displayPct)}%，最後練習 ${d}）` : `需要重新確認（最後練習 ${d}，當時證據不足）`;
    }
    if (cell.needSubtopics != null) return cell.status === "none" ? "尚待評估" : `證據不足：還需要 ${cell.needSubtopics} 個次主題達標`;
    if (cell.status === "none") return "尚待評估";
    const n = cell.need || {}, parts = [];
    if (n.items) parts.push(`${n.items} 題`);
    if (n.contexts) parts.push(`${n.contexts} 種情境`);
    if (n.days) parts.push(`${n.days} 個學習日期`);
    return parts.length ? `證據不足：還需要 ${parts.join("、")}的獨立作答` : "證據不足";
  }

  return {
    RULES, CHANNEL_ZH, GRAMMAR_CHANNEL_ZH, validateEvent, validateStore, trimEvents, mergeAbility, mergeEvents, previewRestore, atomicWrite,
    classify, compute, indexTags, legacySummary, describe, displayOf, dayOf,
  };
});
