#!/usr/bin/env python3
"""Reproduce coordinator AI editorial batch and automated candidate triage.
The TSV/manual notes contain the actual editorial work; heuristics never approve entries.
Run from any directory: python content/core-3000/audit/audit.py
"""
import csv, hashlib, json, re
from collections import Counter, defaultdict
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
DRAFT=HERE.parent/'words-3000.draft.json'
raw=json.loads(DRAFT.read_text())['words']
legacy=json.loads((ROOT/'data/words.json').read_text())
by={x['word'].casefold():x for x in raw}
old={x['word'].casefold():x for x in legacy}
write=lambda name,data:(HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
issues=[]
def issue(word,code,severity,observation,suggestion,method='automated-triage',**extra):
 x=by[word]
 issues.append({'id':f"{x['id']}:{code}"+((':'+extra['relatedWordId']) if extra.get('relatedWordId') else ''),'wordId':x['id'],'word':word,'selectionOrder':x['selectionOrder'],
 'category':code,'severity':severity,'method':method,'original':{'zh':x['zh'],'pos':x.get('pos')},
 'observation':observation,'suggestion':suggestion,**extra})

# Concrete content readings by the coordinator AI, distinct from heuristic flags.
manual=[
('erm','wrong-expansion','blocker','猶豫填充詞被當成化學／醫學縮寫，釋義含紅黴素與甲基化酶。','本輪排除。若日後教口語猶豫，可用interjection「呃；嗯（猶豫時）」並另備真人／可信音訊；不算本批通過。'),
('still','missing-common-sense','high','缺少最高頻副詞「仍然／還是」，首義是蒸餾室。','入門先教adverb「仍然；還是」；She is still at work.／她還在上班。'),
('meet','pos-sense-mismatch','high','詞性有vt/vi，卻只給名詞「會／集會」和形容詞「適宜的」。','verb「見面；遇見」；Let\'s meet at the station.／我們在車站見面吧。'),
('even','missing-common-sense','high','詞典列平坦／相等／偶數等，漏掉最常見副詞「甚至」。','入門先教adverb「甚至；連……都」；另分開教adjective「平坦的；偶數的」，不共用同一題中文答案。'),
('give','sense-priority','high','將少用名詞「彈性／適應性」放在核心動詞前。','先教verb「給」；Please give me a minute.／請給我一分鐘。'),
('good','sense-priority','high','以名詞「善行／利益」開頭且堆疊虔誠等少用義。','先教adjective「好的」；This is a good idea.／這是個好主意。'),
('kid','sense-priority','high','小山羊／小山羊肉在小孩之前，會讓生活題與圖像題誤配。','先教noun「小孩（口語）」；山羊義另做有明確動物情境的詞義。'),
('lead','heteronym','high','把鉛與帶領混在同一詞條，兩個常見義的發音不同。','本批只教verb「帶領；引導」；發音是/ lid /類長母音，鉛/ lɛd /另建sense並匹配音檔；此批不填未驗證KK。'),
('minute','heteronym','high','分鐘與形容詞細微的詞性混列，可能共用錯誤發音。','本批只教noun「分鐘」及Please wait a minute.；形容詞義與發音另列，不能靠同一預設TTS／KK。'),
('live','heteronym','high','形容詞現場／活的在動詞居住之前，兩種發音不同。','本批只教verb「居住；生活」；I live near a park.；現場轉播義另做sense，不混用音檔。'),
('book','legacy-meaning-conflict','high','草稿把原遊戲「書」拓展為「書；預訂」，但既有圖片／音檔教的是書。','保留原book noun「書」、原KK／音檔；預訂可另做動詞情境，不能把書本圖片題改成預訂。'),
('little','grammar-distinction','medium','少量／小的並列，缺少little與a little語用差異。','先以There is little time left.教「剩下時間不多」；a little表示「有一點」，後續另以句子比較。'),
('few','grammar-distinction','medium','很少與少數未呈現few／a few差別。','Few shops are open this early. 表示營業的很少；a few是「有幾家」。量詞題必須保留冠詞語境。'),
('an','pronunciation-rule','medium','僅「一」不足以教a/an選擇。','一個；一種（用於母音發音前），不是看到母音字母就套用；例an apple、an hour，對照a university。'),
('parent','singular-plural','medium','單數parent直接翻成「父母」會讓數量題與句子錯配。','單數noun「父親或母親；一位家長」；parents才是父母／雙親。'),
('process','wrong-common-gloss','high','一般process首義翻成「程式」，容易和program混淆。','noun「過程；流程」，製造verb「加工／處理」另列；program才常指電腦程式。'),
('account','missing-common-sense','high','有帳目但缺生活／App高頻「帳號；帳戶」，又混入殺死等罕見義。','生活科技先教noun「帳號；帳戶」；I need to create an account.／我需要建立帳號。'),
('type','localization','medium','「型別」可用於程式術語，但成人日常先教「種類／類型」。','noun「種類；類型」、verb「打字」分情境出題。'),
('international','wrong-common-gloss','high','普通形容詞混入軟體用語「國別設定」。','adjective「國際的」；an international flight／國際航班，不教「國別設定」為基本義。'),
('significantly','missing-common-sense','high','「值得注目地」不自然，且缺常見程度副詞「顯著地」。','adverb「顯著地；大幅地」；The price has increased significantly.／價格已大幅上漲。'),
('gay','outdated-meaning','high','只給歡快／豔麗／放蕩，漏掉現代主要性傾向義，且「放蕩」造成錯誤貶抑聯結。','現代adjective「同性戀的（常指男性）」；歡快是較舊用法，須標語域。不得把性傾向翻成放蕩。'),
('data','duplicate-gloss','medium','整條中文是「資料, 資料」，沒有增加意義；詞性缺失。','noun「資料；數據」，避免可數規則簡化；This data is useful.可作一般日常集合用法，正式領域另教複數一致。'),
('online','wrong-common-gloss','high','「聯機」不符合台灣常見生活用語，且詞性缺失。','adjective/adverb「線上的；在線上」；I bought it online.／我在網路上買了它。'),
('internet','localization','medium','冗長舊譯含因特網／國際互連網，並混入廣域網。','noun「網際網路」；WAN廣域網不是internet的可互換基本義。'),
('laptop','pos-sense-mismatch','high','把laptop翻成形容詞「膝上型的」，缺名詞筆電。','noun「筆記型電腦；筆電」；I use a laptop for work.／我用筆電工作。'),
('conditioner','sense-boundary','medium','獨立conditioner的「調節機」太泛，容易錯配潤髮乳與冷氣圖。','單字先教noun「潤髮乳」；air conditioner是獨立多字詞「冷氣機」，不能只放conditioner代表冷氣。'),
('de','non-core-abbreviation','blocker','小寫de被引入作化學／已棄用元素名稱，與英語入門無關。','從入門3000候選移除／替換；若保留專門縮寫須用正確大小寫、領域與來源，不納入一般生活題。'),
('ii','non-core-abbreviation','blocker','把字母ii解釋成Image Intensification，無法當普通英文單字教學。','從入門詞數移除／替換；羅馬數字II如有需要另作符號知識，不偽裝高頻英文字。'),
('eg','abbreviation-boundary','high','例如與「邪惡的笑」網路縮寫混列。','若教縮寫，顯示e.g.、adverbial abbreviation「例如」，用句子說明標點；不把eg獨立當一般單字或教邪惡的笑。'),
('etc','abbreviation-boundary','medium','etc詞性缺失且略去正常標點。','若教縮寫，顯示etc.「等等」，標記abbreviation；是否計入3000一般詞須明確決策，不與et cetera雙計。'),
('ceo','abbreviation-boundary','medium','縮寫失去正常大寫，詞性缺失。','若保留商務詞，顯示CEO、noun「執行長」，清楚標縮寫及字母發音，不以ceo整字音亂念。'),
('mhm','discourse-not-core-lemma','medium','是口語回應聲，不應混在拼字／單字數題當一般詞形。','可放對話聆聽附錄「嗯；表示同意／正在聽」，與主要3000詞計數分離。'),
('discrimination','typo','medium','「岐視」是錯字。','改為noun「歧視；區別」，日常先教歧視，避免與單純差別互換。'),
('fee','unsafe-form-alias','high','forms含p/d=feed，但現代高頻feed是獨立動詞「餵食」，不能讓點字查詢回到fee。','移除或隔離fee→feed的來源詞形關係；fee noun「費用」、feed verb「餵食」分開，不靠罕見歷史詞形歸併。'),
]
for word,code,severity,obs,suggestion in manual:
 issue(word,code,severity,obs,suggestion,'coordinator-ai-content-reading')
for word in ['david','paul','george','richard','michael','william','mary','edward']:
 if word in by:issue(word,'proper-name-count-padding','high','來源明確標男子名／女子名；不宜靠常見姓名填滿一般生活單字數。','可留NPC／句子人物名稱庫，但從核心3000詞計數移出；以缺少的日常通用詞補位。','coordinator-ai-content-reading')

# Whole-catalog scan: flags are review requests, not proven errors and never approvals.
seen={}
family_pairs=set()
for x in raw:
 word=x['word'].casefold();zh=x['zh'];parts=[p.strip() for p in re.split('[,，;；]',zh) if p.strip()]
 if word in seen:issue(word,'duplicate-normalized-word','blocker','大小寫正規化後與另一候選同字。','依word:id去重並由編輯挑選單一主要義。')
 seen[word]=x
 if not x.get('pos'):issue(word,'missing-pos','medium','來源未提供詞性。','按實際採用的常用義補詞性；不要依字尾或中文盲猜。')
 if len(zh)>65 or len(parts)>=10:issue(word,'overloaded-dictionary-gloss','medium',f'釋義長{len(zh)}字、含{len(parts)}段，直接作手機選項難辨認。','選1–2個日常常用義，與詞性、例句、圖片及音訊一同配對；其他義另做sense。')
 repeats=[p for p,n in Counter(parts).items() if n>1]
 if repeats:issue(word,'repeated-gloss-fragment','low','重複中文片段：'+'、'.join(repeats),'刪重複片段，再由語境決定需要保留的常用義。')
 if len(word)>=13:issue(word,'advanced-length-triage','low','拼字長度至少13字母，僅是教學負擔的篩選指標，並非判定錯字或必須刪除。','檢查是否成人生活必要及可用自然例句教學；可保留，但不要因詞頻排序自稱A1／TOEIC級距。')
 if word in old and zh != old[word]['zh']:
  issue(word,'legacy-gloss-drift','medium',f"現有遊戲義為「{old[word]['zh']}」，草稿改為「{zh}」。",'保持既有圖片題／音檔的原義；新增義另做情境，載入器需優先保留原80的KK與音檔。')
 for tag,form in (x.get('forms') or {}).items():
  if tag not in {'p','d','3','i','s','r','t'}:continue
  for candidate in re.split(r'[/,;\s]+',str(form)):
   target=candidate.casefold()
   if target in by and target!=word and (word,target) not in family_pairs:
    family_pairs.add((word,target))
    issue(word,'possible-lemma-family-overlap','low',f'詞形欄{tag}指向同批另一條{target}。','這只是人工判斷佇列：could、tired、painting等可能有獨立教學價值，不可一律刪除；單純屈折形才合併。',relatedWordId=by[target]['id'])

rows=list(csv.DictReader((HERE/'first300-editorial.tsv').open(),delimiter='\t'))
assert len(rows)==299 and len({x['word'] for x in rows})==299
assert {x['word'].casefold() for x in raw[:300]}-{x['word'] for x in rows}=={'erm'}
reviewed=[];suggestions=[]
for row in rows:
 key=row['word'];x=by[key];o=old.get(key,{})
 assert key==key.strip().lower() and row['exampleEn'] and row['exampleZh'] and row['zh'] and row['pos']
 assert re.search(r'(?<![a-z])'+re.escape(key)+r'(?![a-z])',row['exampleEn'],re.I),key+' absent from example'
 item={
  'id':x['id'],'word':key,'displayWord':'I' if key=='i' else key,'zh':row['zh'],'pos':row['pos'],'topic':row['topic'],
  'learningBand':'core-frequency-1','reviewStatus':'reviewed','reviewer':'coordinator-ai',
  'source':'ECDICT-MIT+editorial-review','sourceWord':x.get('sourceWord',x['word']),
  'kk':o.get('kk') or None,'audio':o.get('audio') or '',
  'example':{'en':row['exampleEn'],'zh':row['exampleZh']},
  'reviewScope':'AI review of selected common sense, POS and original example; no new phonetic/audio verification',
 }
 for field in ['emoji','theme','level','image','audioZh']:
  if field in o:item[field]=o[field]
 reviewed.append(item)
 suggestions.append({'wordId':x['id'],'word':key,'selectionOrder':x['selectionOrder'],
  'original':{'zh':x['zh'],'pos':x.get('pos')},'proposed':{'zh':item['zh'],'pos':item['pos'],'example':item['example']},
  'decision':'retain-common-sense' if x['zh']==item['zh'] else 'use-selected-common-sense',
  'reviewer':'coordinator-ai','reviewScope':'specific word, selected sense, POS and example; not all dictionary senses',
  'relatedIssues':[i['id'] for i in issues if i['wordId']==x['id'] and i['method']=='coordinator-ai-content-reading']})
suggestions.append({'wordId':by['erm']['id'],'word':'erm','selectionOrder':241,'decision':'exclude-pending-correction','reviewer':'coordinator-ai','reason':'Medical acronym expansion is not the discourse filler. No reviewed example or verified audio supplied.'})
# No heuristic can flip a status to reviewed; only explicit authored TSV rows enter this file.
write('reviewed-first300.json',{'schemaVersion':1,'status':'ai-reviewed-editorial-subset','count':len(reviewed),
 'note':'299 reviewed common-sense entries from the first 300 source selections; erm excluded. This is AI editorial review, not human review. learningBand is an editorial batch, not CEFR or TOEIC.',
 'words':reviewed})
write('editorial-suggestions.json',{'schemaVersion':1,'reviewer':'coordinator-ai','scope':'selectionOrder 1–300; 299 accepted selected senses and one excluded entry','entries':sorted(suggestions,key=lambda x:x['selectionOrder'])})
issues.sort(key=lambda x:(x['selectionOrder'],x['id']))
write('issues.json',{'schemaVersion':1,'sourceSha256':hashlib.sha256(DRAFT.read_bytes()).hexdigest(),
 'scannedCount':len(raw),'uniqueNormalizedWords':len(seen),'issuesCount':len(issues),
 'flaggedWordCount':len({x['wordId'] for x in issues}),
 'methodCounts':dict(Counter(x['method'] for x in issues)),
 'severityCounts':dict(Counter(x['severity'] for x in issues)),
 'note':'Automated flags request review, not confirmed mistakes. Only coordinator-ai-content-reading entries are concrete AI content observations. No human review is claimed.',
 'issues':issues})
assert len({x['id'] for x in reviewed})==299
assert len({x['id'] for x in issues})==len(issues),'duplicate issue ids'
assert all(x['kk']==old[x['word']]['kk'] and x['audio']==old[x['word']]['audio'] for x in reviewed if x['word'] in old)
assert all(x['kk'] is None and x['audio']=='' for x in reviewed if x['word'] not in old)
assert all(x.get('reviewStatus')!='reviewed' for x in raw if x.get('source')!='existing-game')
print(json.dumps({'scanned':len(raw),'unique':len(seen),'reviewed':len(reviewed),'excludedFirst300':['erm'],
 'preservedLegacy':sum(x['word'] in old for x in reviewed),'issues':len(issues),'flaggedWords':len({x['wordId'] for x in issues}),
 'methods':dict(Counter(x['method'] for x in issues)),'severity':dict(Counter(x['severity'] for x in issues))},ensure_ascii=False))
