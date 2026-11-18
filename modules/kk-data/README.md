# modules/kk-data（B-KK-DATA-01，外部 AI）

KK 41 音教材支援資料的原始檔、產生器和驗證器。只輸出 `content/kk-v1/`，不改 novice.js、rpg.js、learn.js 等主程式。

- `kk_source.py`：人工編寫的原始資料。
  - 41 音的口形說明、拼字、例外和例字。
  - 例字的 KK 與拼字切分。
  - 字母組合配對資料，以及各章的完整組音字。
- `build_kk.py --root <專案根目錄> --out content/kk-v1`：產生 `kk-sounds-reviewed.json` 和 `words-reviewed.json`。
  - 只讀根目錄的 data/words.json、data/vocab-reviewed.json 和 assets/voice/words，用來核對原 80 詞與錄音是否存在。
- `kk-validate.cjs --data content/kk-v1 [--root .] [--out validation.json]`：純 Node 驗證器，不需安裝套件，有錯時結束碼為 1。

## 例字列格式（kk_source.W）

`("cat", "[kæt]", "c|a|t", "k|æ|t", None, {})`

- 第三欄是拼字切分，第四欄是對應的音。
- 一個 chunk 有多個音時用空白分開，例如 `"k w"`；不發音的 chunk 用 `-`。
- 兩個音節以上的字，第五欄是拼字分音節，例如 `"cit|y"`。
- 選項：
  - `merger`：/ɔ/ 易受口音合流影響，會自動加上 avoidDistractors ["ɑ"] 和口音說明。
  - `needsReview`：寫明待核對的原因。
  - `noVowelQ`：不出母音位置題。
  - `avoid`：額外要排除的干擾選項。
  - `note`：補充說明。
