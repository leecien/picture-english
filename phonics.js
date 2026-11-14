/* Spelling-to-sound examples, not a one-to-one alphabet conversion.
   Recordings are whole words: never send isolated KK symbols to TTS. */
const Phonics = {
  pages: [
    {title:'字母名字和單字裡的聲音不同', text:'字母 A 的名字是 /e/，但在 cat 裡，a 發 /æ/。先聽整個單字，再看每段拼字對到的聲音。', examples:[{word:'cat',parts:[['c','k'],['a','æ'],['t','t']]}]},
    {title:'先認識短母音', text:'這些是在下列例字中的讀法，不代表字母永遠只能這樣念。點單字聽示範。',examples:[{word:'cat',parts:[['a','æ']]},{word:'egg',parts:[['e','ɛ']]},{word:'fish',parts:[['i','ɪ']]},{word:'octopus',parts:[['開頭 o','ɑ']]},{word:'sun',parts:[['u','ʌ']]}]},
    {title:'字尾 e 可以改變前面的母音',text:'比較 cat 的 a 和 cake 的 a。cake、bike、phone 的字尾 e 在這些字裡不單獨發音；這是常見拼字規律，不是所有字尾 e 都適用。',examples:[{word:'cat',parts:[['a','æ']]},{word:'cake',parts:[['c','k'],['a','e'],['k','k'],['字尾 e','不單獨發音']]},{word:'bike',parts:[['i','aɪ']]},{word:'phone',parts:[['o','o']]}]},
    {title:'兩個字母可以合成一個音',text:'sh、ch、ph 是字母組合。念 fish 時，sh 一起發 /ʃ/，不是先念 s 再念 h。',examples:[{word:'fish',parts:[['f','f'],['i','ɪ'],['sh','ʃ']]},{word:'chair',parts:[['ch','tʃ']]},{word:'phone',parts:[['ph','f']]},{word:'thermometer',parts:[['th','θ']]}]},
    {title:'相同拼字，也可能有不同讀法',text:'ee 在 tree 裡發 /i/；oo 在 moon 與 book 裡卻不同。所以讀新單字時要看例字、聽發音，再用 KK 確認。',examples:[{word:'tree',parts:[['ee','i']]},{word:'moon',parts:[['oo','u']]},{word:'book',parts:[['oo','ʊ']]},{word:'bread',parts:[['ea','ɛ']]}]},
    {title:'把聲音接成完整單字',text:'先慢慢接，再聽正常速度。/k/ ＋ /æ/ ＋ /t/ → cat；/f/ ＋ /ɪ/ ＋ /ʃ/ → fish。接下來老師會教你辨認這些聲音。看過這些例子不代表已掌握所有 KK 音。',examples:[{word:'cat',parts:[['c','k'],['a','æ'],['t','t']]},{word:'fish',parts:[['f','f'],['i','ɪ'],['sh','ʃ']]},{word:'sun',parts:[['s','s'],['u','ʌ'],['n','n']]}]}
  ],
  html(page, words) {
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    return `<h3>${esc(page.title)}</h3><p class="dlg-zh">${esc(page.text)}</p><div class="teach">${page.examples.map(ex=>{
      const w=words.find(w=>w.w===ex.word);
      if(!w)return '';
      return `<section class="teach-card"><button type="button" class="demo" data-say="${esc(w.w)}">🔊 ${esc(w.w)} <span class="qz-kk">${esc(w.kk)}</span></button><p>${ex.parts.map(([letters,sound])=>`<b>${esc(letters)}</b> → <span class="qz-kk">${sound==='不單獨發音'?esc(sound):'/'+esc(sound)+'/'}</span>`).join('　')}</p></section>`;
    }).join('')}</div>`;
  }
};
if(typeof module!=='undefined')module.exports=Phonics;
