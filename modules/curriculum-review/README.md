# modules/curriculum-review — 3,000 詞校對與驗證（B-WORDS3000-01）

只讀種子包（words-3000-editorial-seed.zip），不改根目錄 data/、index、WORDS、Pron、RPG。

```
python3 words3000.py dump  --seed <種子包根> --from 301 --to 600     # 列出待校對詞
python3 words3000.py build --seed <種子包根> --reviews reviews --out <專案根>/content/core-3000/reviewed
```

- `reviews/batch-*.tsv`：校對紀錄（人可讀、可 diff）。9 欄：word、pos、zh、topic、learningBand、example_en、example_zh、status、note。換詞寫「新詞<舊詞」。
- 輸出（每次都從全部 TSV 重算，累加）：
  - `words-reviewed.json`：只含 reviewStatus=reviewed 且通過驗證的詞。頂層 {schemaVersion:1, words, reviewer:"external-ai", count}。
  - `words-needs-review.json`：不確定或驗證失敗的詞，不計入可用數。
  - `validation.json`：數量、lemma 是否唯一、原 80 詞是否原樣保留、主題／級別／詞性分佈、各規則失敗數、模板例句與重複例句數。
  - `issues.json`：驗證失敗、換詞、移除、原詞義保留等待確認事項。
  - `changes.json`：改中文、換詞、移除的紀錄（含原草稿中文）。
- 驗證規則：zh 必須是中文、最多 3 義項、30 字內、無常見簡體字；pos／topic 在清單內；learningBand 1–4；例句大寫開頭、標點結尾、用到目標詞或其詞形；非原 80 詞的 kk 必須是 null；同一例句骨架（目標詞挖空後）出現 3 次以上列為模板例句。
- 原 80 詞：ID、zh、kk、audio、image、難度（learningBand = 原 level）一律取自原遊戲 data/words.json，校對檔不能覆蓋。
- reviewed 代表本輪外部 AI 的教學檢查，**不是真人教師審核**；learningBand 是編輯學習級別，**不是 CEFR／TOEIC**。
