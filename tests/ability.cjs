// 「我的英語能力」: answer → record (pm-ability-v1) → panel analysis → 練習弱項 (in place) → analysis updated.
// Four skills apart (no single rate), grammar 「尚待評估」 until the classification exists, topics 食物／旅遊／會議 with
// coverage, recent errors and the evidence behind them; old saves show 「尚待評估」 (no guessed score); timeout apart
// from wrong; hint / retry / assist and quick repeats are not independent evidence; speech = text match only.
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
  // an old save: a returning player on the food map, with card-book progress but no answer log
  const OLD = {
    "pm-progress": JSON.stringify({ xp: 120, correct: 30, w: 25, s: 5, rounds: 6, modes: ["word"], badges: ["first"], placeDismissed: true }),
    "pm-cards": JSON.stringify({ apple: { c: 5, w: 1, last: 1 }, egg: { c: 3, w: 0, last: 1 } }),
    "pm-log": "[]",
  };
  await page.addInitScript((old) => {
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
  await page.waitForFunction(() => Ability.scenesLoaded);
  const ev = (f, a) => page.evaluate(f, a);
  const openAbility = async () => {
    await page.locator("#hud-menu").click();
    await page.locator('[data-m="ability"]').click();
    await page.waitForSelector(".ab-list");
  };

  /* ---------- old save, no answer log: 尚待評估 everywhere, no guessed score ---------- */
  assert.equal(await ev(() => localStorage.getItem("pm-ability-v1")), null, "nothing written before any answer");
  await openAbility();
  let txt = await page.locator("#menu-body").innerText();
  assert.match(txt, /舊存檔[\s\S]*不會拿來推測分數/);
  for (const k of ["閱讀辨識", "聽力理解", "句子組合", "獨立口說"]) assert.match(txt, new RegExp(`${k}\\s*尚待評估`), k + ": 尚待評估");
  for (const g of ["現在", "過去", "未來", "問句", "否定句"]) assert.match(txt, new RegExp(`${g}\\s*尚待評估`), g + ": 尚待評估 (no classification yet)");
  for (const t of ["食物", "旅遊", "會議"]) assert.match(txt, new RegExp(t));
  assert.doesNotMatch(txt, /\d+\s*%/, "no percentages");
  assert.match(txt, /語音辨識的文字是否吻合」，不代表文法或發音完全正確/);
  assert.match(txt, /練過 0／\d+ 個項目/, "coverage from the material");
  await page.locator("#menu-close").click();

  /* ---------- answer in a battle: right, wrong, timeout, hinted ---------- */
  await ev(() => {
    const ms = World.entities.filter((e) => e.kind === "mob");
    ms.forEach((m) => (m.wait = 999));
    const h = World.hero,
      m = ms.sort((a, b) => Math.hypot(a.tx - h.x, a.ty - h.y) - Math.hypot(b.tx - h.x, b.ty - h.y))[0];
    World.approach(m);
  });
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  await ev(() => Battle.setFoeHp(500));
  const ready = () => page.waitForFunction(() => Battle.ready, null, { timeout: 15000 });
  const answer = async (ok) => {
    await ready();
    const i = await ev((ok) => Learn.last.options.findIndex((o) => !!o.ok === ok), ok);
    await page.locator("#bt-act .qz-o > .qz-opt > button").nth(i).click();
    if (!ok) await page.locator("#bt-next").click();
    else if (await page.waitForSelector("#bt-card", { timeout: 1200 }).catch(() => null)) await page.locator("#bt-card-go").click();
  };
  const asked = [];
  const note = async () => asked.push(await ev(() => ({ id: (Learn.last.recK || "") + ":" + (Learn.last.item.w || Learn.last.item.en) })));
  await ready(), await note(), await answer(true);
  await ready(), await note(), await answer(false);
  await ready(), await note();
  await ev(() => Battle.settleForTest("timeout"));
  await page.locator("#bt-next").click();
  await ready(), await note();
  await ev(() => (Learn.last.assisted = true));
  await answer(true);
  await ready();
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });

  const recs = await ev(() => Ability.records);
  assert.equal(recs.length, 4, "one record per answered question");
  assert.deepEqual(recs.map((r) => r.id), asked.map((a) => a.id), "question IDs");
  assert.deepEqual(recs.map((r) => r.first), ["right", "wrong", "timeout", "right"], "first results; timeout apart from wrong");
  assert.equal(recs[3].hint, 1, "a hinted answer is marked");
  assert(recs.every((r) => r.t > 0 && typeof r.ms === "number" && r.type && ["read", "listen"].includes(r.skill)), "time, answer time, type, skill");
  assert(recs.some((r) => r.topic === "food" && r.tagSrc === "provisional"), "food-map words link to 食物 (provisional, from the material)");
  assert(recs.every((r) => Array.isArray(r.grammar) && !r.grammar.length), "no guessed grammar tags");

  /* ---------- quick repeat is not new evidence; independent = first-try, no help ---------- */
  const rep = await ev(() => {
    const q = { recK: "w", item: WORDS.find((w) => w.w === "milk"), kind: "w" };
    const a = Ability.log(q, { first: "right" }),
      b = Ability.log(q, { first: "right" });
    return [Ability.independent(a), Ability.independent(b), b.fresh];
  });
  assert.deepEqual(rep, [true, false, false], "the same item again within minutes is not independent");

  /* ---------- panel analysis ---------- */
  await openAbility();
  txt = await page.locator("#menu-body").innerText();
  const read = await ev(() => Ability.summary().skills.find((k) => k.id === "read"));
  assert(read.n >= 1, "reading has records");
  assert.match(txt, /獨立首答答對 \d+ 次/);
  assert.match(txt, /超時 1/, "timeouts counted apart");
  assert.match(txt, /提示／重試／輔助 1/);
  assert.match(txt, /短時間重複 1（不算新證據）/);
  assert.match(txt, /正式程度：評估規則驗收後才顯示/);
  assert.doesNotMatch(txt, /\d+\s*%/, "still no percentages");
  // details: recent errors and the evidence
  await page.locator('.ab-row[data-k="topic"][data-id="food"]').click();
  await page.waitForSelector(".ab-practice");
  txt = await page.locator("#menu-body").innerText();
  // which answers fell under 食物 depends on the random questions: check what the records say
  const foodRecs = recs.filter((r) => r.topic === "food");
  if (foodRecs.some((r) => r.first === "wrong")) assert.match(txt, /最近的錯誤[\s\S]*首答錯/);
  if (foodRecs.some((r) => r.first === "timeout")) assert.match(txt, /超時（不算語言答錯）/);
  if (!foodRecs.some((r) => r.first !== "right" || r.hint)) assert.match(txt, /最近沒有錯誤紀錄/);
  assert.match(txt, /評估依據[\s\S]*第一次就答對/);
  const foodBefore = await ev(() => Ability.summary().topics.find((t) => t.id === "food"));
  const hero0 = await ev(() => [World.hero.x, World.hero.y, RPG.data.at]);

  /* ---------- 練習弱項: in place, then the analysis again ---------- */
  await page.locator(".ab-practice").click();
  await page.waitForSelector("#dlg:not([hidden])");
  assert.match(await page.locator("#dlg-name").innerText(), /能力練習/);
  for (let k = 0; k < 60 && (await page.locator("#dlg:not([hidden])").count()); k++) {
    if (await page.locator(".qz-o > .qz-opt > button:not([disabled])").count()) await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    else if (await page.locator(".qz-next").count()) await page.locator(".qz-next").click();
    else if (await page.locator(".dlg-next").count()) await page.locator(".dlg-next").click();
    await page.waitForTimeout(40);
  }
  await page.waitForSelector("#menu:not([hidden]) .ab-practice");
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y, RPG.data.at]), hero0, "back where the player was");
  const foodAfter = await ev(() => Ability.summary().topics.find((t) => t.id === "food"));
  assert(foodAfter.n > foodBefore.n, "the weak practice is recorded");
  assert(foodAfter.items >= foodBefore.items, "coverage does not drop");
  assert.notEqual(await page.locator("#menu-body").innerText(), txt, "the analysis is updated");
  await page.locator(".ab-back").click();
  await page.waitForSelector(".ab-list");

  /* ---------- speaking: text match only ---------- */
  const sp = await ev(() => {
    const it = SENT[0];
    Ability.log({ recK: "s", item: it }, { first: "right", skill: "speak", type: "read-aloud", speech: "文字吻合" });
    return Ability.summary().skills.find((k) => k.id === "speak");
  });
  assert.equal(sp.n, 1);
  assert.equal(sp.matched, 1);
  await page.locator("#menu-close").click();

  /* ---------- saved compatibly ---------- */
  await page.reload();
  await page.waitForSelector(".world-canvas");
  const after = await ev(() => ({ n: Ability.records.length, cards: JSON.parse(localStorage.getItem("pm-cards")), prog: JSON.parse(localStorage.getItem("pm-progress")) }));
  assert(after.n >= 7, "records survive a reload");
  assert.equal(after.cards.egg.c >= 3, true, "old card book kept");
  assert(after.prog.xp >= 120, "old progress kept");

  assert.deepEqual(errors, []);
  console.log("PASS: old save → 尚待評估 (no guessed score, no %), battle answers recorded with ID / time / type / skill / first result / hint / timeout / provisional topic and no guessed grammar, quick repeat not independent, panel counts per skill (timeout, help, repeats apart), details with recent errors and evidence, 練習弱項 in place then the analysis updated, speech = text match only, records survive reload, old keys untouched");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ recs: typeof Ability !== "undefined" && Ability.records.slice(-6), menu: (document.getElementById("menu-body") || {}).innerText })).catch(() => null);
    console.error("STATE", JSON.stringify(why).slice(0, 2500));
    await CUR.screenshot({ path: "/tmp/picture-ability-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
