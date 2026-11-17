/* 「我的英語能力」: one event per answer → LEARNING-PROFILE-01 (external) → panel → weak practice → again.
   Store: pm-ability-v1 (new key; older pm-* keys keep their shape), the most recent 4000 events, in the external
   event schema (content/learning-profile-v1/event-schema.json):
     { v:1, id, item ("s:…" / "w:…" / "g:…"), qtype (question-types.json), ctx, at, result: correct|wrong|timeout,
       retries?, final?, hint?, assisted?, revealed?, sr?, ms?, text? }
   - One event per answer; a retry on the same question updates that event (retries / final).
   - hint: anything looked at before answering (「看中文」, a word or phrase card, the folded Chinese cue).
   - Scoring is the external module (modules/learning-profile/profile.js, window.LearningProfile) with the v1
     rules decided on 2026-11-17 (5 items, 2 contexts, 2 days, last 90 days, 30 days → 需要重新確認, weak < 70%).
   - Decision 2: business negotiation is 職場 → 商務談判, not 會議 (applied when the data is loaded, so one answer
     is never counted twice).
   - No guessed scores: no evidence → 「尚待評估」; some evidence below the thresholds → 「證據不足」. */
const Ability = (() => {
  const KEY = "pm-ability-v1",
    MAX = 4000,
    BASE = "content/learning-profile-v1/";
  const ls = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    set(o) {
      try {
        localStorage.setItem(KEY, JSON.stringify(o));
      } catch (e) {}
    },
  };
  /* ---------- store (with the first-draft records kept apart, never scored) ---------- */
  let ST = (() => {
    const o = ls.get();
    if (o && o.v === 2 && Array.isArray(o.events)) return o;
    const out = { v: 2, events: [] };
    if (o && Array.isArray(o.recs) && o.recs.length) out.draft = o.recs.slice(-500); // 11-17 draft format: kept, not scored
    return out;
  })();
  const save = () => {
    ST.events = typeof LearningProfile !== "undefined" && LearningProfile.trimEvents ? LearningProfile.trimEvents(ST.events, MAX) : ST.events.slice(-MAX);
    ls.set(ST);
  };

  /* ---------- data ---------- */
  let D = null; // { tags, qtypes, contexts, topicMap, nodes, forms, grammarItems }
  const ready =
    typeof fetch === "undefined" || typeof document === "undefined"
      ? Promise.resolve(null)
      : Promise.all(["item-index.json", "question-types.json", "topic-map.json", "grammar-map.json", "grammar-items.json"].map((f) => fetch(BASE + f).then((r) => r.json())))
          .then(([idx, qt, tm, gm, gi]) => (D = decide({ tags: idx.items, qtypes: qt.types, contexts: tm.contexts, topicMap: tm.topics, nodes: gm.nodes, forms: gm.forms, grammarItems: gi.items })))
          .catch((e) => (console.warn("learning profile data", e), null));
  /* Decision 2 (2026-11-17): negotiation lines belong to 職場 → 商務談判, counted once. */
  function decide(d) {
    // batch-03 carries 職場・商務談判 itself; the game-side override below is only for older data (batch-02)
    d.legacyNegotiation = !d.topicMap.work;
    if (d.legacyNegotiation) {
      d.topicMap = { ...d.topicMap, work: { zh: "職場", sub: { negotiation: { zh: "商務談判", desc: "價格、條件、交期與讓步" } } } };
      d.contexts = d.contexts.map((c) => (c.source === "work/negotiate" ? { ...c, topic: "work", sub: "negotiation" } : c));
    }
    d.byId = Object.fromEntries(d.grammarItems.map((g) => [g.id, g]));
    return d;
  }
  let SCN = null;
  if (typeof fetch !== "undefined" && typeof document !== "undefined")
    fetch("data/scenes.json")
      .then((r) => r.json())
      .then((d) => (SCN = d.categories || []))
      .catch(() => {});
  const sceneItems = (cat, scene) => {
    const c = (SCN || []).find((x) => x.id === cat),
      s = c && c.scenes.find((x) => x.id === scene);
    return s ? s.items : [];
  };

  /* ---------- hints: looking before answering ---------- */
  let peeked = false;
  if (typeof window !== "undefined") {
    window.addEventListener("pron:look", () => (peeked = true));
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest && e.target.closest(".qz-cue summary")) peeked = true; // the folded Chinese cue
      },
      true,
    );
  }
  /* A question is on screen: nothing looked at yet. */
  const begin = () => (peeked = false);
  // the entry point of the current round (npc:<task> / practice / battle / drive); does not affect scoring
  let via = "";
  const setVia = (v) => (via = v || "");

  /* ---------- recording ---------- */
  const textOf = (q) => (q.lp ? q.lp.en : q.item ? q.item.w || q.item.en || "" : "");
  const itemOf = (q) => (q.lp ? q.lp.id : `${q.recK === "w" ? "w" : "s"}:${q.item ? q.item.w || q.item.en : ""}`);
  /* how: { result: correct|wrong|timeout, retries, final, assisted, revealed, sr, ms, qtype, ctx } */
  function log(q, how) {
    if (!q || (q.item && q.item.sup)) return null; // KK supplement words: practice only
    const qtype = how.qtype || q.qtype;
    if (!qtype) return null; // no matching question type (e.g. KK sound questions): not part of this profile
    const at = Date.now(),
      ev = {
        v: 1,
        id: `t-${at}-${Math.random().toString(36).slice(2, 7)}`,
        item: itemOf(q),
        qtype,
        // ctx is the situation, not the entry point (scene:<id> for a scene line); via is the entry point
        ctx: q.scene && !/^(scene|companion):/.test(how.ctx || "") ? `scene:${q.scene}` : how.ctx || q.ctx || "practice",
        via: how.via || via || "practice",
        at,
        result: how.result,
        ...(how.retries ? { retries: how.retries, final: how.final || "correct" } : {}),
        ...(how.hint || peeked ? { hint: true } : {}),
        ...(how.assisted ? { assisted: true } : {}),
        ...(how.revealed ? { revealed: true } : {}),
        ...(how.sr ? { sr: how.sr } : {}),
        ...(typeof how.ms === "number" ? { ms: Math.round(how.ms) } : {}),
        text: textOf(q).slice(0, 140),
      };
    ST.events.push(ev);
    save();
    cache = null;
    return ev;
  }
  /* The companion corrected an answer already recorded (battle): it was assisted. */
  function markAssist(q) {
    const id = itemOf(q);
    for (let i = ST.events.length - 1; i >= 0; i--)
      if (ST.events[i].item === id) {
        ST.events[i].assisted = true;
        save();
        cache = null;
        return;
      }
  }

  /* ---------- profile ---------- */
  let cache = null;
  // the negotiation lines themselves (needs the scene data, which may arrive after the profile data)
  let negDone = false;
  function negotiation() {
    if (negDone || !D.legacyNegotiation) return;
    const items = typeof Learn !== "undefined" && Learn.scene("work", "negotiate") ? Learn.scene("work", "negotiate").items : sceneItems("work", "negotiate");
    if (!items.length) return;
    for (const x of items) if (D.tags["s:" + x.en]) D.tags["s:" + x.en] = { ...D.tags["s:" + x.en], topics: [{ topic: "work", sub: "negotiation" }] };
    negDone = true;
    cache = null;
  }
  function profile(now) {
    if (!D || typeof LearningProfile === "undefined") return null;
    negotiation();
    if (cache && !now) return cache;
    const p = LearningProfile.compute({
      events: ST.events,
      tags: D.tags,
      qtypes: D.qtypes,
      contexts: D.contexts,
      topicMap: D.topicMap,
      grammarNodes: D.nodes,
      grammarForms: D.forms,
      legacy: { cards: typeof CARDS !== "undefined" ? CARDS : {}, sents: typeof SENTS !== "undefined" ? SENTS : {} },
      now: now || Date.now(),
    });
    if (!now) cache = p;
    return p;
  }
  /* One label per cell. No evidence: 尚待評估. Some evidence below the thresholds: 證據不足 (what is missing). */
  // one wording for every cell: the external describe() (尚待評估 / 證據不足 / % / 需要重新確認)
  const label = (cell, reason, detail) => LearningProfile.describe(cell, reason, detail ? { detail: true } : undefined);
  const cls = (cell, reason) => (reason || !cell || cell.status !== "scored" ? (cell && cell.status === "stale" ? "stale" : "pend") : cell.rawPct < LearningProfile.RULES.weakBelow ? "weak" : "ok");

  /* ---------- grammar form-choice questions (60 items, external batch-02) ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const shuf = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  /* Before answering: the situation (Chinese) and the stem; never the tense name. After: sentence, Chinese, sound,
     a short explanation (Learn.ask shows answer.en / zh / explain). */
  function grammarQuestion(g, ctx) {
    return {
      kind: "g", recK: "g", lp: g, item: { en: g.en, zh: g.zh, g: g.id }, qtype: "grammar:form-choice", ctx: ctx || g.ctx,
      prompt: `<p class="qz-ask">📝 選出正確的形式</p><p class="gq-sit">情境：${esc(g.situation)}</p><p class="qz-sent gq-stem">${esc(g.stem).replace("___", '<span class="qz-gap">＿＿＿</span>')}</p>`,
      options: shuf(g.options).map((o) => ({ html: `<b>${esc(o)}</b>`, ok: o === g.answer, say: { text: g.stem.replace("___", o), file: "" } })),
      answer: { en: g.en, zh: g.zh },
      explain: g.explain,
      after: true,
    };
  }
  /* Up to n grammar items for a target (tense or form) and/or topic: recent errors first, then not answered yet. */
  function grammarItems({ target, topic, sub } = {}, n = 5) {
    if (!D) return [];
    const p = profile(),
      seen = new Set(ST.events.map((e) => e.item)),
      errs = new Set((p ? p.weak : []).flatMap((w) => w.items));
    const pool = D.grammarItems.filter((g) => (!target || g.target === target || g.form === target) && (!topic || (g.topics || []).some((t) => t.topic === topic && (!sub || t.sub === sub))));
    const rank = (g) => (errs.has(g.id) ? 0 : !seen.has(g.id) ? 1 : 2);
    return shuf(pool).sort((a, b) => rank(a) - rank(b)).slice(0, n);
  }

  /* ---------- panel ---------- */
  const CH = ["reading", "listening", "building", "speaking"];
  const CHZ = { reading: "閱讀辨識", listening: "聽力理解", building: "句子組合", speaking: "獨立口說" };
  function panelHTML() {
    const p = profile();
    if (!p) return `<h3>📊 我的英語能力</h3><p class="fine">評估資料載入中…</p>`;
    const ev = ST.events.length;
    const gRows = Object.entries(p.grammar)
      .filter(([, g]) => g.v1 || g.partial)
      .map(([id, g]) => {
        const c = g.channels.reading;
        return `<button type="button" class="ab-row ${cls(c, g.reason)}" data-k="grammar" data-id="${esc(id)}"><b>${esc(g.zh)}</b><span>${esc(label(c, g.reason))}</span></button>`;
      })
      .join("");
    const later = Object.values(p.grammar).filter((g) => !g.v1 && !g.partial).map((g) => g.zh);
    const tRows = Object.entries(p.topics)
      .map(([tid, t]) => {
        const subs = Object.entries(t.subtopics)
          .map(([sid, s]) => {
            const best = CH.map((ch) => s.channels[ch]).find((c) => c.status === "scored" || c.status === "stale") || CH.map((ch) => s.channels[ch]).find((c) => c.basis && (c.basis.independentAttempts || c.basis.practiceAttempts));
            return `<button type="button" class="ab-sub ${cls(best, s.reason)}" data-k="topic" data-id="${tid}/${sid}">${esc(s.zh)}<small>${esc(s.reason ? "尚無情境句題目" : label(best))}</small></button>`;
          })
          .join("");
        const tc = CH.map((ch) => `${CHZ[ch]}：${label(t.channels[ch])}`).join("<br>");
        return `<div class="ab-topic"><b>${esc(t.zh)}</b><small>${tc}</small></div><div class="ab-subs">${subs}</div>`;
      })
      .join("");
    const weak = p.weak.length
      ? `<div class="ab-list">${p.weak.map((w) => `<button type="button" class="ab-row weak" data-k="${w.kind}" data-id="${esc(w.id)}"><b>${esc(w.zh)}・${esc(CHZ[w.channel])}</b><span>${w.pct}%（低於 70%）</span></button>`).join("")}</div>`
      : '<p class="fine">目前沒有弱項。只有達到門檻、而且低於 70% 的項目才算弱項；證據不足不會被當成弱項。</p>';
    return `<h3>📊 我的英語能力</h3>
      <p class="fine">評估規則 v1（試行）：同一項要有至少 5 個不同題目、2 種情境、2 天的獨立作答才顯示百分比；只看最近 90 天，超過 30 天沒練顯示「需要重新確認」。${ev ? `目前有 ${ev} 筆作答紀錄。` : "還沒有作答紀錄。"}</p>
      ${p.legacy && (p.legacy.wordsAnsweredRight || p.legacy.sentencesAnsweredRight) ? `<p class="fine">舊紀錄：答對過 ${p.legacy.wordsAnsweredRight} 個單字、${p.legacy.sentencesAnsweredRight} 句。${esc(p.legacy.note)}</p>` : ""}
      <h4>弱項</h4>${weak}
      <h4>文法辨識掌握度</h4><p class="fine">來自文法形式選擇題（閱讀辨識）。選擇題只代表看得出正確形式，不代表能獨立造句或口說。作答前不顯示時態名稱。</p>
      <div class="ab-list">${gRows}</div>${later.length ? `<p class="fine">還沒有題目（目前沒有能測這個文法的題目）：${later.map(esc).join("、")}</p>` : ""}
      <h4>主題熟悉度</h4><p class="fine">四種能力分開計算（閱讀辨識、聽力理解、句子組合、獨立口說），不合成單一答對率。商務談判歸在「職場」。</p>
      <div class="ab-list">${tRows}</div>
      <p class="fine">練習答對率（含提示、重試）：${p.totals.practiceRate == null ? "—" : p.totals.practiceRate + "%"}。這只代表練習狀況，不是掌握度。${esc(p.speakingNote)}</p>`;
  }
  const EXCL = { repeat: "24 小時內重複", hint: "作答前看了提示", assisted: "輔助作答", revealed: "先看到／聽到答案", timeout: "超時（不算答錯）", "no-recognition": "沒有語音辨識結果", shadowing: "跟讀", skipped: "跳過" };
  function textFor(id) {
    if (D && D.byId[id]) return D.byId[id].en;
    const e = ST.events.slice().reverse().find((x) => x.item === id);
    return e && e.text ? e.text : id.slice(2);
  }
  function detailHTML(kind, id) {
    const p = profile();
    if (!p) return panelHTML();
    let name, chans, reason, extra = "";
    if (kind === "grammar") {
      const g = p.grammar[id];
      name = g.zh;
      chans = { reading: g.channels.reading };
      reason = g.reason;
      extra = '<p class="fine">文法掌握目前只來自文法形式選擇題（閱讀辨識），不推論成獨立造句或口說。</p>';
    } else {
      const [tid, sid] = id.split("/"),
        s = p.topics[tid].subtopics[sid];
      name = `${p.topics[tid].zh}・${s.zh}`;
      chans = s.channels;
      reason = s.reason;
      extra = `<p class="fine">教材覆蓋率（練過多少，不是掌握度）：情境句 ${s.coverage.sentences.done}/${s.coverage.sentences.total}、單字 ${s.coverage.words.done}/${s.coverage.words.total}。${s.vocabOnly ? "目前只有單字證據，次主題要用句子層級的作答來評估。" : ""}</p>`;
    }
    const block = (ch, c) => {
      const b = c.basis || {},
        ex = Object.entries(b.excluded || {}).map(([k, n]) => `${EXCL[k] || k} ${n}`).join("、");
      return `<div class="ab-ch ${cls(c, reason)}"><b>${esc(c.channelZh || CHZ[ch])}</b><span>${esc(label(c, reason, true))}</span>
        <ul class="ab-why"><li>獨立作答 ${b.independentAttempts || 0} 次：${b.items || 0} 個不同題目（答對 ${b.correctItems || 0}）、${b.contexts || 0} 種情境、${b.days || 0} 天</li>
        <li>不算獨立證據：${ex || "無"}</li><li>最新證據：${b.lastEvidence ? esc(b.lastEvidence.slice(0, 10)) : "—"}</li>
        ${c.recentErrors && c.recentErrors.length ? `<li>最近答錯：${c.recentErrors.slice(0, 5).map((x) => esc(textFor(x.item))).join("；")}</li>` : ""}</ul></div>`;
    };
    const shown = Object.entries(chans).filter(([ch, c]) => kind === "grammar" || (c.basis && (c.basis.independentAttempts || c.basis.practiceAttempts)) || ch === "reading" || ch === "listening");
    return `<h3>📊 ${esc(name)}</h3>${extra}${shown.map(([ch, c]) => block(ch, c)).join("")}
      <p class="fine">只有「第一次送出、沒有提示／重試／輔助、和同一題隔 24 小時以上」的作答才是獨立證據；每題取最近一次。超時另計，不算語言答錯。</p>
      <div class="dlg-row"><button type="button" class="ab-practice" data-k="${kind}" data-id="${esc(id)}">🎯 練習弱項</button><button type="button" class="ab-back">↩ 回能力總覽</button></div>`;
  }

  return {
    ready, begin, setVia, log, markAssist, profile, label, panelHTML, detailHTML, grammarQuestion, grammarItems, textFor, sceneItems,
    get data() { return D; },
    get events() { return ST.events.slice(); },
    get peeked() { return peeked; },
    MAX,
  };
})();
if (typeof module !== "undefined") module.exports = Ability;
