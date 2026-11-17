// Real Battle.start, generated Learn questions and rendered answer controls.
// Media transport ends deterministically after 320ms; countdown waits for it.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8137';
let passed = 0, failed = 0;
async function setup(browser) {
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.stack || e.message));
  await page.addInitScript(()=>{
    window.__audioStarted=0;window.__audioEnded=0;
    HTMLMediaElement.prototype.play=function(){__audioStarted++;setTimeout(()=>{__audioEnded++;this.dispatchEvent(new Event('ended'));},320);return Promise.resolve();};
    if(window.speechSynthesis) speechSynthesis.speak=u=>{__audioStarted++;setTimeout(()=>{__audioEnded++;u.onend&&u.onend();},320);};
    localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'kk',nv:{track:'v1',taught:[],passed:[],n01:false},kk:{done:false}}));
  });
  await page.goto(base);await page.waitForSelector('.world-canvas');
  return {context,page,errors};
}
const ready = page => page.waitForFunction(()=>Battle.ready&&Battle.state.left!==null);
async function start(page, opt={}) {
  await page.evaluate(opt=>{
    Math.random=()=>.5;Battle.setHp(80);Battle.setMp(25);Battle.pref.practice=false;Battle.pref.relaxed=false;
    Battle.start({look:{name:'共鳴守衛',shape:opt.shape||'guardian',boss:opt.boss,hp:opt.hp||160,atk:6,colors:['#bce6ff','#6c92bc']}},{
      region:'wind', ...(opt.intents?{phases:[{until:-1,label:'招式測試',intents:opt.intents}]}:{}),
      make:()=>{
        const q=opt.sentence?Learn.sentQuestion(null,'boss-test'):Learn.wordQuestion(null,opt.listening?'listen':'zh','boss-test');
        if(opt.sentence)q.time=8;
        return q;
      },onEnd:()=>{},
    });
  },opt);
  await ready(page);
}
async function pick(page,correct) {
  await ready(page);
  const i=await page.evaluate(ok=>Learn.last.options.findIndex(o=>!!o.ok===ok),correct);
  assert(i>=0);await page.locator('#bt-act .qz-o .qz-opt > button').nth(i).tap();
}
async function next(page) {
  if(await page.locator('#bt-next').count())await page.locator('#bt-next').tap();
  await ready(page);
}
async function main() {
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  async function test(name,run) {
    const t=await setup(browser);
    try{await run(t.page);assert.deepEqual(t.errors,[]);passed++;console.log('✓ '+name);}catch(e){failed++;console.error('✗ '+name+'\n'+e.stack);}finally{await t.context.close();}
  }
  await test('新生無怪；7音三種、13音五種不同造型與HP；風之旅行五種',async page=>{
    assert.equal(await page.evaluate(()=>World.entities.filter(e=>e.kind==='mob').length),0);
    for(const [count,kinds] of [[7,3],[13,5]]){
      const mobs=await page.evaluate(count=>{
        const sounds=Novice.CHAPTERS.flatMap(c=>c.sounds).slice(0,count);Object.assign(RPG.data.nv,{n01:true,field:true,taught:sounds,passed:sounds});RPG.travel('kk');
        return World.entities.filter(e=>e.kind==='mob').map(e=>({shape:e.look.shape,hp:e.maxHp,name:e.name}));
      },count);
      assert.equal(new Set(mobs.map(m=>m.shape)).size,kinds);assert.equal(new Set(mobs.map(m=>m.hp)).size,kinds);assert.equal(new Set(mobs.map(m=>m.name)).size,kinds);
    }
    const wind=await page.evaluate(()=>{RPG.data.kk.done=true;RPG.travel('wind');return World.entities.filter(e=>e.kind==='mob').map(e=>({shape:e.look.shape,hp:e.maxHp}));});
    assert.equal(new Set(wind.map(m=>m.shape)).size,5);assert.equal(new Set(wind.map(m=>m.hp)).size,5);
    assert(wind.some(m=>m.shape==='wisp'));assert(wind.some(m=>m.shape==='beetle'));
  });
  await test('guardian預設三階段依實際答題血線切換，限時逐漸縮短',async page=>{
    await start(page);const phases=new Map();
    for(let i=0;i<18;i++){
      const s=await page.evaluate(()=>({state:Battle.state,phase:Number(document.getElementById('battle').dataset.phase)}));
      phases.set(s.phase,Math.max(phases.get(s.phase)||0,s.state.left));
      const ratio=s.state.hp/s.state.maxHp;
      assert.equal(s.phase,ratio>.66?0:ratio>.30?1:2);
      if(s.phase===2)break;
      await pick(page,true);await next(page);
    }
    assert.deepEqual([...phases.keys()],[0,1,2]);assert(phases.get(0)>phases.get(1));assert(phases.get(1)>phases.get(2));
    assert.match(await page.locator('.bt-boss-phase').innerText(),/最終階段/);
  });
  await test('boss:true非guardian也啟用階段，句子即使8秒設定仍至少10秒',async page=>{
    await start(page,{shape:'wisp',boss:true,sentence:true});
    assert.equal(await page.locator('#battle').getAttribute('data-boss'),'true');assert((await page.evaluate(()=>Battle.state.left))>=9.9);
    assert.match(await page.locator('.bt-boss-phase').innerText(),/第一階段/);
  });
  await test('聽完才開始；重播和手動暫停均凍結倒數',async page=>{
    await page.evaluate(()=>{
      Math.random=()=>.5;Battle.pref.practice=false;Battle.pref.relaxed=false;
      Battle.start({look:{name:'聽音守衛',shape:'guardian',hp:160,atk:4,colors:['#bce6ff','#6c92bc']}},{region:'wind',make:()=>Learn.wordQuestion(null,'listen','boss-listen')});
    });
    await page.waitForSelector('#bt-say');
    assert.equal(await page.evaluate(()=>Battle.state.left),null);
    assert.equal(await page.locator('#bt-act .qz-o button:not([disabled])').count(),0);
    await ready(page);assert((await page.evaluate(()=>__audioEnded))>=1);
    const turn=await page.evaluate(()=>Battle.state.turn);
    await page.locator('#bt-say').tap();const before=await page.evaluate(()=>Battle.state.left);await page.waitForTimeout(170);assert.equal(await page.evaluate(()=>Battle.state.left),before);
    await page.waitForTimeout(350);assert((await page.evaluate(()=>Battle.state.left))<before);assert.equal(await page.evaluate(()=>Battle.state.turn),turn);
    await page.locator('#bt-hold').tap();const frozen=await page.evaluate(()=>Battle.state.left);await page.waitForTimeout(220);assert.equal(await page.evaluate(()=>Battle.state.left),frozen);await page.locator('#bt-ready').tap();
  });
  await test('選項讀音不作答，播放期間凍結倒數',async page=>{
    await start(page);
    const turn=await page.evaluate(()=>Battle.state.turn),hp=await page.evaluate(()=>Battle.hp);
    await page.locator('#bt-act .qz-hear').first().tap();const before=await page.evaluate(()=>Battle.state.left);await page.waitForTimeout(170);
    assert.equal(await page.evaluate(()=>Battle.state.left),before);assert.equal(await page.evaluate(()=>Battle.state.settled),false);assert.equal(await page.evaluate(()=>Battle.state.turn),turn);assert.equal(await page.evaluate(()=>Battle.hp),hp);
    await page.waitForTimeout(350);assert((await page.evaluate(()=>Battle.state.left))<before);
  });
  await test('汲取先預告；答對打斷、答錯扣HP及2MP、護盾全擋',async page=>{
    await start(page,{intents:['drain']});assert.equal(await page.evaluate(()=>Battle.state.intent),'drain');assert.match(await page.locator('.bt-boss-phase').innerText(),/汲取.*2 MP/);
    let before=await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp}));await pick(page,true);
    assert.equal(await page.evaluate(()=>Battle.hp),before.hp);assert.equal(await page.evaluate(()=>Battle.mp),before.mp+2);assert((await page.evaluate(()=>Battle.foe.hp))<before.foe);
    await next(page);before=await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp}));await pick(page,false);
    assert((await page.evaluate(()=>Battle.hp))<before.hp);assert.equal(await page.evaluate(()=>Battle.mp),before.mp-2);assert.equal(await page.evaluate(()=>Battle.foe.hp),before.foe);
    await next(page);await page.locator('[data-help="shield"]').tap();before=await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp}));await pick(page,false);
    assert.deepEqual(await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp})),before);assert.equal(await page.evaluate(()=>Battle.state.guard),0);
  });
  await test('回復先預告；答對打斷、錯答回10%HP、護盾阻擋回血',async page=>{
    await start(page,{hp:160,intents:['mend']});assert.match(await page.locator('.bt-boss-phase').innerText(),/回復準備.*答對打斷/);
    const initial=await page.evaluate(()=>Battle.foe.hp);await pick(page,true);const damaged=await page.evaluate(()=>Battle.foe.hp);assert(damaged<initial);
    await next(page);await pick(page,false);assert.equal(await page.evaluate(()=>Battle.foe.hp),Math.min(160,damaged+16));
    await next(page);await page.locator('[data-help="shield"]').tap();const before=await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp}));await pick(page,false);assert.deepEqual(await page.evaluate(()=>({hp:Battle.hp,mp:Battle.mp,foe:Battle.foe.hp})),before);
  });
  await test('蓄力與護盾意圖可預見；蓄力錯答重擊，怪盾先破再受傷',async page=>{
    await start(page,{intents:['charge','guard']});assert.equal(await page.evaluate(()=>Battle.foe.shield),true);assert.match(await page.locator('.bt-boss-phase').innerText(),/防禦中/);
    const initial=await page.evaluate(()=>Battle.foe.hp);await pick(page,true);assert.equal(await page.evaluate(()=>Battle.foe.hp),initial);assert.equal(await page.evaluate(()=>Battle.foe.shield),false);
    await next(page);assert.match(await page.locator('.bt-boss-phase').innerText(),/蓄力衝刺/);const hp=await page.evaluate(()=>Battle.hp);await pick(page,false);assert.equal(hp-await page.evaluate(()=>Battle.hp),11);
  });
  await test('390px深淺模式Boss預告清楚，文字對比至少4.5:1',async page=>{
    await start(page,{hp:160});
    for(let i=0;i<12&&Number(await page.locator('#battle').getAttribute('data-phase'))!==2;i++){await pick(page,true);await next(page);}
    for(const colorScheme of ['light','dark']){
      await page.emulateMedia({colorScheme});
      const metrics=await page.evaluate(()=>{
        const b=document.querySelector('.bt-boss-phase'),lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
        const bg=lum(getComputedStyle(b).backgroundColor),ratio=n=>{const fg=lum(getComputedStyle(n).color);return(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05);};
        return{width:document.getElementById('battle').getBoundingClientRect().width,ratios:[ratio(b.querySelector('b')),ratio(b.querySelector('small'))]};
      });assert(metrics.width<=390);assert(metrics.ratios.every(r=>r>=4.5));
    }
  });
  console.log(`${passed} boss-tactics contracts passed; ${failed} failed`);if(failed)process.exitCode=1;
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
