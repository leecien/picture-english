// Ownership matters here: a sound ending must not release a word-card hold,
// and missing/new clips must still use the original URL, not guessed assets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = [], calls = [];
let notify, stopped = 0;
const AudioPractice = {
  onBusy(cb) { notify=cb; cb(false); },
  play(o) { calls.push(o); notify(true); return Promise.resolve({status:'ended'}); },
  stop() { stopped++; notify(false); }, cancelListen() {},
  startRecording() {}, stopRecording() { return Promise.resolve({ok:true}); },
};
const DP = {balanced:true};
const sandbox = {AudioPractice,DP,URL,Set,Promise,document:{baseURI:'https://leecien.github.io/picture-english/index.html'},
 window:{dispatchEvent:e=>events.push(e.detail)},CustomEvent:class {constructor(name,o){this.type=name;this.detail=o.detail;}},
 fetch:async()=>({ok:true,json:async()=>({files:[{file:'words/cat.mp3'}]})}),saveDP() {}};
const bus=vm.runInNewContext(fs.readFileSync('audio-bus.js','utf8')+'\nAudioBus',sandbox);
(async()=>{
 await bus.init(); assert.equal(bus.normalizedCount,1);
 assert.equal(bus.source('assets/voice/words/cat.mp3'),'https://leecien.github.io/picture-english/modules/audio-practice/processed-audio/words/cat.mp3');
 for(const file of ['assets/voice/words/new-word.mp3','https://other.test/assets/voice/words/cat.mp3','assets/voice/words/cat.mp3?private=1','blob:my-recording']) assert.equal(bus.source(file),file);
 bus.setBalanced(false);assert.equal(bus.source('assets/voice/words/cat.mp3'),'assets/voice/words/cat.mp3');
 bus.setBalanced(true);await bus.play({text:'cat',url:'assets/voice/words/cat.mp3',rate:.6});assert.equal(calls.at(-1).rate,.6);
 bus.setHold('word-card',true);notify(false);assert.equal(bus.busy,true);assert.equal(events.at(-1),true);
 notify(true);bus.setHold('word-card',false);assert.equal(bus.busy,true);assert.equal(events.at(-1),true);
 notify(false);assert.equal(bus.busy,false);assert.equal(events.at(-1),false);
 await bus.stopAll();assert.equal(stopped,1);
 console.log('PASS: provider and word-card holds are combined; known balanced sources only; original/new/external clips preserved; rate, cancellation and preference routing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
