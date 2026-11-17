#!/usr/bin/env python3
"""打包一批交件：重算累加輸出、產生 report.md、changed-files.txt、zip 與 SHA256 清單。
  python3 make_batch.py --seed <種子包根> --batch 02 --range 301-600 --notes notes.md --out /home/claude/deliver/B-WORDS3000-01
"""
import argparse, collections, hashlib, json, os, shutil, subprocess, datetime

ap = argparse.ArgumentParser()
ap.add_argument("--seed", required=True); ap.add_argument("--batch", required=True); ap.add_argument("--range", required=True)
ap.add_argument("--notes", default=""); ap.add_argument("--out", required=True)
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(a.out, f"batch-{a.batch}")
shutil.rmtree(out, ignore_errors=True)
pkg = os.path.join(out, "pkg")
rev = os.path.join(pkg, "content/core-3000/reviewed")
os.makedirs(rev)
subprocess.run(["python3", os.path.join(here, "words3000.py"), "build", "--seed", a.seed, "--reviews", os.path.join(here, "reviews"), "--out", rev], check=True, capture_output=True)
shutil.copytree(here, os.path.join(pkg, "modules/curriculum-review"), ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
for f in ("validation.json", "issues.json"):
    shutil.copy(os.path.join(rev, f), out)
val = json.load(open(os.path.join(rev, "validation.json"), encoding="utf-8"))
iss = json.load(open(os.path.join(rev, "issues.json"), encoding="utf-8"))
ch = json.load(open(os.path.join(rev, "changes.json"), encoding="utf-8"))
words = json.load(open(os.path.join(rev, "words-reviewed.json"), encoding="utf-8"))["words"]
lo, hi = map(int, a.range.split("-"))
inb = [w for w in words if lo <= w["selectionOrder"] <= hi]
pend = json.load(open(os.path.join(rev, "words-needs-review.json"), encoding="utf-8"))["words"]
pend_b = [w for w in pend if lo <= w["selectionOrder"] <= hi]
repl = [c for c in ch["changes"] if c["action"] == "replace"]
drop = [c for c in ch["changes"] if c["action"] == "drop"]
leg = [w["word"] for w in inb if w["source"] == "existing-game"]
tb = collections.Counter(w["topic"] for w in inb)
bb = collections.Counter(w["learningBand"] for w in inb)
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
notes = open(a.notes, encoding="utf-8").read().strip() if a.notes and os.path.exists(a.notes) else ""
R = f"""開發方：外部開發者（Claude，claude.ai 工作階段）
交件編號：B-WORDS3000-01 / batch-{a.batch}（generation 1，task.md revision 6）
使用的基準版本：種子包 words-3000-editorial-seed.zip（SHA256 80048566ba47b2db2c201a4bf9a043d97e0e1e581117b17347fb414fddd3df1a）
交件時間（UTC）：{now}

## 本次完成

- 本批 selectionOrder {lo}–{hi}：可用 {len(inb)} 詞（reviewed 且通過驗證），needs-review {len(pend_b)} 詞。
- **累計可用 {val['usableReviewed']}／3000**（已校對到第 {hi} 詞；needs-review 累計 {val['needsReview']}，不計入可用數）。
- 本批原 80 詞：{len(leg)} 詞（{'、'.join(leg) or '無'}），ID／詞義／KK／音檔／難度原樣保留。
- 累計換詞 {len(repl)} 個：{'；'.join(f"{c['from']}→{c['to']}" for c in repl) or '無'}。理由見 changes.json 與各詞 reviewNote。
- 累計移除 {len(drop)} 個。
- 本批主題：{dict(tb.most_common())}；學習級別：{dict(sorted(bb.items()))}。

{notes}

## 修改／新增檔案

見 changed-files.txt。只新增 content/core-3000/reviewed/ 與 modules/curriculum-review/；沒有修改種子包原檔、根目錄 data/、index、WORDS、Pron、RPG。

## 啟動與驗證步驟

解壓 words3000-batch-{a.batch}.zip 到專案根目錄。words-reviewed.json 是**累加**檔，取代前一批。重算方式：
`python3 modules/curriculum-review/words3000.py build --seed . --reviews modules/curriculum-review/reviews --out content/core-3000/reviewed`

## 自動驗證結果（validation.json）

lemma 唯一：{val['uniqueLemmas']}；原 80 詞保留：{val['legacyPreserved']}（已含 {val['legacyIncluded']} 詞）；各規則失敗：{dict(val['failuresByRule']) or 0}；模板例句：{val['templateExampleFlags']}；重複例句：{val['duplicateExamples']}；尚未校對：{val['remainingUnreviewed']} 詞。

## 真人／實測

reviewed 是本輪外部 AI 的教學檢查，**不是真人教師審核**；learningBand 是編輯學習級別，**不是 CEFR／TOEIC**。新詞 kk 一律 null、沒有錄音、沒有圖片（不能放進看圖題；可用整字裝置朗讀但需標示）。

## 已知限制與未完成項目

- 尚未校對：{val['remainingUnreviewed']} 詞，接著每 300 詞交一批。
- 每詞只教 1–3 個常用義；一字多義、讀音不同的義項寫在 reviewNote。
- 功能詞與抽象詞不適合「選中文意思」題，建議用例句填空或聽音拼字。

## 需要協調人決定的介面／依賴

- 輸出另含 selectionOrder、draftZh、phoneticSource、forms、reviewNote、replaces 欄位，可忽略。
- 換詞的新詞 source 為 editorial，原詞記在 replaces。

## 試玩網址或錄影

純資料交件；遊戲內接線由協調人負責。
"""
open(os.path.join(out, "report.md"), "w", encoding="utf-8").write(R)
C = f"""# B-WORDS3000-01 batch-{a.batch}：只新增，沒有修改既有檔案（種子包原檔、根目錄 data/、index、WORDS、Pron、RPG 均未動）
新增／更新 content/core-3000/reviewed/words-reviewed.json      （累加，可用 {val['usableReviewed']} 詞）
新增／更新 content/core-3000/reviewed/words-needs-review.json  （{val['needsReview']} 詞）
新增／更新 content/core-3000/reviewed/validation.json
新增／更新 content/core-3000/reviewed/issues.json             （{iss['count']} 筆）
新增／更新 content/core-3000/reviewed/changes.json            （{ch['count']} 筆）
新增／更新 modules/curriculum-review/（words3000.py、make_batch.py、README.md、reviews/*.tsv）
"""
open(os.path.join(out, "changed-files.txt"), "w", encoding="utf-8").write(C)
z = os.path.join(out, f"words3000-batch-{a.batch}.zip")
subprocess.run(["zip", "-qr", z, "content", "modules"], cwd=pkg, check=True)
for f in (os.path.basename(z), "report.md", "changed-files.txt", "validation.json", "issues.json"):
    p = os.path.join(out, f)
    print(hashlib.sha256(open(p, "rb").read()).hexdigest(), p, os.path.getsize(p))
