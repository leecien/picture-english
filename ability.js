/* 「我的英語能力」: an answer log and what it can (and cannot yet) say.
   Every answered question writes one record to its own key, pm-ability-v1 (older pm-* keys are not touched):
     { id, t, type, skill, first: "right" | "wrong" | "timeout", hint, retry, assist, fresh, ms, topic, sub, grammar,
       tagSrc, text, ctx, speech? }
   - skill: read (閱讀辨識) / listen (聽力理解) / build (句子組合) / speak (獨立口說) are kept apart, never one rate.
   - "independent": first-try right with no hint, retry or assist, and not the same item again within the cool-down.
   - speak records only say the speech-to-text matched the target (or not): never grammar or pronunciation correctness.
   - Tags: the external classification (data/learning-map.json, LEARNING-PROFILE-01) when it exists; until then the
     topic comes from the material's own fields (word theme, scene, route) and is marked provisional, and grammar
     stays "尚待評估" (a past-tense word in a sentence is not evidence that past tense was tested).
   - No percentages yet: the evaluation rules are pending. The panel shows counts, coverage, recent errors and the
     evidence behind them; an old save with no records shows 「尚待評估」 instead of a guessed score. */
const Ability = (() => {
  const KEY = "pm-ability-v1",
    MAX = 3000,
    COOL = 3 * 60 * 1000;
  const SKILLS = [
    { id: "read", name: "閱讀辨識", how: "看英文或圖選答案" },
    { id: "listen", name: "聽力理解", how: "先聽再選" },
    { id: "build", name: "句子組合", how: "把單字排成句子" },
    { id: "speak", name: "獨立口說", how: "自己開口；只記錄語音辨識文字是否吻合" },
  ];
  const GRAMMAR = [
    { id: "present", name: "現在" },
    { id: "past", name: "過去" },
    { id: "future", name: "未來" },
    { id: "question", name: "問句" },
    { id: "negative", name: "否定句" },
  ];
  const TOPICS = [
    { id: "food", name: "食物", subs: ["食材", "點餐", "烹飪", "飲食需求"] },
    { id: "travel", name: "旅遊", subs: ["機場", "海關", "住宿", "問路", "交通"] },
    { id: "meeting", name: "會議", subs: ["安排時間", "開場", "表達意見", "確認事項", "會後行動"] },
  ];
  /* Provisional topic links from the material's own fields (replaced by the external map when it arrives). */
  const SCENE_TOPIC = {
    "travel/airport": ["travel", "機場"], "travel/security": ["travel", "機場"], "travel/inflight": ["travel", "機場"],
    "travel/baggage": ["travel", "機場"], "travel/lostbag": ["travel", "機場"], "travel/customs": ["travel", "海關"],
    "travel/hotel": ["travel", "住宿"], "travel/roomservice": ["travel", "住宿"], "travel/directions": ["travel", "問路"],
    "travel/sights": ["travel", "問路"], "travel/taxi": ["travel", "交通"], "travel/train": ["travel", "交通"], "travel/rentcar": ["travel", "交通"],
    "dining/reserve": ["food", "點餐"], "dining/order": ["food", "點餐"], "dining/cafe": ["food", "點餐"], "dining/fastfood": ["food", "點餐"],
    "dining/bar": ["food", "點餐"], "dining/bill": ["food", "點餐"], "dining/problems": ["food", "點餐"], "dining/diet": ["food", "飲食需求"],
    "companion/food": ["food", "飲食需求"],
    "work/schedule": ["meeting", "安排時間"], "work/meeting": ["meeting", "開場"], "work/presentation": ["meeting", "表達意見"],
  };
  const WORD_TOPIC = { food: ["food", "食材"], transport: ["travel", "交通"] };
  const ROUTE_TOPIC = { travel: ["travel", ""] };

  const ls = {
    get() {
      try {
        const o = JSON.parse(localStorage.getItem(KEY) || "null");
        return o && typeof o === "object" && Array.isArray(o.recs) ? o : null;
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
  let ST = ls.get() || { v: 1, since: 0, recs: [] };
  let MAP = null,
    SCN = null;
  if (typeof fetch !== "undefined" && typeof document !== "undefined") {
    // the external classification is optional: until it is delivered, tags stay provisional
    fetch("data/learning-map.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (MAP = d && d.items ? d : null))
      .catch(() => {});
    fetch("data/scenes.json")
      .then((r) => r.json())
      .then((d) => (SCN = d.categories || []))
      .catch(() => {});
  }

  /* ---------- tagging ---------- */
  const textOf = (q) => (q.item ? q.item.w || q.item.en || "" : q.text || "");
  const idOf = (q) => (q.id ? q.id : `${q.recK || "x"}:${textOf(q)}`);
  function tagsOf(q) {
    const id = idOf(q),
      m = MAP && MAP.items[id];
    if (m) return { topic: m.topic || "", sub: m.sub || "", grammar: Array.isArray(m.grammar) ? m.grammar : [], tagSrc: "map" };
    let t = null;
    if (q.cat && q.scene) t = SCENE_TOPIC[`${q.cat}/${q.scene}`];
    else if (q.item && q.item.th) t = WORD_TOPIC[q.item.th];
    else if (q.item && q.item.route) t = ROUTE_TOPIC[q.item.route];
    return { topic: t ? t[0] : "", sub: t ? t[1] : "", grammar: [], tagSrc: t ? "provisional" : "" };
  }
  function skillOf(q, how) {
    if (how && how.skill) return how.skill;
    if (q.skill) return q.skill;
    if (["snd", "stress", "stress2", "kkword"].includes(q.kind)) return "listen";
    if (q.audio && (q.autoplay || q.noText)) return "listen";
    return "read";
  }

  /* ---------- recording ---------- */
  // how: { first: "right"|"wrong"|"timeout", hint, retry, assist, fresh, ms, skill, type, ctx, speech }
  function log(q, how) {
    if (!q) return null;
    if (q.item && q.item.sup) return null; // KK supplement words (pending review) are practice only
    const now = Date.now(),
      id = idOf(q),
      tags = tagsOf(q);
    if (!ST.since) ST.since = now;
    // the same item answered again within the cool-down is not new evidence (kept, marked not fresh)
    const recent = ST.recs.some((r) => r.id === id && now - r.t < COOL && r.first === "right");
    const rec = {
      id, t: now,
      type: how.type || q.type || q.kind || "",
      skill: skillOf(q, how),
      first: how.first,
      hint: how.hint ? 1 : 0,
      retry: how.retry ? 1 : 0,
      assist: how.assist ? 1 : 0,
      fresh: how.fresh === false ? false : !recent,
      ...(typeof how.ms === "number" ? { ms: Math.round(how.ms) } : {}),
      ...tags,
      text: textOf(q).slice(0, 120),
      ctx: how.ctx || q.ctx || "",
      ...(q.cat ? { cat: q.cat, scene: q.scene } : {}),
      ...(how.speech ? { speech: how.speech } : {}),
    };
    ST.recs.push(rec);
    if (ST.recs.length > MAX) ST.recs = ST.recs.slice(-MAX);
    ls.set(ST);
    return rec;
  }
  /* A later companion fix on an already recorded answer (battle): it was assisted. */
  function markAssist(q) {
    const id = idOf(q);
    for (let i = ST.recs.length - 1; i >= 0; i--)
      if (ST.recs[i].id === id) {
        ST.recs[i].assist = 1;
        ls.set(ST);
        return;
      }
  }
  const independent = (r) => r.first === "right" && !r.hint && !r.retry && !r.assist && r.fresh !== false;

  /* ---------- analysis (counts only; formal levels wait for the accepted rules) ---------- */
  function stats(recs) {
    const s = { n: recs.length, ind: 0, wrong: 0, timeout: 0, helped: 0, repeat: 0, items: new Set(), indItems: new Set(), matched: 0, unmatched: 0 };
    for (const r of recs) {
      s.items.add(r.id);
      if (r.first === "timeout") s.timeout++;
      else if (r.first === "wrong") s.wrong++;
      if (r.hint || r.retry || r.assist) s.helped++;
      if (r.fresh === false) s.repeat++;
      if (independent(r)) (s.ind++, s.indItems.add(r.id));
      if (r.skill === "speak") r.first === "right" ? s.matched++ : r.first === "wrong" && s.unmatched++;
    }
    return { ...s, items: s.items.size, indItems: s.indItems.size };
  }
  /* material items per topic / sub-topic (for coverage), from the same sources as the tags */
  function universe() {
    const u = {};
    const add = (topic, sub, id) => {
      if (!topic) return;
      ((u[topic] = u[topic] || { all: new Set(), subs: {} }).all.add(id), (u[topic].subs[sub] = u[topic].subs[sub] || new Set()).add(id));
    };
    if (MAP) for (const [id, m] of Object.entries(MAP.items)) add(m.topic, m.sub || "", id);
    else {
      (typeof WORDS !== "undefined" ? WORDS : []).forEach((w) => WORD_TOPIC[w.th] && add(...WORD_TOPIC[w.th], "w:" + w.w));
      (SCN || []).forEach((c) => c.scenes.forEach((sc) => SCENE_TOPIC[`${c.id}/${sc.id}`] && sc.items.forEach((it) => add(...SCENE_TOPIC[`${c.id}/${sc.id}`], "s:" + it.en))));
    }
    return u;
  }
  function summary() {
    const R = ST.recs,
      U = universe();
    return {
      empty: !R.length,
      since: ST.since,
      provisional: !MAP,
      skills: SKILLS.map((k) => ({ ...k, ...stats(R.filter((r) => r.skill === k.id)) })),
      grammar: GRAMMAR.map((g) => ({ ...g, ...stats(R.filter((r) => (r.grammar || []).includes(g.id))), tagged: !!MAP })),
      topics: TOPICS.map((tp) => {
        const recs = R.filter((r) => r.topic === tp.id),
          uu = U[tp.id];
        return {
          ...tp,
          ...stats(recs),
          total: uu ? uu.all.size : 0,
          subs: tp.subs.map((name) => {
            const sr = recs.filter((r) => r.sub === name);
            return { name, ...stats(sr), total: uu && uu.subs[name] ? uu.subs[name].size : 0 };
          }),
        };
      }),
    };
  }
  /* records of one group (skill / topic / sub / grammar), newest first */
  function group(kind, id, sub) {
    const R = ST.recs.filter((r) => (kind === "skill" ? r.skill === id : kind === "grammar" ? (r.grammar || []).includes(id) : r.topic === id && (!sub || r.sub === sub)));
    return R.slice().reverse();
  }
  const isError = (r) => r.first !== "right" || r.hint || r.retry || r.assist;
  /* weak items of a group: recent errors first (one entry per item), then material not tried yet */
  function weakItems(kind, id, sub, n = 5) {
    const seen = new Set(),
      out = [];
    for (const r of group(kind, id, sub))
      if (isError(r) && !seen.has(r.id)) {
        seen.add(r.id);
        out.push({ id: r.id, text: r.text, cat: r.cat, scene: r.scene, why: r.first === "timeout" ? "超時" : r.first === "wrong" ? "答錯" : "要協助" });
      }
    if (kind === "topic" && out.length < n) {
      const tried = new Set(ST.recs.map((r) => r.id)),
        U = universe()[id];
      const pool = U ? [...(sub ? U.subs[sub] || new Set() : U.all)] : [];
      for (const pid of pool) if (out.length < n && !tried.has(pid) && !seen.has(pid)) out.push({ id: pid, text: pid.slice(2), why: "還沒練過", ...sceneOf(pid) });
    }
    return out.slice(0, n);
  }
  function sceneOf(pid) {
    if (!SCN || !pid.startsWith("s:")) return {};
    const en = pid.slice(2);
    for (const c of SCN) for (const sc of c.scenes) if (sc.items.some((it) => it.en === en)) return { cat: c.id, scene: sc.id };
    return {};
  }

  /* ---------- panel HTML ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const PENDING = '<span class="ab-pend">尚待評估</span>';
  function countLine(s) {
    if (!s.n) return PENDING + '<small>還沒有作答紀錄</small>';
    const parts = [`獨立首答答對 <b>${s.ind}</b> 次（${s.indItems} 個不同題目）`, `作答 ${s.n} 次`];
    if (s.wrong) parts.push(`首答錯 ${s.wrong}`);
    if (s.timeout) parts.push(`超時 ${s.timeout}`);
    if (s.helped) parts.push(`提示／重試／輔助 ${s.helped}`);
    if (s.repeat) parts.push(`短時間重複 ${s.repeat}（不算新證據）`);
    return `${parts.join("・")}<small>${PENDING} 正式程度：評估規則驗收後才顯示</small>`;
  }
  function panelHTML() {
    const S = summary();
    const row = (kind, id, name, s, extra = "") =>
      `<button type="button" class="ab-row" data-k="${kind}" data-id="${esc(id)}"${extra}><b>${esc(name)}</b><span>${countLine(s)}</span></button>`;
    const cover = (s) => (s.total ? `<small class="ab-cov">教材覆蓋：練過 ${s.items}／${s.total} 個項目（覆蓋不等於熟悉）</small>` : '<small class="ab-cov">這個主題還沒有對應的教材</small>');
    return `<h3>📊 我的英語能力</h3>
      <p class="fine">${S.empty ? "還沒有作答紀錄。這個功能從現在開始記錄；舊存檔（卡冊、經驗值）沒有每題的作答細節，不會拿來推測分數，所以先顯示「尚待評估」。" : `從 ${new Date(S.since).toLocaleDateString()} 開始記錄。`}正式百分比等評估規則驗收後才顯示；現在先列出實際次數與依據。</p>
      <h4>四種能力（分開計算）</h4><div class="ab-list">${S.skills.map((k) => row("skill", k.id, `${k.name}`, k, ` title="${esc(k.how)}"`)).join("")}</div>
      <p class="fine">獨立口說只記錄「語音辨識的文字是否吻合」，不代表文法或發音完全正確。</p>
      <h4>文法掌握</h4><div class="ab-list">${S.grammar
        .map((g) => (g.tagged ? row("grammar", g.id, g.name, g) : `<div class="ab-row off"><b>${esc(g.name)}</b><span>${PENDING}<small>題目的文法分類（外部 LEARNING-PROFILE-01）還沒交付；句子裡出現過去式不等於這題測了過去式，所以不推測。</small></span></div>`))
        .join("")}</div>
      <h4>主題熟悉度</h4>${S.provisional ? '<p class="fine">主題暫時依教材原本的欄位（單字主題、對話場景）對應；正式分類交付後會替換。</p>' : ""}
      <div class="ab-list">${S.topics
        .map((t) => `${row("topic", t.id, t.name, t)}${cover(t)}<div class="ab-subs">${t.subs.map((s) => `<button type="button" class="ab-sub" data-k="topic" data-id="${t.id}" data-sub="${esc(s.name)}">${esc(s.name)}<small>${s.n ? `獨立答對 ${s.ind}・作答 ${s.n}` : s.total ? "還沒練" : "尚無教材"}</small></button>`).join("")}</div>`)
        .join("")}</div>`;
  }
  function detailHTML(kind, id, sub) {
    const name = kind === "skill" ? SKILLS.find((x) => x.id === id).name : kind === "grammar" ? GRAMMAR.find((x) => x.id === id).name : TOPICS.find((x) => x.id === id).name + (sub ? `・${sub}` : "");
    const R = group(kind, id, sub),
      s = stats(R),
      errs = R.filter(isError).slice(0, 6),
      weak = weakItems(kind, id, sub);
    const when = (t) => new Date(t).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const what = (r) => [r.first === "timeout" ? "超時（不算語言答錯）" : r.first === "wrong" ? "首答錯" : "答對", r.hint && "用了提示", r.retry && "重試", r.assist && "夥伴補正", r.fresh === false && "短時間重複", r.speech && `語音辨識：${r.speech}`].filter(Boolean).join("・");
    return `<h3>📊 ${esc(name)}</h3>
      <p>${countLine(s)}</p>
      <h4>最近的錯誤</h4>${errs.length ? `<ul class="ab-errs">${errs.map((r) => `<li><b>${esc(r.text)}</b><small>${when(r.t)}・${esc(SKILLS.find((k) => k.id === r.skill).name)}・${what(r)}</small></li>`).join("")}</ul>` : '<p class="fine">最近沒有錯誤紀錄。</p>'}
      <h4>評估依據</h4><ul class="ab-why">
        <li>只有「第一次就答對，而且沒有提示、重試、夥伴補正，也不是 3 分鐘內重複同一題」才算獨立掌握的證據：這裡有 ${s.ind} 次。</li>
        <li>超時（${s.timeout}）和答錯（${s.wrong}）分開記；超時不算語言答錯。</li>
        <li>提示／重試／輔助（${s.helped}）和短時間重複（${s.repeat}）都有記錄，但不算新的獨立證據。</li>
        <li>${s.n ? `共 ${s.n} 筆紀錄、${s.items} 個不同題目。` : "還沒有紀錄。"}正式百分比與門檻等評估規則驗收後才顯示。</li>
        ${kind === "topic" && !MAP ? "<li>主題對應暫時依教材原本的欄位，正式分類交付後替換。</li>" : ""}
      </ul>
      ${weak.length ? `<h4>練習弱項</h4><p class="fine">先練：${weak.map((w) => `${esc(w.text)}（${w.why}）`).join("、")}</p>` : ""}
      <div class="dlg-row"><button type="button" class="ab-practice" data-k="${kind}" data-id="${esc(id)}"${sub ? ` data-sub="${esc(sub)}"` : ""} ${weak.length || kind === "skill" ? "" : "disabled"}>🎯 練習弱項</button><button type="button" class="ab-back">↩ 回能力總覽</button></div>`;
  }

  return { SKILLS, GRAMMAR, TOPICS, log, markAssist, summary, group, weakItems, panelHTML, detailHTML, tagsOf, independent, get records() { return ST.recs.slice(); }, get mapLoaded() { return !!MAP; }, get scenesLoaded() { return !!SCN; } };
})();
if (typeof module !== "undefined") module.exports = Ability;
