#!/usr/bin/env node
/* LEARNING-PROFILE-01 整合驗收用「預期值」工具（外部，獨立於內部實作）。
   Reads a storage export (JSON object of localStorage keys, e.g. from the game's backup or
   `JSON.stringify(Object.fromEntries(Object.entries(localStorage)))`) and prints what the ability panel MUST show,
   computed with the same content and lp-rules-v1.1. The panel is accepted only if every cell matches.
   usage: node oracle.cjs <export.json> [--now 2026-11-18T12:00:00Z] [--data <content dir>] [--json out.json] [--check-events] */
"use strict";
const fs = require("fs");
const path = require("path");
const LP = require("../profile.js");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const DATA = opt("--data", path.join(__dirname, "../../../content/learning-profile-v1"));
const J = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const store = JSON.parse(fs.readFileSync(args[0], "utf8"));
const parse = (v, d) => { try { return v == null ? d : typeof v === "string" ? JSON.parse(v) : v; } catch (_) { return d; } };
const raw = parse(store["pm-ability-v1"], []);
const events = Array.isArray(raw) ? raw : raw.events || [];
const now = Date.parse(opt("--now", new Date().toISOString()));
const qt = J("question-types.json").types, tm = J("topic-map.json"), gm = J("grammar-map.json");
const tags = J("item-index.json").items;

const problems = [];
if (args.includes("--check-events")) {
  const ids = new Set();
  if (events.length > LP.RULES.maxEvents) problems.push(`pm-ability-v1 has ${events.length} events (max ${LP.RULES.maxEvents})`);
  events.forEach((e, i) => {
    const errs = LP.validateEvent(e, qt);
    if (errs.length) problems.push(`event #${i} ${e && e.id}: ${errs.join("; ")}`);
    if (e && e.id != null) (ids.has(e.id) ? problems.push(`duplicate event id ${e.id} (retries must update the same event)`) : ids.add(e.id));
    if (e && e.id == null) problems.push(`event #${i} has no id`);
    if (e && !tags[e.item]) problems.push(`event ${e.id}: item ${e.item} not in item-index.json`);
    if (e && e.qtype === "grammar:form-choice" && !/^grammar:/.test(e.ctx || "")) problems.push(`event ${e.id}: grammar item ctx should be the item's grammar:<topic>/<sub>`);
    if (e && e.qtype === "life:context-blank" && !(e.item.startsWith("s:") && e.links && e.links.word)) problems.push(`event ${e.id}: life context must be s:<sentence> with links.word (decision 3)`);
  });
}
const p = LP.compute({ events, tags, qtypes: qt, contexts: tm.contexts, topicMap: tm.topics, grammarNodes: gm.nodes, grammarForms: gm.forms,
  legacy: { cards: parse(store["pm-cards"], {}), sents: parse(store["pm-sents"], {}) }, now });

const rows = [];
for (const [id, g] of Object.entries(p.grammar)) {
  if (!g.v1 && !g.partial) continue;
  rows.push(["文法", g.zh, g.channels.reading.channelZh, g.channels.reading.status, LP.describe(g.channels.reading, g.reason)]);
}
for (const [tid, t] of Object.entries(p.topics)) {
  for (const ch of Object.keys(LP.CHANNEL_ZH)) rows.push(["主題", t.zh, LP.CHANNEL_ZH[ch], t.channels[ch].status, LP.describe(t.channels[ch])]);
  for (const [sid, s] of Object.entries(t.subtopics))
    for (const ch of Object.keys(LP.CHANNEL_ZH)) rows.push(["次主題", `${t.zh}・${s.zh}`, LP.CHANNEL_ZH[ch], s.channels[ch].status, LP.describe(s.channels[ch], s.reason)]);
}
const out = {
  rulesVersion: p.rulesVersion, computedAt: p.computedAt, events: events.length, totals: p.totals,
  legacy: p.legacy, weak: p.weak, rows: rows.map(([a, b, c, d, e]) => ({ group: a, ability: b, channel: c, status: d, text: e })), problems,
};
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out, null, 1) + "\n");
for (const r of rows) if (r[3] !== "none" || process.env.ALL) console.log(r.join(" | "));
console.log(`events ${events.length} · independent ${p.totals.independent} · timeouts ${p.totals.timeouts} · weak ${p.weak.map((w) => `${w.zh}/${w.channel} ${w.rawPct}%`).join("、") || "—"}`);
if (p.legacy) console.log(`舊紀錄：答對過 ${p.legacy.wordsAnsweredRight} 詞、${p.legacy.sentencesAnsweredRight} 句（尚待評估）`);
for (const x of problems) console.log("PROBLEM", x);
process.exit(problems.length ? 1 : 0);
