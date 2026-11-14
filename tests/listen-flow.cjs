const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/tmp/fix-tests', findings=[];fs.mkdirSync(OUT,{recursive:true});
const assert=require('node:assert/strict');
// Audio is controlled deliberately; microphone behaviour is not tested here.
const browserErrors=[];
const log=(id,data)=>{
 if(id==='audio-before-ended'){assert.equal(data.result.optionsVisible,false);assert.equal(data.result.timer,null);assert(!data.result.prompt.includes(data.result.target));assert(!data.result.label.includes(data.result.target));}
 if(id==='replay-timer')assert.equal(data.timerContinues,false);
 if(id.startsWith('feedback-'))assert(!data.result.feedback.includes('['),'no complete KK answer before assistance');
 if(id==='hide-after-success')assert.equal(data.backgroundTimerRuns,false);
 if(id==='unit-fails-open'){assert(!data.result.unitComplete);assert.equal(data.result.correctDelta,0);}
 findings.push({id,...data});console.log('PASS',id);
};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
async function pageFor(colorScheme='light',view={width:390,height:760}){
 const ctx=await browser.newContext({viewport:view,colorScheme});const p=await ctx.newPage();
 p.on('pageerror',e=>browserErrors.push(e.message));
 await p.addInitScript(()=>{
  window.__autoAudio=true;window.__audioCalls=[];
  HTMLMediaElement.prototype.play=function(){__audioCalls.push({src:this.src,t:Date.now()});if(__autoAudio)setTimeout(()=>this.dispatchEvent(new Event('ended')),15);return Promise.resolve()};
  HTMLMediaElement.prototype.pause=function(){};
  if(window.speechSynthesis){speechSynthesis.speak=u=>{window.__lastU=u;if(__autoAudio)setTimeout(()=>u.onend&&u.onend(),15)};speechSynthesis.cancel=()=>{}}
 });
 await p.goto(process.env.TEST_URL||'http://127.0.0.1:8000');await p.waitForSelector('.world-canvas');return p;
}
async function start(p,type='find'){
 await p.evaluate(type=>{Battle.start({look:{name:'Audit bubble',shape:'bubble',colors:['#ff9fd0','#ffffff'],lv:2,hp:120,atk:3}},{region:'kk',make:()=>Learn.unitQuestion(Learn.UNITS[2],type)})},type);
 await p.waitForSelector('.qz-o button',{state:'attached'});
}
async function ready(p){await p.waitForFunction(()=>Battle.ready)}
async function flee(p){if(await p.locator('#bt-ready').isVisible())await p.locator('#bt-ready').click();await p.locator('#bt-run').click();}
// A. Audio-first and answer visibility
let p=await pageFor();
await p.evaluate(()=>__autoAudio=false);await start(p,'which');await p.waitForTimeout(300);
log('audio-before-ended',{result:await p.evaluate(()=>({prompt:document.querySelector('.qz-p').textContent,target:Learn.last.item.w,label:document.querySelector('#bt-say').textContent,optionsVisible:[...document.querySelectorAll('.qz-o button')].every(e=>e.getBoundingClientRect().height>0),enabled:[...document.querySelectorAll('.qz-o button')].some(e=>!e.disabled),timer:Battle.state.left}))});
await p.screenshot({path:OUT+'/audio-before-ended.png'});
await flee(p);await p.evaluate(()=>__autoAudio=true);
// B. Replay costs time
await start(p,'which');await ready(p);await p.evaluate(()=>__autoAudio=false);
const before=await p.evaluate(()=>Battle.state.left);await p.locator('#bt-say').click();await p.waitForTimeout(650);const after=await p.evaluate(()=>Battle.state.left);
log('replay-timer',{before,after,timerContinues:after<before-.3});await flee(p);
// C. Wrong answer exposes full answer; visible content not replayable
for(const scheme of ['light','dark']){
 const cp=await pageFor(scheme);await start(cp);await ready(cp);
 const wrong=await cp.evaluate(()=>Learn.last.options.findIndex(o=>!o.ok));await cp.locator('.qz-o button').nth(wrong).click();
 log('feedback-'+scheme,{result:await cp.evaluate(()=>({feedback:document.querySelector('.qz-f').textContent,styles:[...document.querySelectorAll('.qz-o button')].map(e=>({text:e.textContent,disabled:e.disabled,bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,opacity:getComputedStyle(e).opacity})),sentenceReplayControls:document.querySelectorAll('.qz-f button,.qz-f [data-say]').length,rootScheme:getComputedStyle(document.documentElement).colorScheme}))});
 await cp.screenshot({path:OUT+'/feedback-'+scheme+'.png'});await cp.context().close();
}
// D. Hide during success animation: subsequent countdown must not start in background
await p.evaluate(()=>__autoAudio=true);await start(p,'find');await ready(p);
await p.locator('.qz-o button').nth(await p.evaluate(()=>Learn.last.options.findIndex(o=>o.ok))).click();
await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
await p.waitForTimeout(1250);const hiddenFirst=await p.evaluate(()=>Battle.state);await p.waitForTimeout(500);const hiddenLater=await p.evaluate(()=>Battle.state);
log('hide-after-success',{first:hiddenFirst,later:hiddenLater,backgroundTimerRuns:hiddenLater?.left<hiddenFirst?.left});
await p.evaluate(()=>delete document.hidden);await flee(p);
// E. Eight failed questions still mark a unit complete (public UI, no source patch)
await p.context().close();p=await pageFor();await p.evaluate(()=>localStorage.setItem('pm-rpg-v1',JSON.stringify({version:1,at:'kk',kk:{vowel:true,consonant:true,units:{s1:true}}})));await p.reload();await p.waitForSelector('.world-canvas');const correct0=await p.evaluate(()=>P.correct);
await p.locator('#act-talk').click();await p.waitForSelector('#dlg:not([hidden])',{timeout:30000});
let missClicks=0,steps=0;
for(;steps<180;steps++){
 if(await p.evaluate(()=>!!RPG.data.kk.units.s2))break;
 const bs=p.locator('#dlg-body .qz-o button:not([disabled])');
 if(await bs.count()){
  const i=await p.evaluate(()=>Learn.last.options.findIndex((o,i)=>!o.ok&&!document.querySelectorAll('#dlg-body .qz-o button')[i].disabled));
  if(i>=0){await p.locator('#dlg-body .qz-o button').nth(i).click();missClicks++;continue;}
 }
 const next=p.locator('#dlg-body .qz-next, #dlg-body .dlg-next');
 if(await next.count()){await next.first().click();continue;}
 await p.waitForTimeout(20);
}
log('unit-fails-open',{steps,missClicks,result:await p.evaluate(n=>({unitComplete:RPG.data.kk.units.s2,correctDelta:P.correct-n,kkSoundCount:Object.keys(Learn.SOUNDS).length}),correct0)});
await p.screenshot({path:OUT+'/failed-unit-complete.png'});await p.context().close();
assert.deepEqual(browserErrors,[]);fs.writeFileSync(OUT+'/fix-findings.json',JSON.stringify(findings,null,2));await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
