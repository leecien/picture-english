// Real scene questions, navigable maps, sequential quests and one-time rewards. No browser required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../world-regions.js');
const root = path.resolve(__dirname,'..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const source = read('data/scenes.json');
assert.deepEqual(R.catalog,read('data/world-regions.json'),'embedded defaults match source catalog');
assert.deepEqual(R.validate(R.catalog,source),[]);
assert.equal(R.maps.length,4);
assert.deepEqual(R.maps.map((m)=>m.id),['water','light','metal','star']);
const damaged = R.catalog;
damaged.regions[0].quests[0].questionRefs[0].scene = 'absent-scene';
assert(R.validate(damaged,source).some((s)=>s.includes('missing scene')),'broken source is rejected instead of falling back to random words');

// Match the renderer's collision rules: residents are approached from an adjacent walkable tile.
for (const m of R.maps) {
 const width = m.layout[0].length, blocked = new Set('THR~BF');
 const marker = new Set(m.npcs.map((n)=>n.ch));
 const positions = (ch) => m.layout.flatMap((row,y)=>[...row].flatMap((tile,x)=>tile===ch?[{x,y}]:[]));
 const spawn = positions('P')[0];
 const key = (x,y)=>`${x},${y}`;
 const walk = (x,y)=>y>=0&&y<m.layout.length&&x>=0&&x<width&&!blocked.has(m.layout[y][x])&&!marker.has(m.layout[y][x]);
 const reached = new Set([key(spawn.x,spawn.y)]), queue=[spawn];
 for(let i=0;i<queue.length;i++) {
  const p=queue[i];
  for (const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
   const x=p.x+dx,y=p.y+dy,k=key(x,y);
   if(walk(x,y)&&!reached.has(k)){reached.add(k);queue.push({x,y});}
  }
 }
 for(const n of m.npcs) {
  const p=positions(n.ch)[0];
  assert(p,`${m.id}: ${n.id} exists`);
  assert([[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dy])=>reached.has(key(p.x+dx,p.y+dy))),`${m.id}: ${n.id} can be approached`);
 }
 for(const p of [...positions('@'),...positions('m')]) assert(reached.has(key(p.x,p.y)),`${m.id}: spawn/exit reachable ${JSON.stringify(p)}`);
 const spawns=positions('m').map((p)=>m.mobAt(p));
 assert.equal(new Set(spawns.map((mob)=>mob.shape)).size,5,`${m.id}: five distinct shapes spawn`);
 positions('m').forEach((p,i)=>assert.equal(m.mobAt(p).name,m.mobs[i%5].name,'tile scan order maps to all five mobs'));
 assert.equal(m.mobAt({x:0,y:0}),null,'non-spawn tiles do not invent a monster');
 assert.deepEqual(m.mobs[0].intents,['attack']);
 assert.deepEqual(m.mobs[1].intents,['attack','charge']);
 assert.deepEqual(m.mobs[2].intents,['guard','attack']);
 assert.deepEqual(m.mobs[3].intents,['attack','drain','attack']);
 assert.deepEqual(m.mobs[4].intents,['attack','mend','guard']);
 assert.equal(m.boss.boss,true);
 assert.equal(new Set(spawns.map((mob)=>mob.name)).size,5,`${m.id}: all five monsters actually spawn`);
 assert.equal(new Set(spawns.map((mob)=>mob.hp)).size,5,`${m.id}: different monster HP`);
 assert(m.quests[2].boss.hp > Math.max(...spawns.map((m)=>m.hp)));
}

// Use the real Learn generator: each source ref makes one sentence question with exactly one answer.
Object.assign(global,{
 LS:{get:(k,d)=>d,set:()=>{}},
 esc:String, shuffle:(a)=>a, maxLv:()=>1,
 WORDS:[],SENT:[],
});
const Learn = new Function(fs.readFileSync(path.join(root,'learn.js'),'utf8')+';return Learn')();
Learn.setScenes(source.categories);
let generated=0;
for(const m of R.maps) for(const q of m.quests) for(const ref of q.questionRefs) {
 const actual=Learn.sceneQuestion(ref.cat,ref.scene,ref.index,{mode:ref.mode});
 const item=source.categories.find(c=>c.id===ref.cat).scenes.find(s=>s.id===ref.scene).items[ref.index];
 assert.equal(actual.kind,'s');assert.equal(actual.item.en,item.en);
 assert(actual.prompt.includes(item.zh),'explicit meaning cue resolves ambiguous natural replies');
 assert(actual.options.length>=2);assert.equal(actual.options.filter(o=>o.ok).length,1);
 assert.equal(new Set(actual.options.map(o=>o.html)).size,actual.options.length);
 generated++;
}
assert.equal(generated,60);

let state = R.normalize();
const initial=JSON.stringify(state);
assert.equal(R.has('water'),true);assert.equal(R.has('bogus'),false);
assert.equal(R.start('bogus',state).reason,'unknown-map');
assert.equal(R.start('water',state,'water-3').reason,'quest-locked');
assert.equal(JSON.stringify(state),initial,'API does not mutate caller state');
let attempt=R.start('water',state);state=attempt.state;
assert.equal(R.question('water',state,Learn).item.en,source.categories.find(c=>c.id==='life').scenes.find(s=>s.id==='doctor').items[0].en);
assert.equal(R.complete('water',state).reason,'quiz-incomplete');
assert.equal(R.recordBattle('water',state,{won:true}).reason,'battle-not-required');
let a=R.answer('water',state,{index:1,correct:true});assert.equal(a.reason,'answer-out-of-order');
a=R.answer('water',state,{index:0,correct:true});state=a.state;
assert.equal(R.answer('water',state,{index:0,correct:true}).reason,'answer-out-of-order');
assert.equal(R.start('water',state).resumed,true);assert.equal(R.start('water',state).run.index,1);
for(let i=1;i<5;i++) state=R.answer('water',state,{index:i,correct:true,assisted:true}).state;
const assisted=R.complete('water',state);assert.equal(assisted.reason,'quiz-not-passed');assert.equal(assisted.result.independent,1);
assert.equal(assisted.state.completed.water.length,0);state=assisted.state;
const forged=R.start('water',state).state;forged.runs.water.index=5;forged.runs.water.correct=5;
assert.equal(R.complete('water',forged).reason,'no-active-quest','forged counters without answers rejected');

const rewards=[];
function finishQuiz(id) {
 state=R.start(id,state).state;
 for(let i=state.runs[id].index;i<5;i++) {
  const response=R.answer(id,state,{index:i,correct:i!==4});assert(response.ok);state=response.state;
 }
}
for(const m of R.maps) {
 for(let stage=1;stage<=3;stage++) {
  assert.equal(R.next(m.id,state).id,`${m.id}-${stage}`);
  finishQuiz(m.id);
  if(stage===3) {
   assert.equal(R.complete(m.id,state).reason,'battle-required');
   const lost=R.recordBattle(m.id,state,{won:false});assert(lost.ok);state=lost.state;
   assert.equal(R.start(m.id,state).run.index,5,'losing boss preserves the passed quiz');
   assert.equal(R.complete(m.id,state).reason,'battle-required');
   const won=R.recordBattle(m.id,state,{won:true});assert(won.ok);state=won.state;
   assert.equal(R.status(m.id,state).rewardReady,true);
  }
  const previous=JSON.stringify(state), result=R.complete(m.id,state);assert(result.ok);
  assert.equal(JSON.stringify(state),previous,'complete is pure');
  assert(result.reward && result.reward.xp>0);rewards.push(result.reward);state=result.state;
  state=JSON.parse(JSON.stringify(state));
  const repeat=R.complete(m.id,state);assert(!repeat.ok);assert(!repeat.reward,'serial retry never grants another reward');
 }
 assert.equal(R.status(m.id,state).done,true);assert.equal(R.next(m.id,state),null);
 assert.equal(R.status(m.id,state).seal.id,m.id);
 assert.equal(R.start(m.id,state).reason,'region-complete');
}
assert.equal(new Set(rewards.map(r=>r.id)).size,12);
assert.equal(rewards.reduce((sum,r)=>sum+r.xp,0),4*(24+28+45));
assert.equal(rewards.reduce((sum,r)=>sum+(r.items.berry||0),0),8);
assert.equal(rewards.reduce((sum,r)=>sum+(r.items.dew||0),0),8);
assert.equal(Object.keys(state.seals).length,4);
assert.equal(R.normalize({completed:{water:['water-3']}}).completed.water.length,0,'out-of-order persisted completion cannot skip stages');
assert.equal(R.status('absent',state).unlocked,false);
console.log('world-regions: 4 navigable maps with 5 distinct monsters each, 12 sequential quests, 60 real questions; quiz/boss gates and one-time rewards passed');
