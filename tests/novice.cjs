// 音之新手村 v1 vertical slice (docs/NOVICE_VILLAGE_V1.md §16-1), 390px phone:
// N00 letters / sound / KK → N01 /k/ /æ/ /t/ (hear examples, how, spelling) → listen-first recognition with no
// answer leak and no reveal on a miss → stop and resume from the same step → picture → assemble /k æ t/
// (wrong slots stay open) → reveal cat → one field battle with 回音泡泡 (only taught sounds, audio before clock,
// no reveal on a miss, timeout recorded apart) → Echo: all 41 sounds previewable, look up cat; legacy saves.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;

async function setup(browser, save, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ([save, mute]) => {
      window.__plays = [];
      window.__said = [];
      if (mute) {
        HTMLMediaElement.prototype.play = function () {
          return Promise.reject(new Error("blocked"));
        };
        speechSynthesis.speak = (u) => setTimeout(() => u.onerror && u.onerror(), 5);
      } else {
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push({ src: this.src, rate: this.playbackRate });
          setTimeout(() => this.dispatchEvent(new Event("ended")), 10);
          return Promise.resolve();
        };
        speechSynthesis.speak = (u) => {
          window.__said.push(u.text);
          setTimeout(() => u.onend && u.onend(), 10);
        };
      }
      if (save && !localStorage.getItem("seeded")) {
        localStorage.setItem("seeded", "1");
        localStorage.setItem("pm-rpg-v1", JSON.stringify(save));
      }
    },
    [save, !!opt.mute],
  );
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  CUR = page;
  const ev = (f, a) => page.evaluate(f, a);
  const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());
  return { ctx, page, errors, ev, visible };
}
/* The DOM before an answer must not contain the word, its KK or its picture (aria-labels included). */
async function noLeak(ev, where) {
  const leak = await ev((where) => {
    const q = Learn.last,
      root = document.querySelector(where),
      html = root.innerHTML;
    const bad = [q.item.w, q.item.kk, q.item.e].filter((x) => x && html.includes(x));
    return bad;
  }, where);
  assert.deepEqual(leak, [], "nothing in the page gives the answer away before answering");
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });

  /* ---------- 1. New player: Kai first, no monsters before anything is taught ---------- */
  const a = await setup(browser, null);
  const { page, ev, visible } = a;
  assert.equal(await ev(() => RPG.data.nv.track), "v1");
  assert.match(await page.locator("#quest-text").innerText(), /村長 Kai：學第一個字 cat/);
  assert.equal(await ev(() => World.entities.filter((e) => e.kind === "mob").length), 0, "no field monsters before a sound is taught");
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-next").click();
  // N00: three different things
  const n00 = await page.locator("#dlg-body").innerText();
  assert.match(n00, /字母（拼字）[\s\S]*see[\s\S]*聲音[\s\S]*KK 音標[\s\S]*\[kæt\]/);
  await page.locator('[data-say="cat"]').click();
  assert(await ev(() => __plays.some((p) => /words\/cat\.mp3/.test(p.src))), "whole word from its recording");
  await page.locator('[data-tts="C. A. T."]').click();
  assert(await ev(() => __said.includes("C. A. T.")), "letter names, labelled as the device voice");
  assert.equal(await ev(() => __said.some((t) => /^\/?[kæt]\/?$/.test(t))), false, "a KK symbol is never read out by the device voice");
  await page.locator(".dlg-next").click();
  // /k/ card: hear (examples), how, spelling, examples; slowed word is labelled as such
  const kc = await page.locator("#dlg-body").innerText();
  assert.match(kc, /\/k\/[\s\S]*單音錄音還沒有[\s\S]*怎麼發[\s\S]*舌頭後半部[\s\S]*怎麼寫[\s\S]*聽例字/);
  assert.equal(await page.locator("#dlg-body mark.nv-hit").first().innerText(), "c", "the spelling for the sound is marked in the example");
  await page.locator("[data-slow]").first().click();
  assert(await ev(() => __plays.some((p) => /cat\.mp3/.test(p.src) && Math.abs(p.rate - 0.6) < 0.01)), "slowed whole-word recording");
  assert.match(await page.locator("[data-slow]").first().innerText(), /不是單音/);
  await page.locator(".dlg-next").click();
  await page.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await page.locator(".dlg-next").click(); // /æ/ card
  await page.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await page.locator(".dlg-next").click(); // "listen, then choose"

  /* ---------- 2. Listen-first recognition: no leak, a miss reveals nothing ---------- */
  await page.waitForSelector(".qz-o button");
  await noLeak(ev, "#dlg-body");
  assert.equal(await ev(() => Learn.last.type), "listen-sound");
  assert(await ev(() => ["k", "æ"].includes(Learn.last.targetSound) && Learn.last.options.every((o) => /\/(k|æ)\//.test(o.html))), "only taught sounds");
  const target1 = await ev(() => Learn.last.targetSound);
  await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  assert.match(await page.locator(".qz-f").innerText(), /不是這個音[\s\S]*答案不會直接公布/);
  assert.equal(await page.locator(".qz-o button.right").count(), 0, "the right option is not lit up after a miss");
  await noLeak(ev, "#dlg-body");
  await page.locator(".qz-o > .qz-opt > button:not([disabled])").first().click();
  assert.match(await page.locator(".qz-f").innerText(), /重試後答對，不算獨立答對/);
  assert.match(await page.locator(".qz-f").innerText(), new RegExp(await ev(() => Learn.last.item.w)), "the word is revealed only once it is right");
  assert.equal(await ev((t) => RPG.data.nv.passed.includes(t), target1), false, "a retry does not pass the sound");
  await page.locator(".qz-next").click();
  for (let k = 0; k < 10 && (await visible(".qz-o")); k++) {
    if (!(await visible(".qz-o > .qz-opt > button:not([disabled])"))) break;
    await noLeak(ev, "#dlg-body");
    await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await page.locator(".qz-next").click();
    if (await visible(".dlg-choices")) break;
  }
  assert.deepEqual((await ev(() => RPG.data.nv.passed)).sort(), ["k", "æ"].sort(), "each sound right on a first try");
  assert(await ev(() => RPG.data.nv.rec.k.ind + RPG.data.nv.rec["æ"].ind >= 2 && Object.values(RPG.data.nv.rec).some((r) => r.retry === 1)), "first-try and retry recorded apart");

  /* ---------- 3. Stop and come back: same step, no replay of the opening ---------- */
  await page.locator(".dlg-choices button", { hasText: "先休息" }).click();
  for (let k = 0; k < 5 && (await visible("#dlg")); k++) await page.locator(".dlg-next").click();
  assert.equal(await ev(() => RPG.data.nv.step), "t");
  await page.reload();
  await page.waitForSelector(".world-canvas");
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  assert.match(await page.locator("#dlg-body").innerText(), /新的音：\/t\//, "resumes at /t/");
  await page.locator(".dlg-next").click();
  for (let k = 0; k < 12 && !(await visible(".dlg-choices")); k++) {
    await page.waitForSelector(".qz-o > .qz-opt > button:not([disabled])");
    await noLeak(ev, "#dlg-body");
    await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await page.locator(".qz-next").click();
  }
  assert(await ev(() => RPG.data.nv.passed.includes("t")));
  await page.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await page.locator(".dlg-next").click(); // "put them together"

  /* ---------- 4. Picture → assemble /k æ t/; wrong slots stay open; reveal only when right ---------- */
  await page.waitForSelector(".nv-slots");
  const html0 = await page.locator("#dlg-body").innerHTML();
  assert(!/\bcat\b|kæt/.test(html0.replace(/aria-label="[^"]*"/g, "")), "no word or KK before it is built");
  for (const c of ["t", "æ", "k"]) await page.locator(`[data-chip="${c}"]`).click();
  await page.locator("#nv-ok").click();
  assert.equal(await page.locator(".nv-slot.bad").count(), 2, "wrong places marked");
  assert.equal(await page.locator(".nv-slot.good").count(), 1, "the right middle sound stays");
  assert.equal(await page.locator("#nv-ok").isDisabled(), true, "wrong slots emptied: not complete");
  assert(!/kæt/.test(await page.locator("#dlg-body").innerHTML()), "still no reveal");
  await page.locator('[data-chip="k"]').click();
  await page.locator('[data-chip="t"]').click();
  await page.locator("#nv-ok").click();
  await page.waitForSelector(".nv-reveal");
  const rv = await page.locator("#dlg-body").innerText();
  assert.match(rv.replace(/\s+/g, ""), /組對了（重試後）[\s\S]*cat[\s\S]*\[kæt\][\s\S]*c→\/k\/a→\/æ\/t→\/t\//);
  assert(await ev(() => __plays.some((p) => /cat\.mp3/.test(p.src))), "the word plays when revealed");
  await page.locator(".nv-reveal .pw").click();
  assert.match(await page.locator(".wd-card").innerText(), /\[kæt\]/, "tap the word: its KK");
  await page.locator(".wd-card .wd-close").click();
  await page.locator("#nv-done").click();
  for (let k = 0; k < 5 && (await visible("#dlg")); k++) await page.locator(".dlg-next").click();
  assert.deepEqual(await ev(() => [RPG.data.nv.n01, RPG.data.nv.lv]), [true, 2]);
  await page.waitForFunction(() => World.entities.some((e) => e.kind === "mob" && e.name === "回音泡泡"));
  assert.match(await page.locator("#quest-text").innerText(), /回聲原野/);

  /* ---------- 5. One field battle: taught sounds only, audio before clock, no reveal on a miss ---------- */
  await ev(() => {
    const m = World.entities.filter((e) => e.kind === "mob").sort((p, q) => Math.hypot(p.tx - World.hero.x, p.ty - World.hero.y) - Math.hypot(q.tx - World.hero.x, q.ty - World.hero.y))[0];
    m.wait = 999;
    World.approach(m);
  });
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  await page.waitForFunction(() => Battle.ready);
  assert.equal(await ev(() => Battle.foe.name), "回音泡泡");
  assert.equal(await ev(() => Battle.foe.maxHp), 24);
  await noLeak(ev, "#bt-act");
  assert(await ev(() => ["k", "æ", "t"].includes(Learn.last.targetSound)));
  assert((await ev(() => Battle.state.left)) >= 14, "long time for the first monster");
  const hp0 = await ev(() => Battle.hp);
  await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  assert((await ev(() => Battle.hp)) < hp0, "a miss is a hit taken");
  assert.equal(await page.locator("#bt-act .qz-o button.right").count(), 0, "no lit-up answer");
  assert.match(await page.locator("#bt-feedback").innerText(), /不是這個音[\s\S]*答案不在這裡公布/);
  await noLeak(ev, "#bt-act");
  await page.locator("#bt-next").click();
  await page.waitForFunction(() => Battle.ready);
  const tq = await ev(() => Learn.last.targetSound);
  await ev(() => Battle.settleForTest("timeout"));
  assert(await ev((s) => RPG.data.nv.rec[s].timeout >= 1, tq), "timeout recorded apart");
  await page.locator("#bt-next").click();
  for (let k = 0; k < 20 && !(await page.locator("#bt-claim").count()); k++) {
    await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 10000 });
    if (await page.locator("#bt-claim").count()) break;
    await ev(() => Battle.setHp(80));
    await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    assert.match(await page.locator("#bt-feedback").innerText(), new RegExp(await ev(() => Learn.last.item.w)), "revealed when right");
  }
  await page.locator("#bt-claim").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  assert.equal(await ev(() => RPG.data.nv.field), true);
  assert.match(await page.locator("#quest-text").innerText(), /Cody：N02/, "then on to N02 with Cody");

  /* ---------- 6. Echo: all 41 sounds, taught card with practice, previews, word breakdown ---------- */
  await ev(() => World.approach(World.npc("echo")));
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await page.locator(".dlg-choices button", { hasText: "選一個音" }).click();
  assert.equal(await page.locator(".nv-grid button").count(), 41, "17 vowels + 24 consonants");
  assert.equal(await page.locator(".nv-grid button.taught").count(), 3);
  await page.locator('.nv-grid [data-v="ʒ"]').click();
  assert.match(await page.locator("#dlg-body").innerText(), /N08 組合子音[\s\S]*measure \/ vision[\s\S]*完成後才開放/);
  await page.locator('[data-v=""]').click();
  await page.locator(".dlg-choices button", { hasText: "選一個字" }).click();
  await page.locator('.nv-grid [data-v="cat"]').click();
  assert.match((await page.locator("#dlg-body").innerText()).replace(/\s+/g, ""), /c→\/k\/a→\/æ\/t→\/t\/[\s\S]*單音錄音：尚未提供/);
  await page.locator('[data-v=""]').click();
  await page.locator(".dlg-choices button", { hasText: "再見" }).click();
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.deepEqual(await ev(() => [RPG.data.nv.n01, RPG.data.nv.field, RPG.data.nv.taught.length]), [true, true, 3], "saved");
  assert.deepEqual(a.errors, []);
  await a.ctx.close();

  /* ---------- 7. Field battle when audio cannot play: replay only, no clock, no text fallback ---------- */
  const m = await setup(browser, { version: 1, at: "kk", nv: { track: "v1", n01: true, field: true, taught: ["k", "æ", "t"], lv: 2, step: "done" } }, { mute: true });
  await m.ev(() => {
    const e = World.entities.find((x) => x.kind === "mob");
    e.wait = 999;
    World.approach(e);
  });
  await m.page.waitForSelector("#bt-replay", { timeout: 30000 });
  assert.equal(await m.page.locator("#bt-read").count(), 0, "no 'show text' (it would give the word away)");
  assert.equal(await m.ev(() => Battle.state.left), null, "no countdown before the sound is heard");
  assert.match(await m.page.locator("#bt-replay").innerText(), /點擊播放/);
  assert.deepEqual(m.errors, []);
  await m.ctx.close();

  /* ---------- 8. A player who started the old lessons keeps them; Echo offers the new unit ---------- */
  const l = await setup(browser, { version: 1, at: "kk", kk: { vowel: true, units: { v1: true, v2: true, v3: true } } });
  assert.equal(await l.ev(() => RPG.data.nv.track), "legacy");
  assert.match(await l.page.locator("#quest-text").innerText(), /Cody/, "old progress and next lesson kept");
  assert.equal(await l.ev(() => World.entities.find((e) => e.kind === "mob").name), "音節泡泡");
  await l.ev(() => World.approach(World.npc("echo")));
  await l.page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  assert(await l.page.locator(".dlg-choices button", { hasText: "上新版入門課" }).count(), "Echo offers the new unit");
  assert.deepEqual(l.errors, []);
  await l.ctx.close();

  /* ---------- 9. N02 /m n s f/ with Cody: cards, recognition, matching, fill-the-slots build, field ---------- */
  const AFTER_N01 = { version: 1, at: "kk", nv: { track: "v1", step: "done", n01: true, field: true, taught: ["k", "æ", "t"], passed: ["k", "æ", "t"], lv: 2 } };
  const z = await setup(browser, AFTER_N01);
  const zp = z.page,
    zev = z.ev;
  assert.match(await zp.locator("#quest-text").innerText(), /Cody：N02 聲音小路/);
  const answerRight = async () => {
    await zp.waitForSelector(".qz-o > .qz-opt > button:not([disabled])");
    await noLeak(zev, "#dlg-body");
    await zp.locator(".qz-o > .qz-opt > button").nth(await zev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await zp.locator(".qz-next").click();
  };
  await zp.locator("#act-talk").click();
  await zp.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  assert.match(await zp.locator("#dlg-name").innerText(), /Cody/);
  await zp.locator(".dlg-next").click(); // intro
  assert.match(await zp.locator("#dlg-body").innerText(), /新的音：\/m\/[\s\S]*雙唇[\s\S]*moon/);
  await zp.locator(".dlg-next").click();
  assert.match(await zp.locator("#dlg-body").innerText(), /新的音：\/n\/[\s\S]*舌尖/);
  await zp.locator(".dlg-next").click();
  await zp.locator(".dlg-next").click(); // "listen, then choose"
  // a learner who never gets a first try right cannot pass: 10 questions, then it stops and keeps the step
  for (let k = 0; k < 10; k++) {
    await zp.waitForSelector(".qz-o > .qz-opt > button:not([disabled])");
    assert(await zev(() => ["m", "n"].includes(Learn.last.targetSound)), "only the new pair is targeted");
    assert(await zev(() => Learn.last.options.every((o) => /\/(k|æ|t|m|n)\//.test(o.html))), "options only from taught sounds");
    await zp.locator(".qz-o > .qz-opt > button").nth(await zev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
    await zp.locator(".qz-o > .qz-opt > button:not([disabled])").nth(await zev(() => {
      const bs = [...document.querySelectorAll(".qz-o > .qz-opt > button")];
      return bs.filter((b) => !b.disabled).findIndex((b) => Learn.last.options[+b.dataset.i].ok);
    })).click();
    await zp.locator(".qz-next").click();
  }
  for (let k = 0; k < 5 && (await z.visible("#dlg")); k++) await zp.locator(".dlg-next").click();
  assert.equal(await zev(() => RPG.data.nv.n02step), "check-mn", "no pass on retries only: the step is kept");
  assert.equal(await zev(() => RPG.data.nv.passed.includes("m") || RPG.data.nv.passed.includes("n")), false);
  // back: straight to the check, right on first tries this time
  await zp.locator("#act-talk").click();
  await zp.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await zp.locator(".dlg-next").click();
  for (let k = 0; k < 6 && !(await z.visible(".dlg-choices")); k++) await answerRight();
  // stop here; come back after a reload at /s/ /f/
  await zp.locator(".dlg-choices button", { hasText: "先休息" }).click();
  for (let k = 0; k < 5 && (await z.visible("#dlg")); k++) await zp.locator(".dlg-next").click();
  await zp.reload();
  await zp.waitForSelector(".world-canvas");
  assert.equal(await zev(() => RPG.data.nv.n02step), "sf");
  await zp.locator("#act-talk").click();
  await zp.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  assert.match(await zp.locator("#dlg-body").innerText(), /新的音：\/s\//, "resumes at /s/");
  await zp.locator(".dlg-next").click();
  assert.match(await zp.locator("#dlg-body").innerText(), /新的音：\/f\/[\s\S]*ph/);
  assert.equal(await zp.locator('#dlg-body mark.nv-hit', { hasText: "ph" }).count(), 1, "ph marked in phone");
  await zp.locator(".dlg-next").click();
  await zp.locator(".dlg-next").click();
  for (let k = 0; k < 6 && !(await z.visible(".dlg-choices")); k++) await answerRight();
  assert(await zev(() => ["m", "n", "s", "f"].every((x) => RPG.data.nv.passed.includes(x))), "each new sound right on a first try");
  await zp.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await zp.locator(".dlg-next").click(); // "f and ph both say /f/"
  // matching: one wrong pair first, then all right
  await zp.waitForSelector(".nv-match");
  const pairs = await zev(() => Novice.MATCH.N02);
  const leftIdx = async (sp) => zev((sp) => [...document.querySelectorAll("[data-l]")].findIndex((b) => b.textContent.trim().startsWith(sp) && !b.disabled), sp);
  await zp.locator("[data-l]").nth(await leftIdx("ph")).click();
  await zp.locator('[data-s="s"]').click();
  assert.match(await zp.locator("#dlg-body .qz-f").innerText(), /ph 不是發 \/s\//);
  for (const [sp, sd] of pairs) {
    await zp.locator("[data-l]").nth(await leftIdx(sp)).click();
    await zp.locator(`[data-s="${sd}"]`).click();
  }
  assert.equal(await zev(() => RPG.data.nv.rec.f.retry >= 1), true, "the missed pair is recorded as a retry");
  await zp.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await zp.locator(".dlg-next").click(); // "fill the taught slots"
  // fill-the-slots: sun = /s ʌ n/ (ʌ not taught: placed and locked), phone = /f o n/ (o locked)
  for (const [w, fill] of [["sun", ["s", "n"]], ["phone", ["f", "n"]]]) {
    await zp.waitForSelector(".nv-slots");
    assert(!(await zp.locator("#dlg-body").innerHTML()).includes(`>${w}<`), `${w}: no word before it is built`);
    assert.equal(await zp.locator(".nv-slot.given").count(), 1, `${w}: one untaught sound placed for you`);
    assert.equal(await zp.locator(".nv-slot.given").isDisabled(), true);
    assert(await zev(() => [...document.querySelectorAll("[data-chip]")].every((b) => RPG.data.nv.taught.includes(b.dataset.chip))), "chips are taught sounds only");
    for (const c of fill) await zp.locator(`[data-chip="${c}"]`).click();
    await zp.locator("#nv-ok").click();
    await zp.waitForSelector(".nv-reveal");
    assert.match(await zp.locator("#dlg-body").innerText(), new RegExp(`組對了！[\\s\\S]*${w}`));
    await zp.locator("#nv-done").click();
  }
  for (let k = 0; k < 5 && (await z.visible("#dlg")); k++) await zp.locator(".dlg-next").click();
  assert.deepEqual(await zev(() => [RPG.data.nv.n02, RPG.data.nv.n02step]), [true, "done"]);
  assert.match(await zp.locator("#quest-text").innerText(), /7 個音/);
  // field battle with the seven sounds; newest ones come up; win -> field2, adventure Lv.3
  await zev(() => {
    const m = World.entities.filter((e) => e.kind === "mob").sort((p, q) => Math.hypot(p.tx - World.hero.x, p.ty - World.hero.y) - Math.hypot(q.tx - World.hero.x, q.ty - World.hero.y))[0];
    m.wait = 999;
    World.approach(m);
  });
  await zp.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  const asked = new Set();
  for (let k = 0; k < 25 && !(await zp.locator("#bt-claim").count()); k++) {
    await zp.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 10000 });
    if (await zp.locator("#bt-claim").count()) break;
    await noLeak(zev, "#bt-act");
    asked.add(await zev(() => Learn.last.targetSound));
    if (k === 0) await zev(() => Battle.setFoeHp(60));
    await zev(() => Battle.setHp(80));
    await zp.locator("#bt-act .qz-o > .qz-opt > button").nth(await zev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  }
  assert([...asked].some((x) => ["m", "n", "s", "f"].includes(x)), "N02 sounds asked in the field: " + [...asked]);
  assert([...asked].every((x) => ["k", "æ", "t", "m", "n", "s", "f"].includes(x)), "only taught sounds");
  await zp.locator("#bt-claim").click();
  await zp.waitForSelector("#battle", { state: "hidden" });
  assert.deepEqual(await zev(() => [RPG.data.nv.field2, RPG.data.nv.lv]), [true, 3]);
  assert.match(await zp.locator("#quest-text").innerText(), /Cody：N03/, "then N03 with Cody");
  await zp.locator("#hud-quest").click();
  assert.match(await zp.locator("#menu-body").innerText(), /✅ N02 聲音小路[\s\S]*✅ 回聲原野：7 個音/);
  assert.deepEqual(z.errors, []);
  await z.ctx.close();

  /* ---------- 10. N03 /p b d g h l/ with Cody: three pairs, matching (pp, ll), full builds, field, Lv.4 ---------- */
  const AFTER_N02 = { version: 1, at: "kk", nv: { track: "v1", step: "done", n01: true, field: true, n02: true, n02step: "done", field2: true, taught: ["k", "æ", "t", "m", "n", "s", "f"], passed: ["k", "æ", "t", "m", "n", "s", "f"], lv: 3 } };
  const y = await setup(browser, AFTER_N02);
  const yp = y.page,
    yev = y.ev;
  assert.match(await yp.locator("#quest-text").innerText(), /Cody：N03 子音工具箱/);
  const yRight = async () => {
    await yp.waitForSelector(".qz-o > .qz-opt > button:not([disabled])");
    await noLeak(yev, "#dlg-body");
    assert(await yev(() => Learn.last.options.every((o) => RPG.data.nv.taught.includes(o.label.replace(/\//g, "")))), "options only from taught sounds");
    await yp.locator(".qz-o > .qz-opt > button").nth(await yev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    await yp.locator(".qz-next").click();
  };
  const yCards = async (syms) => {
    for (const sym of syms) {
      assert.match(await yp.locator("#dlg-body").innerText(), new RegExp(`新的音：/${sym}/`), "card for /" + sym + "/");
      await yp.locator(".dlg-next").click();
    }
  };
  await yp.locator("#act-talk").click();
  await yp.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await yp.locator(".dlg-next").click(); // intro
  await yCards(["p", "b"]);
  assert.match(await yp.locator("#dlg-body").innerText(), /重點是 \/p\/ 和 \/b\//);
  await yp.locator(".dlg-next").click();
  for (let k = 0; k < 6 && !(await y.visible(".dlg-choices")); k++) {
    assert(await yev(() => ["p", "b"].includes(Learn.last ? Learn.last.targetSound : "p")));
    await yRight();
  }
  // a break after the first pair; the next visit starts at /d/ /g/
  await yp.locator(".dlg-choices button", { hasText: "先休息" }).click();
  for (let k = 0; k < 5 && (await y.visible("#dlg")); k++) await yp.locator(".dlg-next").click();
  await yp.reload();
  await yp.waitForSelector(".world-canvas");
  assert.equal(await yev(() => RPG.data.nv.ch.N03.step), "dg", "saved at the second pair");
  await yp.locator("#act-talk").click();
  await yp.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  await yCards(["d", "g"]);
  await yp.locator(".dlg-next").click();
  for (let k = 0; k < 6 && !(await y.visible(".dlg-choices")); k++) await yRight();
  await yp.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await yCards(["h", "l"]);
  await yp.locator(".dlg-next").click();
  for (let k = 0; k < 6 && !(await y.visible(".dlg-choices")); k++) await yRight();
  assert(await yev(() => ["p", "b", "d", "g", "h", "l"].every((x) => RPG.data.nv.passed.includes(x))), "each new sound right on a first try");
  assert.equal(await yev(() => RPG.data.nv.taught.length), 13);
  await yp.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await yp.locator(".dlg-next").click(); // matching line
  await yp.waitForSelector(".nv-match");
  const ypairs = await yev(() => Novice.MATCH.N03);
  assert.equal(ypairs.length, 8);
  const yLeft = async (sp) => yev((sp) => [...document.querySelectorAll("[data-l]")].findIndex((b) => b.firstChild.textContent.trim() === sp && !b.disabled), sp);
  await yp.locator("[data-l]").nth(await yLeft("b")).click();
  await yp.locator('[data-s="p"]').click();
  assert.match(await yp.locator("#dlg-body .qz-f").innerText(), /b 不是發 \/p\//, "voiced vs voiceless miss");
  for (const [sp, sd] of ypairs) {
    await yp.locator("[data-l]").nth(await yLeft(sp)).click();
    await yp.locator(`[data-s="${sd}"]`).click();
  }
  await yp.locator(".dlg-choices button", { hasText: "繼續下一步" }).click();
  await yp.locator(".dlg-next").click(); // build line
  // map and hat: every sound is taught now, so nothing is placed for you
  for (const [w, fill] of [["map", ["m", "æ", "p"]], ["hat", ["h", "æ", "t"]]]) {
    await yp.waitForSelector(".nv-slots");
    assert.equal(await yp.locator(".nv-slot.given").count(), 0, `${w}: a full build, no slot given`);
    assert(!(await yp.locator("#dlg-body").innerHTML()).includes(`>${w}<`), `${w}: not shown before it is built`);
    for (const c of fill) await yp.locator(`[data-chip="${c}"]`).click();
    await yp.locator("#nv-ok").click();
    await yp.waitForSelector(".nv-reveal");
    await yp.locator("#nv-done").click();
  }
  for (let k = 0; k < 5 && (await y.visible("#dlg")); k++) await yp.locator(".dlg-next").click();
  assert.deepEqual(await yev(() => RPG.data.nv.ch.N03), { step: "done", done: true, full: ["map", "hat"] });
  assert.match(await yp.locator("#quest-text").innerText(), /13 個音/);
  // field: 13 sounds, N03 sounds come up, win -> field3, Lv.4
  await yev(() => {
    const m = World.entities.filter((e) => e.kind === "mob").sort((p, q) => Math.hypot(p.tx - World.hero.x, p.ty - World.hero.y) - Math.hypot(q.tx - World.hero.x, q.ty - World.hero.y))[0];
    m.wait = 999;
    World.approach(m);
  });
  await yp.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  const yAsked = new Set();
  for (let k = 0; k < 30 && !(await yp.locator("#bt-claim").count()); k++) {
    await yp.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 10000 });
    if (await yp.locator("#bt-claim").count()) break;
    await noLeak(yev, "#bt-act");
    yAsked.add(await yev(() => Learn.last.targetSound));
    if (k === 0) await yev(() => Battle.setFoeHp(80));
    await yev(() => Battle.setHp(80));
    await yp.locator("#bt-act .qz-o > .qz-opt > button").nth(await yev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  }
  assert([...yAsked].some((x) => ["p", "b", "d", "g", "h", "l"].includes(x)), "N03 sounds asked: " + [...yAsked]);
  assert([...yAsked].every((x) => ["k", "æ", "t", "m", "n", "s", "f", "p", "b", "d", "g", "h", "l"].includes(x)), "only the 13 taught sounds");
  await yp.locator("#bt-claim").click();
  await yp.waitForSelector("#battle", { state: "hidden" });
  assert.deepEqual(await yev(() => [RPG.data.nv.field3, RPG.data.nv.lv]), [true, 4]);
  await yp.locator("#hud-quest").click();
  assert.match(await yp.locator("#menu-body").innerText(), /✅ N03 子音工具箱[\s\S]*✅ 回聲原野：13 個音/);
  // results are kept per sound: first-try right and retry apart
  assert(await yev(() => RPG.data.nv.rec.b.retry >= 1 && RPG.data.nv.rec.p.ind >= 1), "first-try and retry recorded apart");
  assert.deepEqual(y.errors, []);
  await y.ctx.close();

  /* ---------- 11. A-N03-02: the N03 full-build threshold (two different full words, each right first time) ---------- */
  const T13 = ["k", "æ", "t", "m", "n", "s", "f", "p", "b", "d", "g", "h", "l"];
  const AT_BUILD = { version: 1, at: "kk", nv: { track: "v1", step: "done", n01: true, field: true, n02: true, n02step: "done", field2: true, ch: { N03: { step: "build" } }, taught: T13, passed: T13, lv: 3 } };
  /* fill a build: right = the word's sounds in order; wrong = swap the first two */
  const fillBuild = async (pg, ev2, ok) => {
    await pg.waitForSelector(".nv-slots");
    const w = await ev2(() => {
      const cand = ["map", "hat", "cat"];
      return cand.find((x) => document.querySelector(".nv-pic").textContent.includes(Novice.word(x).e));
    });
    assert(w, "a full-build word is on screen");
    assert.equal(await pg.locator(".nv-slot.given").count(), 0, `${w}: nothing pre-placed`);
    const snd = await ev2((w) => Novice.kkSounds(Novice.word(w).kk), w);
    const order = ok ? snd : [snd[1], snd[0], ...snd.slice(2)];
    for (const c of order) await pg.locator(`[data-chip="${c}"]`).click();
    await pg.locator("#nv-ok").click();
    if (!ok) {
      // wrong slots cleared: put the right sounds back
      const left = await ev2(() => [...document.querySelectorAll(".nv-slot")].map((b) => b.classList.contains("good")));
      for (let i = 0; i < snd.length; i++) if (!left[i]) await pg.locator(`[data-chip="${snd[i]}"]`).click();
      await pg.locator("#nv-ok").click();
    }
    await pg.waitForSelector(".nv-reveal");
    await pg.locator("#nv-done").click();
    return w;
  };
  const openBuild = async (pg) => {
    await pg.locator("#act-talk").click();
    await pg.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
    assert.match(await pg.locator("#dlg-body").innerText(), /兩個不同的字，各自第一次送出就組對/);
    await pg.locator(".dlg-next").click();
  };
  const closeAll = async (t) => {
    for (let k = 0; k < 6 && (await t.visible("#dlg")); k++) await t.page.locator(".dlg-next").click();
  };
  {
    // (a) only one word right first time -> not complete; (b) a reload keeps it, the next visit skips that word
    const t = await setup(browser, AT_BUILD);
    await openBuild(t.page);
    assert.equal(await fillBuild(t.page, t.ev, true), "map");
    assert.equal(await fillBuild(t.page, t.ev, false), "hat");
    assert.equal(await fillBuild(t.page, t.ev, false), "cat");
    assert.match(await t.page.locator("#dlg-body").innerText(), /已完成：map/);
    await closeAll(t);
    assert.deepEqual(await t.ev(() => [RPG.data.nv.ch.N03.step, !!RPG.data.nv.ch.N03.done, RPG.data.nv.ch.N03.full]), ["build", false, ["map"]], "one first-try word is not enough");
    assert.match(await t.page.locator("#quest-text").innerText(), /Cody：N03/, "still on N03");
    await t.page.reload();
    await t.page.waitForSelector(".world-canvas");
    assert.deepEqual(await t.ev(() => RPG.data.nv.ch.N03.full), ["map"], "kept after a reload");
    const xp0 = await t.ev(() => P.xp);
    await openBuild(t.page);
    assert.equal(await fillBuild(t.page, t.ev, true), "hat", "map is not asked again");
    await closeAll(t);
    assert.deepEqual(await t.ev(() => [RPG.data.nv.ch.N03.step, RPG.data.nv.ch.N03.done, RPG.data.nv.ch.N03.full]), ["done", true, ["map", "hat"]], "two different words, each right first time");
    const xp1 = await t.ev(() => P.xp);
    assert(xp1 > xp0, "the chapter reward is given");
    // (e) no repeat reward: back to Cody after completion does not run N03 again
    await t.page.reload();
    await t.page.waitForSelector(".world-canvas");
    await t.ev(() => World.approach(World.npc("consonant")));
    await t.page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
    assert.doesNotMatch(await t.page.locator("#dlg-body").innerText(), /N03 子音工具箱|兩個不同的字/, "N03 does not start again");
    assert.equal(await t.ev(() => P.xp), xp1, "no second chapter reward");
    assert.deepEqual(t.errors, []);
    await t.ctx.close();
  }
  {
    // (c) every word needed a retry -> not complete, nothing counted
    const t = await setup(browser, AT_BUILD);
    await openBuild(t.page);
    for (const w of ["map", "hat", "cat"]) assert.equal(await fillBuild(t.page, t.ev, false), w);
    await closeAll(t);
    assert.deepEqual(await t.ev(() => [RPG.data.nv.ch.N03.step, !!RPG.data.nv.ch.N03.done, RPG.data.nv.ch.N03.full || []]), ["build", false, []], "retries only: not complete");
    assert(await t.ev(() => !RPG.data.nv.field3 && RPG.data.nv.lv === 3), "no field / level progress either");
    await t.ctx.close();
  }
  {
    // (d) leaving in the middle of a build (reload before submitting) cannot skip it
    const t = await setup(browser, AT_BUILD);
    await openBuild(t.page);
    assert.equal(await fillBuild(t.page, t.ev, true), "map");
    await t.page.waitForSelector(".nv-slots");
    await t.page.locator(`[data-chip="h"]`).click(); // half-built hat, not submitted
    await t.page.reload();
    await t.page.waitForSelector(".world-canvas");
    assert.deepEqual(await t.ev(() => [RPG.data.nv.ch.N03.step, !!RPG.data.nv.ch.N03.done, RPG.data.nv.ch.N03.full]), ["build", false, ["map"]], "an unsubmitted build counts for nothing");
    await openBuild(t.page);
    assert.equal(await fillBuild(t.page, t.ev, false), "hat", "hat comes back as a fresh first attempt");
    assert.equal(await fillBuild(t.page, t.ev, true), "cat");
    await closeAll(t);
    assert.deepEqual(await t.ev(() => [RPG.data.nv.ch.N03.done, RPG.data.nv.ch.N03.full]), [true, ["map", "cat"]], "two different first-try words (map, cat)");
    await t.ctx.close();
  }

  console.log("PASS: A-N03-02 threshold (one first-try word is not enough; retries only are not enough; two different full words each right first time complete N03; passed words survive a reload and are not asked again; an unsubmitted build counts for nothing; no second chapter reward); N03 /p b d g h l/ (three pairs of cards, recognition only from taught sounds, resume at the second pair after reload, 8-pair matching incl. pp / ll with a voiced/voiceless miss recorded, full builds map + hat with no given slots, 13-sound field battle asking N03 sounds, Lv.4, journal); N02 /m n s f/ (cards incl. ph, recognition only from taught sounds, no pass on retries only, resume after reload, spelling ↔ sound matching with a recorded miss, fill-the-slots build with untaught sounds locked, field battle asking N02 sounds, Lv.3, journal); new player starts with Kai and no monsters, N00 letters / sound / KK, /k/ /æ/ /t/ cards (recording vs device voice vs slowed word labelled), listen-first recognition with no leak and no reveal on a miss, retry not counted as independent, stop and resume at the same step, picture → assemble with wrong slots left open, reveal with breakdown and word card, adventure Lv.2, field monsters appear, 回音泡泡 battle (taught sounds, long time, no reveal on a miss, timeout recorded apart), Echo (41 sounds, previews, cat breakdown), audio failure = replay only and no clock, legacy players keep the old lessons");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ dlg: document.getElementById("dlg-body").innerText.slice(0, 400), quest: document.getElementById("quest-text").textContent, nv: RPG.data.nv, battle: Battle.state, fb: (document.getElementById("bt-feedback") || {}).textContent })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-novice-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
