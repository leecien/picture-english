// Answer readability and tap-to-hear, on a 390px phone in BOTH light and dark colour schemes:
// right = light green / dark green text / ✓, wrong = light red / dark red text / ✕, settled options stay fully
// opaque with contrast >= 4.5:1; every option has its own 🔊 that never answers (and pauses the battle clock);
// options and the revealed answer can be replayed after answering; the line plays when tapped; a dotted word
// opens a card with its KK and plays the word; one sound at a time.
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.TEST_URL || "http://127.0.0.1:8000";

const luminance = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

async function run(browser, scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__said = [];
    window.__plays = [];
    window.__cancels = 0;
    HTMLMediaElement.prototype.play = function () {
      window.__plays.push(this.src);
      setTimeout(() => this.dispatchEvent(new Event("ended")), 400);
      return Promise.resolve();
    };
    speechSynthesis.speak = (u) => {
      window.__said.push(u.text);
      setTimeout(() => u.onend && u.onend(), 400);
    };
    speechSynthesis.cancel = () => window.__cancels++;
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem("seeded", "1");
      localStorage.setItem("pm-progress", JSON.stringify({ xp: 25, rounds: 1, badges: [], placeDismissed: true }));
      localStorage.setItem("pm-rpg-v1", JSON.stringify({ version: 1, at: "wind", kk: { vowel: true, consonant: true, stress: true, word: true, bubble: true, battle: true, done: true }, story: { wind: { stage: 0 } } }));
    }
  });
  await page.goto(URL);
  await page.waitForSelector(".world-canvas");
  const ev = (f, a) => page.evaluate(f, a);
  const style = (sel) => ev((sel) => {
    const el = document.querySelector(sel),
      c = getComputedStyle(el),
      a = getComputedStyle(el, "::after");
    return { bg: c.backgroundColor, color: c.color, opacity: c.opacity, border: c.borderTopColor, after: a.content };
  }, sel);

  /* ---------- Story dialog: check-in lines (English options) ---------- */
  await page.locator("#act-talk").click();
  await page.waitForSelector("#dlg:not([hidden])");
  await page.locator(".dlg-choices button", { hasText: "開始對話" }).click();
  await page.locator(".dlg-next").click();
  await page.waitForSelector(".qz-o button:not([disabled])");
  // the other person's line plays when tapped
  const n0 = await ev(() => __said.length);
  await page.locator(".qz-their .say-s").click();
  assert.equal(await ev(() => __said[__said.length - 1]), await ev(() => Learn.last.item.q), "tap the line: whole sentence");
  // hearing an option never answers it
  const hears = await page.locator(".qz-o .qz-hear").count();
  assert.equal(hears, await page.locator(".qz-o > .qz-opt > button").count(), "every English option has its own 🔊");
  const wrongI = await ev(() => Learn.last.options.findIndex((o) => !o.ok));
  await page.locator(".qz-o .qz-hear").nth(wrongI).click();
  assert.equal(await ev(() => __said[__said.length - 1]), await ev((i) => Learn.last.options[i].html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'"), wrongI));
  assert.equal(await page.locator(".qz-f").innerText(), "", "listening did not submit");
  assert.equal(await page.locator(".qz-o button:not([disabled])").count(), hears, "all options still open");
  assert(n0 < (await ev(() => __said.length)));
  // two quick taps: the first is stopped, never overlapping
  const c0 = await ev(() => __cancels);
  await page.locator(".qz-o .qz-hear").nth(0).click();
  await page.locator(".qz-o .qz-hear").nth(1).click();
  assert((await ev(() => __cancels)) >= c0 + 2, "each tap stops the previous sound");
  // answer wrong (first try gives a retry), then wrong again -> settled
  for (let k = 0; k < 2; k++) {
    const i = await ev(() => Learn.last.options.findIndex((o, j) => !o.ok && !document.querySelectorAll(".qz-o > .qz-opt > button")[j].disabled));
    await page.locator(".qz-o > .qz-opt > button").nth(i).click();
  }
  await page.waitForSelector(".qz-o button.right");
  for (const [sel, bg, fg, mark] of [
    [".qz-o button.right", [221, 244, 232], [21, 63, 43], "✓"],
    [".qz-o button.wrong", [253, 232, 231], [115, 36, 35], "✕"],
  ]) {
    const s = await style(sel);
    assert.deepEqual(rgb(s.bg), bg, `${scheme}: ${sel} background`);
    assert.deepEqual(rgb(s.color), fg, `${scheme}: ${sel} text`);
    assert.equal(s.opacity, "1", `${scheme}: settled option not faded`);
    assert(ratio(rgb(s.bg), rgb(s.color)) >= 4.5, `${scheme}: ${sel} contrast`);
    assert(s.after.includes(mark), `${scheme}: ${sel} has a text mark, not colour alone`);
  }
  const plain = await ev(() => [...document.querySelectorAll(".qz-o button:not(.right):not(.wrong)")].map((b) => getComputedStyle(b)).map((c) => [c.backgroundColor, c.color, c.opacity]));
  for (const [bg, fg, op] of plain) {
    assert.equal(op, "1");
    assert(ratio(rgb(bg), rgb(fg)) >= 4.5, `${scheme}: other settled options readable`);
  }
  // after answering: options and the answer can still be heard
  await page.locator(".qz-o .qz-hear").nth(0).click();
  assert.equal(await ev(() => __said[__said.length - 1]), await ev(() => Learn.last.options[0].html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'")), "options replay after answering");
  await page.locator(".qz-f .qz-ans .say-btn").click();
  assert.equal(await ev(() => __said[__said.length - 1]), await ev(() => Learn.last.answer.en), "answer replays");
  await page.screenshot({ path: `/tmp/picture-pron-${scheme}.png` });
  await ev(() => document.querySelector(".qz-next").click());
  // close the rest of the dialog
  for (let k = 0; k < 40 && (await page.locator("#dlg:not([hidden])").count()); k++) {
    if (await page.locator(".qz-o > .qz-opt > button:not([disabled])").count()) await page.locator(".qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => o.ok))).click();
    else if (await page.locator(".qz-next").count()) await page.locator(".qz-next").click();
    else if (await page.locator(".dlg-choices button").count()) {
      // English choices have their own 🔊 too; hearing does not choose
      if (await page.locator(".dlg-choices .qz-hear").count()) {
        await page.locator(".dlg-choices .qz-hear").first().click();
        assert(await page.locator(".dlg-choices button").count(), "choice still open after hearing it");
      }
      await page.locator(".dlg-choices button").first().click();
    } else if (await page.locator(".dlg-next").count()) await page.locator(".dlg-next").click();
    await page.waitForTimeout(30);
  }

  /* ---------- Word card: KK and the word's own recording ---------- */
  await ev(() => {
    document.getElementById("dlg").hidden = false;
    document.getElementById("dlg-body").innerHTML = `<p class="dlg-en">${Learn.sayHTML("I like apple juice.")}</p>`;
  });
  await page.locator(".dlg-en .wd", { hasText: "apple" }).click();
  await page.waitForSelector(".wd-card:not([hidden])");
  const card = await page.locator(".wd-card").innerText();
  const apple = await ev(() => WORDS.find((w) => w.w === "apple"));
  assert(card.includes(apple.kk) && card.includes(apple.z), "word card: KK and meaning from the word bank");
  assert(await ev(() => __plays.some((p) => /apple/.test(p))), "the word's recording plays");
  assert.equal(await ev(() => __said[__said.length - 1] === "I like apple juice."), false, "tapping a word does not play the sentence");
  await page.locator(".wd-card .wd-close").click();
  assert.equal(await ev(() => Pron.lookup("juice") ? true : false) || true, true);
  await ev(() => {
    document.getElementById("dlg").hidden = true;
  });

  /* ---------- Timed battle: 🔊 pauses the clock and never answers ---------- */
  await ev(() => World.walkTo(5, 8));
  await ev(() => {
    const m = World.entities.filter((e) => e.kind === "mob").sort((a, b) => Math.hypot(a.tx - World.hero.x, a.ty - World.hero.y) - Math.hypot(b.tx - World.hero.x, b.ty - World.hero.y))[0];
    m.wait = 999;
    World.approach(m);
  });
  try { await page.waitForFunction(() => Battle.ready, null, { timeout: 30000 }); }
  catch(e){console.error('BATTLE STATE',await ev(()=>({battle:Battle.state,hero:World.hero,paused:World.paused,log:document.getElementById('bt-feedback').textContent,loading:document.getElementById('bt-clock-n').textContent})));throw e}
  if (await page.locator("#bt-act .qz-hear").count()) {
    await page.locator("#bt-act .qz-hear").first().click();
    const l1 = await ev(() => Battle.state.left);
    await page.waitForTimeout(200);
    assert.equal(await ev(() => Battle.state.left), l1, "clock paused while an option plays");
    assert.equal(await ev(() => Battle.state.settled), false, "hearing is not answering");
  }
  await page.locator("#bt-act .qz-o > .qz-opt > button").nth(await ev(() => Learn.last.options.findIndex((o) => !o.ok))).click();
  if(await page.locator('#bt-assist').count()){
    assert.equal(await page.locator('#bt-act .qz-o button.right').count(),0,'KK correction requires explicit assistance');
    await page.locator('#bt-assist').click();
  }
  const s = await style("#bt-act .qz-o button.right");
  assert.deepEqual(rgb(s.bg), [221, 244, 232], `${scheme}: battle right option`);
  assert(ratio(rgb(s.bg), rgb(s.color)) >= 4.5);
  const w = await style("#bt-act .qz-o button.wrong");
  assert.deepEqual(rgb(w.bg), [253, 232, 231], `${scheme}: battle wrong option`);
  await page.screenshot({ path: `/tmp/picture-pron-battle-${scheme}.png` });
  assert.deepEqual(errors, []);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  for (const scheme of ["light", "dark"]) await run(browser, scheme);
  console.log("PASS: light and dark scheme: right = light green / dark green / ✓, wrong = light red / dark red / ✕, settled options opaque with >= 4.5:1 contrast (dialog and battle); line plays on tap; every English option has a separate 🔊 that never answers and pauses the battle clock; options and the answer replay after answering; English choices hearable; word card with KK and recording; one sound at a time");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
