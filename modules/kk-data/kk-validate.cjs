#!/usr/bin/env node
/* B-KK-DATA-01 content validator (external AI). Plain Node, no dependencies, reads only.
   usage: node kk-validate.cjs [--data content/kk-v1] [--root <project root>] [--out validation.json]
   Everything is re-derived from the JSON itself; the builder is not trusted. With --root it also checks against
   novice.js (chapter order, 41 sounds), data/words.json (original 80 unchanged) and assets/voice/words (only files
   that exist are claimed as recordings). Exit code 1 when any error is found. */
"use strict";
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const dataDir = opt("--data", path.join(process.cwd(), "content/kk-v1"));
const root = opt("--root", null);
const outFile = opt("--out", null);

const VOWELS = ["i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "o", "ʊ", "u", "ʌ", "ə", "ɝ", "ɚ", "aɪ", "aʊ", "ɔɪ"];
const MULTI = ["aɪ", "aʊ", "ɔɪ", "tʃ", "dʒ"];
const CHAPTER_IDS = ["N00", "N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08", "N09", "N10", "N11"];
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function kkTokens(kk) {
  const s = String(kk).replace(/[[\]ˋˏ]/g, "");
  const out = [];
  for (let i = 0; i < s.length; ) {
    const two = s.slice(i, i + 2);
    if (MULTI.includes(two)) (out.push(two), (i += 2));
    else (out.push(s[i]), (i += 1));
  }
  return out;
}
function stressIndex(kk) {
  const s = String(kk).replace(/[[\]]/g, "");
  let before = 0,
    stress = 0;
  for (let i = 0; i < s.length; ) {
    if (s[i] === "ˋ") (stress = before + 1), i++;
    else if (s[i] === "ˏ") i++;
    else {
      const two = s.slice(i, i + 2),
        t = MULTI.includes(two) ? two : s[i];
      if (VOWELS.includes(t)) before++;
      i += t.length;
    }
  }
  return stress || (before === 1 ? 1 : 0);
}

const S = JSON.parse(fs.readFileSync(path.join(dataDir, "kk-sounds-reviewed.json"), "utf8"));
const Wd = JSON.parse(fs.readFileSync(path.join(dataDir, "words-reviewed.json"), "utf8"));
const words = Wd.words;
const W = Object.fromEntries(words.map((w) => [w.word, w]));
if (words.length !== Object.keys(W).length) err("duplicate word entries");

// ---- 1. 41 sounds, 17 vowels + 24 consonants, chapter order ----
const chapters = S.chapters;
if (!eq(chapters.map((c) => c.id), CHAPTER_IDS)) err("chapters must be N00–N11 in order: " + chapters.map((c) => c.id).join(","));
const all41 = chapters.flatMap((c) => c.sounds);
if (all41.length !== 41) err(`chapter sounds: ${all41.length}, expected 41`);
if (new Set(all41).size !== all41.length) err("a sound is listed in two chapters");
const vowelsIn = all41.filter((x) => VOWELS.includes(x));
if (vowelsIn.length !== 17) err(`vowels: ${vowelsIn.length}, expected 17`);
if (all41.length - vowelsIn.length !== 24) err(`consonants: ${all41.length - vowelsIn.length}, expected 24`);
if (!eq([...vowelsIn].sort(), [...VOWELS].sort())) err("vowel set differs from the 17 KK vowels");
const chapterOf = {};
const chapterIdx = {};
chapters.forEach((c, ci) => c.sounds.forEach((s) => ((chapterOf[s] = c.id), (chapterIdx[s] = ci))));
if (root) {
  try {
    const Novice = require(path.resolve(root, "novice.js"));
    const nv = Novice.CHAPTERS.map((c) => [c.id, c.sounds]);
    if (!eq(nv, chapters.map((c) => [c.id, c.sounds]))) err("chapter order / sounds differ from novice.js Novice.CHAPTERS");
    if (!eq([...Novice.VOWELS].sort(), [...VOWELS].sort())) err("vowel list differs from novice.js");
  } catch (e) {
    warn("could not load novice.js from --root: " + e.message);
  }
}
const SND = Object.fromEntries(S.sounds.map((s) => [s.symbol, s]));
if (S.sounds.length !== 41 || Object.keys(SND).length !== 41) err(`sound entries: ${S.sounds.length}`);
let order = 0;
for (const c of chapters)
  for (const s of c.sounds) {
    order++;
    const e = SND[s];
    if (!e) {
      err(`no sound entry for /${s}/`);
      continue;
    }
    if (e.chapter !== c.id) err(`/${s}/ chapter ${e.chapter} but listed in ${c.id}`);
    if (e.order !== order) err(`/${s}/ order ${e.order}, expected ${order}`);
    if ((e.category === "vowel") !== VOWELS.includes(s)) err(`/${s}/ category ${e.category}`);
  }

// ---- 2. words: spelling ↔ KK, syllables, positions ----
const hasCJK = (s) => /[一-鿿]/.test(s || "");
let legacy = null;
if (root) {
  try {
    legacy = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8")).map((w) => [w.word, w]));
  } catch (e) {
    warn("could not read data/words.json: " + e.message);
  }
}
for (const w of words) {
  const id = w.word;
  if (!hasCJK(w.zh)) err(`${id}: zh missing`);
  const toks = kkTokens(w.kk);
  for (const t of toks) if (!chapterOf[t]) err(`${id}: KK token /${t}/ is not one of the 41 sounds`);
  if (!eq(w.sounds, toks)) err(`${id}: sounds ${w.sounds.join(" ")} ≠ KK ${toks.join(" ")}`);
  if (w.chunks.map((c) => c.text).join("") !== id) err(`${id}: chunk texts join to "${w.chunks.map((c) => c.text).join("")}"`);
  const joined = w.chunks.flatMap((c) => c.soundTokens);
  if (!eq(joined, toks)) err(`${id}: chunk sounds ${joined.join(" ")} ≠ KK ${toks.join(" ")}`);
  for (const c of w.chunks) {
    if (!c.text) err(`${id}: empty chunk`);
    if (!Array.isArray(c.soundTokens)) err(`${id}: soundTokens not an array`);
    if (c.soundTokens.length === 0 && !c.silent) err(`${id}: chunk "${c.text}" has no sound but is not marked silent`);
  }
  const vow = toks.filter((t) => VOWELS.includes(t));
  if (w.syllables.count !== vow.length) err(`${id}: syllable count ${w.syllables.count}, KK has ${vow.length} vowels`);
  if (w.syllables.stress !== stressIndex(w.kk)) err(`${id}: stress ${w.syllables.stress}, KK gives ${stressIndex(w.kk)}`);
  if (vow.length > 1 && !/ˋ/.test(w.kk)) err(`${id}: multi-syllable word without primary stress mark`);
  if (w.syllables.spelling.join("") !== id) err(`${id}: syllable spelling does not join to the word`);
  if (w.syllables.spelling.length !== vow.length) err(`${id}: ${w.syllables.spelling.length} spelling syllables vs ${vow.length} KK syllables`);
  const pos = { first: toks[0], last: toks[toks.length - 1] };
  if (w.positions.first !== pos.first) err(`${id}: first ${w.positions.first} ≠ ${pos.first}`);
  if (w.positions.last !== pos.last) err(`${id}: last ${w.positions.last} ≠ ${pos.last}`);
  if (w.positions.vowel != null && (vow.length !== 1 || w.positions.vowel !== vow[0])) err(`${id}: vowel position only allowed for single-vowel words`);
  const cnt = {};
  toks.forEach((t) => (cnt[t] = (cnt[t] || 0) + 1));
  if (!eq(w.uniqueSounds, toks.filter((t) => cnt[t] === 1))) err(`${id}: uniqueSounds wrong`);
  const ready = CHAPTER_IDS[Math.max(...toks.map((t) => chapterIdx[t]))];
  if (w.readyChapter !== ready) err(`${id}: readyChapter ${w.readyChapter}, expected ${ready}`);
  if (!["reviewed", "needs-review"].includes(w.reviewStatus)) err(`${id}: reviewStatus ${w.reviewStatus}`);
  if (w.reviewStatus === "needs-review" && !w.reviewNote) err(`${id}: needs-review without reviewNote`);
  if (!w.reviewer || !w.source) err(`${id}: reviewer/source missing`);
  // /ɔ/ not before r: merger-prone in American speech
  toks.forEach((t, i) => {
    if (t === "ɔ" && toks[i + 1] !== "r" && !((w.avoidDistractors || []).includes("ɑ") && w.accentNote))
      err(`${id}: /ɔ/ (not before r) needs accentNote and avoidDistractors ["ɑ"] (cot–caught merger)`);
  });
  // audio claims
  if (w.audio.mode === "recording") {
    if (!w.audio.file) err(`${id}: recording without file`);
    if (root && !fs.existsSync(path.join(root, w.audio.file))) err(`${id}: claimed recording missing: ${w.audio.file}`);
  } else if (w.audio.mode === "device-whole-word") {
    if (w.audio.file) err(`${id}: device-whole-word must not name a file`);
    if (root && fs.existsSync(path.join(root, "assets/voice/words", id + ".mp3"))) warn(`${id}: a recording exists but is not used`);
  } else err(`${id}: audio mode ${w.audio.mode}`);
  if (legacy) {
    const L = legacy[id];
    if (!!L !== !!w.legacy) err(`${id}: legacy flag ${w.legacy} but data/words.json ${L ? "has" : "lacks"} it`);
    if (L && (L.kk !== w.kk || L.zh !== w.zh)) err(`${id}: differs from the original 80 (kk ${L.kk} / zh ${L.zh})`);
  }
}

// ---- 3. sounds: hints, ≥2 checked examples, spellings found in the words ----
function findGrapheme(w, g, sym) {
  const ch = w.chunks;
  if (g.includes("_")) {
    const [v, tail] = g.split("_");
    return ch.some((c, i) => c.text === v && c.soundTokens.includes(sym) && i + 3 === ch.length && ch[ch.length - 1].text === tail && ch[ch.length - 1].silent);
  }
  return ch.some((c) => c.text === g && c.soundTokens.includes(sym));
}
const soundStatus = {};
for (const s of all41) {
  const e = SND[s];
  if (!e) continue;
  if (!e.how || e.how.length < 10) err(`/${s}/: mouth / airflow hint missing`);
  if (!e.reviewer || !e.source) err(`/${s}/: reviewer/source missing`);
  if (e.demo.singleSoundRecording !== null) err(`/${s}/: claims a single-sound recording`);
  const good = e.examples.filter((x) => W[x] && W[x].reviewStatus === "reviewed" && W[x].sounds.includes(s));
  for (const x of e.examples) if (!W[x] || !W[x].sounds.includes(s)) err(`/${s}/: example "${x}" missing or without the sound`);
  if (good.length < 2) err(`/${s}/: only ${good.length} reviewed example words`);
  for (const x of e.recordedExamples) if (!W[x] || W[x].audio.mode !== "recording") err(`/${s}/: recordedExamples "${x}" has no recording`);
  if (!e.spellings.length) err(`/${s}/: no spelling patterns`);
  for (const sp of e.spellings)
    for (const x of sp.words) {
      if (!W[x]) err(`/${s}/ ${sp.grapheme}: word "${x}" not in words-reviewed.json`);
      else if (!findGrapheme(W[x], sp.grapheme, s)) err(`/${s}/: "${sp.grapheme}" in ${x} does not map to /${s}/`);
    }
  if (["ɑ", "ɔ"].includes(s) && !(e.accentNote && /合流|口音/.test(e.accentNote))) err(`/${s}/: American /ɑ/–/ɔ/ merger note missing`);
  if (["e", "o"].includes(s) && !(e.accentNote && /KK/.test(e.accentNote))) err(`/${s}/: traditional KK /e/ /o/ note missing`);
  soundStatus[s] = e.reviewStatus === "reviewed" && good.length >= 2 ? "accepted" : "needs-review";
}

// ---- 4. letter-group ↔ sound matching in context ----
const taughtBy = {};
let acc = [];
for (const c of chapters) (acc = acc.concat(c.sounds)), (taughtBy[c.id] = new Set(acc));
const byGrapheme = {};
let matchCount = 0;
for (const c of chapters)
  for (const m of c.matches) {
    matchCount++;
    const w = W[m.word];
    const tag = `${c.id} ${m.grapheme}→/${m.soundTokens.join(" ")}/ (${m.word})`;
    if (!w) {
      err(`${tag}: word missing`);
      continue;
    }
    if (w.reviewStatus !== "reviewed") err(`${tag}: word not reviewed`);
    const ch = m.chunks.map((i) => w.chunks[i]);
    if (ch.some((x) => !x)) err(`${tag}: chunk index out of range`);
    else if (m.grapheme.includes("_")) {
      const [v, tail] = m.grapheme.split("_");
      if (!(m.chunks.length === 2 && ch[0].text === v && ch[1].text === tail && ch[1].silent && eq(ch[0].soundTokens, m.soundTokens)))
        err(`${tag}: split pattern does not match the chunks`);
    } else if (!(m.chunks.length === 1 && ch[0].text === m.grapheme && eq(ch[0].soundTokens, m.soundTokens))) err(`${tag}: chunk does not say this`);
    for (const t of m.soundTokens) if (!taughtBy[c.id].has(t)) err(`${tag}: /${t}/ not taught yet in ${c.id}`);
    if (m.grapheme === "qu" && !eq(m.soundTokens, ["k", "w"])) err(`${tag}: qu must be /k w/`);
    (byGrapheme[m.grapheme] = byGrapheme[m.grapheme] || []).push([m, c.id]);
  }
for (const [g, list] of Object.entries(byGrapheme)) {
  const variants = new Set(list.map(([m]) => m.soundTokens.join(" ")));
  if (variants.size > 1) for (const [m, cid] of list) if (!m.contextDependent) err(`${cid} ${g} (${m.word}): same letters map to several sounds; mark contextDependent`);
}
// every word's "qu" chunk is two sounds
for (const w of words) for (const c of w.chunks) if (c.text === "qu" && !eq(c.soundTokens, ["k", "w"])) err(`${w.word}: qu chunk must be /k w/`);

// ---- 5. full builds: ≥2 different words per chapter, every sound already taught ----
const buildCounts = {};
for (const c of chapters) {
  if (c.id === "N00") continue;
  const ok = [...new Set(c.builds)].filter((x) => {
    const w = W[x];
    if (!w) return err(`${c.id} build "${x}": word missing`), false;
    if (w.reviewStatus !== "reviewed") return err(`${c.id} build "${x}": not reviewed`), false;
    const un = w.sounds.filter((t) => !taughtBy[c.id].has(t));
    if (un.length) return err(`${c.id} build "${x}": untaught /${un.join(" ")}/`), false;
    return true;
  });
  buildCounts[c.id] = ok.length;
  if (ok.length < 2) err(`${c.id}: only ${ok.length} full-build words`);
}

// ---- 6. position questions: one right answer, target taught in this chapter ----
let pq = 0;
for (const c of chapters)
  for (const q of c.positionQuestions) {
    pq++;
    const w = W[q.word];
    if (!w) {
      err(`${c.id} position ${q.word}: missing`);
      continue;
    }
    if (!c.sounds.includes(q.sound)) err(`${c.id} position ${q.word}: /${q.sound}/ is not a sound of this chapter`);
    if (w.positions[q.place] !== q.sound) err(`${c.id} position ${q.word} ${q.place}: word says ${w.positions[q.place]}`);
    if (q.place === "vowel" && w.sounds.filter((t) => VOWELS.includes(t)).length !== 1) err(`${c.id} position ${q.word}: vowel question on a multi-vowel word`);
    if (w.reviewStatus !== "reviewed") err(`${c.id} position ${q.word}: word needs review`);
  }

const counts = {
  sounds: all41.length,
  vowels: vowelsIn.length,
  consonants: all41.length - vowelsIn.length,
  soundsAccepted: Object.values(soundStatus).filter((x) => x === "accepted").length,
  soundsNeedsReview: Object.values(soundStatus).filter((x) => x !== "accepted").length,
  words: words.length,
  wordsReviewed: words.filter((w) => w.reviewStatus === "reviewed").length,
  wordsNeedsReview: words.filter((w) => w.reviewStatus !== "reviewed").map((w) => w.word),
  wordsWithRecording: words.filter((w) => w.audio.mode === "recording").length,
  matches: matchCount,
  fullBuildsPerChapter: buildCounts,
  positionQuestions: pq,
};
const result = {
  validator: "kk-validate.cjs (B-KK-DATA-01)",
  checkedAt: new Date().toISOString(),
  crossChecked: root ? ["novice.js CHAPTERS / VOWELS", "data/words.json (original 80)", "assets/voice/words"] : [],
  pass: errors.length === 0,
  counts,
  errors,
  warnings,
};
if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ pass: result.pass, errors: errors.length, warnings: warnings.length, counts }, null, 1));
if (errors.length) console.error(errors.slice(0, 40).join("\n"));
process.exit(errors.length ? 1 : 0);
