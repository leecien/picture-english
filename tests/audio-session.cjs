/* Deterministic panel contracts use the real external comparison function.
   Capture/ASR transport is controlled here; real MediaRecorder is exercised by
   modules/audio-practice/tests/audio-practice.test.cjs separately. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8137';
let passed = 0;
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/__audio_session_test', route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="entry">Open</button></body></html>'}));
    await page.goto(base + '/__audio_session_test');
    await page.addScriptTag({ path: path.join(__dirname, '../modules/audio-practice/audio-practice.js') });
    await page.evaluate(() => {
      const compare = AudioPractice.compare;
      window.testAudio = { calls: [], listening: null, recording: false, recognize: true, allowRecord: true, playStatus: 'ended', nextError: null, created: [], revoked: [], result: [], closed: 0, original: {id:'customs-1',en:'I am here for sightseeing.',zh:'我是來觀光的。',kind:'sentence'} };
      const t = testAudio, create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = b => { const u = create(b); t.created.push(u); return u; };
      URL.revokeObjectURL = u => { t.revoked.push(u); revoke(u); };
      window.AudioPractice = {
        capabilities: () => ({ recording:t.allowRecord, recognition:t.recognize?'browser':'none' }), compare,
        reset: () => t.calls.push('reset'),
        play: async opt => { t.calls.push(['play', opt]); return {status:t.playStatus}; },
        stop: () => t.calls.push('stop'),
        listen: opt => { t.calls.push(['listen',opt.record]); t.options = opt; return new Promise(resolve => {t.listening=resolve;}); },
        stopListen: () => t.calls.push('stopListen'),
        cancelListen: () => { t.calls.push('cancelListen'); if(t.listening){ const r=t.listening;t.listening=null;r({ok:false,error:'cancelled',message:'已取消'}); } },
        startRecording: async () => { t.calls.push('startRecording'); t.recording=true;return t.nextError||{ok:true}; },
        stopRecording: async () => { t.calls.push('stopRecording'); const captured=t.recording;t.recording=false;return captured?{ok:true,blob:new Blob(['test-audio'],{type:'audio/webm'}),durationMs:1200,playbackGainDb:6,levelMeasured:false}:{ok:false,error:'not-recording'}; },
        clearRecording: () => t.calls.push('clearRecording'),
        destroy: () => t.calls.push('DESTROY'),
      };
      window.AudioBus = {play: async opt => {t.calls.push(['bus',opt]);return {status:t.playStatus};}};
      window.openTestSession = () => AudioSession.open({items:[t.original],label:'海關練習',onClose:()=>t.closed++,onResult:r=>t.result.push(r)});
      localStorage.setItem('pm-progress','{"xp":123}');
      localStorage.setItem('other-app','private');
    });
    await page.addStyleTag({ path: path.join(__dirname, '../audio-session.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../audio-session.js') });
    const settle = () => page.evaluate(() => new Promise(resolve=>setTimeout(resolve,0)));
    const open = async () => { await page.evaluate(()=>openTestSession()); await settle(); };
    const demo = async () => { await page.locator('#as-demo').click(); await settle(); };
    const answer = async (text='I am here for sightseeing.', conf=.95, error=null, recording=false, extra={}) => {
      await page.locator('#as-start').click();
      await page.evaluate(({text,conf,error,recording,extra})=>{const r=testAudio.listening;testAudio.listening=null;r(error?{ok:false,error,message:'麥克風權限未開啟'}:{ok:true,alts:[text],conf,recording:recording?{ok:true,blob:new Blob(['recording'])}:undefined,...extra});},{text,conf,error,recording,extra});
      await settle();
    };
    async function test(name, fn) { await fn();passed++;console.log('✓ '+name); }
    await test('示範播完才能跟讀；示範使用中央 AudioBus', async()=>{
      await open();assert(await page.locator('#as-start').isDisabled());
      await page.evaluate(()=>testAudio.playStatus='error');await demo();assert(await page.locator('#as-start').isDisabled());
      await page.evaluate(()=>testAudio.playStatus='ended');await demo();assert(await page.locator('#as-start').isEnabled());
      assert(await page.evaluate(()=>testAudio.calls.some(c=>Array.isArray(c)&&c[0]==='bus')));
    });
    await test('跟讀逐字回饋、只有吻合才解鎖自己念；跟讀不回報通關', async()=>{
      await answer('I am sightseeing.');assert(await page.locator('.aus-token-missing').count()>0);assert(await page.locator('#as-independent').isHidden());
      await answer('I am here for sightseeing.',.1);assert(await page.locator('.aus-token-unsure').count()>0);assert(await page.locator('#as-independent').isHidden());
      await answer();assert(await page.locator('#as-independent').isVisible());assert.equal(await page.evaluate(()=>testAudio.result.length),0);
    });
    await test('自己念前不顯示英文答案；獨立念吻合才回報原始題目一次', async()=>{
      await page.locator('#as-independent').click();await settle();
      assert.equal(await page.locator('#as-english').textContent(),'');assert.equal(await page.locator('#as-feedback').textContent(),'');assert(await page.locator('#as-demo').isHidden());
      await answer();assert.equal(await page.evaluate(()=>testAudio.result.length),1);
      assert(await page.evaluate(()=>testAudio.result[0].item===testAudio.original&&testAudio.result[0].status==='match'&&testAudio.result[0].independentPassed));
      await answer();assert.equal(await page.evaluate(()=>testAudio.result.length),1);
      await page.locator('#as-next').click();await settle();assert.match(await page.locator('#as-chinese').textContent(),/1 \/ 1/);
    });
    await test('聆聽與略過都不計完成，也不啟動收音', async()=>{
      await open();const before=await page.evaluate(()=>testAudio.calls.filter(c=>Array.isArray(c)&&c[0]==='listen').length);
      await page.locator('#as-listen-only').check();await settle();await demo();await page.locator('#as-next').click();await settle();
      assert.match(await page.locator('#as-chinese').textContent(),/0 \/ 1/);assert.equal(await page.evaluate(()=>testAudio.calls.filter(c=>Array.isArray(c)&&c[0]==='listen').length),before);
      await open();await page.locator('#as-skip').click();await settle();assert.match(await page.locator('#as-chinese').textContent(),/0 \/ 1/);
    });
    await test('權限拒絕與無辨識回應是中性，不假裝評分', async()=>{
      await open();await demo();await answer('',.95,'permission-denied');assert.match(await page.locator('#as-message').textContent(),/不計分/);assert(await page.locator('#as-independent').isHidden());
      await page.evaluate(()=>testAudio.recognize=false);await open();await demo();assert.match(await page.locator('#as-capability').textContent(),/沒有語音辨識/);
      await answer('',.95,'unsupported-recognition');assert(await page.locator('#as-independent').isHidden());await page.evaluate(()=>testAudio.recognize=true);
    });
    await test('r2 auto 收音與跳過/衝突提示；失敗靜音錄音不提供回放', async()=>{
      await open();await demo();await answer(undefined,.95,null,true);assert(await page.locator('#as-replay').isVisible());
      assert(await page.evaluate(()=>testAudio.calls.some(c=>Array.isArray(c)&&c[0]==='listen'&&c[1]==='auto')));
      await answer(undefined,.95,null,false,{recordSkipped:true});assert.match(await page.locator('#as-message').textContent(),/本次未保留錄音/);assert(await page.locator('#as-replay').isHidden());
      await answer(undefined,.95,null,true,{recordConflict:true,recording:{ok:false,error:'no-sound',silent:true}});assert.match(await page.locator('#as-message').textContent(),/本次未保留錄音/);assert(await page.locator('#as-replay').isHidden());
      await page.locator('#as-record-copy').uncheck();await answer();assert.equal(await page.evaluate(()=>testAudio.calls.filter(c=>Array.isArray(c)&&c[0]==='listen').at(-1)[1]),false);
    });
    await test('只錄音可回放、不評分；重錄與離開釋放 blob URL 且保留共享引擎', async()=>{
      await open();await demo();await page.locator('#as-record-only').click();await settle();await page.locator('#as-stop').click();await settle();
      assert(await page.locator('#as-replay').isVisible());assert.match(await page.locator('#as-message').textContent(),/不計分/);assert.match(await page.locator('#as-message').textContent(),/無法確認音量/);assert.doesNotMatch(await page.locator('#as-message').textContent(),/沒聲音/);
      await page.locator('#as-replay').click();await settle();assert(await page.evaluate(()=>testAudio.calls.some(c=>Array.isArray(c)&&c[0]==='play'&&c[1].url.startsWith('blob:')&&c[1].fallbackTts===false&&c[1].gainDb===6&&c[1].durationMs===1200)));
      await page.locator('#as-replay-gain').uncheck();await page.locator('#as-replay').click();await settle();assert.equal(await page.evaluate(()=>testAudio.calls.filter(c=>Array.isArray(c)&&c[0]==='play').at(-1)[1].gainDb),0);
      const url=await page.evaluate(()=>testAudio.created.at(-1));await page.locator('#as-record-only').click();await settle();assert(await page.evaluate(u=>testAudio.revoked.includes(u),url));
      await page.locator('#as-stop').click();await settle();const second=await page.evaluate(()=>testAudio.created.at(-1));
      await page.locator('#as-close').click();await settle();assert(await page.evaluate(u=>testAudio.revoked.includes(u),second));assert.equal(await page.evaluate(()=>AudioSession.isOpen),false);assert.equal(await page.evaluate(()=>testAudio.calls.includes('DESTROY')),false);
    });
    await test('等待收音可取消；切背景立即停止並要求手動繼續', async()=>{
      await open();await demo();await page.locator('#as-start').click();await page.locator('#as-cancel').click();await settle();assert(await page.locator('#as-start').isEnabled());
      await page.locator('#as-start').click();await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await settle();
      assert(await page.locator('#as-paused').isVisible());assert(await page.locator('#as-start').isDisabled());
      await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});await settle();assert(await page.locator('#as-start').isDisabled());
      await page.locator('#as-resume').click();assert(await page.locator('#as-start').isEnabled());
    });
    await test('390px 深淺模式不橫向溢出；逐字提示對比至少 4.5:1', async()=>{
      await open();await demo();await answer('I am there for visiting.');
      for(const colorScheme of ['light','dark']){
        await page.emulateMedia({colorScheme});
        const metrics=await page.evaluate(()=>{
          const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
          const contrast=[...document.querySelectorAll('.aus-token')].map(n=>{const s=getComputedStyle(n),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
          return{width:document.getElementById('audio-session').scrollWidth,contrast};
        });assert(metrics.width<=390);assert(metrics.contrast.length);assert(metrics.contrast.every(c=>c>=4.5));
      }
    });
    await test('空題目安全；不更改存檔、不插入原始 HTML', async()=>{
      await page.evaluate(()=>AudioSession.open({items:[]}));await settle();assert.match(await page.locator('#as-message').textContent(),/沒有/);
      await page.evaluate(()=>AudioSession.open({items:[{en:'<img src=x onerror=alert(1)>',zh:'測試'}]}));assert.equal(await page.locator('#as-english img').count(),0);
      assert.equal(await page.evaluate(()=>localStorage.getItem('pm-progress')),'{"xp":123}');assert.equal(await page.evaluate(()=>localStorage.getItem('other-app')),'private');
      await page.keyboard.press('Escape');await settle();assert.equal(await page.evaluate(()=>AudioSession.isOpen),false);assert.deepEqual(errors,[]);
    });
    console.log(`${passed} audio-session contracts passed`);
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
