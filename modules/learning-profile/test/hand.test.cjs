#!/usr/bin/env node
/* Hand-computed expectations (test/hand-fixtures.json) against profile.js. Independent of describe() and of the oracle:
   only numbers, status and evidence are compared. node test/hand.test.cjs */
"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const LP = require("../profile.js");
const DATA = process.env.LP_DATA || path.join(__dirname, "../../../content/learning-profile-v1");
const J = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const qtypes = J("question-types.json").types, tm = J("topic-map.json"), gm = J("grammar-map.json");
const realTags = J("item-index.json").items;
const F = JSON.parse(fs.readFileSync(path.join(__dirname, "hand-fixtures.json"), "utf8"));
const NOW = Date.parse(F.now);
const synth = (target) => ({ kind: "grammar-item", topics: [], target, grammar: [target], grammarStatus: "reviewed" });

let n = 0;
const out = [];
for (const c of F.cases) {
  try {
    const tags = c.realTags ? realTags : {};
    for (const [id, t] of Object.entries(F.tags)) if (!c.realTags) tags[id] = synth(t.target);
    const evs = [];
    const mk = (item, ctx, at, result, more = {}) => ({ v: 1, id: `h${++n}`, item, qtype: more.qtype || "grammar:form-choice", ctx, at, result, ...more, ...(more.qtype ? { qtype: more.qtype } : {}) });
    for (const [item, ctx, at, result, more] of c.events || []) evs.push(mk(item, ctx, Date.parse(at), result, more));
    if (c.gen) {
      const g = c.gen;
      for (let i = 0; i < g.count; i++) {
        const id = `${g.prefix}${String(i + 1).padStart(2, "0")}`;
        tags[id] = synth(g.target);
        evs.push(mk(id, g.ctx[i % 2], Date.parse(g.days[i % 2]) + i * g.stepMs, i < g.correct ? "correct" : "wrong"));
      }
    }
    if (c.genAfter) {
      const g = c.genAfter;
      for (let i = 0; i < g.count; i++) evs.push(mk(g.item, g.ctx, Date.parse(g.start) + i * g.stepMs, "correct"));
    }
    const p = LP.compute({ events: evs, tags, qtypes, contexts: tm.contexts, topicMap: tm.topics, grammarNodes: gm.nodes, grammarForms: gm.forms, now: NOW });
    for (const [key, want] of Object.entries(c.expect)) {
      let cell;
      if (key === "totals") cell = p.totals;
      else if (key.startsWith("grammar:")) cell = p.grammar[key.slice(8)].channels.reading;
      else {
        const [, ts, ch] = key.split(":"), [t, s] = ts.split("/");
        cell = p.topics[t].subtopics[s].channels[ch];
      }
      const b = cell.basis || {};
      const got = {
        status: cell.status, items: b.items, correctItems: b.correctItems, contexts: b.contexts, days: b.days, independentAttempts: b.independentAttempts,
        rawPct: cell.rawPct, displayPct: cell.displayPct, band: cell.band, weak: !!cell.weak, practiceRate: b.practiceRate, need: cell.need,
        previousPct: cell.previous && cell.previous.displayPct, lastEvidenceDay: b.lastEvidenceDay,
        attempts: cell.attempts, distinctItems: cell.distinctItems, trimmed: cell.trimmed,
      };
      for (const [f, v] of Object.entries(want)) {
        if (f === "excluded") for (const [k, m] of Object.entries(v)) assert.equal((b.excluded || {})[k] || 0, m, `${key}.excluded.${k}`);
        else assert.deepEqual(got[f], v, `${key}.${f}`);
      }
      if (key.startsWith("grammar:") && want.weak != null)
        assert.equal(p.weak.some((w) => w.id === key.slice(8)), want.weak, `${key}: weak list`);
    }
    out.push(["PASS", c.id, c.title]);
  } catch (e) {
    out.push(["FAIL", c.id, c.title, e.message.split("\n").slice(0, 6).join(" ")]);
  }
}
for (const r of out) console.log(r.join("  "));
const fail = out.filter((r) => r[0] === "FAIL").length;
console.log(`${out.length - fail}/${out.length} hand-computed cases passed`);
process.exit(fail ? 1 : 0);
