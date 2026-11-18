#!/usr/bin/env node
/* LEARNING-PROFILE-01 計算模組測試。node test/profile.test.cjs [--write-expected]
   使用真正的分類資料（content/learning-profile-v1），加上明確標示為「範例」的文法題 fixture。 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const LP = require("../profile.js");

const DATA = process.env.LP_DATA || path.join(__dirname, "../../../content/learning-profile-v1");
const J = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const itemTags = J("item-tags.json"), topicMap = J("topic-map.json"), qtypes = J("question-types.json").types, gmap = J("grammar-map.json");
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/grammar-items.sample.json"), "utf8"));
const WRITE = process.argv.includes("--write-expected");
const NOW = Date.parse("2026-11-18T12:00:00Z");
const H = 36e5, D = 24 * H;

const tagsReal = LP.indexTags(itemTags); // without grammar items (as in batch-01)
const tagsWithSample = LP.indexTags(itemTags, sample);
const base = (tags) => ({ qtypes, tags, contexts: topicMap.contexts, topicMap: topicMap.topics, grammarNodes: gmap.nodes, grammarForms: gmap.forms, now: NOW });
const run = (name, events, extra = {}) => {
  const p = LP.compute({ ...base(extra.tags || tagsReal), events, legacy: extra.legacy });
  const file = path.join(__dirname, "expected", name + ".json");
  const slim = JSON.parse(JSON.stringify(slimProfile(p))); // drop undefined keys, same as the file on disk
  if (WRITE) fs.writeFileSync(file, JSON.stringify(slim, null, 1) + "\n");
  else if (fs.existsSync(file)) assert.deepEqual(slim, JSON.parse(fs.readFileSync(file, "utf8")), name + ": differs from expected/" + name + ".json");
  return p;
};
// the snapshot keeps what a panel shows; everything else is checked by explicit asserts below
function slimProfile(p) {
  const ch = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { status: v.status, rawPct: v.rawPct, displayPct: v.displayPct, band: v.band, items: v.basis && v.basis.items, contexts: v.basis && v.basis.contexts, need: v.need, previous: v.previous && { displayPct: v.previous.displayPct, items: v.previous.items } }]));
  return {
    totals: p.totals,
    grammarV1: Object.fromEntries(Object.entries(p.grammar).filter(([, g]) => g.v1 || g.partial).map(([k, g]) => [k, { reason: g.reason, channels: ch(g.channels) }])),
    topics: Object.fromEntries(Object.entries(p.topics).map(([k, t]) => [k, {
      channels: Object.fromEntries(Object.entries(t.channels).map(([c, v]) => [c, { status: v.status, rawPct: v.rawPct, displayPct: v.displayPct, needSubtopics: v.needSubtopics }])),
      subtopics: Object.fromEntries(Object.entries(t.subtopics).map(([s, v]) => [s, { listening: ch(v.channels).listening, reading: ch(v.channels).reading, coverage: v.coverage, vocabOnly: v.vocabOnly, reason: v.reason }])),
    }])),
    weak: p.weak.map((w) => ({ id: w.id, channel: w.channel, rawPct: w.rawPct, displayPct: w.pct })),
    legacy: p.legacy,
  };
}
let n = 0;
const ev = (item, qtype, ctx, at, result = "correct", more = {}) => ({ v: 1, id: `t${++n}`, item, qtype, ctx, at, result, ...more });
const ORDER = ["Can I see the menu, please?", "What do you recommend?", "I'll have the same.", "Can I have some water, please?"];
const CAFE = ["Could I get an iced americano?", "Can I have a receipt?"];
const BILL = ["Can I have the bill, please?", "Can we pay separately?", "Could I get a receipt?"];
const results = [];
const T = (name, fn) => {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
  }
};

T("01 新玩家：沒有紀錄，全部尚待評估；時態沒有測驗工具", () => {
  const p = run("01-new-player", []);
  for (const g of Object.values(p.grammar).filter((g) => g.v1)) {
    assert.equal(g.reason, "no-instrument");
    assert.equal(g.channels.reading.status, "none");
    for (const ch of ["listening", "building", "speaking"]) assert.equal(g.channels[ch].status, "no-instrument", "選擇題不推論造句或口說");
  }
  for (const t of Object.values(p.topics)) for (const c of Object.values(t.channels)) assert.equal(c.status, "none");
  assert.equal(LP.describe(p.topics.food.channels.reading), "尚待評估");
  assert.equal(p.legacy, null);
  assert.equal(p.weak.length, 0);
});

T("02 反覆刷同題：30 次答對只算 1 個獨立證據", () => {
  const evs = Array.from({ length: 30 }, (_, i) => ev("s:Can I have the bill, please?", "scene:listen", "scene:bill", NOW - 2 * H + i * 60e3));
  const p = run("02-farming", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.status, "insufficient");
  assert.equal(s.basis.items, 1);
  assert.equal(s.basis.independentAttempts, 1);
  assert.equal(s.basis.excluded.repeat, 29);
  assert.equal(p.topics.food.subtopics.ordering.coverage.sentences.done, 1);
});

T("03 提示後答對：不算獨立掌握；24 小時內不用提示重答也不算", () => {
  const items = [...ORDER, ...BILL];
  const evs = items.flatMap((en, i) => [
    ev("s:" + en, "scene:listen", "scene:order", NOW - 3 * D + i * H, "correct", { hint: true }),
    ev("s:" + en, "scene:listen", "scene:order", NOW - 3 * D + i * H + 5 * 60e3, "correct"),
  ]);
  const p = run("03-hint-then-correct", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.status, "none");
  assert.equal(s.basis.independentAttempts, 0);
  assert.equal(s.basis.excluded.hint, items.length);
  assert.equal(s.basis.excluded.repeat, items.length);
  assert.equal(p.topics.food.subtopics.ordering.coverage.sentences.done, 0, "提示答對不算覆蓋");
  assert.equal(p.totals.practiceRate, 100, "練習答對率另計（含提示）");
});

T("04 跨情境獨立答對：達門檻才顯示百分比（四捨五入整數）；主題需 3 個次主題", () => {
  const plan = [[ORDER[0], "scene:order", 0], [ORDER[1], "scene:order", 0], [CAFE[0], "scene:cafe", 1], [CAFE[1], "scene:cafe", 1], [BILL[0], "scene:bill", 2], [BILL[1], "scene:bill", 2]];
  const evs = plan.map(([en, ctx, d], i) => ev("s:" + en, "scene:listen", ctx, NOW - (3 - d) * D + i * H, i === 5 ? "wrong" : "correct"));
  const p = run("04-cross-context", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.status, "scored");
  assert.equal(s.basis.items, 6);
  assert.equal(s.basis.contexts, 3);
  assert.equal(s.rawPct, 83.3, "原始：6 題答對 5 題");
  assert.equal(s.displayPct, 83, "顯示：83.3% 四捨五入為 83%（revision 9）");
  assert.equal(s.pct, s.displayPct, "pct 與 displayPct 相同（相容欄位）");
  assert.equal(s.ratio, "5/6");
  assert.equal(s.band, "熟悉");
  assert.equal(p.topics.food.subtopics.ordering.channels.reading.status, "none", "聽力證據不轉成閱讀");
  assert.equal(p.topics.food.channels.listening.status, "insufficient");
  assert.equal(p.topics.food.channels.listening.needSubtopics, 2);
  assert.equal(s.recentErrors.length, 1);
});

T("05 超時：和語言答錯分開，不扣分也不算證據", () => {
  const all = [...ORDER, ...CAFE];
  const evs = all.map((en, i) => ev("s:" + en, "scene:listen", i % 2 ? "scene:order" : "scene:cafe", NOW - 2 * D + i * 7 * H, i < 3 ? "timeout" : "correct"));
  const p = run("05-timeout", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.basis.timeouts, 3);
  assert.equal(s.basis.items, 3);
  assert.equal(s.status, "insufficient");
  assert.equal(s.recentErrors.length, 0, "超時不列為答錯");
  assert.equal(p.totals.timeouts, 3);
});

T("06 舊存檔：只列出，不推測補分", () => {
  const legacy = { cards: Object.fromEntries(["apple", "banana", "grape", "bread", "milk"].map((w) => [w, { c: 4, w: 0, last: 1 }])), sents: { "The boy kicks the ball.": { c: 2, w: 0 } } };
  const p = run("06-legacy-save", [], { legacy });
  assert.equal(p.legacy.wordsAnsweredRight, 5);
  assert.equal(p.legacy.sentencesAnsweredRight, 1);
  assert.equal(p.legacy.status, "none");
  assert.match(p.legacy.note, /尚待評估/);
  assert.equal(p.topics.food.subtopics.ingredients.coverage.words.done, 0, "舊卡冊不算覆蓋");
  assert.equal(p.topics.food.subtopics.ingredients.channels.reading.status, "none");
});

T("07 只會單字：增加詞彙覆蓋，但主題熟悉度仍尚待評估", () => {
  const words = ["apple", "banana", "grape", "bread", "milk", "lemon", "cheese", "egg"];
  const evs = words.map((w, i) => ev("w:" + w, "word:pic2word", i % 2 ? "battle" : "quest", NOW - (i % 3) * D - i * H));
  const p = run("07-vocab-only", evs);
  const sub = p.topics.food.subtopics.ingredients;
  assert.equal(sub.coverage.words.done, 8);
  assert.equal(sub.vocabOnly, true);
  assert.equal(sub.channels.reading.status, "none", "單字不算情境句熟悉度");
  assert.equal(p.weak.length, 0);
});

T("08 文法題（範例 fixture）：只有目標文法題才是時態證據；排序題只證明語序", () => {
  const g = sample.items.filter((x) => x.target === "tense:past-simple");
  const evs = g.slice(0, 6).map((x, i) => ev(x.id, "grammar:form-choice", i < 3 ? "quest:grammar-a" : "battle", NOW - (i < 3 ? 2 : 1) * D + i * H, i < 4 ? "correct" : "wrong"));
  // sentences containing past simple, answered in a scene: NOT evidence for past simple
  evs.push(ev("s:Sales went up last quarter.", "scene:zh", "scene:presentation", NOW - D));
  // ordering yes/no questions: form evidence only
  ["Can I see the menu, please?", "Is this dish spicy?", "Can we pay separately?", "Could I get a receipt?", "Do you have oat milk?"].forEach((en, i) =>
    evs.push(ev("s:" + en, "sent:order", i % 2 ? "quest:order-a" : "quest:order-b", NOW - (i % 2 ? 1 : 2) * D + i * H)));
  const p = run("08-grammar-sample", evs, { tags: tagsWithSample });
  const ps = p.grammar["tense:past-simple"];
  assert.equal(ps.channels.reading.status, "scored");
  assert.equal(ps.channels.reading.basis.items, 6);
  assert.equal(ps.channels.reading.rawPct, 66.7);
  assert.equal(ps.channels.reading.displayPct, 67, "4/6 = 66.7% → 67%");
  assert.equal(ps.channels.reading.band, "發展中");
  assert.equal(p.grammar["tense:going-to"].reason, "no-instrument");
  assert.equal(p.grammar["form:yes-no-question"].channels.building.status, "scored");
  assert.equal(p.grammar["tense:present-simple"].channels.building.status, "no-instrument", "排序題不證明時態");
  assert(p.weak.some((w) => w.id === "tense:past-simple" && w.channel === "reading"), "past simple listed as weak");
});

T("09 舊證據：超過 30 天顯示需要重新確認，不顯示百分比", () => {
  const plan = [[ORDER[0], "scene:order"], [ORDER[1], "scene:order"], [CAFE[0], "scene:cafe"], [CAFE[1], "scene:cafe"], [BILL[0], "scene:bill"]];
  const evs = plan.map(([en, ctx], i) => ev("s:" + en, "scene:listen", ctx, NOW - (40 + (i % 2)) * D));
  const p = run("09-stale", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.status, "stale");
  assert.equal(s.pct, undefined, "不顯示目前分數");
  assert.equal(s.previous.displayPct, 100, "保留上次結果");
  assert.match(LP.describe(s), /^需要重新確認（上次 100%，最後練習 2026-10-/);
});

T("10 先對後錯：以最近一次間隔作答為準", () => {
  const items = [...ORDER, CAFE[0]];
  const evs = items.flatMap((en, i) => [
    ev("s:" + en, "scene:listen", i % 2 ? "scene:order" : "scene:cafe", NOW - 5 * D + i * H, "correct"),
    ev("s:" + en, "scene:listen", "scene:order", NOW - 2 * D + i * H, i === 0 ? "wrong" : "correct"),
  ]);
  const p = run("10-latest-wins", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.basis.items, 5);
  assert.equal(s.displayPct, 80);
  assert.equal(s.rawPct, 80);
  assert.equal(s.basis.independentAttempts, 10);
});

T("11 口說：只有語音辨識吻合的獨立口說；跟讀不算", () => {
  const items = [...ORDER, ...BILL];
  const evs = items.map((en, i) => ev("s:" + en, "drive:speak", i % 2 ? "scene:order" : "scene:bill", NOW - (i % 3) * D - i * H, "correct", { sr: { matched: i !== 0, confidence: 0.8 } }));
  items.forEach((en, i) => evs.push(ev("s:" + en, "drive:shadow", "scene:order", NOW - 4 * D - i * H, "correct", { revealed: true, sr: { matched: true } })));
  const p = run("11-speaking", evs);
  const s = p.topics.food.subtopics.ordering.channels.speaking;
  assert.equal(s.status, "scored");
  assert.equal(s.basis.items, 7);
  assert.equal(s.rawPct, 85.7);
  assert.equal(s.displayPct, 86, "6/7 = 85.7% → 86%");
  assert.equal(p.totals.excluded.shadowing, 7);
  assert.match(p.speakingNote, /不代表文法或發音/);
});

T("12 重試：第一次答錯、重試答對 → 證據算答錯；練習答對率含重試", () => {
  const items = [...ORDER, ...BILL];
  const evs = items.map((en, i) => ev("s:" + en, "scene:listen", i % 2 ? "scene:order" : "scene:bill", NOW - (i % 2 ? 1 : 2) * D - i * H, i < 2 ? "wrong" : "correct", i < 2 ? { retries: 1, final: "correct" } : {}));
  const p = run("12-retry", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.rawPct, 71.4);
  assert.equal(s.displayPct, 71, "5/7 = 71.4% → 71%");
  assert.equal(s.basis.practiceRate, 100);
});

T("13 格式錯誤的事件：拒收並回報，不影響計算", () => {
  const p = LP.compute({ ...base(tagsReal), events: [{ item: "cake", at: "x" }, ev("s:Can I have the bill, please?", "nope", "scene:bill", NOW)] });
  assert.equal(p.totals.invalidEvents, 2);
  assert.equal(p.totals.attempts, 0);
});

T("14 面板文字：同一套說法", () => {
  const plan = [[ORDER[0], "scene:order", 0], [ORDER[1], "scene:order", 0], [CAFE[0], "scene:cafe", 1], [CAFE[1], "scene:cafe", 1], [BILL[0], "scene:bill", 2], [BILL[1], "scene:bill", 2]];
  const p = LP.compute({ ...base(tagsReal), events: plan.map(([en, ctx, d], i) => ev("s:" + en, "scene:listen", ctx, NOW - (3 - d) * D + i * H, i === 5 ? "wrong" : "correct")) });
  assert.equal(LP.describe(p.topics.food.subtopics.ordering.channels.listening), "83%（熟悉）· 6 題、3 種情境");
  assert.equal(LP.describe(p.topics.food.subtopics.ordering.channels.listening, null, { detail: true }),
    "83%（熟悉）· 6 題、3 種情境；6 題中答對 5 題＝83.3%，四捨五入顯示 83%");
  assert.equal(LP.describe(p.topics.food.subtopics.dietary.channels.listening), "尚待評估", "完全沒有證據");
  assert.equal(LP.describe(p.topics.food.channels.listening), "證據不足：還需要 2 個次主題達標");
  const q = LP.compute({ ...base(tagsReal), events: [ev("s:" + ORDER[0], "scene:listen", "scene:order", NOW - D)] });
  assert.equal(LP.describe(q.topics.food.subtopics.ordering.channels.listening), "證據不足：還需要 4 題、1 種情境、1 個學習日期的獨立作答");
  assert.equal(LP.describe(p.grammar["tense:will"].channels.speaking), "未提供評估：這個通道目前沒有題型（不從選擇題推論）");
  assert.equal(LP.describe(null, p.grammar["tense:will"].reason), "未提供評估：目前沒有能測這個文法的題型");
});

const gitemsPath = path.join(DATA, "grammar-items.json");
if (fs.existsSync(gitemsPath)) {
  const gitems = JSON.parse(fs.readFileSync(gitemsPath, "utf8"));
  const tagsG = LP.indexTags(itemTags, gitems);
  T("15 正式文法題（batch-02）：載入後時態不再是『沒有題目』，改為尚待評估；只有文法辨識通道", () => {
    const p = run("15-grammar-items-new-player", [], { tags: tagsG });
    for (const id of ["tense:present-simple", "tense:present-continuous", "tense:past-simple", "tense:going-to", "tense:will"]) {
      assert.equal(p.grammar[id].reason, undefined, id + " now has items");
      assert.equal(p.grammar[id].channels.reading.status, "none");
      assert.equal(p.grammar[id].channels.reading.channelZh, "文法辨識掌握度");
    }
    assert.equal(p.grammar["tense:present-perfect"].reason, "no-instrument", "非 v1 時態仍沒有題目");
  });
  T("16 正式文法題：will 跨主題 6 題、2 天，5 對 1 錯 → 83%；否定句型另計", () => {
    const wl = gitems.items.filter((x) => x.target === "tense:will").slice(0, 6);
    const evs = wl.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, NOW - (i < 3 ? 2 : 1) * D + i * H, i === 5 ? "wrong" : "correct"));
    const p = run("16-grammar-items-will", evs, { tags: tagsG });
    const r = p.grammar["tense:will"].channels.reading;
    assert.equal(r.status, "scored");
    assert.equal(r.rawPct, 83.3);
    assert.equal(r.displayPct, 83);
    assert(r.basis.contexts >= 2);
    const neg = p.grammar["form:negative"].channels.reading;
    assert.equal(neg.basis.items, wl.filter((x) => x.form === "form:negative").length);
    assert.equal(neg.status, "insufficient", "否定句型題數不足，不顯示百分比");
    assert.equal(p.grammar["tense:past-simple"].channels.reading.status, "none");
    assert.equal(p.topics.meeting.subtopics.actions.channels.reading.basis.items, wl.filter((x) => x.topics[0].sub === "actions").length, "文法題也是該次主題的句子層級證據");
  });
}

/* ---------- v1.1：協調人 2026-11-18 決定與補測 ---------- */
T("17 跨日與重複題：24 小時內再答是重複；滿 24 小時才是新的獨立證據", () => {
  const it = "s:" + ORDER[0], t0 = NOW - 3 * D;
  const evs = [ev(it, "scene:listen", "scene:order", t0, "wrong"), ev(it, "scene:listen", "scene:order", t0 + D - 60e3, "correct"),
    ev(it, "scene:listen", "scene:order", t0 + 2 * D, "correct")];
  const p = run("17-spacing-boundary", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.basis.excluded.repeat, 1, "23 小時 59 分後再答 → 重複");
  assert.equal(s.basis.independentAttempts, 2, "第 3 次距離上一次（重複那次）已滿 24 小時");
  assert.equal(s.basis.correctItems, 1, "同一題以最近一次獨立作答為準");
  assert.equal(s.basis.days, 2);
});

T("18 超過 90 天：不進入目前分數，但保留歷史並標『需要重新確認』", () => {
  const plan = [[ORDER[0], "scene:order"], [ORDER[1], "scene:order"], [CAFE[0], "scene:cafe"], [CAFE[1], "scene:cafe"], [BILL[0], "scene:bill"], [BILL[1], "scene:bill"]];
  const evs = plan.map(([en, ctx], i) => ev("s:" + en, "scene:listen", ctx, NOW - (120 + (i % 2)) * D, i === 5 ? "wrong" : "correct"));
  const p = run("18-over-90-days", evs);
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.equal(s.status, "stale");
  assert.equal(s.basis.items, 0, "90 天外的證據不算目前分數");
  assert.equal(s.previous.displayPct, 83, "歷史保留：當時 5/6");
  assert.equal(s.previous.rawPct, 83.3);
  assert.equal(p.weak.length, 0, "需要重新確認不等於弱項");
  // 30–90 天之間同樣是需要重新確認
  const q = LP.compute({ ...base(tagsReal), events: plan.map(([en, ctx], i) => ev("s:" + en, "scene:listen", ctx, NOW - (45 + (i % 2)) * D)) });
  assert.equal(q.topics.food.subtopics.ordering.channels.listening.status, "stale");
  assert.equal(q.topics.food.subtopics.ordering.channels.listening.basis.items, 6, "45 天前仍在 90 天內，列在依據裡");
});

T("19 pm-ability-v1 最多 4000 筆：裁切保留最新、同 id 去重；明確選用的「僅合併能力紀錄」取聯集", () => {
  const many = Array.from({ length: 4100 }, (_, i) => ev("s:" + ORDER[i % 4], "scene:listen", "scene:order", NOW - (4100 - i) * 60e3));
  const kept = LP.trimEvents(many);
  assert.equal(kept.length, 4000);
  assert.equal(kept[0].id, many[100].id, "最舊的 100 筆被裁掉");
  assert.equal(kept[3999].id, many[4099].id);
  const dupe = LP.trimEvents([...many.slice(0, 10), { ...many[5], final: "correct", retries: 1 }]);
  assert.equal(dupe.length, 10, "重試更新同一筆，不是新事件");
  assert.equal(dupe.find((e) => e.id === many[5].id).final, "correct");
  const backup = many.slice(3000, 3500), device = many.slice(3400, 4100);
  const merged = LP.mergeAbility(device, backup);
  assert.equal(merged.events.length, 1100, "聯集、去重");
  assert.deepEqual([merged.preview.add, merged.preview.duplicate, merged.preview.conflicts.length], [400, 100, 0]);
  const p = LP.compute({ ...base(tagsReal), events: many });
  assert.equal(p.totals.attempts, 4000, "compute 也只看最近 4000 筆");
});

T("20 多標籤不重複計分：談判句主分類職場，只有確實有會議作用的句子加會議副標籤；同一主題同一事件只算一次", () => {
  const deal = tagsReal["s:I think we have a deal."];
  assert.deepEqual(deal.topics.map((t) => [t.topic, t.sub, t.role]), [["work", "negotiation", "primary"], ["meeting", "confirming", "secondary"]]);
  assert.deepEqual(tagsReal["s:Could you lower the price a little?"].topics.map((t) => t.topic), ["work"], "純談判句不加會議標籤");
  assert.deepEqual(tagsReal["s:Can you deliver by the end of the month?"].topics.map((t) => t.topic), ["work"], "交期是談判條件，不加會議");
  assert.deepEqual(tagsReal["s:I need to check with my manager."].topics.map((t) => t.topic), ["work"], "拖延談判，不是會議行動");
  assert.deepEqual(tagsReal["s:Let's put it in writing."].topics.map((t) => [t.topic, t.sub]), [["work", "negotiation"], ["meeting", "actions"]]);
  const e1 = ev("s:I think we have a deal.", "scene:zh", "scene:negotiate", NOW - D);
  const p = LP.compute({ ...base(tagsReal), events: [e1] });
  assert.equal(p.topics.work.subtopics.negotiation.channels.reading.basis.independentAttempts, 1);
  assert.equal(p.topics.meeting.subtopics.confirming.channels.reading.basis.independentAttempts, 1);
  assert.deepEqual([p.totals.attempts, p.totals.distinctItems, p.totals.independent], [1, 1, 1], "副標籤不灌成額外作答：總事件、總題數各算一次");
  // a deliberately bad tag with two subtopics in the same topic still counts once in that topic
  const bad = { ...tagsReal, "s:X": { kind: "sentence", topics: [{ topic: "meeting", sub: "opinions", role: "primary" }, { topic: "meeting", sub: "confirming", role: "secondary" }], grammar: [], grammarStatus: "reviewed" } };
  const q = LP.compute({ ...base(bad), events: [ev("s:X", "scene:zh", "scene:meeting", NOW - D)] });
  const n = Object.values(q.topics.meeting.subtopics).reduce((a, s) => a + s.channels.reading.basis.independentAttempts, 0);
  assert.equal(n, 1, "同一事件在會議主題只計一次");
  // switch: secondary tags can be turned off entirely
  const r = LP.compute({ ...base(tagsReal), events: [e1], rules: { ...LP.RULES, secondaryTagsScore: false } });
  assert.equal(r.topics.meeting.subtopics.confirming.channels.reading.basis.independentAttempts, 0);
});

T("21 句子層級事件（決定 3）：生活情境一筆事件連結句子與單字；只計真正測到的能力", () => {
  const kitchen = ["Put the milk in the refrigerator.", "Turn off the stove after cooking.", "Heat the rice in the microwave.", "Fill the kettle with water.", "Cook the egg in the pan."];
  const words = ["refrigerator", "stove", "microwave", "kettle", "pan"];
  const evs = kitchen.map((en, i) => ev("s:" + en, "life:context-blank", "life:kitchen", NOW - (i % 2 ? 1 : 2) * D - i * H, "correct", { links: { word: "w:" + words[i] } }));
  evs.push(ev("s:Please put the salad on my plate.", "life:context-blank", "life:restaurant", NOW - 3 * D, "correct", { links: { word: "w:plate" } }));
  const p = run("21-sentence-level-life", evs);
  const cook = p.topics.food.subtopics.cooking;
  assert.equal(cook.channels.reading.basis.items, 5, "烹飪現在有句子層級證據");
  assert.equal(cook.channels.reading.status, "insufficient", "只有一種情境（life:kitchen），仍證據不足");
  assert.equal(cook.coverage.words.done, 5, "連結的單字算覆蓋，不另算分");
  assert.equal(p.totals.attempts, 6, "一次作答一筆事件");
  assert.equal(p.grammar["support:imperative"], undefined);
  assert.equal(p.grammar["form:negative"].channels.reading.basis.items, 0, "句子裡的文法只是出現，不算證據");
});

T("22 公式命名：rawPct 原始比例、displayPct 顯示分數（四捨五入到整數），不是加權", () => {
  const plan = [[ORDER[0], "scene:order", 0], [ORDER[1], "scene:order", 0], [CAFE[0], "scene:cafe", 1], [CAFE[1], "scene:cafe", 1], [BILL[0], "scene:bill", 2], [BILL[1], "scene:bill", 2]];
  const p = LP.compute({ ...base(tagsReal), events: plan.map(([en, ctx, d], i) => ev("s:" + en, "scene:listen", ctx, NOW - (3 - d) * D + i * H, i === 5 ? "wrong" : "correct")) });
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.deepEqual([s.basis.correctItems, s.basis.items, s.rawPct, s.displayPct], [5, 6, 83.3, 83]);
  assert.equal(Math.round((100 * 5) / 6), s.displayPct, "displayPct = round(5 / 6 × 100)");
  assert.equal(s.band, "熟悉", "等級依原始比例 83.3（70–84）");
});

T("23 弱項只列已達門檻且原始比例 < 70%；證據不足、需要重新確認都不列", () => {
  const plan = [[ORDER[0], "scene:order"], [ORDER[1], "scene:order"], [CAFE[0], "scene:cafe"], [CAFE[1], "scene:cafe"], [BILL[0], "scene:bill"], [BILL[1], "scene:bill"]];
  const evs = plan.map(([en, ctx], i) => ev("s:" + en, "scene:listen", ctx, NOW - (i % 2 ? 1 : 2) * D - i * H, i < 2 ? "correct" : "wrong"));
  evs.push(ev("s:" + ORDER[2], "scene:zh", "scene:order", NOW - D, "wrong")); // reading: 1 item only
  const p = LP.compute({ ...base(tagsReal), events: evs });
  assert.deepEqual(p.weak.map((w) => [w.id, w.channel, w.rawPct]), [["food/ordering", "listening", 33.3]]);
});

T("24 驗收工具 oracle.cjs：抓出重複事件 id，並算出面板預期值", () => {
  const { execFileSync } = require("child_process");
  const os = require("os");
  const g = JSON.parse(fs.readFileSync(path.join(DATA, "grammar-items.json"), "utf8")).items.filter((x) => x.target === "tense:past-simple");
  const evs = g.slice(0, 6).map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, NOW - (i < 3 ? 2 : 1) * D + i * H, i < 4 ? "correct" : "wrong", { via: "npc:t" }));
  const f = path.join(os.tmpdir(), "lp-oracle-test.json"), out = path.join(os.tmpdir(), "lp-oracle-out.json");
  const runOracle = (list) => {
    fs.writeFileSync(f, JSON.stringify({ "pm-ability-v1": JSON.stringify(list) }));
    try { execFileSync("node", [path.join(__dirname, "../acceptance/oracle.cjs"), f, "--now", new Date(NOW).toISOString(), "--check-events", "--json", out, "--data", DATA]); return 0; }
    catch (e) { return e.status; }
  };
  assert.equal(runOracle(evs), 0);
  const o = JSON.parse(fs.readFileSync(out, "utf8"));
  const row = o.rows.find((r) => r.ability === "過去簡單式");
  assert.deepEqual([row.status, row.displayPct, row.rawPct, row.items, row.correctItems, row.contexts, row.days], ["scored", 67, 66.7, 6, 4, 4, 3], "oracle 以數值比對，不只比文字");
  // 3 learning dates, not 2: the answers at 15:00Z and 16:00Z on 11-17 are 23:00 on 11-17 and 00:00 on 11-18 in Taipei
  assert.equal(runOracle([...evs, { ...evs[0] }]), 1, "重複 id 要被抓出");
});

/* ---------- v1.2：派工 revision 9 ---------- */
T("25 學習日期用台北時間；24 小時重複規則另外算", () => {
  assert.equal(LP.RULES.dayTimeZone, "Asia/Taipei");
  assert.equal(LP.dayOf(Date.parse("2026-11-17T15:59:00Z")), "2026-11-17", "台北 23:59");
  assert.equal(LP.dayOf(Date.parse("2026-11-17T16:00:00Z")), "2026-11-18", "台北 00:00");
  const it = (i) => "s:" + [...ORDER, ...CAFE][i];
  // five different lines, 15:00Z–16:30Z on 11-17 (UTC one day) → Taipei 11-17 and 11-18
  const at = ["15:00", "15:30", "15:59", "16:00", "16:30"].map((h) => Date.parse(`2026-11-17T${h}:00Z`));
  const p = LP.compute({ ...base(tagsReal), events: at.map((t, i) => ev(it(i), "scene:listen", i % 2 ? "scene:order" : "scene:cafe", t)) });
  const s = p.topics.food.subtopics.ordering.channels.listening;
  assert.deepEqual([s.status, s.basis.days], ["scored", 2]);
  // the same line again 2 h later (Taipei: the next date) is still a 24-hour repeat
  const q = LP.compute({ ...base(tagsReal), events: [ev(it(0), "scene:listen", "scene:cafe", at[0]), ev(it(0), "scene:listen", "scene:cafe", at[0] + 2 * H)] });
  const r = q.topics.food.subtopics.ordering.channels.listening;
  assert.deepEqual([r.basis.independentAttempts, r.basis.excluded.repeat, r.basis.days], [1, 1, 1]);
});

T("26 顯示四捨五入；跨門檻時顯示一位小數；弱項和等級用原始比例", () => {
  const R = LP.RULES;
  assert.deepEqual([83.333, 66.667, 85.714, 71.429, 80, 12.5].map((x) => LP.displayOf(x, R)), [83, 67, 86, 71, 80, 13]);
  assert.deepEqual([69.697, 84.615, 39.6, 69.96, 99.6].map((x) => LP.displayOf(x, R)), [69.7, 84.6, 39.6, 69.9, 99.6], "不讓 70／85／40／100 出現在沒達到的人身上");
  assert.equal(LP.RULES.displayStep, undefined, "取消 5% 級距");
});

T("27 未提供評估、證據不足、尚待評估三種說法分開", () => {
  const p = LP.compute({ ...base(tagsReal), events: [ev("s:" + ORDER[0], "scene:listen", "scene:order", NOW - D)] });
  assert.match(LP.describe(null, p.grammar["tense:will"].reason), /^未提供評估/, "沒有題型");
  assert.match(LP.describe(p.grammar["tense:will"].channels.speaking), /^未提供評估/, "通道沒有題型");
  assert.match(LP.describe(p.topics.food.subtopics.ordering.channels.listening), /^證據不足/);
  assert.equal(LP.describe(p.topics.food.subtopics.dietary.channels.listening), "尚待評估");
  assert(!p.weak.length, "都不是弱項");
});

const store = (evs) => JSON.stringify({ v: 2, events: evs });
const E = (id, at, more = {}) => ({ v: 1, id, item: "s:" + ORDER[0], qtype: "scene:listen", ctx: "scene:order", at, result: "correct", ...more });
T("28 還原（整份還原）：預覽列出裝置上會消失的事件；不合併", () => {
  const device = { "pm-ability-v1": store([E("a", 1), E("b", 2), E("c", 3)]) };
  const backup = { "pm-ability-v1": store([E("a", 1), E("x", 4)]), "pm-cards": "{}" };
  const pv = LP.previewRestore(device, backup, "replace", { qtypes });
  assert.deepEqual([pv.mode, pv.ok, pv.device, pv.backup, pv.result, pv.deviceOnlyLost], ["replace", true, 3, 2, 2, 2]);
  assert.deepEqual(pv.keys.sort(), ["pm-ability-v1", "pm-cards"]);
});

T("29 還原（僅合併能力紀錄）：預覽新增／重複／衝突／裁切；衝突不猜，保留裝置資料", () => {
  const dev = [E("a", 1), E("b", 2), E("c", 3)];
  const bak = [E("a", 1), E("b", 2, { result: "wrong" }), E("x", 4), E("y", 0)];
  const m = LP.mergeAbility(store(dev), store(bak), 4);
  assert.deepEqual([m.preview.add, m.preview.duplicate, m.preview.conflicts.map((c) => c.id), m.preview.trimmed, m.preview.result], [2, 1, ["b"], 1, 4]);
  assert.equal(m.events.find((e) => e.id === "b").result, "correct", "同 id 內容不同：保留裝置上的原資料");
  assert.deepEqual(m.events.map((e) => e.id), ["a", "b", "c", "x"], "裁切掉最舊的 y");
  const pv = LP.previewRestore({ "pm-ability-v1": store(dev) }, { "pm-ability-v1": store(bak), "pm-cards": "{}" }, "merge-ability", { qtypes });
  assert.deepEqual(pv.keys, ["pm-ability-v1"], "只動能力紀錄，其他鍵不動");
  assert.equal(pv.conflicts.length, 1);
  assert.throws(() => LP.previewRestore({}, {}, "union"), /mode/);
});

T("30 還原前驗證：格式錯、超過 4000、重複 id 都在寫入前擋下", () => {
  assert.deepEqual(LP.validateStore(store([E("a", 1)]), qtypes), []);
  assert(LP.validateStore("{bad", qtypes).length);
  assert(LP.validateStore(store([E("a", 1), E("a", 2)]), qtypes).some((x) => /duplicate id/.test(x)));
  assert(LP.validateStore(store([{ ...E("a", 1), result: "maybe" }]), qtypes).length);
  assert(LP.validateStore(store(Array.from({ length: 4001 }, (_, i) => E("e" + i, i))), qtypes).some((x) => /max 4000/.test(x)));
  const pv = LP.previewRestore({}, { "pm-ability-v1": store([E("a", 1), E("a", 2)]) }, "replace", { qtypes });
  assert.equal(pv.ok, false);
});

T("31 原子寫入：任何一個鍵寫入失敗（例如 quota），全部回到原狀", () => {
  const mem = new Map([["pm-cards", "OLD-C"], ["pm-ability-v1", "OLD-A"]]);
  let writes = 0;
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { if (++writes === 3) throw new Error("QuotaExceededError"); mem.set(k, v); },
    removeItem: (k) => mem.delete(k),
  };
  assert.throws(() => LP.atomicWrite(storage, { "pm-cards": "NEW-C", "pm-ability-v1": "NEW-A", "pm-sents": "NEW-S" }), /Quota/);
  assert.deepEqual([...mem.entries()].sort(), [["pm-ability-v1", "OLD-A"], ["pm-cards", "OLD-C"]], "沒有半套還原");
  LP.atomicWrite({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }, { "pm-ability-v1": "NEW-A" });
  assert.equal(mem.get("pm-ability-v1"), "NEW-A");
});

T("32 裁切到 4000 筆後，被裁掉的舊證據不再算數（不虛構歷史）", () => {
  const old = [ORDER[0], ORDER[1], CAFE[0], CAFE[1], BILL[0], BILL[1]].map((en, i) => ev("s:" + en, "scene:listen", i % 2 ? "scene:order" : "scene:cafe", NOW - (3 - (i % 2)) * D));
  const filler = Array.from({ length: 4000 }, (_, i) => ev("w:apple", "word:pic2word", "battle", NOW - 2 * D + i * 1000));
  const before = LP.compute({ ...base(tagsReal), events: old });
  const after = LP.compute({ ...base(tagsReal), events: [...old, ...filler] });
  assert.equal(before.topics.food.subtopics.ordering.channels.listening.status, "scored");
  assert.equal(after.topics.food.subtopics.ordering.channels.listening.status, "none");
  assert.equal(after.totals.trimmed, 6);
});

const fail = results.filter((r) => r[0] === "FAIL");
for (const r of results) console.log(r.join("  "));
console.log(`${results.length - fail.length}/${results.length} passed${WRITE ? " (expected/ written)" : ""}`);
process.exit(fail.length ? 1 : 0);
