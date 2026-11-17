// Actual reviewed bank through the real Drive and selected-word recording entry.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const pack=require('../data/vocab-reviewed.json');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   HTMLMediaElement.prototype.play=function(){setTimeout(()=>this.dispatchEvent(new Event('ended')),15);return Promise.resolve();};
   speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),15);
   localStorage.setItem('pm-progress',JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true}));
   localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'food'}));
  });
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8018/');await page.waitForSelector('.world-canvas');
  const spot=await page.evaluate(()=>[RPG.data.at,World.hero.x,World.hero.y]);
  assert.equal(await page.evaluate(()=>allWords().length),pack.count);
  const n=await page.evaluate(()=>({examples:allSentences().length,original:SENT.length,legacy:WORDS.length}));
  assert(n.examples>n.original+1000);assert.equal(n.legacy,80);assert.equal(n.original,42);
  await page.locator('#hud-menu').click();await page.locator('[data-m="drive"]').click();
  await page.locator('#dk-word').check();await page.locator('#drive-listen').check();
  await page.evaluate(()=>{Math.random=()=>0;});await page.locator('#drive-start').click();
  await page.waitForFunction(()=>D.cur&&D.cur.kind==='w');
  assert(await page.evaluate(()=>!!Vocab.lookup(D.cur.it.w)&&!WORDS.some(w=>w.w===D.cur.it.w)),'Drive can actually select a reviewed new word');
  await page.locator('#drive-stop').click();await page.locator('#drive-back').click();
  assert.deepEqual(await page.evaluate(()=>[RPG.data.at,World.hero.x,World.hero.y]),spot);
  await page.locator('#hud-menu').click();await page.locator('[data-m="vocab"]').click();await page.locator('#vc-search').fill('still');
  await page.getByRole('button',{name:'still',exact:true}).click();await page.locator('.wd-close').click();
  await page.getByRole('button',{name:'🎙️ 跟讀這個單字',exact:true}).click();
  await page.waitForSelector('#audio-session:not([hidden])');
  assert.equal(await page.locator('#as-english').innerText(),'still');
  assert(await page.locator('#audio-session').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+20,r.y+20));}),'recording sits above the vocabulary page');
  await page.locator('#as-demo').click();await page.waitForFunction(()=>!document.querySelector('#as-demo').disabled);
  await page.locator('#as-close').click();assert(await page.locator('#vocab').isVisible());
  assert.equal(await page.evaluate(()=>World.paused),true,'closing nested recording keeps vocabulary paused');
  assert.equal(await page.evaluate(()=>CARDS.still&&CARDS.still.c||0),0,'listening alone grants no card');
  await page.locator('#vc-close').click();assert.equal(await page.evaluate(()=>World.paused),false);
  assert.deepEqual(await page.evaluate(()=>[RPG.data.at,World.hero.x,World.hero.y]),spot);
  assert.deepEqual(errors,[]);
  console.log(`PASS: actual ${pack.count}-word Drive bank, ${n.examples} sentence lines, old 80/42 retained, new word selected in real listen mode, selected-word recording overlay/replay/return and no listening reward.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
