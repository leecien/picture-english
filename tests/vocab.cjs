// Synthetic reviewed fixtures exercise scale and mechanics; none are saved as teaching content.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Vocab=require('../vocab.js');
let checks=0;
function test(name,fn){fn();checks++;console.log('✓ '+name);}
const code=n=>{let s='';do{s=String.fromCharCode(97+n%26)+s;n=Math.floor(n/26);}while(n);return s.padStart(3,'a');};
const topics=['core','home','food','travel','work','school','health','nature','social','technology','arts'];
function fixture(n){return{schemaVersion:1,words:Array.from({length:n},(_,i)=>{const word='lex'+code(i);return{id:'word:'+word,word,zh:'測試詞義 '+i,pos:'n.',topic:topics[i%topics.length],learningBand:i%4+1,reviewStatus:'reviewed',reviewer:'synthetic-test-fixture',source:'test-only; never shipped as vocabulary',kk:null,audio:'',image:'',example:{en:'I use '+word+' every day.',zh:'我每天使用這項物品。'}};})};}
async function main(){
 const pack=fixture(3000);
 test('3000筆可玩fixture、lookup與舊卡冊分類相容，不虛構音標/資產',()=>{
  const r=Vocab.setData(pack);assert.equal(r.accepted,3000);assert.equal(Vocab.count,3000);assert.equal(Vocab.lookup('LEXAAA!').w,'lexaaa');assert.equal(Vocab.lookup('lexaaa').kk,null);assert.equal(Vocab.lookup('lexaaa').au,'');assert.equal(Vocab.words[3].topic,'travel');assert.equal(Vocab.words[3].th,'transport');assert.equal(Vocab.words[7].th,'nature');const copy=Vocab.words;copy.pop();assert.equal(Vocab.count,3000);
 });
 test('去重、draft/缺審核來源/缺欄位/錯誤分組不計入可玩數',()=>{
  const a=fixture(1).words[0];const invalid=[{...a,id:'word:draft',word:'draft',reviewStatus:'draft'},{...a,id:'word:missing',word:'missing',reviewer:''},{...a,id:'word:topic',word:'topic',topic:'unknown'},{...a,id:'word:level',word:'level',learningBand:0},{...a,id:'word:nosource',word:'nosource',source:''},{...a,id:'word:noaudio',word:'noaudio',audio:undefined},{...a,id:'word:nopos',word:'nopos',pos:''},{...a,id:'word:nokk',word:'nokk',kk:undefined}];delete invalid.at(-1).kk;
  const r=Vocab.setData({schemaVersion:1,words:[a,{...a,word:a.word.toUpperCase()},...invalid]});assert.equal(r.accepted,1);assert.equal(r.duplicates,1);assert.equal(r.rejected,invalid.length);
 });
 test('原80可無詞性/例句；偽造legacy字或更改原義不能灌數',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/words.json'),'utf8')).map(w=>({...w,reviewStatus:'legacy-verified'}));
  const r=Vocab.setData({schemaVersion:1,words:[...raw,{...raw[0],word:'inventedlegacy'},{...raw[0],word:'apple',zh:'不相符'}]});assert.equal(r.accepted,80);assert.equal(r.rejected,2);assert.equal(Vocab.lookup('cat').th,'animal');assert.equal(Vocab.lookup('cat').topic,'nature');assert.equal(Vocab.lookup('cat').pos,'');assert.equal(Vocab.lookup('cat').example,null);
 });
 test('壞格式不覆蓋現有80；不執行source，阻擋可執行資產URL',()=>{
  assert(Vocab.setData({schemaVersion:2,words:[]}).error);assert.equal(Vocab.count,80);
  const p=fixture(1);p.words[0].source='<script>globalThis.vocabExploit=true</script>';p.words[0].audio='javascript:alert(1)';p.words[0].image='data:image/svg+xml,bad';Vocab.setData(p);assert.equal(Vocab.words[0].au,'');assert.equal(Vocab.words[0].img,'');assert.equal(globalThis.vocabExploit,undefined);
 });
 const originalFetch=global.fetch;global.fetch=async()=>({ok:false,status:404});const failed=await Vocab.load();assert(failed.error&&failed.retained);assert.equal(Vocab.count,1);global.fetch=originalFetch;checks++;console.log('✓ 缺詞庫檔案保留既有可玩資料');
 const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/__vocab_test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="entry">入口</button></body></html>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:8137')+'/__vocab_test');
  await page.addStyleTag({path:path.join(__dirname,'../vocab.css')});await page.addScriptTag({path:path.join(__dirname,'../vocab.js')});
  await page.evaluate(pack=>{
    window.__audio={calls:[],pending:null,stops:0};window.__answers=[];window.__words=[];window.__closed=0;
    window.AudioBus={play:opt=>{__audio.calls.push(opt);return new Promise(resolve=>__audio.pending=resolve);},stop:()=>{__audio.stops++;if(__audio.pending){const done=__audio.pending;__audio.pending=null;done({status:'cancelled'});}}};
    window.finishAudio=()=>{const done=__audio.pending;__audio.pending=null;if(done)done({status:'ended'});};
    window.openVocab=()=>Vocab.open({onClose:()=>__closed++,onAnswer:r=>__answers.push(r),onWord:w=>__words.push(w),getProgress:w=>({learned:w==='lexaaa',correct:w==='lexaaa'?2:0,wrong:0})});
    localStorage.setItem('pm-progress','{"xp":42}');localStorage.setItem('other-app','keep');Vocab.setData(pack);openVocab();
  },pack);
  const settle=()=>page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
  async function check(name,fn){await fn();checks++;console.log('✓ '+name);}
  await check('3000詞只渲染20列、分頁不重複；搜尋/主題/程度/進度篩選',async()=>{
    assert.equal(await page.locator('.vc-row').count(),20);assert.match(await page.locator('#vc-total').innerText(),/3000 \/ 3000/);
    const first=await page.locator('.vc-row-word').allTextContents();await page.locator('.vc-pages button').last().click();const second=await page.locator('.vc-row-word').allTextContents();assert(first.every(w=>!second.includes(w)));assert((await page.locator('#vocab *').count())<220);
    await page.locator('#vc-search').fill('lexaaa');assert.equal(await page.locator('.vc-row').count(),1);
    await page.locator('#vc-search').fill('');await page.locator('#vc-topic').selectOption('food');await page.locator('#vc-band').selectOption('2');const shown=await page.locator('.vc-row-word').allTextContents();assert(shown.length);assert(await page.evaluate(shown=>shown.every(w=>Vocab.lookup(w).topic==='food'&&Vocab.lookup(w).lv===2),shown));
    await page.locator('#vc-topic').selectOption('');await page.locator('#vc-band').selectOption('');await page.locator('#vc-progress').selectOption('learned');assert.equal(await page.locator('.vc-row').count(),1);assert.equal(await page.locator('.vc-row-word').innerText(),'lexaaa');await page.locator('#vc-progress').selectOption('');
  });
  await check('單字可點發音與查資料、例句可播放；不冒充有KK或錄音',async()=>{
    await page.locator('.vc-row-word').first().click();assert.match(await page.locator('#vc-content').innerText(),/未提供經核對的 KK/);assert.match(await page.locator('#vc-content').innerText(),/裝置整字朗讀/);assert.equal(await page.evaluate(()=>__words.length),1);assert.equal(await page.evaluate(()=>__audio.calls.at(-1).text),'lexaaa');await page.evaluate(()=>finishAudio());await settle();
    await page.getByRole('button',{name:'🔊 聽整句',exact:true}).click();assert.match(await page.evaluate(()=>__audio.calls.at(-1).text),/I use lexaaa/);await page.locator('#vc-home').click();assert.equal(await page.evaluate(()=>__answers.length),0);
  });
  async function beginRound(){await page.getByRole('button',{name:'學習這一輪（最多 10 字）',exact:true}).click();for(let i=0;i<10;i++)await page.getByRole('button',{name:i<9?'下一個單字':'開始本輪練習',exact:true}).click();}
  await beginRound();
  await check('十字課次生成聽音拼字/例句填空；先聽完才解鎖且不洩露英文',async()=>{
    assert(await page.locator('#vc-answer').isDisabled());assert(await page.locator('#vc-submit').isDisabled());await page.locator('#vc-hear').click();const target=await page.evaluate(()=>__audio.calls.at(-1).text);assert(!(await page.locator('#vc-content').innerHTML()).includes(target));assert(await page.locator('#vc-answer').isDisabled());await page.evaluate(()=>finishAudio());await settle();assert(await page.locator('#vc-answer').isEnabled());assert(!(await page.locator('#vc-content').innerHTML()).includes(target));
  });
  let firstTarget=await page.evaluate(()=>__audio.calls.at(-1).text);
  await check('首答只回報一次；答錯重試/重播不刷進度',async()=>{
    await page.locator('#vc-answer').fill('incorrect');await page.locator('#vc-submit').click();assert.equal(await page.evaluate(()=>__answers.length),1);assert.equal(await page.evaluate(()=>__answers[0].correct),false);assert.equal(await page.evaluate(()=>__answers[0].assisted),false);assert.equal(await page.evaluate(()=>__answers[0].firstTry),true);
    await page.locator('#vc-hear').click();await page.evaluate(()=>finishAudio());await settle();await page.locator('#vc-answer').fill(firstTarget);await page.locator('#vc-submit').click();assert.equal(await page.evaluate(()=>__answers.length),1);assert.match(await page.locator('#vc-note').innerText(),/重試不重複計分/);await page.getByRole('button',{name:'下一題',exact:true}).click();
  });
  await check('十題各一次真生成答案；完成報首答9/10，含合法目標例句填空',async()=>{
    for(let i=1;i<10;i++){
      assert(await page.locator('#vc-answer').isDisabled());await page.locator('#vc-hear').click();const target=await page.evaluate(()=>__audio.calls.at(-1).text);assert(!(await page.locator('#vc-content').innerHTML()).includes(target));if(i%2)assert.match(await page.locator('.vc-blank').innerText(),/＿＿＿/);await page.evaluate(()=>finishAudio());await settle();await page.locator('#vc-answer').fill(target.toUpperCase());await page.locator('#vc-submit').click();await page.evaluate(()=>document.getElementById('vc-submit').click());assert.equal(await page.evaluate(()=>__answers.length),i+1);await page.getByRole('button',{name:'下一題',exact:true}).click();
    }
    assert.match(await page.locator('#vc-content').innerText(),/首答答對 9 \/ 10/);assert.equal(await page.evaluate(()=>new Set(__answers.map(r=>r.item.w)).size),10);assert(await page.evaluate(()=>__answers.some(r=>r.mode==='example-spelling')&&__answers.some(r=>r.mode==='listen-spelling')));
  });
  await check('390px深淺字清楚；正確/錯誤提示對比至少4.5:1',async()=>{
    await page.locator('#vc-home').click();await beginRound();await page.locator('#vc-hear').click();await page.evaluate(()=>finishAudio());await settle();await page.locator('#vc-answer').fill('wrong');await page.locator('#vc-submit').click();
    for(const scheme of ['light','dark']){await page.emulateMedia({colorScheme:scheme});const m=await page.evaluate(()=>{const n=document.querySelector('.vc-result'),s=getComputedStyle(n),lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;},a=lum(s.color),b=lum(s.backgroundColor);return{width:document.getElementById('vocab').scrollWidth,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});assert(m.width<=390);assert(m.ratio>=4.5);}
  });
  await check('離開/背景停音，存檔不變；不含目標的例句不生成例句題',async()=>{
    await page.locator('#vc-hear').click();const before=await page.evaluate(()=>__audio.stops);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await settle();assert((await page.evaluate(()=>__audio.stops))>before);assert.equal(await page.evaluate(()=>__audio.pending),null);await page.evaluate(()=>delete document.hidden);await page.locator('#vc-close').click();assert.equal(await page.evaluate(()=>Vocab.isOpen),false);assert.equal(await page.evaluate(()=>__closed),1);assert.equal(await page.evaluate(()=>localStorage.getItem('pm-progress')),'{"xp":42}');assert.equal(await page.evaluate(()=>localStorage.getItem('other-app')),'keep');
    const small=fixture(2);small.words.forEach(w=>w.example.en='We inspect a different item.');await page.evaluate(p=>{Vocab.setData(p);openVocab();},small);await page.getByRole('button',{name:'學習這一輪（最多 10 字）',exact:true}).click();await page.getByRole('button',{name:'下一個單字',exact:true}).click();await page.getByRole('button',{name:'開始本輪練習',exact:true}).click();
    for(let i=0;i<2;i++){assert.equal(await page.locator('.vc-blank').count(),0);await page.locator('#vc-hear').click();const target=await page.evaluate(()=>__audio.calls.at(-1).text);await page.evaluate(()=>finishAudio());await settle();await page.locator('#vc-answer').fill(target);await page.locator('#vc-submit').click();await page.getByRole('button',{name:'下一題',exact:true}).click();}
    assert.deepEqual(errors,[]);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Vocab.isOpen),false);
  });
 }finally{await browser.close();}
 console.log(checks+' vocabulary contracts passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
