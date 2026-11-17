/* Reviewed vocabulary only. This component never writes game storage or grades
   a word twice: the host owns cards, achievements, XP and save compatibility. */
(function(root,factory){const v=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=v;else root.Vocab=v;})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const TOPICS={core:'基本用語',home:'居家生活',food:'飲食',travel:'旅行',work:'工作',school:'學習',health:'健康',nature:'自然',social:'人際互動',technology:'科技',arts:'藝文'};
  const BANDS=['','基礎','生活','進階','延伸'];
  const LEGACY={"apple":"蘋果","banana":"香蕉","grape":"葡萄","lemon":"檸檬","cake":"蛋糕","bread":"麵包","egg":"蛋","milk":"牛奶","cheese":"起司","cat":"貓","dog":"狗","fish":"魚","bird":"鳥","rabbit":"兔子","horse":"馬","tiger":"老虎","frog":"青蛙","elephant":"大象","sun":"太陽","moon":"月亮","star":"星星","rain":"雨","tree":"樹","flower":"花","volcano":"火山","mountain":"山","car":"汽車","bus":"公車","bike":"腳踏車","ambulance":"救護車","bridge":"橋","map":"地圖","suitcase":"行李箱","house":"房子","book":"書","clock":"時鐘","key":"鑰匙","shoe":"鞋子","hat":"帽子","phone":"手機","ball":"球","umbrella":"雨傘","chair":"椅子","gift":"禮物","headphones":"耳機","hospital":"醫院","bank":"銀行","doctor":"醫生","cucumber":"小黃瓜","pineapple":"鳳梨","mushroom":"蘑菇","dolphin":"海豚","octopus":"章魚","squirrel":"松鼠","rainbow":"彩虹","desert":"沙漠","thermometer":"溫度計","passport":"護照","compass":"指南針","helicopter":"直升機","receipt":"收據","envelope":"信封","battery":"電池","ladder":"梯子","avocado":"酪梨","broccoli":"花椰菜","garlic":"大蒜","hedgehog":"刺蝟","flamingo":"紅鶴","peacock":"孔雀","tornado":"龍捲風","comet":"彗星","satellite":"人造衛星","anchor":"船錨","tractor":"拖拉機","microscope":"顯微鏡","telescope":"望遠鏡","stethoscope":"聽診器","magnet":"磁鐵","hourglass":"沙漏"};
  const oldTopics={animal:'nature',nature:'nature',transport:'travel',things:'home',food:'food'};
  const oldTheme={core:'things',home:'things',work:'things',school:'things',technology:'things',arts:'things',social:'things',travel:'transport',health:'nature',nature:'nature',food:'food'};
  let bank=[],index=new Map(),panel=null,session=null,token=0,loadToken=0;
  const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const key=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
  function safeAsset(s){return typeof s==='string'&&s.length<=1600&&!/[\u0000-\u001f<>]/.test(s)&&!/^\s*(?:javascript|data|vbscript|file):/i.test(s)&&(!/^[a-z][a-z\d+.-]*:/i.test(s)||/^https?:\/\//i.test(s))?s:'';}
  function sourceOK(s){if(typeof s==='string')return !!s.trim()&&s.length<=2000;if(!s||typeof s!=='object'||Array.isArray(s))return false;try{const j=JSON.stringify(s);return j.length<=2000&&Object.keys(s).length>0&&!Object.keys(s).some(k=>['__proto__','constructor','prototype'].includes(k));}catch(_){return false;}}
  function normalize(x){
    if(!x||typeof x!=='object'||Array.isArray(x))return null;
    const w=typeof (x.word??x.w)==='string'?(x.word??x.w).trim().replace(/\s+/g,' '):'',z=x.zh??x.z;
    if(!/^[a-z]+(?:[ '\u2019-][a-z]+)*$/i.test(w)||w.length>80||typeof z!=='string'||!z.trim()||z.length>300)return null;
    const legacy=x.reviewStatus==='legacy-verified'&&LEGACY[key(w)]===z.trim();
    if(!legacy&&!(x.reviewStatus==='reviewed'&&typeof x.reviewer==='string'&&x.reviewer.trim()&&x.reviewer.length<=100&&sourceOK(x.source)))return null;
    const th=legacy?(TOPICS[x.topic]?x.topic:oldTopics[x.theme??x.th]||'core'):x.topic;
    const lv=legacy?(x.learningBand??x.level??x.lv):x.learningBand;
    if(!TOPICS[th]||!Number.isInteger(lv)||lv<1||lv>4)return null;
    if(!legacy&&(!(typeof x.id==='string'&&/^word:/.test(x.id)&&x.id.length<=120)||typeof x.word!=='string'||typeof x.zh!=='string'||typeof x.pos!=='string'||!x.pos.trim()||x.pos.length>60||!Object.prototype.hasOwnProperty.call(x,'kk')||typeof x.audio!=='string'||typeof x.image!=='string'))return null;
    if(x.kk!=null&&(typeof x.kk!=='string'||x.kk.length>150))return null;
    if((x.audio!=null&&typeof x.audio!=='string')||(x.image!=null&&typeof x.image!=='string'))return null;
    const ex=x.example;
    if(!legacy&&(!ex||typeof ex.en!=='string'||!ex.en.trim()||ex.en.length>600||typeof ex.zh!=='string'||!ex.zh.trim()||ex.zh.length>600))return null;
    return {id:legacy?'word:'+key(w):x.id,w,z:z.trim(),kk:x.kk&&x.kk.trim()||null,topic:th,th:legacy&&oldTopics[x.theme??x.th]?(x.theme??x.th):oldTheme[th],lv,e:legacy&&typeof(x.emoji??x.e)==='string'?(x.emoji??x.e):'',img:safeAsset(x.image??x.img??''),au:safeAsset(x.audio??x.au??''),az:safeAsset(x.audioZh??x.az??''),pos:typeof x.pos==='string'?x.pos:'',example:ex&&typeof ex.en==='string'&&typeof ex.zh==='string'?{en:ex.en,zh:ex.zh}:null,reviewStatus:legacy?'legacy-verified':'reviewed',reviewer:legacy?'original-80':x.reviewer.trim(),source:legacy?'data/words.json':x.source};
  }
  function setData(pack){
    if(!pack||pack.schemaVersion!==1||!Array.isArray(pack.words)||pack.words.length>10000)return{accepted:0,rejected:0,duplicates:0,count:bank.length,error:'詞庫格式不符，保留原有資料。'};
    const accepted=[],seen=new Set(),ids=new Set();let rejected=0,duplicates=0;
    for(const raw of pack.words){const item=normalize(raw);if(!item){rejected++;continue;}const k=key(item.w);if(seen.has(k)||ids.has(item.id)){duplicates++;continue;}seen.add(k);ids.add(item.id);accepted.push(item);}
    if(!accepted.length)return{accepted:0,rejected,duplicates,count:bank.length,error:'沒有可玩的已審核單字，保留原有資料。'};
    bank=accepted;index=new Map(bank.map(w=>[key(w.w),w]));
    if(session){stop();session.view='dictionary';session.page=0;session.detail=null;session.round=null;render();}
    return{accepted:accepted.length,rejected,duplicates,count:bank.length,errors:rejected?[`${rejected} 筆未符合審核與欄位要求`]:[]};
  }
  async function load(url='data/vocab-reviewed.json'){
    const id=++loadToken;
    try{const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.text();if(raw.length>12*1024*1024)throw Error('詞庫過大');const pack=JSON.parse(raw);if(id!==loadToken)return{accepted:0,count:bank.length,error:'已取消較早的載入。'};return setData(pack);}
    catch(_){return{accepted:0,count:bank.length,retained:true,error:'審核詞庫尚未提供或無法載入；現有可玩單字照常保留。'};}
  }
  function lookup(word){return index.get(key(word).replace(/^[^a-z]+|[^a-z]+$/g,''))||null;}
  function blank(item){
    if(!item.example)return null;
    const re=new RegExp('(^|[^a-z])('+escapeRE(item.w)+')(?=$|[^a-z])','gi');let hits=0;
    const en=item.example.en.replace(re,(_,p)=>{hits++;return p+'＿＿＿';});
    return hits&&(en.match(/[a-z]+/gi)||[]).length>=2?{en,zh:mask(item.example.zh,item.w)}:null;
  }
  function mask(s,w){return String(s||'').replace(new RegExp(escapeRE(w),'gi'),'＿＿＿');}
  const q=id=>panel.querySelector('#'+id);
  function node(tag,text,className){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;}
  function button(text,fn,className){const b=node('button',text,className);b.type='button';b.onclick=fn;return b;}
  function stop(){token++;if(session)session.playing=false;try{if(typeof AudioBus!=='undefined')AudioBus.stop();else if(typeof AudioPractice!=='undefined')AudioPractice.stop();else if(root.speechSynthesis)root.speechSynthesis.cancel();}catch(_){} }
  async function play(text,url,after){
    if(!session)return;stop();const s=session,id=token;s.playing=true;s.note='正在播放，聽音不會作答。';render();
    try{
      let result;
      if(typeof AudioBus!=='undefined')result=await AudioBus.play({text,url:url||'',lang:'en-US',rate:.85});
      else if(typeof AudioPractice!=='undefined')result=await AudioPractice.play({text,url:url||'',lang:'en-US',rate:.85});
      else result=await new Promise(resolve=>{if(!root.speechSynthesis||typeof root.SpeechSynthesisUtterance!=='function')return resolve({status:'error'});const u=new root.SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.85;u.onend=()=>resolve({status:'ended'});u.onerror=()=>resolve({status:'error'});root.speechSynthesis.speak(u);});
      if(session!==s||id!==token)return;
      s.note=result&&result.status==='ended'?(result.source==='tts'?'播放完成（裝置整字朗讀）。':'播放完成。'):'聲音未播完，請重聽；不會當作答錯。';if(result&&result.status==='ended'&&after)after();
    }catch(_){if(session===s&&id===token)s.note='聲音無法播放，請確認音量與瀏覽器後重試。';}
    finally{if(session===s&&id===token){s.playing=false;render();}}
  }
  function progress(item){try{const p=session&&typeof session.getProgress==='function'?session.getProgress(item.w):null;return p&&typeof p==='object'?p:null;}catch(_){return null;}}
  function filtered(){if(!session)return[];const s=session,t=key(s.search);return bank.filter(w=>{const p=progress(w),learned=!!(p&&p.learned);return(!s.topic||w.topic===s.topic)&&(!s.band||w.lv===Number(s.band))&&(!t||key(w.w).includes(t)||w.z.includes(s.search.trim()))&&(!s.progress||(s.progress==='learned'?learned:!learned||p.wrong>0));});}
  function detail(item){stop();session.detail=item;session.note='';render();if(typeof session.onWord==='function'){try{session.onWord(item);}catch(_){session.note='單字已顯示；遊戲的單字回呼暫時無法完成。';}}play(item.w,item.au);}
  function sentence(host,item){
    if(!item.example)return;
    const line=node('p',null,'vc-example');
    if(typeof Pron!=='undefined'&&typeof Pron.sent==='function')line.innerHTML=Pron.sent(item.example.en,'');
    else {for(const part of item.example.en.split(/([a-z]+(?:['’-][a-z]+)*)/ig)){const w=lookup(part);line.append(w?button(part,()=>detail(w),'vc-inline-word'):document.createTextNode(part));}}
    host.append(line,node('p',item.example.zh,'vc-muted'),button('🔊 聽整句',()=>play(item.example.en,'')));
  }
  function wordCard(item,host){
    host.append(button('🔊 '+item.w,()=>play(item.w,item.au),'vc-word'),node('p',item.z),node('p',(item.pos?item.pos+' · ':'')+TOPICS[item.topic]+' · '+BANDS[item.lv],'vc-muted'),node('p',item.kk?'KK '+item.kk:'未提供經核對的 KK 音標，不推測。','vc-muted'),node('p',item.au?'播放整字錄音；失敗時可由裝置朗讀。':'未提供錄音：使用裝置整字朗讀，音色依裝置而異。','vc-muted'));
    if(item.img){const image=node('img');image.src=item.img;image.alt=item.z;image.loading='lazy';image.className='vc-image';host.append(image);}
    sentence(host,item);
  }
  function startRound(){
    stop();const pool=filtered();if(!pool.length)return;
    const words=pool.slice();for(let i=words.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
    session.round={words:words.slice(0,10),study:0,index:0,questions:[],score:0};session.round.questions=session.round.words.map((item,i)=>({item,mode:i%2&&blank(item)?'example-spelling':'listen-spelling',blank:blank(item),heard:false,tries:0,reported:false,solved:false,revealed:false,value:'',firstCorrect:false}));
    session.detail=null;session.view='study';session.note='先認識這一輪的單字，再聽音拼字。';render();
  }
  function submit(){
    const s=session,r=s&&s.round,a=r&&r.questions[r.index];if(!a||!a.heard||a.solved||s.playing)return;
    const value=q('vc-answer').value.trim();a.value=value;if(!value){s.note='請先輸入你聽到的英文。';render();return;}
    a.tries++;const correct=key(value.replace(/[’]/g,"'"))===key(a.item.w.replace(/[’]/g,"'"));a.revealed=true;a.solved=correct;
    if(!a.reported){a.reported=true;a.firstCorrect=correct;if(correct)r.score++;
      if(typeof s.onAnswer==='function'){try{s.onAnswer({item:a.item,correct,mode:a.mode,assisted:false,firstTry:a.tries===1,tries:a.tries});}catch(_){s.note='已判讀，但遊戲進度回報遇到問題。';}}
    }
    s.note=correct?(a.tries===1?'✓ 首答正確！':'✓ 這次拼對了，重試不重複計分。'):'還沒拼對。看看正確拼法，再聽一次、再拼；本題首答已記錄，不重複計分。';render();
  }
  function render(){
    if(!session||!panel||panel.hidden)return;
    const hadFocus=panel.contains(document.activeElement),focusedId=hadFocus?document.activeElement.id:'';
    try {
    const s=session,host=q('vc-content');host.replaceChildren();
    q('vc-total').textContent=bank.length+' / 3000 個實際可玩單字';q('vc-note').textContent=s.note||'';
    q('vc-filters').hidden=s.view!=='dictionary';q('vc-progress-label').hidden=s.view!=='dictionary'||typeof s.getProgress!=='function';q('vc-home').hidden=s.view==='dictionary'&&!s.detail;
    if(s.view==='dictionary'){
      if(s.detail){host.append(button('← 返回單字列表',()=>{stop();s.detail=null;s.note='';render();}));wordCard(s.detail,host);return;}
      const pool=filtered();s.page=Math.max(0,Math.min(s.page,Math.ceil(pool.length/20)-1));
      host.append(node('p','篩選後 '+pool.length+' 個 · 程度為教材分組，不宣稱官方 CEFR 或多益分數。','vc-muted'),button('學習這一輪（最多 10 字）',startRound,'vc-primary'));
      const list=node('div',null,'vc-list');
      for(const item of pool.slice(s.page*20,s.page*20+20)){
        const row=node('article',null,'vc-row'),p=progress(item);row.append(button(item.w,()=>detail(item),'vc-row-word'),node('span',item.z),node('small',BANDS[item.lv]+' · '+TOPICS[item.topic]+(p?(p.learned?' · 已學':' · 待練'):'')),button('🔊',()=>{if(typeof s.onWord==='function')try{s.onWord(item);}catch(_){}play(item.w,item.au);}));list.append(row);
      }host.append(list);
      if(!pool.length)host.append(node('p',bank.length?'沒有符合篩選的單字。':'尚未載入可玩的審核詞庫。原有遊戲進度不受影響。'));
      const nav=node('nav',null,'vc-pages'),prev=button('上一頁',()=>{stop();s.page--;render();}),next=button('下一頁',()=>{stop();s.page++;render();});prev.disabled=s.page===0;next.disabled=(s.page+1)*20>=pool.length;nav.append(prev,node('span',(pool.length?s.page+1:0)+' / '+Math.ceil(pool.length/20)),next);host.append(nav);return;
    }
    const r=s.round;if(!r)return;
    if(s.view==='study'){
      const item=r.words[r.study];host.append(node('h2','認識單字 '+(r.study+1)+' / '+r.words.length));wordCard(item,host);
      host.append(button(r.study+1<r.words.length?'下一個單字':'開始本輪練習',()=>{stop();if(++r.study>=r.words.length)s.view='practice';s.note='';render();},'vc-primary'));return;
    }
    if(r.index>=r.questions.length){host.append(node('h2','這輪完成'),node('p','首答答對 '+r.score+' / '+r.questions.length+'。重播與重試不重複計分。'),button('再學一輪',startRound,'vc-primary'),button('回單字列表',home));return;}
    const a=r.questions[r.index],item=a.item;
    host.append(node('h2','第 '+(r.index+1)+' / '+r.questions.length+' 題'),node('p',a.mode==='example-spelling'?'看例句、聽目標單字，拼出空格。':'看中文線索、聽單字，拼出英文。'),node('p',mask(item.z,item.w),'vc-clue'));
    if(a.mode==='example-spelling')host.append(node('p',a.blank.en,'vc-blank'),node('p',a.blank.zh,'vc-muted'));
    host.append(node('p',item.au?'這題使用整字錄音。':'這題沒有錄音，使用裝置整字朗讀。','vc-muted'));
    const hear=button(a.heard?'🔊 再聽一次':'🔊 先聽單字',()=>{a.value=q('vc-answer')?q('vc-answer').value:a.value;play(item.w,item.au,()=>{a.heard=true;});});hear.id='vc-hear';host.append(hear);
    const form=node('form'),input=node('input');input.id='vc-answer';input.type='text';input.autocomplete='off';input.setAttribute('autocapitalize','none');input.spellcheck=false;input.setAttribute('aria-label','輸入英文答案');input.placeholder=a.heard?'輸入你聽到的英文':'先聽完單字，再輸入';input.disabled=!a.heard||a.solved||s.playing;input.value=a.value;input.oninput=()=>a.value=input.value;
    const send=button('送出答案',submit,'vc-primary');send.id='vc-submit';send.disabled=!a.heard||a.solved||s.playing;form.onsubmit=e=>{e.preventDefault();submit();};form.append(input,send);host.append(form);
    if(a.revealed){const result=node('div',null,'vc-result '+(a.solved?'vc-correct':'vc-wrong'));result.append(node('b',a.solved?'✓ 正確拼法':'✕ 請對照拼法'),button(item.w,()=>play(item.w,item.au)),node('span',item.z));if(item.kk)result.append(node('span','KK '+item.kk));host.append(result);
      host.append(button(a.solved?'下一題':'先記下，下一題',()=>{stop();r.index++;s.note='';render();},'vc-primary'));
    }
    } finally {
      if(hadFocus&&(!panel.contains(document.activeElement)||document.activeElement.disabled)){
        const old=focusedId&&q(focusedId),next=old&&!old.disabled&&!old.hidden?old:panel.querySelector('#vc-content button:not([disabled])')||q('vc-close');next.focus({preventScroll:true});
      }
    }
  }
  function home(){if(!session)return;stop();session.view='dictionary';session.detail=null;session.note='';render();}
  function close(){if(!session)return;const s=session;stop();session=null;panel.hidden=true;if(s.previous&&s.previous.isConnected)s.previous.focus();if(typeof s.onClose==='function')try{s.onClose();}catch(_){} }
  function build(){
    if(panel)return;panel=node('section',null,'vocab-panel');panel.id='vocab';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','單字學習');
    panel.innerHTML='<div class="vc-inner"><header><button type="button" id="vc-close">← 返回遊戲</button><h1>單字學習</h1><button type="button" id="vc-home">單字列表</button></header><p id="vc-total" class="vc-total"></p><div id="vc-filters"><label>找單字或中文<input id="vc-search" type="search" placeholder="例如 apple、蘋果"></label><label>主題<select id="vc-topic"><option value="">所有主題</option></select></label><label>程度<select id="vc-band"><option value="">所有程度</option></select></label></div><label id="vc-progress-label" hidden>進度<select id="vc-progress"><option value="">全部進度</option><option value="learned">已學</option><option value="pending">待練</option></select></label><p id="vc-note" role="status"></p><main id="vc-content"></main></div>';
    document.body.append(panel);for(const[id,label]of Object.entries(TOPICS)){const o=node('option',label);o.value=id;q('vc-topic').append(o);}for(let i=1;i<=4;i++){const o=node('option',BANDS[i]);o.value=i;q('vc-band').append(o);}
    q('vc-close').onclick=close;q('vc-home').onclick=home;
    for(const[id,prop]of[['vc-search','search'],['vc-topic','topic'],['vc-band','band'],['vc-progress','progress']])q(id).addEventListener(id==='vc-search'?'input':'change',()=>{stop();session[prop]=q(id).value;session.page=0;session.detail=null;render();});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const all=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(n=>!n.hidden&&n.offsetParent!==null);if(all.length&&e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(all.length&&!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}}});
    document.addEventListener('keydown',e=>{if(session&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
    document.addEventListener('visibilitychange',()=>{if(session&&document.hidden){stop();session.note='切換畫面已停止播放，回來後可自行重聽。';render();}});
  }
  function open(opt={}){if(session)close();build();session={view:'dictionary',page:0,search:'',topic:'',band:'',progress:'',getProgress:opt.getProgress,detail:null,round:null,note:'',playing:false,onClose:opt.onClose,onAnswer:opt.onAnswer,onWord:opt.onWord,previous:document.activeElement};q('vc-search').value='';q('vc-topic').value='';q('vc-band').value='';q('vc-progress').value='';q('vc-progress-label').hidden=typeof opt.getProgress!=='function';panel.hidden=false;render();q('vc-close').focus();return true;}
  return{open,close,load,setData,lookup,get words(){return bank.slice();},get count(){return bank.length;},get isOpen(){return!!session&&!!panel&&!panel.hidden;}};
});
