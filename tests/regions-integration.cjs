// Real 390px RPG → atlas → residents → Learn → guardian battle → persistent rewards.
// Media is stubbed; no WorldRegions progression function is used to fake UI completion.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const URL=process.env.TEST_URL || 'http://127.0.0.1:8018/';
let current;
async function setup(browser,graduated) {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];current=page;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript((done)=>{
  HTMLMediaElement.prototype.play=function(){setTimeout(()=>this.dispatchEvent(new Event('ended')),5);return Promise.resolve();};
  speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5);
  if(!localStorage.getItem('regions-test-seeded')) {
   localStorage.setItem('regions-test-seeded','1');
   localStorage.setItem('pm-progress',JSON.stringify({xp:25,rounds:1,badges:[],placeDismissed:true}));
   localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:done?'food':'kk',kk:{done},story:{wind:{stage:4,done:true}},cleared:[],chests:[]}));
  }
 },graduated);
 await page.goto(URL);await page.waitForSelector('.world-canvas');
 return {context,page,errors};
}
function helpers(page) {
 const ev=(f,arg)=>page.evaluate(f,arg);
 const atlas=async(id)=>{
  await page.locator('#hud-menu').tap();await page.locator('[data-m="atlas"]').tap();
  await page.locator(`[data-region="${id}"]`).tap();
 };
 const travel=async(id)=>{
  await atlas(id);assert.equal(await page.locator(`[data-map="${id}"]`).isDisabled(),false);
  await page.locator(`[data-map="${id}"]`).tap();
  await page.waitForFunction(id=>RPG.data.at===id&&document.getElementById('atlas').hidden,id);
 };
 const approach=async(npcId)=>{
  await ev(id=>World.approach(World.npc(id)),npcId);
  await page.waitForSelector('#dlg:not([hidden])',{timeout:20000});
 };
 const choose=async(re)=>{await page.locator('.dlg-choices button').filter({hasText:re}).tap();};
 const startQuest=async(id,stage)=>{
  await approach(`${id}-${['guide','helper','keeper'][stage-1]}`);
  await choose('繼續任務');
 };
 const answer=async(correct)=>{
  await page.waitForSelector('#dlg .qz-o button:not([disabled])');
  const n=await ev(ok=>Learn.last.options.findIndex(o=>!!o.ok===ok),correct);
  assert(n>=0);await page.locator('#dlg .qz-o button').nth(n).tap();
  await page.locator('#dlg .qz-next').tap();
 };
 const quiz=async(id,{start=0,wrong=[]}={})=>{
  for(let i=start;i<5;i++) {
   const before=await ev(id=>WorldRegions.status(id,RPG.data.regions).active.index,id);assert.equal(before,i);
   await answer(!wrong.includes(i));
  }
 };
 const closeLine=async()=>{await page.locator('#dlg .dlg-next').tap();await page.waitForSelector('#dlg',{state:'hidden'});};
 const rewards=()=>ev(()=>({xp:P.xp,berry:Battle.count('berry'),dew:Battle.count('dew')}));
 return {ev,atlas,travel,approach,choose,startQuest,answer,quiz,closeLine,rewards};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const locked=await setup(browser,false),l=helpers(locked.page);
  for(const id of ['water','light','metal','star']) {
   await l.atlas(id);assert.equal(await locked.page.locator(`[data-map="${id}"]`).isDisabled(),true,`${id} locked before KK graduation`);
   await locked.page.locator('#atlas-close').tap();
  }
  assert.deepEqual(locked.errors,[]);await locked.context.close();

  const {context,page,errors}=await setup(browser,true),t=helpers(page);
  for(const id of ['water','light','metal','star']) {
   console.log(`checking ${id}`);await t.travel(id);
   const dimensions=await t.ev(()=>({w:document.getElementById('shell').getBoundingClientRect().width,h:document.getElementById('shell').getBoundingClientRect().height}));
   assert.deepEqual(dimensions,{w:390,h:844});
   const mobs=await t.ev(()=>World.entities.filter(e=>e.kind==='mob').map(e=>({name:e.name,hp:e.maxHp,shape:e.look.shape})));
   assert.equal(new Set(mobs.map(m=>m.name)).size,5);assert.equal(new Set(mobs.map(m=>m.hp)).size,5);assert.equal(new Set(mobs.map(m=>m.shape)).size,5);

   if(id==='water') {
    // Trying a later resident cannot begin/advance the second task.
    await t.approach('water-helper');assert.match(await page.locator('#dlg-body').innerText(),/先找/);await t.closeLine();
    await t.startQuest(id,1);await t.quiz(id,{wrong:[0,1]});
    assert.equal(await t.ev(()=>WorldRegions.status('water',RPG.data.regions).completedCount),0,'3/5 does not pass');
    assert.match(await page.locator('#dlg-body').innerText(),/獨立答對 3/);await t.closeLine();
    // Preserve two real answers across a page reload, then finish the same task.
    await t.startQuest(id,1);await t.answer(true);await t.answer(true);
    await page.reload();await page.waitForSelector('.world-canvas');
    assert.equal(await t.ev(()=>WorldRegions.status('water',RPG.data.regions).active.index),2);
    await t.startQuest(id,1);await t.quiz(id,{start:2});await t.closeLine();
   } else {await t.startQuest(id,1);await t.quiz(id);await t.closeLine();}
   assert.equal(await t.ev(id=>WorldRegions.status(id,RPG.data.regions).completedCount,id),1);
   const stage1=await t.rewards();
   await t.approach(`${id}-guide`);assert.match(await page.locator('#dlg-body').innerText(),/先找/);await t.closeLine();
   assert.deepEqual(await t.rewards(),stage1,'completed first resident cannot reward twice');

   // Context switch uses the next task, saves the exact field position and comes back to it.
   const spot=await t.ev(()=>[RPG.data.at,World.hero.x,World.hero.y]);
   await page.locator('#hud-menu').tap();await page.locator('[data-m="drive"]').tap();
   await page.waitForSelector('#drive:not([hidden])');
   const expected=await t.ev(id=>WorldRegions.next(id,RPG.data.regions).questionRefs[0],id);
   assert.deepEqual(await t.ev(()=>[DP.cat,DP.scene]),[expected.cat,expected.scene]);
   await page.locator('#drive-back').tap();assert.deepEqual(await t.ev(()=>[RPG.data.at,World.hero.x,World.hero.y]),spot);

   await t.startQuest(id,2);await t.quiz(id);await t.closeLine();
   await t.startQuest(id,3);await t.quiz(id);
   assert.equal(await t.ev(id=>WorldRegions.status(id,RPG.data.regions).completedCount,id),2);
   assert.equal(await t.ev(id=>!!WorldRegions.status(id,RPG.data.regions).seal,id),false,'quiz alone cannot award seal');
   await t.choose('挑戰守衛');await page.waitForSelector('#battle:not([hidden])');
   assert.equal(await t.ev(()=>Battle.active),true);
   assert.equal(await t.ev(()=>Battle.foe.name),await t.ev(id=>WorldRegions.map(id).boss.name,id));
   if(id==='water') {
    await page.locator('#bt-run').tap();await page.waitForSelector('#battle',{state:'hidden'});
    assert.equal(await t.ev(()=>WorldRegions.status('water',RPG.data.regions).active.index),5);
    assert.equal(await t.ev(()=>!!WorldRegions.status('water',RPG.data.regions).seal),false);
    await t.startQuest(id,3);await t.choose('挑戰守衛');await page.waitForSelector('#battle:not([hidden])');
   }
   // Accelerate HP only: a genuine answer resolves combat, victory, claim and the actual onEnd callback.
   await t.ev(()=>{Battle.setFoeHp(1);Battle.setHp(Battle.bars().maxHp);});
   for(let turn=0;turn<8;turn++) {
    await page.waitForFunction(()=>Battle.ready||document.getElementById('bt-claim')||document.getElementById('bt-next'));
    if(await page.locator('#bt-claim').count()) break;
    if(await page.locator('#bt-next').count()){await page.locator('#bt-next').tap();continue;}
    const n=await t.ev(()=>Learn.last.options.findIndex(o=>o.ok));await page.locator('#battle .qz-o button').nth(n).tap();
    await page.waitForFunction(()=>!Battle.ready);
   }
   await page.locator('#bt-claim').tap();await page.waitForSelector('#battle',{state:'hidden'});
   await page.waitForSelector('#dlg:not([hidden])');await t.closeLine();
   assert.equal(await t.ev(id=>WorldRegions.status(id,RPG.data.regions).done,id),true);
   assert.equal(await t.ev(id=>WorldRegions.status(id,RPG.data.regions).seal.id,id),id);
   const done=await t.rewards();
   await t.approach(`${id}-keeper`);await t.closeLine();assert.deepEqual(await t.rewards(),done);
   await page.reload();await page.waitForSelector('.world-canvas');
   assert.deepEqual(await t.rewards(),done,'reloading does not replay XP/supplies');
   assert.equal(await t.ev(id=>WorldRegions.status(id,RPG.data.regions).done,id),true);
   await t.atlas(id);
   assert.equal(await page.locator(`[data-map="${id}"]`).isDisabled(),false);
   assert.match(await page.locator('#atlas-content').innerText(),/3 \/ 3/,'atlas reports completed resident tasks');
   await page.locator('#atlas-close').tap();
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('regions-integration: 390px KK locks, four real atlas trips, 12 UI quests, retries/resume, real guardian wins, rewards, drive round trips passed');
 } finally {await browser.close();}
})().catch(async e=>{
 if(current&&!current.isClosed()) {console.error(await current.locator('body').innerText().catch(()=>''));await current.screenshot({path:'/tmp/regions-integration-failure.png'}).catch(()=>{});}
 console.error(e);process.exitCode=1;
});
