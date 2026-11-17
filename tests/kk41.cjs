// The whole KK main line after N03, on a 390px phone, with a generic player that answers right:
// N04–N11 (28 more sounds → 41), a field battle after each chapter, Lumi's village quest after N06 (she joins and
// helps: "fix" after a miss is recorded as assisted), N12 stress (listen first, KK after), N13's three seals,
// 失音魔王 (3 seals × 10 questions; a seal needs 6 first-try answers; a failed seal is retried, HP reaching 0 early
// does not end it; progress survives a reload), graduation (portal open) and the review that starts from misses.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";
let CUR = null;
const errors = [],
  SEEN = new Set(),
  MATCHED = [];
const T13 = ["k", "æ", "t", "m", "n", "s", "f", "p", "b", "d", "g", "h", "l"];
const AFTER_N03 = { version: 1, at: "kk", nv: { track: "v1", step: "done", n01: true, field: true, n02: true, n02step: "done", field2: true, ch: { N03: { step: "done", done: true, full: ["map", "hat"] } }, field3: true, taught: T13, passed: T13, lv: 4 } };

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page = await ctx.newPage();
  CUR = page;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    window.__said = [];
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.dispatchEvent(new Event("ended")), 5);
      return Promise.resolve();
    };
    speechSynthesis.speak = (u) => {
      window.__said.push(u.text);
      setTimeout(() => u.onend && u.onend(), 5);
    };
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem("seeded", "1");
      localStorage.setItem("pm-rpg-v1", JSON.stringify(save));
    }
  }, AFTER_N03);
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());
  const noLeak = async (root) => {
    const bad = await ev((root) => {
      const q = Learn.last,
        el = document.querySelector(root).cloneNode(true);
      if (q.kind === "kkword") el.querySelectorAll(".qz-o .qz-kk").forEach((k) => k.remove()); // KK options (a distractor can read like the spelling, e.g. [dog])
      const html = el.innerHTML.replace(/\s(class|id)="[^"]*"/g, "");
      return [q.item.w, q.kind === "kkword" ? "" : q.item.kk].filter((x) => x && new RegExp("(^|[^a-z])" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)").test(html));
    }, root);
    assert.deepEqual(bad, [], "nothing gives the answer away before answering");
  };
  const quest = () => page.locator("#quest-text").innerText();

  /* A player who answers right: questions, matching, builds, choices, continue. */
  async function drive(prefer = [/繼續下一步/, /一起走吧/, /開始/, /▶/]) {
    for (let step = 0; step < 600; step++) {
      if (!(await visible("#dlg"))) return;
      if (await visible(".qz-o > .qz-opt > button:not([disabled])")) {
        await noLeak("#dlg-body");
        SEEN.add(await ev(() => Learn.last.kind));
        await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
        continue;
      }
      if (await visible(".qz-next")) {
        await page.locator(".qz-next").click();
        continue;
      }
      if (await visible(".nv-match")) {
        const pairs = await ev(() => Novice.lastMatch);
        MATCHED.push(pairs.map((p) => p[0]).join(","));
        for (const [sp, sd] of pairs) {
          const i = await ev((sp) => [...document.querySelectorAll("[data-l]")].findIndex((b) => b.firstChild.textContent.trim() === sp && !b.disabled), sp);
          if (i < 0) continue;
          await page.locator("[data-l]").nth(i).click();
          await page.locator(`[data-s="${sd}"]`).click();
        }
        continue;
      }
      if (await visible(".nv-slots")) {
        assert.equal(await page.locator(".nv-slots").innerText().then((t) => /＿/.test(t)), true);
        const snd = await ev(() => Novice.kkSounds(Novice.word(Novice.lastBuild).kk));
        const given = await ev(() => [...document.querySelectorAll(".nv-slot")].map((b) => b.classList.contains("given")));
        for (let i = 0; i < snd.length; i++) if (!given[i]) await page.locator(`[data-chip="${snd[i]}"]`).first().click();
        await page.locator("#nv-ok").click();
        await page.waitForSelector(".nv-reveal");
        await page.locator("#nv-done").click();
        continue;
      }
      if (await visible(".dlg-choices")) {
        const labels = await page.locator(".dlg-choices button:not([disabled])").allInnerTexts();
        let k = -1;
        for (const re of prefer) if ((k = labels.findIndex((l) => re.test(l))) >= 0) break;
        await page.locator(".dlg-choices button:not([disabled])").nth(Math.max(0, k)).click();
        continue;
      }
      if (await visible(".dlg-next")) {
        await page.locator(".dlg-next").click();
        continue;
      }
      await page.waitForTimeout(40);
    }
    throw new Error("dialog did not finish");
  }
  async function talk() {
    await page.locator("#act-talk").click();
    await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  }
  async function fieldWin(expectKind) {
    await ev(() => {
      const m = World.entities.filter((e) => e.kind === "mob" && !e.dead).sort((p, q) => Math.hypot(p.tx - World.hero.x, p.ty - World.hero.y) - Math.hypot(q.tx - World.hero.x, q.ty - World.hero.y))[0];
      m.wait = 999;
      World.approach(m);
    });
    await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
    let first = true;
    for (let k = 0; k < 30; k++) {
      await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 15000 });
      if (await page.locator("#bt-claim").count()) break;
      if (first) await ev(() => Battle.setFoeHp(4)), (first = false);
      await noLeak("#bt-act");
      if (expectKind) assert(await ev((k) => Learn.last.kind === k, expectKind));
      assert(await ev(() => Learn.last.kind !== "snd" || RPG.data.nv.taught.includes(Learn.last.targetSound)), "only taught sounds");
      await ev(() => Battle.setHp(80));
      await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    }
    await page.locator("#bt-claim").click();
    await page.waitForSelector("#battle", { state: "hidden" });
  }

  /* ---------- N04–N11: 28 more sounds, a field battle after each chapter, Lumi after N06 ---------- */
  const plan = await ev(() => Novice.PLAN);
  for (const id of Object.keys(plan)) {
    assert.match(await quest(), new RegExp(plan[id].title.split(" ")[0]), "objective names " + id);
    await talk();
    const who = await page.locator("#dlg-name").innerText();
    assert.match(who, plan[id].teacher === "vowel" ? /Ava/ : /Cody/, id + " is taught by the right teacher");
    await drive();
    assert.equal(await ev((id) => !!(RPG.data.nv.ch[id] && RPG.data.nv.ch[id].done), id), true, id + " done");
    assert(await ev((id) => RPG.data.nv.ch[id].full.length >= 2, id), id + ": two full words right first time");
    const cov = await ev(([id, g]) => new Set(RPG.data.nv.ch[id].full.flatMap((w) => Novice.kkSounds(Novice.word(w).kk)).filter((x) => g.flat().includes(x))).size, [id, plan[id].groups]);
    assert(cov >= 2, id + ": the two words use at least two different new sounds");
    assert(await ev((g) => g.flat().every((x) => RPG.data.nv.taught.includes(x) && RPG.data.nv.passed.includes(x)), plan[id].groups), id + ": every new sound right on a first try");
    await fieldWin();
    assert.equal(await ev((id) => RPG.data.nv.ch[id].field, id), true, id + " field battle");
    assert.equal(await ev(() => RPG.data.nv.lv), plan[id].lv, id + " adventure level");
    if (id === "N04") {
      const kinds = await ev(() => [...new Set(World.entities.filter((e) => e.kind === "mob").map((e) => e.look && e.look.name))]);
      assert(kinds.length >= 3, "three or more kinds of field monsters after N04: " + kinds);
    }
    if (id === "N06") {
      assert.match(await quest(), /露米/, "the companion quest comes after N06");
      assert.equal(await ev(() => World.entities.some((e) => e.kind === "pet")), false, "not given before the quest");
      await talk();
      await drive();
      assert.deepEqual(await ev(() => [RPG.data.companion.claimed, RPG.data.nv.lumi]), [true, ["map", "book", "cake"]]);
      await page.waitForFunction(() => World.entities.some((e) => e.kind === "pet"));
    }
  }
  assert.equal(await ev(() => RPG.data.nv.taught.length), 41, "41 sounds taught");
  assert.equal(await ev(() => new Set(RPG.data.nv.taught).size), 41);

  /* ---------- companion fix after a miss: assisted, not independent, no extra damage ---------- */
  await ev(() => {
    const m = World.entities.find((e) => e.kind === "mob" && !e.dead);
    m.wait = 999;
    World.approach(m);
  });
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  await page.waitForFunction(() => Battle.ready);
  await ev(() => Battle.setFoeHp(200));
  const sym = await ev(() => Learn.last.targetSound),
    a0 = await ev((s) => (RPG.data.nv.rec[s] || {}).assist || 0, sym),
    foe0 = await ev(() => Battle.foe.hp);
  await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  assert.equal(await page.locator("#bt-act .qz-o button.right").count(), 0, "nothing lit up before asking");
  await page.locator("#bt-buddy-fix").click();
  assert.equal(await page.locator("#bt-act .qz-o button.right").count(), 0, "the companion corrects the pick but does not give the answer");
  assert.match(await page.locator("#bt-feedback").innerText(), /換一個選/);
  assert.equal(await page.locator("#bt-next").isHidden(), true);
  await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
  assert.equal(await page.locator("#bt-act .qz-o button.right").count(), 1, "the player chose again");
  assert.match(await page.locator("#bt-feedback").innerText(), /夥伴補正」，不算獨立答對/);
  assert.equal(await ev((s) => RPG.data.nv.rec[s].assist, sym), a0 + 1, "recorded as assisted");
  assert.equal(await ev(() => Battle.foe.hp), foe0, "no damage from the fix");
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });

  /* ---------- N12 stress (listen first, KK after) ---------- */
  assert.match(await quest(), /Stella：N12/);
  await talk();
  await drive();
  assert.equal(await ev(() => RPG.data.nv.ch.N12.done), true);
  assert(SEEN.has("stress2"), "N12 asks secondary stress (listen first)");
  const n12 = await ev(() => Novice.N12_MATCH);
  for (const k of ["magic", "cg"]) assert(MATCHED.includes(n12[k].map((p) => p[0]).join(",")), "N12 matching game: " + k);

  /* ---------- N13: three seals with Kai, one per visit ---------- */
  for (const seal of ["sound", "build", "rhythm"]) {
    assert.match(await quest(), /Kai：N13/);
    await talk();
    await drive([/辨音印記|組音印記|節奏印記/, /繼續/, /▶/]);
    assert.equal(await ev((s) => RPG.data.nv.ch.seals[s], seal), true, seal + " seal");
  }
  assert.equal(await ev(() => RPG.data.nv.lv), 10, "adventure Lv.10 with three seals");

  /* ---------- 失音魔王 ---------- */
  await page.waitForFunction(() => World.entities.some((e) => e.story === "boss"), null, { timeout: 15000 });
  assert.match(await quest(), /失音魔王/);
  const bossFight = async (plan) => {
    await ev(() => World.approach(World.entities.find((e) => e.story === "boss")));
    await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
    assert.equal(await page.locator("#bt-mode").count(), 0, "no practice switch in the formal challenge");
    for (let k = 0; k < 10; k++) {
      await page.waitForFunction(() => Battle.ready, null, { timeout: 15000 });
      await noLeak("#bt-act");
      await ev(() => Battle.setHp(80));
      const right = plan(k);
      await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev((r) => Learn.last.options.findIndex((o) => !!o.ok === r), right)).click();
      if (!right) await page.locator("#bt-next").click();
      if (k === 6 && right) {
        // seal bar full after 6 first-try answers, but the seal needs all 10 questions
        await page.waitForFunction(() => Battle.ready || document.getElementById("bt-claim"), null, { timeout: 15000 });
        const st = await ev(() => Battle.state);
        if (st && st.quota.first >= 6) {
          assert.equal(st.hp, 0, "seal bar full");
          assert.equal(await page.locator("#bt-claim").count(), 0, "but the seal is not done before 10 questions");
        }
      }
    }
    await page.waitForSelector("#bt-claim", { timeout: 15000 });
    const text = await page.locator(".bt-end").innerText();
    await page.locator("#bt-claim").click();
    await page.waitForSelector("#battle", { state: "hidden" });
    return text;
  };
  // seal 1 with only 5 first-try answers: not locked, nothing saved
  const t1 = await bossFight((k) => k >= 5);
  assert.match(t1, /封印沒有完成[\s\S]*首次答對 5 題（需要 6 題）/);
  assert.equal(await ev(() => RPG.data.nv.boss.phase || 0), 0, "a failed seal is retried");
  // seal 1 again: all right
  assert.match(await bossFight(() => true), /封印完成/);
  assert.equal(await ev(() => RPG.data.nv.boss.phase), 1);
  // a reload keeps the seal
  await page.reload();
  await page.waitForSelector(".world-canvas");
  assert.equal(await ev(() => RPG.data.nv.boss.phase), 1, "saved per seal");
  await page.waitForFunction(() => World.entities.some((e) => e.story === "boss"));
  // seal 2: confusable pairs; seal 3: whole-word KK
  assert.match(await bossFight(() => true), /封印完成/);
  assert.equal(await ev(() => Learn.last.kind), "snd");
  await ev(() => World.approach(World.entities.find((e) => e.story === "boss")));
  await page.waitForSelector("#battle:not([hidden])", { timeout: 30000 });
  await page.waitForFunction(() => Battle.ready);
  assert.equal(await ev(() => Learn.last.kind), "kkword", "seal 3 asks for whole-word KK");
  await page.locator("#bt-run").click();
  await page.waitForSelector("#battle", { state: "hidden" });
  await bossFight(() => true);
  // graduation dialog
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 15000 });
  await drive();
  assert.deepEqual(await ev(() => [RPG.data.nv.grad, RPG.data.kk.done, RPG.data.nv.boss.phase]), [true, true, 3], "graduated");
  assert.match(await quest(), /傳送門/, "the portal is open");

  /* ---------- review after graduation: starts from misses / retries / assists ---------- */
  await ev(() => World.approach(World.npc("word")));
  await page.waitForSelector("#dlg:not([hidden])", { timeout: 30000 });
  const intro = await page.locator("#dlg-body").innerText();
  assert.match(intro, /正式複習[\s\S]*最需要練/);
  for (const c of ["音標", "拼字", "組音", "重音"]) assert(await page.locator(".dlg-choices button", { hasText: c }).count(), "review kind: " + c);
  await drive([/音標/, /▶/]);
  assert.equal(await ev(() => RPG.data.nv.reviews), 1);
  await page.locator("#hud-quest").click();
  const j = await page.locator("#menu-body").innerText();
  assert.match(j, /✅ N11 弱母音與捲舌母音[\s\S]*✅ 夥伴：露米[\s\S]*✅ N12[\s\S]*✅ N13 三枚印記[\s\S]*✅ 失音魔王[\s\S]*✅ 正式複習/);
  assert.deepEqual(errors, []);
  console.log("PASS: N04–N11 (41 sounds, right teachers, two full words per chapter, every new sound first-try, field battle after each, Lv.5–9), Lumi's village quest after N06 (not before), companion fix = assisted with no damage, N12 stress, three seals (Lv.10), boss: failed seal (5/10) retried, seal bar full before 10 does not end it, saved per seal across reload, phase 3 whole-word KK, graduation opens the portal, review from misses, journal");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (errors.length) console.error("PAGE ERRORS", errors);
  if (CUR) {
    const why = await CUR.evaluate(() => ({ act: (document.getElementById("bt-act") || {}).innerHTML, dlg: document.getElementById("dlg-body").innerText.slice(0, 300), quest: document.getElementById("quest-text").textContent, nv: { ch: RPG.data.nv.ch, taught: RPG.data.nv.taught.length, lv: RPG.data.nv.lv, boss: RPG.data.nv.boss }, battle: Battle.state })).catch(() => null);
    console.error("STATE", JSON.stringify(why));
    await CUR.screenshot({ path: "/tmp/picture-kk41-fail.png" }).catch(() => {});
  }
  process.exit(1);
});
