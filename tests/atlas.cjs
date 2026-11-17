// World atlas content references and mobile navigation. Audio is not part of this check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const AtlasModule = require('../atlas.js');
const base = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(base, p), 'utf8'));
const data = read('data/worlds.json');
const scenes = read('data/scenes.json').categories;
const life = new Map(read('data/life-scenes.json').scenes.map((s) => [s.id, s]));
const words = new Map(read('data/words.json').map((w) => [w.word, w]));
const maps = new Set(['kk','wind','food','animal','nature','transport','things','water','light','metal','star']);
assert.deepEqual(AtlasModule.validate(data), []);
assert.equal(data.regions.length, 9);
assert.equal(data.regions.reduce((n, r) => n + r.stages.length, 0), 27);
assert.equal(new Set(data.regions.flatMap((r) => r.stages.map((s) => s.id))).size, 27);
assert.deepEqual(data.practiceModes.map((m) => m.id), ['explore','listen','spell','mission']);
for (const r of data.regions) {
  for (const m of r.maps) assert(maps.has(m.id), `${r.id}: actual map reference`);
  for (const c of r.contexts) {
    if (c.lifeSceneId) {
      const s = life.get(c.lifeSceneId);
      assert(s, `${r.id}/${c.id}: actual photo`);
      assert.deepEqual(c.wordRefs.map((w) => w.word), s.targets.map((w) => w.word), `${c.id}: actual photo vocabulary`);
    }
    if (c.drive) assert(scenes.some((cat) => cat.id === c.drive.cat && cat.scenes.some((s) => s.id === c.drive.scene)), `${r.id}/${c.id}: actual dialogue source`);
    for (const w of c.wordRefs) {
      if (w.source === 'active-word-bank') assert(words.has(w.word), `${c.id}: assessed word reference`);
      else assert(life.get(c.lifeSceneId).targets.some((t) => t.word === w.word), `${c.id}: image word reference`);
    }
  }
}
const duplicate = structuredClone(data);
duplicate.regions[1].id = duplicate.regions[0].id;
assert(AtlasModule.validate(duplicate).length, 'invalid duplicate region rejected');
const missing = structuredClone(data);
missing.regions[0].stages.pop();
assert(AtlasModule.validate(missing).length, 'missing story stage rejected');

(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),args:['--no-sandbox']});
 try {
  for (const colorScheme of ['light','dark']) {
   const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme});
   const page = await context.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(e.message));
   await page.addInitScript(() => {
    localStorage.setItem('pm-progress',JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true}));
    localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'food',world:{food:{x:10,y:8}},cleared:[],chests:[]}));
   });
   await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8000');
   await page.waitForSelector('.world-canvas');
   if (!(await page.evaluate(() => typeof Atlas !== 'undefined'))) await page.addScriptTag({url:'atlas.js'});
   if (!(await page.locator('link[href$="atlas.css"]').count())) await page.addStyleTag({url:'atlas.css'});
   const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k,localStorage.getItem(k)]))));
   const install = () => page.evaluate(async () => {
    window.__atlasCalls = [];
    window.__atlasClose = 0;
    window.__atlasOpen = (regionId) => Atlas.open({
     regionId,currentMapId:'food',
     getStatus:() => ({unlockedMapIds:['kk','food'],completedStoryIds:[],progressLabel:'保留既有進度'}),
     onClose:() => { window.__atlasClose++; },
     travel:(id) => { window.__atlasCalls.push(['travel',id]); },
     openLife:(id,opt) => { window.__atlasCalls.push(['life',id,opt]); },
     openDrive:(ctx) => { window.__atlasCalls.push(['drive',ctx]); },
     openPractice:(ctx) => { window.__atlasCalls.push(['practice',ctx]); },
     openWord:(word) => { window.__atlasCalls.push(['word',word]); }
    });
    await __atlasOpen();
   });
   await install();
   assert.equal(await page.locator('#atlas [data-region]').count(),9);
   assert.equal(await page.evaluate(() => Atlas.isOpen),true);
   const box = await page.locator('#atlas').boundingBox();
   assert.equal(box.width,390);
   assert.equal(box.height,844);
   assert(await page.evaluate(() => document.getElementById('atlas-content').scrollWidth <= document.getElementById('atlas-content').clientWidth), 'no horizontal overflow');
   const badContrast = await page.evaluate(() => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const lum = values => values.slice(0,3).map(v => {v /= 255;return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;}).reduce((s,v,i) => s + v * [.2126,.7152,.0722][i],0);
    return [...document.querySelectorAll('#atlas h1,#atlas .atlas-note,#atlas .atlas-badge,#atlas .atlas-region strong,#atlas .atlas-region-tagline,#atlas .atlas-region-element')].filter(el => {
     const fg = rgb(getComputedStyle(el).color);let node = el,bg;
     while(node) {bg = rgb(getComputedStyle(node).backgroundColor);if(bg.length===3 || bg[3]>=.99) break;node=node.parentElement;}
     if(!bg || bg.length<3) return true;
     const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)<4.5;
    }).map(el => el.textContent);
   });
   assert.deepEqual(badContrast,[], 'opaque text/background pairs remain readable in both schemes');
   await page.locator('[data-region="wind"]').tap();
   assert.equal(await page.locator('#atlas [data-map="wind"]').isDisabled(),true,'locked map stays locked');
   assert.equal(await page.locator('#atlas [data-map="transport"]').isDisabled(),true);
   assert.match(await page.locator('#atlas-content').innerText(), /地圖未解鎖/);
   await page.locator('#atlas-back').tap();
   await page.locator('[data-region="water"]').tap();
   assert.equal(await page.locator('#atlas [data-map="water"]').isDisabled(),true,'new map still respects RPG locks');
   assert.match(await page.locator('#atlas-content').innerText(), /完成原本的前置任務/);
   assert.match(await page.locator('#atlas-content').innerText(), /已有主線任務/);
   assert.equal(await page.locator('#atlas [data-life-mode]').count(),4,'real available photo provides four modes');
   await page.locator('[data-life-mode="listen"]').tap();
   assert.deepEqual(await page.evaluate(() => __atlasCalls.at(-1)),['life','clinic',{mode:'listen'}]);
   assert.equal(await page.evaluate(() => Atlas.isOpen),false,'close before opening next feature');
   assert.equal(await page.evaluate(() => __atlasClose),1);
   // All four mode payloads go to the active image context.
   for (const mode of ['explore','listen','spell','mission']) {
    await page.evaluate(() => __atlasOpen('earth'));
    await page.locator('[data-context="earth-laundry"]').tap();
    await page.locator(`[data-life-mode="${mode}"]`).tap();
    assert.deepEqual(await page.evaluate(() => __atlasCalls.at(-1)),['life','laundry',{mode}]);
   }
   await page.evaluate(() => __atlasOpen('metal'));
   await page.locator('[data-context="metal-meeting"]').tap();
   await page.locator('[data-drive]').tap();
   assert.deepEqual(await page.evaluate(() => __atlasCalls.at(-1)),['drive',{cat:'work',scene:'meeting',label:'金之商務都會・會議與行程'}]);
   await page.evaluate(() => __atlasOpen('fire'));
   await page.locator('[data-map="food"]').tap();
   assert.deepEqual(await page.evaluate(() => __atlasCalls.at(-1)),['travel','food']);
   await page.evaluate(() => __atlasOpen('fire'));
   await page.locator('[data-atlas-word="glass"]').tap();
   assert.deepEqual(await page.evaluate(() => __atlasCalls.at(-1)),['word','glass']);
   assert.equal(await page.evaluate(() => Atlas.isOpen),true,'hearing a word does not leave atlas');
   await page.locator('[data-practice]').tap();
   assert.equal((await page.evaluate(() => __atlasCalls.at(-1)))[1].theme,'food');
   // Failed adapter reopens useful context with a friendly state; no unhandled rejection.
   await page.evaluate(() => Atlas.open({regionId:'fire',getStatus:() => ({unlockedMapIds:['food']}),travel:() => false}));
   await page.locator('[data-map="food"]').tap();
   await page.waitForFunction(() => Atlas.isOpen);
   assert.equal(await page.evaluate(() => Atlas.selectedRegion),'fire');
   assert.match(await page.locator('#atlas-status').innerText(), /暫時無法開啟/);
   // A standalone/disconnected overview is conservative; no forged unlocked travel.
   await page.evaluate(() => Atlas.close());
   await page.evaluate(() => Atlas.open({regionId:'wind'}));
   assert.equal(await page.locator('#atlas [data-map="wind"]').isDisabled(),true);
   assert.equal(await page.locator('#atlas [data-life-mode]').count(),0,'no dead photo controls without an adapter');
   await page.locator('#atlas-close').tap();
   assert.equal(await page.evaluate(() => Atlas.isOpen),false);
   const after = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k,localStorage.getItem(k)]))));
   assert.equal(after,before,'world atlas itself does not write or clear progress');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: nine-region/27-stage data with actual map/dialogue/photo/word references; 390px light/dark atlas; locked/unbuilt maps cannot travel; context-specific four photo modes; drive/practice/travel/word adapters; close ownership; error recovery; no progress writes.');
 } finally { await browser.close(); }
})().catch((e) => {console.error(e);process.exit(1);});
