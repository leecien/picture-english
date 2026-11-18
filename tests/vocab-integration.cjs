// Use the actual reviewed production pack and the real RPG/Pron/Learn/save hooks.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const pack = require('../data/vocab-reviewed.json');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   HTMLMediaElement.prototype.play=function(){setTimeout(()=>this.dispatchEvent(new Event('ended')),10);return Promise.resolve();};
   speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),10);
   if(!localStorage.getItem('vocab-integration-seeded')){
    localStorage.setItem('vocab-integration-seeded','1');localStorage.setItem('pm-progress',JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true}));
    localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'food',cleared:[],chests:[]}));
   }
  });
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8018/');await page.waitForSelector('.world-canvas');
  assert.equal(await page.evaluate(()=>Vocab.count),pack.count);
  assert.equal(await page.evaluate(()=>WORDS.length),80,'old image/KK questions keep their verified bank');
  const spot=await page.evaluate(()=>[RPG.data.at,World.hero.x,World.hero.y]);
  await page.locator('#hud-menu').click();await page.locator('[data-m="vocab"]').click();
  assert.equal(await page.evaluate(()=>World.paused),true);
  assert.equal(await page.locator('.vc-row').count(),20);
  await page.locator('#vc-search').fill('still');
  await page.getByRole('button',{name:'still',exact:true}).click();
  await page.waitForSelector('.wd-card:not([hidden])');
  assert.match(await page.locator('.wd-card').innerText(),/仍然/);
  assert.equal(await page.locator('.wd-card').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'word card remains clickable above vocabulary screen');
  await page.locator('.wd-close').click();
  await page.getByRole('button',{name:'← 返回單字列表',exact:true}).click();
  await page.getByRole('button',{name:'學習這一輪（最多 10 字）',exact:true}).click();
  await page.getByRole('button',{name:'開始本輪練習',exact:true}).click();
  assert(await page.locator('#vc-answer').isDisabled());
  await page.locator('#vc-hear').click();await page.waitForFunction(()=>!document.getElementById('vc-answer').disabled);
  await page.locator('#vc-answer').fill('still');await page.locator('#vc-submit').click();
  await page.waitForFunction(()=>CARDS.still&&CARDS.still.c===1);
  const xp=await page.evaluate(()=>P.xp);await page.evaluate(()=>document.getElementById('vc-submit').click());
  assert.equal(await page.evaluate(()=>P.xp),xp,'duplicate submission gives no extra reward');
  await page.locator('#vc-close').click();
  assert.deepEqual(await page.evaluate(()=>[RPG.data.at,World.hero.x,World.hero.y]),spot);
  assert.equal(await page.evaluate(()=>World.paused),false);
  await page.reload();await page.waitForSelector('.world-canvas');
  assert.equal(await page.evaluate(()=>CARDS.still.c),1,'reviewed vocabulary uses the old card save');
  await page.locator('#hud-menu').click();await page.locator('[data-m="book"]').click();
  await page.waitForSelector('button.card[data-w="still"]');
  assert.match(await page.locator('button.card[data-w="still"]').innerText(),/仍然/);
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${pack.count} actual production words loaded, legacy bank stays 80, RPG menu/search/definition/above-panel word card, real spelling → Learn/XP/card, duplicate guard, return position and reload/card-book persistence.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
