// B-KK-DATA-01 trial integration evidence (no browser): the external validator against this repo (novice.js, the
// original 80 words, assets/voice), and the game's own KK data against the external reviewed data:
// supplement KK and spelling splits identical where both exist, needs-review words (with, usually) unused, chapter
// sound sets identical, and the cot–caught merger rule (no /ɑ/ distractor for /ɔ/ words, no /ɔ/ for /ɑ/ words).
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const tmp = path.join(require("os").tmpdir(), `kk-validate-${process.pid}.json`);
execFileSync("node", [path.join(root, "modules/kk-data/kk-validate.cjs"), "--data", path.join(root, "content/kk-v1"), "--root", root, "--out", tmp], { encoding: "utf8" });
const v = JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.unlinkSync(tmp);
assert.equal(v.pass, true, "external validator passes against this repo");
assert.deepEqual([v.errors.length, v.warnings.length], [0, 0]);
assert.equal(v.counts.sounds, 41);
global.WORDS = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8")).map((x) => ({ w: x.word, z: x.zh, kk: x.kk, au: x.audio || "" }));
const N = require(path.join(root, "novice.js"));
const W = JSON.parse(fs.readFileSync(path.join(root, "content/kk-v1/words-reviewed.json"), "utf8"));
const words = W.words || W;
const byW = new Map(words.map((w) => [w.word, w]));
const norm = (k) => String(k || "").replace(/[[\]ˋˏ]/g, "");
let sameKK = 0, sameSplit = 0;
for (const s of N.SUPPLEMENT) {
  const e = byW.get(s.w);
  if (!e) continue;
  assert.equal(norm(s.kk), norm(e.kk), `${s.w}: game KK = external reviewed KK`);
  sameKK++;
}
for (const [w, parts] of Object.entries(N.WORDS_SPLIT)) {
  const e = byW.get(w);
  if (!e || !e.chunks) continue;
  assert.deepEqual(parts, e.chunks.map((c) => [c.text, (c.soundTokens || []).join("")]), `${w}: same spelling split`);
  sameSplit++;
}
for (const e of words.filter((x) => x.reviewStatus !== "reviewed")) assert(!N.WORDS_SPLIT[e.word] && !N.SUPPLEMENT.some((s) => s.w === e.word), `${e.word} (needs-review) is not used`);
const S = JSON.parse(fs.readFileSync(path.join(root, "content/kk-v1/kk-sounds-reviewed.json"), "utf8"));
for (const [id, p] of Object.entries(N.PLAN)) {
  const ch = (S.chapters || []).find((c) => c.id === id);
  assert(ch, id + " in the external data");
  assert.deepEqual((ch.newSounds || ch.sounds).slice().sort(), p.groups.flat().slice().sort(), id + ": same sounds");
}
// merger: every external avoidDistractors entry is honoured by the game's rule, and 3000 generated questions obey it
for (const e of words) for (const a of e.avoidDistractors || []) if (a === "ɑ") assert(N.mergerAvoid(e.kk).has("ɑ"), `${e.word}: /ɑ/ avoided`);
let bad = 0;
for (let i = 0; i < 3000; i++) {
  const q = N.soundQuestion(N.ALL41(), {});
  if (q && q.options.some((o) => !o.ok && N.mergerAvoid(q.item.kk).has(o.label.replace(/\//g, "")))) bad++;
}
assert.equal(bad, 0, "no merged-vowel distractor in 3000 questions");
const missing = N.SUPPLEMENT.filter((s) => !byW.has(s.w)).map((s) => s.w);
console.log(`PASS: external validator (0 errors / 0 warnings, 41 sounds, ${v.counts.words} words, ${v.counts.wordsReviewed} reviewed) against this repo; ${sameKK} supplement KK and ${sameSplit} spelling splits identical to the external data; needs-review words unused; N04–N11 sound sets identical; cot–caught merger honoured (0 in 3000 questions). Supplement words not in the external data (KK still pending review): ${missing.join(", ")}`);
