# modules/learning-profile（LEARNING-PROFILE-01，外部 AI）

- `profile.js`：熟悉度計算模組（UMD；瀏覽器 `window.LearningProfile`，Node `require`）。lp-rules-v1.2（派工 revision 9）。只有 `atomicWrite` 會寫入呼叫端傳入的 storage，其他都是純函式。
- `test/profile.test.cjs`：32 個情境測試。`node test/profile.test.cjs`；加 `--write-expected` 會重寫 `test/expected/`（這些快照由程式產生，只用來抓意外變動，不是正確答案的來源）。
- `test/hand-fixtures.json` + `test/hand.test.cjs`：12 個**手算**案例，每案附算式；只比數值、狀態和證據。`node test/hand.test.cjs`
- `test/fixtures/grammar-items.sample.json`：測試用的範例文法題，**不是正式教材**。
- `build_profile_data.py --root <遊戲根目錄> --out content/learning-profile-v1`：從遊戲教材（唯讀）和 `tag_source.py` 產生分類 JSON。
- `tag_source.py`：人工編寫的主題、次主題對照，以及逐句文法標記。
- `grammar_detect.py`：自動偵測。結果只標 `auto-unreviewed`，供參考，不用於評估。
- `validate_data.py <data dir> [--out validation.json]`：分類資料一致性檢查。
- `acceptance/ACCEPTANCE-INTEGRATION.md`：內部交出串接版本後，外部獨立驗收整個流程的 37 個案例（A–G 組）。
- `acceptance/make-fixtures.cjs [--now …]`：產生驗收用的存檔匯出（C1、C2、C3、C9、C10、F2、F4–F6），日期以測試當天為準；`_expect` 是手寫的預期值。
- `acceptance/check-fixtures.cjs`：確認每個驗收存檔和它的手寫預期值一致。
- `acceptance/oracle.cjs <匯出檔.json> [--now …] [--check-events] [--json out.json]`：讀入遊戲存檔匯出，算出面板每一格的狀態和數值（`rows`），並檢查事件格式。oracle 和遊戲共用 `profile.js`，只當輔助，正確答案以手算為準。
