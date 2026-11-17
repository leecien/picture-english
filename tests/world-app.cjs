// Actual RPG adapters, rather than stand-alone atlas callbacks. Media is stubbed;
// this checks navigation/pausing and does not claim device microphone verification.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    for (const colorScheme of ['light','dark']) {
      const ctx = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme});
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror',e => errors.push(e.message));
      await page.addInitScript(() => {
        HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event('ended')),10); return Promise.resolve(); };
        speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(),10);
        localStorage.setItem('pm-progress', JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true}));
        localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'food',world:{food:{x:16,y:8}},cleared:[],chests:[]}));
      });
      await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8018/');
      await page.waitForSelector('.world-canvas');
      const ev = (fn,arg) => page.evaluate(fn,arg);
      const spot = await ev(() => [RPG.data.at,World.hero.x,World.hero.y]);
      const openAtlas = async () => {
        await page.locator('#hud-menu').tap();
        await page.locator('[data-m="atlas"]').tap();
        await page.waitForSelector('#atlas [data-region]');
        assert.equal(await ev(() => World.paused),true);
      };
      const sameSpot = async () => {
        assert.deepEqual(await ev(() => [RPG.data.at,World.hero.x,World.hero.y]),spot);
        assert.equal(await ev(() => World.paused),false);
      };
      await openAtlas();
      await page.locator('[data-region="wind"]').tap();
      assert.equal(await page.locator('#atlas [data-map="wind"]').isDisabled(),true);
      await page.locator('[data-context="wind-customs"]').tap();
      await page.locator('#atlas [data-drive]').tap();
      await page.waitForSelector('#drive:not([hidden])');
      assert.deepEqual(await ev(() => [DP.cat,DP.scene,D.from]),['travel','customs','field']);
      assert.equal(await ev(() => World.paused),true);
      await page.locator('#drive-back').tap();
      await sameSpot();

      await openAtlas();
      await page.locator('[data-region="water"]').tap();
      await page.locator('[data-context="water-clinic"]').tap();
      await page.locator('[data-life-mode="listen"]').tap();
      await page.waitForSelector('#life-img');
      await page.waitForFunction(() => document.getElementById('life-img').complete && document.getElementById('life-img').naturalWidth > 0);
      assert.equal(await page.locator('#life-title').innerText(),'診所看診');
      assert.match(await page.locator('#life-panel').innerText(),/聽單字/);
      assert.equal(await ev(() => World.paused),true);
      await ev(() => Life.close());
      await sameSpot();

      await openAtlas();
      await page.locator('[data-region="fire"]').tap();
      await page.locator('[data-atlas-word="phone"]').tap();
      await page.waitForSelector('.wd-card:not([hidden])');
      assert.equal(await ev(() => {
        const e=document.querySelector('.wd-card'),r=e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),true,'word card appears above atlas and accepts taps');
      await page.locator('.wd-close').tap();
      await page.screenshot({path:`/tmp/world-app-fire-${colorScheme}.png`});
      await page.locator('#atlas [data-practice]').tap();
      await page.waitForSelector('#game:not([hidden])');
      assert.equal(await ev(() => RPG.active.source),'atlas');
      assert.equal(await ev(() => Array.from({length:24},() => take('w').th).every(x => x === 'food')),true,'themed practice keeps selecting the chosen theme across repeats');
      await page.locator('#back').tap();
      await sameSpot();
      await ev(() => start('word'));
      assert.equal(await ev(() => RPG.active),null,'ordinary practice clears the atlas filter');
      await page.locator('#back').tap();
      await page.locator('#quick-map').tap();
      await page.locator('#hud-menu').tap();
      await page.locator('[data-m="platform"]').tap();
      await page.waitForSelector('.pf:not([hidden])');
      assert.equal(await ev(() => World.paused),true);
      const download = page.waitForEvent('download');
      await page.locator('#pf-export').tap();
      assert.match((await download).suggestedFilename(),/\.json$/);
      await page.locator('#pf-close').tap();
      await sameSpot();
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('PASS: real 390px light/dark RPG menu → locked Wind/customs drive → clinic listen/photo → readable tappable word card → theme-filtered practice → backup; every return preserves map position and resumes the field.');
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
