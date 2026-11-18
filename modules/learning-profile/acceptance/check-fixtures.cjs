#!/usr/bin/env node
/* Checks each acceptance fixture against its hand-written "_expect" (numbers / status only).
   usage: node check-fixtures.cjs [--dir fixtures] [--data <content dir>] */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const LP = require("../profile.js");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const DIR = opt("--dir", path.join(__dirname, "fixtures"));
const DATA = opt("--data", path.join(__dirname, "../../../content/learning-profile-v1"));
const J = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const qtypes = J("question-types.json").types, tm = J("topic-map.json"), gm = J("grammar-map.json"), tags = J("item-index.json").items;
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const out = [];
const check = (name, fn) => { try { fn(); out.push(["PASS", name]); } catch (e) { out.push(["FAIL", name, e.message.split("\n").slice(0, 4).join(" ")]); } };
const keysOf = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const fx = read(f), exp = fx._expect;
  if (!exp || f.startsWith("F4-F5-device")) continue;
  check(f, () => {
    const now = Date.parse(fx._now);
    if (f.startsWith("F4-F5-backup")) {
      const dev = keysOf(read("F4-F5-device.json")), bak = keysOf(fx);
      const r = LP.previewRestore(dev, bak, "replace", { qtypes });
      for (const k of ["device", "backup", "result", "deviceOnlyLost"]) assert.equal(r[k], exp.replace[k], "replace." + k);
      const m = LP.previewRestore(dev, bak, "merge-ability", { qtypes });
      for (const k of ["add", "duplicate", "trimmed", "result"]) assert.equal(m[k], exp["merge-ability"][k], "merge." + k);
      assert.deepEqual(m.conflicts.map((c) => c.id), exp["merge-ability"].conflicts);
      return;
    }
    if (f.startsWith("F6")) return assert.equal(LP.previewRestore({}, keysOf(fx), "replace", { qtypes }).ok, exp.ok);
    const events = JSON.parse(fx["pm-ability-v1"]).events;
    const p = LP.compute({ events, tags, qtypes, contexts: tm.contexts, topicMap: tm.topics, grammarNodes: gm.nodes, grammarForms: gm.forms, now });
    for (const [key, want] of Object.entries(exp)) {
      if (key === "hand") continue;
      let cell;
      if (key === "totals") cell = p.totals;
      else if (key.startsWith("grammar:")) cell = p.grammar[key.slice(8)].channels.reading;
      else { const [, ts, ch] = key.split(":"), [t, s] = ts.split("/"); cell = p.topics[t].subtopics[s].channels[ch]; }
      const b = cell.basis || {};
      const got = { status: cell.status, items: b.items, correctItems: b.correctItems, contexts: b.contexts, days: b.days, rawPct: cell.rawPct, displayPct: cell.displayPct,
        band: cell.band, weak: !!cell.weak, previousPct: cell.previous && cell.previous.displayPct, attempts: cell.attempts, trimmed: cell.trimmed };
      for (const [k, v] of Object.entries(want)) {
        if (k === "need") for (const [nk, nv] of Object.entries(v)) assert.equal(cell.need[nk], nv, `${key}.need.${nk}`);
        else assert.deepEqual(got[k], v, `${key}.${k}`);
      }
    }
  });
}
for (const r of out) console.log(r.join("  "));
const fail = out.filter((r) => r[0] === "FAIL").length;
console.log(`${out.length - fail}/${out.length} fixtures match their hand-written expectations`);
process.exit(fail ? 1 : 0);
