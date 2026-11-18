// 我的英語能力 × LEARNING-PROFILE-01 batch-02, v1 rules (decisions of 2026-11-17):
// NPC task (時態小任務) → grammar form-choice questions (situation + stem first, no tense name; after: sentence,
// Chinese, sound, explanation) → one event per answer in pm-ability-v1 → panel 「文法辨識掌握度」 (尚待評估 /
// 證據不足 / % only past 5 items · 2 contexts · 2 days) → weak (< 70% and scored only) → 練習弱項 in place →
// analysis updated (24-hour repeats are not new evidence); 30 days → 需要重新確認; old saves 尚待評估; hint
// before answering; negotiation under 職場; the 4000-event cap; reload keeps everything.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 760 } }),
    errors = [];
  CUR = page;
  page.on("pageerror", (e) => errors.push(e.message));
  const OLD = {
    "pm-progress": JSON.stringify({ xp: 120, correct: 30, w: 25, s: 5, rounds: 6, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": JSON.stringify({ apple: { c: 5, w: 1, last: 1 }, egg: { c: 3, w: 0, last: 1 } }),
    "pm-log": "[]",
  };
  await page.addInitScript((old) => {
    const realNow = Date.now;
    window.__skew = 0;
    Date.now = () => realNow() + window.__skew;
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.dispatchEvent(new Event("ended")), 5);
      return Promise.resolve();
    };
    if (window.speechSynthesis) speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5);
    if (!localStorage.getItem("seeded")) {
      for (const [k, v] of Object.entries(old)) localStorage.setItem(k, v);
      localStorage.setItem("seeded", "1");
    }
  }, OLD);
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Ability.data && Learn.scene("work", "negotiate"));
  const ev = (f, a) => page.evaluate(f, a);
  const openAbility = async () => {
    if (await page.locator("#menu:not([hidden])").count()) await page.locator("#menu-close").click();
    await page.locator("#hud-menu").click();
    await page.locator('[data-m="ability"]').click();
    await page.waitForSelector(".ab-list");
    return page.locator("#menu-body").innerText();
  };
  const NODES = await ev(() => Ability.data.nodes.map((n) => n.zh));
  const drain = async (onQuestion) => {
    for (let k = 0; k < 60 && (await page.locator("#dlg:not([hidden])").count()); k++) {
      if (await page.locator(".qz-o > .qz-opt > button:not([disabled])").count()) await onQuestion();
      else if (await page.locator(".qz-next").count()) await page.locator(".qz-next").click();
      else if (await page.locator(".dlg-next").count()) await page.locator(".dlg-next").click();
      await page.waitForTimeout(40);
    }
  };

  /* ---------- old save, no events: 尚待評估, legacy listed, no % ---------- */
  let txt = await openAbility();
  assert.match(txt, /評估規則 v1（試行）[\s\S]*5 個不同題目、2 種情境、2 個學習日期（台北時間）[\s\S]*90 天[\s\S]*30 天/);
  assert.match(txt, /舊紀錄：答對過 2 個單字[\s\S]*尚待評估/);
  for (const t of ["現在簡單式", "過去簡單式"]) assert.match(txt, new RegExp(`${t}\\s*尚待評估`));
  assert.match(txt, /未提供評估（目前沒有能測這個文法的題目）：/, "non-v1 tenses: no instrument");
  assert.doesNotMatch(txt, /\d+%（/, "no percentages without evidence");
  assert.match(txt, /選擇題只代表看得出正確形式，不代表能獨立造句或口說/);
  assert.match(txt, /職場/, "negotiation sits under 職場");
  await page.locator("#menu-close").click();

  /* ---------- NPC task: 時態小任務 (5 grammar items) ---------- */
  await ev(() => World.approach(World.entities.find((e) => e.kind === "npc")));
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  for (let k = 0; k < 10 && !(await page.locator(".dlg-choices button", { hasText: "時態小任務" }).count()); k++) {
    if (await page.locator(".dlg-next").count()) await page.locator(".dlg-next").click();
    await page.waitForTimeout(80);
  }
  await page.locator(".dlg-choices button", { hasText: "時態小任務" }).click();
  const answered = [];
  await drain(async () => {
    const pre = await page.locator("#dlg-body").innerText();
    const q = await ev(() => ({ id: Learn.last.lp && Learn.last.lp.id, sit: Learn.last.lp && Learn.last.lp.situation }));
    assert(q.id && q.id.startsWith("g:"), "a grammar form-choice item");
    assert(pre.includes(q.sit) && /＿＿＿/.test(pre), "situation and the stem with its gap before answering");
    for (const n of NODES) assert(!pre.includes(n), `no tense name before answering (${n})`);
    const right = answered.length !== 1; // one wrong answer
    await page.locator(".qz-o > .qz-opt > button").nth(await ev((r) => Learn.last.options.findIndex((o) => !!o.ok === r), right)).click();
    const post = await page.locator("#dlg-body").innerText();
    const g = await ev(() => Learn.last.lp);
    assert(post.includes(g.en) && post.includes(g.zh) && post.includes(g.explain), "after: sentence, Chinese, explanation");
    assert(await page.locator("#dlg-body .qz-ans .say-btn").count(), "after: the sentence can be heard");
    answered.push({ id: g.id, right });
  });
  assert.equal(answered.length, 5, "five questions");
  const evs = await ev(() => Ability.events);
  assert.equal(evs.length, 5, "one event per answer");
  assert(evs.every((e) => e.v === 1 && e.qtype === "grammar:form-choice" && /^g:/.test(e.item) && /^grammar:/.test(e.ctx) && e.at > 0 && typeof e.ms === "number"), "event schema");
  assert.deepEqual(evs.map((e) => e.result), answered.map((a) => (a.right ? "correct" : "wrong")), "first results");
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-cards")).apple.c), 5, "grammar items do not touch the card book");

  /* ---------- 證據不足 (some evidence, not enough) ---------- */
  txt = await openAbility();
  assert.match(txt, /證據不足：還需要/, "some evidence → 證據不足 with what is missing");
  await page.locator("#menu-close").click();

  /* ---------- reaching the thresholds: will, 6 items, 2 contexts, 2 days, 5 right 1 wrong → 83%（熟悉） ---------- */
  const answer = (ids, oks) =>
    ev(([ids, oks]) => {
      ids.forEach((id, i) => {
        Ability.begin();
        Ability.log(Ability.grammarQuestion(Ability.data.byId[id]), { result: oks[i] ? "correct" : "wrong", ms: 3000 });
      });
    }, [ids, oks]);
  // start the threshold checks from an empty log (the NPC task above picked random items)
  await ev(() => localStorage.removeItem("pm-ability-v1"));
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Ability.data && Learn.scene("work", "negotiate"));
  const will = await ev(() => Ability.data.grammarItems.filter((g) => g.target === "tense:will").map((g) => g.id).slice(0, 6));
  await ev(() => (window.__skew += 2 * 864e5)); // past the 24-hour spacing of the NPC task answers
  await answer(will.slice(0, 3), [true, true, true]);
  await ev(() => (window.__skew += 864e5 + 60000));
  await answer(will.slice(3), [true, true, false]);
  const p = await ev(() => Ability.profile(Date.now()).grammar["tense:will"].channels.reading);
  assert.equal(p.status, "scored");
  assert.equal(p.basis.items, 6);
  assert(p.basis.contexts >= 2 && p.basis.days >= 2);
  assert.equal(p.pct, 83, "5/6 = 83.3% shown as 83% (batch-04: rounded to an integer)");
  assert.equal(p.weak, false);
  assert.equal(p.band, "熟悉");
  txt = await openAbility();
  assert.match(await ev(() => LearningProfile.describe(Ability.profile(Date.now()).grammar["tense:will"].channels.reading, null, { detail: true })), /83\.3%/, "detail: 5/6 = 83.3%");
  assert.match(txt, /83%（熟悉）· 6 題、\d 種情境/, "the panel shows the % once the thresholds are met");

  /* ---------- weak: past simple 2/6 → 30% → listed; 練習弱項 in place → analysis updated ---------- */
  const past = await ev(() => Ability.data.grammarItems.filter((g) => g.target === "tense:past-simple").map((g) => g.id).slice(0, 6));
  await page.locator("#menu-close").click();
  await ev(() => (window.__skew += 2 * 864e5));
  await answer(past.slice(0, 3), [true, false, false]);
  await ev(() => (window.__skew += 864e5 + 60000));
  await answer(past.slice(3), [true, false, false]);
  const weak = await ev(() => Ability.profile(Date.now()).weak);
  assert(weak.some((w) => w.id === "tense:past-simple" && w.pct < 70), "past simple is weak (< 70%)");
  assert.equal(await ev(() => Ability.profile(Date.now()).grammar["tense:past-simple"].channels.reading.weak), true, "the module marks the cell weak");
  assert(!weak.some((w) => w.id === "tense:will"), "83% is not weak");
  assert(!weak.some((w) => w.id === "tense:going-to"), "insufficient evidence is never weak");
  txt = await openAbility();
  assert.match(txt, /弱項[\s\S]*過去簡單式・閱讀辨識[\s\S]*\d+%（低於 70%）/);
  await page.locator('.ab-row.weak[data-id="tense:past-simple"]').first().click(); // listed under 弱項 and under the grammar rows
  await page.waitForSelector(".ab-practice");
  const before = await page.locator("#menu-body").innerText();
  assert.match(before, /最近答錯/);
  const hero0 = await ev(() => [World.hero.x, World.hero.y, RPG.data.at]);
  const n0 = await ev(() => Ability.events.length);
  await page.locator(".ab-practice").click();
  await page.waitForSelector("#dlg:not([hidden])");
  const practised = [];
  await drain(async () => {
    practised.push(await ev(() => Learn.last.lp.target));
    await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  });
  assert(practised.length >= 3 && practised.every((t) => t === "tense:past-simple"), "weak practice asks that tense");
  await page.waitForSelector("#menu:not([hidden]) .ab-practice");
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y, RPG.data.at]), hero0, "back in place");
  assert.equal((await ev(() => Ability.events.length)) - n0, practised.length, "one event per practice answer");
  const after = await page.locator("#menu-body").innerText();
  assert.notEqual(after, before, "the analysis is updated");
  assert.match(after, /24 小時內重複 \d+/, "same-day repeats are listed, not counted as new evidence");

  /* ---------- hint before answering ---------- */
  const hinted = await ev(() => {
    Ability.begin();
    window.dispatchEvent(new Event("pron:look"));
    return Ability.log(Ability.grammarQuestion(Ability.data.grammarItems[0]), { result: "correct" }).hint;
  });
  assert.equal(hinted, true, "looking something up before answering is a hint");

  /* ---------- 30 days later: 需要重新確認 (history kept) ---------- */
  const stale = await ev(() => Ability.profile(Date.now() + 31 * 864e5).grammar["tense:will"].channels.reading);
  assert.equal(stale.status, "stale");
  assert.match(await ev((c) => Ability.label(c), stale), /需要重新確認/);

  /* ---------- decision 2: negotiation under 職場, once ---------- */
  const neg = await ev(() => {
    Ability.profile();
    return Learn.scene("work", "negotiate").items.map((x) => Ability.data.tags["s:" + x.en]).filter(Boolean);
  });
  assert(neg.length, "negotiation lines are tagged");
  // decision 2: primary 職場・商務談判; a meeting tag only as a secondary one (counted once per topic by the module)
  assert(neg.every((t) => t.topics.some((x) => x.topic === "work" && x.sub === "negotiation" && x.role === "primary")), "negotiation lines: primary 職場・商務談判");
  assert(neg.every((t) => t.topics.every((x) => x.role === "primary" || x.topic === "meeting")), "other tags are secondary meeting tags only");

  /* ---------- reload keeps the events; the store keeps the newest 4000 ---------- */
  const kept = await ev(() => Ability.events.length);
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Ability.data);
  assert.equal(await ev(() => Ability.events.length), kept, "events survive a reload");
  await ev(() => {
    const o = JSON.parse(localStorage.getItem("pm-ability-v1"));
    const base = o.events[0];
    for (let i = 0; i < 4100; i++) o.events.push({ ...base, id: "t-x" + i, at: base.at + i });
    localStorage.setItem("pm-ability-v1", JSON.stringify(o));
  });
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await page.waitForFunction(() => Ability.data);
  await ev(() => Ability.log(Ability.grammarQuestion(Ability.data.grammarItems[1]), { result: "correct" }));
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-ability-v1")).events.length), 4000, "the newest 4000 are kept");
  assert.equal(await ev(() => JSON.parse(localStorage.getItem("pm-cards")).egg.c), 3, "old keys untouched");

  assert.deepEqual(errors, []);
  console.log("PASS: old save → 尚待評估 (legacy listed, non-v1 tenses: no instrument, no %), NPC 時態小任務: situation + stem, no tense name before answering, sentence / Chinese / sound / explanation after, one event per answer (schema), 證據不足 with what is missing, will 6 items · 2 days · 2 contexts · 5/6 → 83%（熟悉, batch-04 integer rounding; detail 83.3%）, weak only when scored < 70%, 練習弱項 in place asks that tense and updates the analysis (24-hour repeats listed apart), hint before answering, 31 days → 需要重新確認, negotiation primary under 職場 (meeting only as a secondary tag), reload keeps events, 4000-event cap, card book untouched");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ ev: typeof Ability !== "undefined" && Ability.events.slice(-4), menu: (document.getElementById("menu-body") || {}).innerText, dlg: (document.getElementById("dlg-body") || {}).innerText })).catch(() => null);
    console.error("STATE", JSON.stringify(why).slice(0, 2500));
    await CUR.screenshot({ path: "/tmp/picture-ability-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
