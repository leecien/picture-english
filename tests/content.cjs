// Question-bank quality checks without a browser: KK parsing against a hand-checked table, every generated
// question has exactly one right answer and no duplicate options, scene questions never offer another valid
// reply to the same line as a "wrong" option, and the commute-mode judge accepts how recognizers write answers.
// Run: node tests/content.cjs
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Minimal page globals that learn.js expects.
const store = {};
Object.assign(global, {
  LS: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => (store[k] = v) },
  esc: (s) => String(s),
  pic: (o) => o.e || "",
  maxLv: () => 1,
  shuffle: (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  WORDS: JSON.parse(read("data/words.json")).map((x) => ({ w: x.word, z: x.zh, e: x.emoji, kk: x.kk, th: x.theme, lv: x.level || 1, au: x.audio || "" })),
  SENT: JSON.parse(read("data/sentences.json")).map((x) => ({ en: x.en, zh: x.zh, b: x.blank, o: x.distractors, lv: x.level || 1, route: x.route })),
});
const Learn = new Function(read("learn.js") + ";return Learn")();
const scenes = JSON.parse(read("data/scenes.json"));
Learn.setScenes(scenes.categories);

// 1. KK parsing: syllables and primary stress, checked by hand (dictionary syllabification).
const KK = {
  apple: [2, 1], banana: [3, 2], volcano: [3, 2], avocado: [4, 3], elephant: [3, 1], umbrella: [3, 2], mountain: [2, 1],
  thermometer: [4, 2], headphones: [2, 1], suitcase: [2, 1], receipt: [2, 2], flamingo: [3, 2], tornado: [3, 2],
  helicopter: [4, 1], satellite: [3, 1], pineapple: [3, 1], squirrel: [2, 1], hospital: [3, 1], cat: [1, 1], tree: [1, 1],
};
for (const [w, [syl, stress]] of Object.entries(KK)) {
  const it = WORDS.find((x) => x.w === w),
    k = Learn.parseKK(it.kk);
  assert.deepEqual([k.syl, k.stress], [syl, stress], `${w} ${it.kk}`);
}
for (const w of WORDS) assert(Learn.parseKK(w.kk).syl >= 1, "every word has a vowel: " + w.w);

// 2. Generated questions: one right answer, distinct options, never empty.
const check = (q, label) => {
  assert(q && q.options.length >= 2, label + ": options");
  assert.equal(q.options.filter((o) => o.ok).length, 1, label + ": exactly one right answer");
  assert.equal(new Set(q.options.map((o) => o.html)).size, q.options.length, label + ": no duplicate options");
};
for (let i = 0; i < 60; i++) {
  for (const u of Learn.UNITS) for (const kind of ["which", "find"]) {
    const q = Learn.unitQuestion(u, kind);
    check(q, `unit ${u.id} ${kind}`);
    assert(u.pair.includes(q.sym), "unit questions stay inside the taught pair");
    const k = Learn.parseKK(q.item.kk);
    assert(k.has(q.sym) && !k.has(u.pair.find((p) => p !== q.sym)), "answer word has exactly one sound of the pair");
  }
  check(Learn.stressQuestion(1), "stress 1");
  check(Learn.stressQuestion(2), "stress 2");
  check(Learn.wordKK("listen", new Set(["i", "ɪ", "æ", "ɛ", "ɑ", "ʌ"])), "word listen");
  check(Learn.wordKK("read", new Set(["i", "ɪ", "æ", "ɛ", "ɑ", "ʌ"])), "word read");
  check(Learn.wordQuestion(null, "pic"), "word pic");
  check(Learn.wordQuestion(null, "zh"), "word zh");
  check(Learn.sentQuestion(), "sentence");
}
for (const u of Learn.UNITS)
  for (const s of u.pair)
    for (const d of Learn.SOUNDS[s].demo) {
      const w = Learn.wordBy(d);
      assert(w && w.au, `demo word ${d} has a recording`);
      const k = Learn.parseKK(w.kk);
      assert(k.has(s) && !k.has(u.pair.find((p) => p !== s)), `demo ${d} shows /${s}/ only`);
    }

// 3. Scene questions: lines answering the same question are never "wrong" options for each other.
for (const c of scenes.categories)
  for (const sc of c.scenes)
    for (let i = 0; i < sc.items.length; i++)
      for (const mode of ["listen", "cue"]) {
        const q = Learn.sceneQuestion(c.id, sc.id, i, { mode });
        check(q, `${sc.id}[${i}]`);
        const it = sc.items[i];
        if (it.q)
          for (const o of q.options.filter((o) => !o.ok)) {
            const other = sc.items.find((x) => x.en === o.html);
            assert(!(other && other.q === it.q), `${sc.id}: "${o.html}" also answers "${it.q}"`);
          }
      }
// Story stages use beginner scenes only.
const travel = scenes.categories.find((c) => c.id === "travel");
for (const id of ["airport", "customs", "lostbag", "hotel"]) assert.equal(travel.scenes.find((s) => s.id === id).lv, 1, id + " is beginner level");
assert.equal(travel.element, "wind");

// 4. Spoken-answer judge (speech.js): ordered word alignment, not a bag of words.
const Speech = require(path.join(root, "speech.js"));
const pass = (t, a, o) => Speech.judge(t, [a], o).status;
for (const [t, a] of [
  ["I will stay for five days.", "I will stay for 5 days"],
  ["Does three o'clock work for you?", "does 3:00 work for you"],
  ["What time is check out?", "what time is checkout"],
  ["Okay, no problem.", "OK no problem"],
  ["My suitcase hasn't arrived.", "my suitcase has not arrived"],
  ["I'd like to withdraw two hundred dollars.", "I'd like to withdraw 200 dollars"],
  ["I'm here for sightseeing.", "um I'm here for sightseeing"],
  ["cat", "the cat"],
]) assert.equal(pass(t, a), "pass", `accepted: ${a}`);
const W = (t, a) => Speech.align(t, a).words.map((x) => x.st).join(" ");
assert.equal(pass("I'm here for sightseeing.", "I'm here for business"), "partial", "wrong key word is not a pass");
assert.equal(W("I'm here for sightseeing.", "I'm here for business"), "ok ok ok sub", "the wrong word is marked in place");
assert.equal(W("I'm here for sightseeing.", "I'm for sightseeing"), "ok miss ok ok", "missing word marked at its position");
assert.deepEqual(Speech.align("I'm here for sightseeing.", "I'm here for sightseeing today").extra, ["today"], "extra word listed");
assert.equal(pass("I'm here for sightseeing.", "I'm here for sightseeing today"), "partial", "extra words are not a full pass");
assert.equal(W("Thank you very very much.", "thank you very much"), "ok ok miss ok ok", "repeated words counted by position");
assert.equal(pass("Thank you very very much.", "thank you very much"), "partial");
assert.notEqual(pass("I am here for sightseeing.", "sightseeing for here I am"), "pass", "word order matters");
assert.equal(pass("Give me five minutes.", "give me five minutes", { accept: [] }), "pass");
assert.equal(pass("Yes, I'm ready.", "give me five minutes", { accept: ["Give me five minutes."] }), "pass", "explicitly accepted reply");
assert.equal(Speech.judge("Yes, I'm ready.", ["yes I am red", "yes I am ready"]).status, "uncertain", "a lower candidate matching is not a pass");
assert.equal(Speech.judge("Yes, I'm ready.", Object.assign(["yes I am ready"], { conf: 0.2 })).status, "uncertain", "low confidence is not graded");
assert.equal(Speech.judge("Yes, I'm ready.", []).status, "silent");
assert.match(Speech.html(Speech.judge("I'm here for sightseeing.", ["I'm for sightseeing"])), /sw-miss[^>]*>here<sup>漏<\/sup>/, "missing word marked with text, not colour alone");
for (const c of scenes.categories) for (const sc of c.scenes) for (const it of sc.items) assert.equal(pass(it.en, it.en.replace(/[.,!?]/g, "")), "pass", "self match " + it.en);

console.log("PASS: KK syllables and stress (hand-checked), unit questions stay in the taught pair with unambiguous words and recorded demos, one right answer and unique options for every generator, scene distractors never another valid reply, beginner story scenes, spoken-answer judge (order, missing / extra / repeated words, contractions, numbers, accepted replies, unsure candidates and low confidence)");
