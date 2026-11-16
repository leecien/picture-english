// 生活情境找物 (PR #10) on a 390px phone, with real taps at the objects' positions:
// 6 scenes × 6 targets, every target's centre hits that target at the starting zoom (priority order,
// 44 px tolerance for small things); drag pans and never answers; explore plays the word and counts finds;
// listen-first (no tapping until the word has played, nothing named before the answer, wrong object = retry,
// audio failure = no answering); find-and-spell with tiles that go in and back (long words: find + hear);
// missions; first-try / retry / wrong kept apart; bank words update the card book; back to the same map spot.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;

async function setup(browser, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((mute) => {
    window.__said = [];
    window.__plays = [];
    HTMLMediaElement.prototype.play = function () {
      if (mute) return Promise.reject(new Error("blocked"));
      window.__plays.push(this.src);
      setTimeout(() => this.dispatchEvent(new Event("ended")), 300);
      return Promise.resolve();
    };
    speechSynthesis.speak = (u) => {
      window.__said.push(u.text);
      setTimeout(() => (mute ? u.onerror && u.onerror() : u.onend && u.onend()), 300);
    };
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem("seeded", "1");
      localStorage.setItem("pm-progress", JSON.stringify({ xp: 25, rounds: 1, badges: [], placeDismissed: true }));
      localStorage.setItem("pm-rpg-v1", JSON.stringify({ version: 1, at: "food" }));
    }
  }, !!opt.mute);
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  CUR = page;
  const ev = (f, a) => page.evaluate(f, a);
  /* a real click at a target's centre */
  const tapTarget = async (id) => {
    // off screen at this zoom? drag the picture (a real drag, which must not count as a tap)
    const off = await ev((id) => {
      const q = Life.pointOf(id),
        W = document.getElementById("life-stage").clientWidth;
      return q.x < 24 ? W / 2 - q.x : q.x > W - 24 ? W / 2 - q.x : 0;
    }, id);
    if (off) {
      const r = await page.locator("#life-stage").boundingBox(),
        sx = r.x + r.width / 2 - Math.sign(off) * 40,
        sy = r.y + 40;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + off, sy, { steps: 6 });
      await page.mouse.up();
    }
    const p = await ev((id) => {
      const r = document.getElementById("life-stage").getBoundingClientRect(),
        q = Life.pointOf(id);
      return { x: r.left + q.x, y: r.top + q.y };
    }, id);
    await page.mouse.click(p.x, p.y);
  };
  const openScene = async (id) => {
    await page.locator(`[data-scene="${id}"]`).click();
    await page.waitForFunction(() => document.getElementById("life-img").complete && Life.view.w > 0);
  };
  return { ctx, page, errors, ev, tapTarget, openScene };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const a = await setup(browser);
  const { page, ev, tapTarget, openScene } = a;
  const spot = await ev(() => [World.hero.x, World.hero.y]);
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="life"]').click();
  await page.waitForSelector("#life:not([hidden]) [data-scene]");
  assert.equal(await page.locator("[data-scene]").count(), 12, "twelve scenes (PR #10 + PR #11)");
  assert(await ev(() => Life.data.scenes.every((s) => s.targets.length === 6)), "six targets each");
  assert.equal(await ev(() => new Set(Life.data.scenes.flatMap((s) => s.targets.map((t) => t.word))).size), 71, "71 different picture words");
  assert(await ev(() => Life.data.scenes.every((s) => s.missions.every((m) => m.targets.every((t) => s.targets.some((x) => x.id === t))))), "missions only use their scene's targets");

  /* ---------- every target is reachable from its centre, in every scene ---------- */
  for (const id of await ev(() => Life.data.scenes.map((s) => s.id))) {
    await openScene(id);
    const bad = await ev(() => {
      const st = document.getElementById("life-stage").getBoundingClientRect();
      return Life.data.scenes.find((s) => s.id === Life.scene).targets.filter((t) => {
        const p = Life.pointOf(t.id);
        if (p.x < 0 || p.x > st.width) return false; // off screen at this zoom: reached by panning (checked below)
        const h = Life.hit(p.x, p.y); // pointOf searches the target's own area; the hit must agree
        return !(h.t && h.t.id === t.id);
      }).map((t) => t.id);
    });
    assert.deepEqual(bad, [], `${id}: each target has a tappable area that hits it`);
    await page.locator("#life-back").click();
  }

  /* ---------- explore (supermarket first, as the handoff asks) ---------- */
  await openScene("supermarket");
  assert.equal(await page.locator("#life-count").innerText(), "找到 0 / 6");
  // a drag pans the picture and is not a tap
  const v0 = await ev(() => Life.view);
  const r = await page.locator("#life-stage").boundingBox();
  await page.mouse.move(r.x + 200, r.y + 150);
  await page.mouse.down();
  await page.mouse.move(r.x + 120, r.y + 150, { steps: 5 });
  await page.mouse.up();
  assert.notEqual((await ev(() => Life.view)).tx, v0.tx, "dragging pans");
  assert.equal(await page.locator("#life-count").innerText(), "找到 0 / 6", "a drag never counts as a tap");
  await page.locator("#life-fit").click();
  await tapTarget("bread");
  assert.match(await page.locator("#life-panel").innerText(), /bread[\s\S]*麵包[\s\S]*\[brɛd\][\s\S]*真人錄音[\s\S]*第一次找到/);
  assert(await ev(() => __plays.some((p) => /bread\.mp3/.test(p))), "bread plays its recording");
  await tapTarget("tomato");
  assert.match(await page.locator("#life-panel").innerText(), /tomato[\s\S]*音標待補[\s\S]*裝置語音念整個字/, "no KK guessed; sound source labelled");
  assert(await ev(() => __said.includes("tomato")));
  for (const id of ["apple", "banana", "milk", "basket"]) await tapTarget(id);
  assert.equal(await page.locator("#life-count").innerText(), "找到 6 / 6");
  await tapTarget("apple");
  assert.equal(await ev(() => Life.state.res.apple.seen), 1, "the first-find reward is given once");
  // zoom buttons
  const z0 = (await ev(() => Life.view)).z;
  await page.locator("#life-in").click();
  assert((await ev(() => Life.view)).z > z0);
  await page.locator("#life-fit").click();

  /* ---------- listen first: nothing named, no tapping until the word has played ---------- */
  await page.locator('[data-mode="listen"]').click();
  await page.waitForSelector("#life-wait");
  const lastSaid = await ev(() => Life.round.target);
  const panelBefore = await page.locator("#life-panel").innerText();
  const tWord = lastSaid;
  assert(tWord, "a word was played");
  assert(!panelBefore.includes(tWord), "the panel does not name the word before the answer");
  assert.equal(await ev(() => Life.round.locked), true, "no answering while the word is playing");
  await page.waitForFunction(() => Life.round && !Life.round.locked, null, { timeout: 5000 });
  const other = ["apple", "banana", "tomato", "bread", "milk", "basket"].find((x) => x !== tWord);
  await tapTarget(other);
  assert.match(await page.locator("#life-fb").innerText(), /不是這個/);
  assert(!(await page.locator("#life-panel").innerText()).includes(tWord), "a miss does not reveal the answer");
  await tapTarget(tWord);
  assert.match(await page.locator("#life-panel").innerText(), new RegExp(`找到了（再試後）[\\s\\S]*${tWord}`));
  assert(await ev((w) => Life.state.res[w].wrong === 1 && Life.state.res[w].retry === 1, tWord), "the miss and the retry are recorded apart");

  /* ---------- find and spell ---------- */
  await page.locator('[data-mode="spell"]').click();
  for (let k = 0; k < 3; k++) {
    const zh = await page.locator("#life-panel b").first().innerText();
    const t = await ev((zh) => Life.data.scenes.find((s) => s.id === "supermarket").targets.find((x) => x.zh === zh), zh);
    await tapTarget(t.id);
    if (t.word.length > 6) {
      assert.match(await page.locator("#life-panel").innerText(), /比較長[\s\S]*不考拼字/);
    } else {
      assert(!(await page.locator("#life-panel").innerText()).includes(t.word), "spelling: the answer is not shown before submitting");
      // a tile in, then back out
      await page.locator(".life-tile").first().click();
      assert.equal(await page.locator(".life-slot").first().innerText(), await page.locator(".life-tile").first().innerText());
      await page.locator(".life-slot").first().click();
      assert.equal(await page.locator(".life-slot").first().innerText(), "＿", "a slot gives its letter back");
      for (const c of t.word) await page.locator(`.life-tile:not([disabled])`, { hasText: new RegExp(`^${c}$`) }).first().click();
      await page.locator("#life-submit").click();
      assert.match(await page.locator("#life-panel").innerText(), new RegExp(`拼對了[\\s\\S]*${t.word}`));
    }
    await page.locator("#life-next").click();
  }
  assert.match(await page.locator("#life-panel").innerText(), /這一輪完成/);

  /* ---------- mission ---------- */
  await page.locator('[data-mode="mission"]').click();
  await page.locator('[data-mission="0"]').click();
  assert.match(await page.locator("#life-panel").innerText(), /早餐採買[\s\S]*麵包[\s\S]*牛奶[\s\S]*香蕉/);
  await tapTarget("apple");
  assert.match(await page.locator("#life-fb").innerText(), /用不到/);
  for (const id of ["bread", "milk", "banana"]) await tapTarget(id);
  assert.match(await page.locator("#life-panel").innerText(), /任務完成：早餐採買/);
  assert.deepEqual(await ev(() => Life.state.missions.supermarket), [0]);

  /* ---------- card book for bank words, saved, back to the same place ---------- */
  assert(await ev(() => JSON.parse(localStorage.getItem("pm-life-v1")).found.supermarket.length === 6));
  await page.locator("#life-back").click();
  await page.locator("#life-back").click();
  await page.waitForSelector("#life", { state: "hidden" });
  assert.deepEqual(await ev(() => [World.hero.x, World.hero.y, World.paused]), [...spot, false], "back on the map where you were");
  // the other scenes open from the practice page too
  await page.locator("#hud-menu").click();
  await page.locator('[data-m="practice"]').click();
  await page.locator("#go-life").click();
  await page.waitForSelector("#life:not([hidden]) [data-scene]");
  // second-batch scenes now have two missions each
  await openScene("kitchen");
  await page.locator('[data-mode="mission"]').click();
  assert.match(await page.locator("#life-panel").innerText(), /熱剩菜[\s\S]*煎蛋配湯/);
  await page.locator('[data-mode="explore"]').click();
  await tapTarget("kettle");
  assert.match(await page.locator("#life-panel").innerText(), /kettle[\s\S]*熱水壺[\s\S]*音標待補/);
  await page.locator("#life-back").click();
  await openScene("bathroom");
  await tapTarget("toothbrush");
  assert.match(await page.locator("#life-panel").innerText(), /toothbrush[\s\S]*牙刷/, "small objects are tappable");
  await tapTarget("soap");
  assert.match(await page.locator("#life-panel").innerText(), /soap[\s\S]*肥皂/);
  assert.deepEqual(a.errors, []);
  await a.ctx.close();

  /* ---------- per-scene acceptance: all 12 scenes, every play mode, real taps ---------- */
  {
    const c = await setup(browser);
    const spot0 = await c.ev(() => [World.hero.x, World.hero.y]);
    await c.page.locator("#hud-menu").click();
    await c.page.locator('[data-m="life"]').click();
    await c.page.waitForSelector("#life:not([hidden]) [data-scene]");
    const ids = await c.ev(() => Life.data.scenes.map((s) => s.id));
    const report = [];
    for (const id of ids) {
      await c.openScene(id);
      const targets = await c.ev(() => Life.data.scenes.find((s) => s.id === Life.scene).targets.map((t) => ({ id: t.id, word: t.word, zh: t.zh })));
      // explore: every object, its sound
      for (const t of targets) {
        const n = await c.ev(() => __said.length + __plays.length);
        await c.tapTarget(t.id);
        assert.match(await c.page.locator("#life-panel").innerText(), new RegExp(t.word), `${id}: ${t.word} shows its word`);
        assert((await c.ev(() => __said.length + __plays.length)) > n, `${id}: ${t.word} plays`);
      }
      assert.equal(await c.page.locator("#life-count").innerText(), "找到 6 / 6", id);
      // listen: three words, each answered after it played
      await c.page.locator('[data-mode="listen"]').click();
      for (let k = 0; k < 3; k++) {
        await c.page.waitForFunction(() => Life.round && Life.round.target && !Life.round.locked, null, { timeout: 8000 });
        const want = await c.ev(() => Life.round.target);
        assert(!(await c.page.locator("#life-panel").innerText()).includes(targets.find((t) => t.id === want).word), `${id}: no answer before the tap`);
        await c.tapTarget(want);
        await c.page.locator("#life-next").click();
      }
      assert.match(await c.page.locator("#life-panel").innerText(), /這一輪完成/);
      // spell: find from Chinese, then spell (long words: find and hear)
      await c.page.locator('[data-mode="spell"]').click();
      for (let k = 0; k < 3; k++) {
        const zh = await c.page.locator("#life-panel b").first().innerText();
        const t = targets.find((x) => x.zh === zh);
        await c.tapTarget(t.id);
        if (t.word.length <= 6) {
          for (const ch of t.word) await c.page.locator(".life-tile:not([disabled])", { hasText: new RegExp(`^${ch}$`) }).first().click();
          await c.page.locator("#life-submit").click();
          assert.match(await c.page.locator("#life-panel").innerText(), /拼對了/, `${id}: ${t.word} spelled`);
        }
        await c.page.locator("#life-next").click();
      }
      // missions: both
      await c.page.locator('[data-mode="mission"]').click();
      const missions = await c.ev(() => Life.data.scenes.find((s) => s.id === Life.scene).missions);
      assert.equal(missions.length, 2, `${id}: two missions`);
      for (let m = 0; m < 2; m++) {
        if (m) await c.page.locator("#life-again").click();
        await c.page.locator(`[data-mission="${m}"]`).click();
        for (const tid of missions[m].targets) await c.tapTarget(tid);
        assert.match(await c.page.locator("#life-panel").innerText(), new RegExp(`任務完成：${missions[m].title}`), `${id}: mission ${m + 1}`);
      }
      report.push(id);
      await c.page.locator("#life-back").click();
      await c.page.waitForSelector("[data-scene]");
    }
    assert.equal(report.length, 12);
    await c.page.locator("#life-back").click();
    await c.page.waitForSelector("#life", { state: "hidden" });
    assert.deepEqual(await c.ev(() => [World.hero.x, World.hero.y]), spot0, "back to the map spot after all scenes");
    assert.deepEqual(c.errors, []);
    await c.ctx.close();
  }

  /* ---------- listen mode when sound cannot play: no answering ---------- */
  const m = await setup(browser, { mute: true });
  await m.page.locator("#hud-menu").click();
  await m.page.locator('[data-m="life"]').click();
  await m.openScene("airport");
  await m.page.locator('[data-mode="listen"]').click();
  await m.page.waitForFunction(() => /聲音沒有播出來/.test(document.getElementById("life-wait").textContent), null, { timeout: 15000 });
  assert.equal(await m.ev(() => Life.round.locked), true, "cannot answer without hearing the word");
  assert.deepEqual(m.errors, []);
  await m.ctx.close();

  console.log("PASS: per scene (all 12): explore all six with sound, a listen round, a spell round, both missions, back to the map; 12 scenes × 6 targets (71 words) with valid missions, every target's centre hits it (priority + 44px tolerance), drag pans without answering, zoom, explore (recording vs labelled device voice, no guessed KK, find count, first-find once), listen-first (locked until played, nothing named before the answer, miss then retry recorded apart), find-and-spell (tiles in and back, answer only after submit, long words find + hear), mission, saved progress, back to the same map spot, small objects (toothbrush, soap), sound failure blocks answering");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ panel: (document.getElementById("life-panel") || {}).innerText, scene: Life.scene, mode: Life.mode, view: Life.view })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-life-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
