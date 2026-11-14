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
  assert.match(await page.locator("#quest-text").innerText(), /Ava/, "then on to the next lesson");

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

  console.log("PASS: new player starts with Kai and no monsters, N00 letters / sound / KK, /k/ /æ/ /t/ cards (recording vs device voice vs slowed word labelled), listen-first recognition with no leak and no reveal on a miss, retry not counted as independent, stop and resume at the same step, picture → assemble with wrong slots left open, reveal with breakdown and word card, adventure Lv.2, field monsters appear, 回音泡泡 battle (taught sounds, long time, no reveal on a miss, timeout recorded apart), Echo (41 sounds, previews, cat breakdown), audio failure = replay only and no clock, legacy players keep the old lessons");
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
