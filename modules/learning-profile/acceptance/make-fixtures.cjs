#!/usr/bin/env node
/* Builds the storage exports used by ACCEPTANCE-INTEGRATION.md (C1, C2, C3, C9, C10, F2, F4–F6), dated relative to --now
   (default: the current time) so they stay inside the 30/90-day windows on the day of the test. Each file is a
   localStorage export: { "pm-ability-v1": "<json>", "pm-cards": …, "_expect": <hand-computed expectation> }.
   The "_expect" values are written by hand below (with the arithmetic), not computed by profile.js.
   usage: node make-fixtures.cjs [--now 2026-11-18T12:00:00Z] [--out fixtures] [--data <content dir>] */
"use strict";
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const NOW = Date.parse(opt("--now", new Date().toISOString()));
const OUT = opt("--out", path.join(__dirname, "fixtures"));
const DATA = opt("--data", path.join(__dirname, "../../../content/learning-profile-v1"));
const tags = JSON.parse(fs.readFileSync(path.join(DATA, "item-index.json"), "utf8")).items;
const G = JSON.parse(fs.readFileSync(path.join(DATA, "grammar-items.json"), "utf8")).items;
const H = 36e5, D = 24 * H, TPE = 8 * H;
// the Asia/Taipei midnight that started yesterday (Taipei), as UTC ms
const todayTpe = Math.floor((NOW + TPE) / D) * D - TPE;
const Y = todayTpe - D; // Taipei 00:00 yesterday
let n = 0;
const ev = (item, qtype, ctx, at, result = "correct", more = {}) => ({ v: 1, id: `fx-${++n}`, item, qtype, ctx, at, result, via: "fixture", ...more });
const g = (target) => G.filter((x) => x.target === target);
const store = (events, extra = {}) => ({ "pm-ability-v1": JSON.stringify({ v: 2, events }), ...extra });
const files = {};

// C1: past simple 6 items, Taipei yesterday-1 and yesterday (10:00), 4 contexts, results ✓✗✓✓✗✓
const ps = g("tense:past-simple").slice(0, 6);
files["C1-past-simple-4of6"] = store(ps.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, (i < 3 ? Y - D : Y) + 10 * H + i * 60e3, [1, 0, 1, 1, 0, 1][i] ? "correct" : "wrong")));
files["C1-past-simple-4of6"]._expect = { "grammar:tense:past-simple": { status: "scored", items: 6, correctItems: 4, contexts: new Set(ps.map((x) => x.ctx)).size, days: 2, rawPct: 66.7, displayPct: 67, band: "發展中", weak: true },
  hand: "4÷6=66.7% → 67%；情境 = 題目附的 ctx（g:pst-01…06 共 4 種）；台北日期 2 天；<70 → 弱項" };

// C2: going-to, 3 items only
const gt = g("tense:going-to").slice(0, 3);
files["C2-going-to-3-items"] = store(gt.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, Y + 10 * H + i * 60e3)));
files["C2-going-to-3-items"]._expect = { "grammar:tense:going-to": { status: "insufficient", items: 3, need: { items: 2 }, weak: false }, hand: "3 題 < 5 → 證據不足，還差 2 題；不顯示 %、不列弱項" };

// C3: will 45 days ago (5/6), present continuous 120 days ago (6/6)
const wl = g("tense:will").slice(0, 6), pc = g("tense:present-continuous").slice(0, 6);
files["C3-stale-45-and-120-days"] = store([
  ...wl.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, todayTpe - (i < 3 ? 46 : 45) * D + 10 * H + i * 60e3, i === 5 ? "wrong" : "correct")),
  ...pc.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, todayTpe - (i < 3 ? 121 : 120) * D + 10 * H + i * 60e3)),
]);
files["C3-stale-45-and-120-days"]._expect = {
  "grammar:tense:will": { status: "stale", items: 6, previousPct: 83, weak: false },
  "grammar:tense:present-continuous": { status: "stale", items: 0, previousPct: 100, weak: false },
  hand: "will：最新 45 天前（>30）→ 需要重新確認，45 天仍在 90 天內 → 依據 6 題；上次 5/6=83%。現在進行式：120 天前（>90）→ 依據 0 題，但歷史保留，上次 6/6=100%",
};

// C9: 33 different food/ordering lines read in scene:zh, 23 right → 69.7% shown as 69.7 and weak
const ordering = Object.entries(tags).filter(([id, t]) => id.startsWith("s:") && t.kind !== "word" && (t.topics || []).some((x) => x.topic === "food" && x.sub === "ordering" && x.role === "primary")).map(([id]) => id).slice(0, 33);
if (ordering.length < 33) throw new Error("need 33 food/ordering lines, found " + ordering.length);
files["C9-boundary-69_7"] = store(ordering.map((id, i) => ev(id, "scene:zh", i % 2 ? "scene:order" : "scene:cafe", (i % 2 ? Y : Y - D) + 10 * H + i * 60e3, i < 23 ? "correct" : "wrong")));
files["C9-boundary-69_7"]._expect = { "topic:food/ordering:reading": { status: "scored", items: 33, correctItems: 23, rawPct: 69.7, displayPct: 69.7, weak: true }, hand: "23÷33=69.697% → 四捨五入 70 會跨過 70 → 顯示 69.7；<70 → 弱項" };

// C10: Taipei midnight. H3-like (2 learning dates in one UTC date) on will; H4-like (1 learning date over two UTC dates) on going-to
const w5 = g("tense:will").slice(0, 5), t5 = g("tense:going-to").slice(0, 5);
files["C10-taipei-dates"] = store([
  ...w5.map((x, i) => ev(x.id, "grammar:form-choice", i % 2 ? "grammar:travel/airport" : "grammar:food/ordering", todayTpe + [-60, -30, -1, 0, 30][i] * 60e3)),
  ...t5.map((x, i) => ev(x.id, "grammar:form-choice", i % 2 ? "grammar:travel/airport" : "grammar:food/ordering", Y + [0.5, 1, 10, 16, 18][i] * H)),
]);
files["C10-taipei-dates"]._expect = {
  "grammar:tense:will": { status: "scored", items: 5, days: 2, displayPct: 100 },
  "grammar:tense:going-to": { status: "insufficient", items: 5, days: 1, need: { days: 1 } },
  hand: "will：台北今天 00:00 前後各有作答（23:00、23:30、23:59 → 昨天；00:00、00:30 → 今天）→ 2 天。going-to：台北昨天 00:30–18:00，UTC 是兩個日期，台北只有 1 天 → 還差 1 個學習日期",
};

// F2: old will evidence + 4000 newer events on one word → will trimmed away
const filler = Array.from({ length: 4000 }, (_, i) => ev("w:apple", "word:pic2word", "battle", Y + i * 10e3));
files["F2-trim-4000"] = store([...wl.map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, Y - 2 * D + 10 * H + (i < 3 ? 0 : D) + i * 60e3, i === 5 ? "wrong" : "correct")), ...filler]);
files["F2-trim-4000"]._expect = { "grammar:tense:will": { status: "none", items: 0 }, totals: { attempts: 4000, trimmed: 6 }, hand: "4006 筆只留最新 4000 → will 的 6 筆（最舊）全被裁掉 → 尚待評估" };

// F4/F5: device and backup for restore (one shared id with different content = conflict)
const base = ps.slice(0, 3).map((x, i) => ev(x.id, "grammar:form-choice", x.ctx, Y + 9 * H + i * 60e3));
const device = [...base, ev(gt[0].id, "grammar:form-choice", gt[0].ctx, Y + 12 * H)];
const backup = [base[0], { ...base[1], result: "wrong" }, ev(wl[0].id, "grammar:form-choice", wl[0].ctx, Y - D)];
files["F4-F5-device"] = store(device, { "pm-cards": JSON.stringify({ apple: { c: 5, w: 0, last: 1 } }) });
files["F4-F5-backup"] = store(backup, { "pm-cards": JSON.stringify({ apple: { c: 2, w: 0, last: 1 } }) });
files["F4-F5-backup"]._expect = {
  replace: { device: 4, backup: 3, result: 3, deviceOnlyLost: 2, cardsAfter: "備份的 apple c=2" },
  "merge-ability": { add: 1, duplicate: 1, conflicts: [base[1].id], trimmed: 0, result: 5, cardsAfter: "裝置的 apple c=5（不動）", conflictKept: "裝置那筆 result: correct" },
  hand: "裝置 4 筆（A、B、C、D），備份 3 筆（A 相同、B 同 id 但 result 不同、E 新）。整份還原：結果 = 備份 3 筆，裝置上 C、D 消失 → 2。僅合併：E 新增 1、A 重複 1、B 衝突 1（保留裝置）→ 4+1=5",
};
// F6: malformed backup
files["F6-bad-backup"] = store([base[0], base[0], { ...base[2], id: "fx-bad", result: "maybe" }]);
files["F6-bad-backup"]._expect = { ok: false, hand: "重複 id、result 不合法 → 預覽就擋下" };

fs.mkdirSync(OUT, { recursive: true });
for (const [name, o] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ _now: new Date(NOW).toISOString(), ...o }, null, 1) + "\n");
console.log(`wrote ${Object.keys(files).length} fixtures to ${OUT} (now ${new Date(NOW).toISOString()})`);
