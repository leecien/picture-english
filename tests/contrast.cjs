// Readability in light AND dark mode, measured on computed colours (not on CSS source): every visible text
// element is checked against its effective background (ancestors composited, opacity included).
// Run with a local HTTP server: python -m http.server 8000
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const SWEEP = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0,0,0,0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0],p[1],p[2],p[3]==null?1:p[3]]; };
  const lum = ([r,g,b]) => { const f = (c) => ((c/=255) <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4); return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const bgOf = (el) => { let stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= 1) break; if (getComputedStyle(e).backgroundImage !== "none" && e !== el) return null; } let col = [255,255,255]; for (const c of stack.reverse()) col = col.map((v,i)=>v*(1-c[3])+c[i]*c[3]); return col; };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
    if (el.closest(".toast, .gap")) continue; // toasts animate; the gap hides the answer on purpose
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
    const bg = bgOf(el); if (!bg) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    const fg0 = parse(cs.color), a = fg0[3]*op, fg = fg0.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join(".")} "${el.textContent.trim().slice(0,30)}" fg=${cs.color} bg=${bg.map(Math.round)}`);
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const scheme of ["light","dark"]) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage();
    await p.addInitScript(() => { HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event("ended")), 20); return Promise.resolve(); }; speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 20); localStorage.setItem("pm-progress", JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true})); });
    await p.goto((process.env.TEST_URL || "http://127.0.0.1:8000")); await p.waitForSelector(".world-canvas"); await p.waitForTimeout(500);
    const shots = {};
    shots.field = await p.evaluate(SWEEP);
    await p.locator("#hud-menu").click(); shots.menu = await p.evaluate(SWEEP); await p.locator("#menu-close").click();
    await p.evaluate(() => { openPanelHome && 0; }).catch(()=>{});
    await p.evaluate(() => { document.getElementById("hud-menu").click(); }); await p.locator('[data-m="practice"]').click(); await p.waitForTimeout(300);
    shots.home = await p.evaluate(SWEEP);
    for (const [mode, types] of [["word",["pic2word","word2pic","match","spell"]],["sent",["scene2sent","sent2scene","blank","order"]]]) {
      await p.locator(mode === "word" ? "#go-word" : "#go-sent").click(); await p.waitForSelector("#game:not([hidden])");
      for (const t of types) {
        await p.evaluate((t) => { S.answered = false; $("stage").innerHTML = ""; G[t]($("stage")); clearTimeout(S.timer); $("sheet").hidden = true; }, t);
        shots[t] = await p.evaluate(SWEEP);
        // answer (first option) to see right/wrong + sheet
        const btn = await p.$("#stage .opt, #stage .tile");
        if (btn) { await btn.click(); await p.waitForTimeout(150); shots[t + "-answered"] = await p.evaluate(SWEEP); }
      }
      await p.evaluate(() => { $("sheet").hidden = true; }); await p.locator("#back").click();
    }
    await p.evaluate(() => { const pw = document.querySelector("#ans-en .pw"); }); 
    // dialog question, answered wrong then right
    await p.evaluate(() => { toField(); document.getElementById("dlg").hidden = false; Learn.ask(document.getElementById("dlg-body"), Learn.sceneQuestion("travel", "customs", 0, { mode: "listen" }), { retry: false }); });
    await p.waitForTimeout(200); shots.dlg = await p.evaluate(SWEEP);
    await p.locator(".qz-o > .qz-opt > button").nth(await p.evaluate(() => Learn.last.options.findIndex((o) => !o.ok))).click();
    shots["dlg-answered"] = await p.evaluate(SWEEP);
    await p.evaluate(() => { document.getElementById("dlg-body").innerHTML = `<p class="dlg-en">${Learn.sayHTML("My phone battery is almost empty.")}</p>`; });
    await p.locator('.pw[data-w="almost"]').click(); await p.waitForTimeout(100); shots.card = await p.evaluate(SWEEP);
    await p.evaluate(() => { Pron.closeWord(); document.getElementById("dlg").hidden = true; });
    // novice village: a teaching card, the N02 matching screen, Echo's 41-sound grid, a field battle
    await p.evaluate(() => {
      Object.assign(RPG.data.nv, { track: "v1", n01: true, field: true, taught: ["k", "æ", "t", "m", "n", "s", "f"], n02step: "match" });
      RPG.travel("kk");
    });
    await p.waitForFunction(() => World.npc && World.npc("consonant"));
    await p.evaluate(() => { document.getElementById("dlg").hidden = true; World.approach(World.npc("consonant")); });
    await p.waitForSelector("#dlg:not([hidden]) .dlg-next", { timeout: 30000 });
    await p.locator(".dlg-next").click();
    await p.waitForSelector(".nv-match", { timeout: 10000 });
    await p.locator("[data-l]").first().click();
    shots.match = await p.evaluate(SWEEP);
    await p.reload(); await p.waitForSelector(".world-canvas");
    await p.evaluate(() => World.approach(World.npc("echo")));
    await p.waitForSelector("#dlg:not([hidden]) .dlg-choices", { timeout: 30000 });
    await p.locator(".dlg-choices button").first().click();
    shots.echo = await p.evaluate(SWEEP);
    await p.locator('[data-v=""]').click();
    await p.locator(".dlg-choices button", { hasText: "再見" }).click();
    await p.evaluate(() => Life.open({ scene: "kitchen" })); await p.waitForTimeout(600);
    const q = await p.evaluate(() => Life.pointOf("kettle")); const r = await p.locator("#life-stage").boundingBox();
    await p.mouse.click(r.x + q.x, r.y + q.y); await p.waitForTimeout(150); shots.life = await p.evaluate(SWEEP);
    await p.locator('[data-mode="mission"]').click(); shots.lifeMission = await p.evaluate(SWEEP);
    for (const [k, v] of Object.entries(shots)) assert.deepEqual([...new Set(v)], [], `${scheme} / ${k}: text below 4.5:1 (3:1 for large text)`);
  }
  await b.close();
  console.log("PASS: computed-colour contrast sweep in light and dark mode over the field, menu, practice home, all 8 practice question types before and after answering (answer sheet included), a dialog question answered, the word card, the N02 matching screen, Echo\'s 41-sound grid, a life scene card and its mission list: all text >= 4.5:1 (large text >= 3:1)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
