開發方：外部開發者（Claude），負責教材分類、評估規則與獨立驗收
任務：LEARNING-PROFILE-01，generation 1。依派工 revision 9 修訂規則與驗收案例
交件：**batch-04 完整包**，相容取代 batch-03。檔名、函式名和欄位名都沿用
依據：dispatch revision 9（updated_at 2026-11-17T17:45:39Z）、task.md sha256 `fcacf0d5df8eca22130b6a844993def1b005d5d6ba0d5513ae70d774c992d05b`（已核對）
教材基準：picture-english e079ef8，只讀；沒有修改根遊戲、戰鬥或存檔程式
時間（UTC）：2026-11-17

## 一、revision 9 每一項的落實

| # | 要求 | 已落實 | 測試 |
| --- | --- | --- | --- |
| 1 | 學習日期用 Asia/Taipei，事件存 UTC；24 小時重複和跨日期門檻分開說明、分開測試 | `RULES.dayTimeZone`、`dayOf()`；學習日期只看獨立作答；24 小時仍是同題同通道的滾動間隔。RULES.md §4 用例子分開說明 | 測試 25；手算 H3、H4、H5 |
| 2 | 90 天；超過 30 天須重新確認並保留歷史；不足顯示「證據不足」；沒有題型顯示「未提供評估」；都不是弱項 | 沒有題型時，`describe()` 改說「未提供評估：…」；只有已計分且 `weak` 為真的格才列弱項 | 測試 09、18、27；手算 H10 |
| 3 | 顯示 rawPct 四捨五入到整數，5/6 顯示 83%、詳情寫 83.3%；取消 5% 級距；rawPct 仍用於 70% 弱項判定 | `displayPct = pct = round(rawPct)`。四捨五入會跨過 40、70、85、100 而原始比例沒到時，改顯示一位小數；每格新增 `weak` | 測試 04、22、26；手算 H1、H2、H8、H9 |
| 4 | 談判主分類 work/negotiation；會議只在確有關聯時作副標籤；同主題同事件一次；總事件、總題數去重 | 會議副標籤由 4 句減為 2 句（理由見 RULES.md §5）；新增 `totals.distinctItems` | 測試 20；手算 H12 |
| 5 | 句子層級一事件；重點字只算對應證據；沒直接測文法就不算時態；重試保留 wrong／final correct，不挑最佳；提示、輔助、超時分開 | 規則原本就是這樣，補上手算案例 | 測試 12、21；手算 H6、H7 |
| 6 | 4000 筆；還原不得靜默合併；整份還原與僅合併能力紀錄語意清楚；只做一種先用整份還原；合併先預覽，衝突不猜並保留原資料；驗證或 quota 失敗要原子回復；更新 F3 | `previewRestore()`、`mergeAbility()`、`validateStore()`、`atomicWrite()`；`mergeEvents()` 只留給明確選用的合併。驗收案例原本的 F3 拆成 F4–F8 | 測試 19、28–31；驗收存檔 F4–F6 |
| 7 | 裁切後舊證據不足要如實顯示，不虛構歷史 | `compute()` 只用最新 4000 筆；新增 `totals.trimmed` | 測試 32；手算 H11；驗收存檔 F2 |
| 8 | oracle 不是唯一真理：要有手算 fixture；比對數值、狀態、證據，容許 UI 用語不同 | `test/hand-fixtures.json` 有 12 案，每案附紙筆算式；oracle 的 `rows` 改輸出數值欄位；驗收案例改成比對數值；驗收存檔附手寫 `_expect` | `hand.test.cjs`、`check-fixtures.cjs` |
| 9 | 不擴充全部 3000 詞的次主題或新時態 | 沒有新增時態、次主題或題目；60 題文法題不變 | — |

## 二、百分比公式（v1.2）

以 6 題中答對 5 題為例：

| 名稱 | 欄位 | 公式 | 範例 |
| --- | --- | --- | --- |
| 原始比例 | `rawPct` | 答對題數 ÷ 有獨立證據的題數 × 100，存一位小數；每題只看最近一次獨立作答，不加權 | 5 ÷ 6 = **83.3** |
| 顯示分數 | `displayPct`（`pct` 是相容欄位，值相同） | 原始比例四捨五入到整數 | **83** |
| 比例 | `ratio` | — | `"5/6"` |
| 等級 | `band` | 依原始比例判定 | 83.3 是「熟悉」 |
| 弱項 | `weak` | 原始比例 < 70 | 否 |

**跨門檻例外**：四捨五入會讓沒有達到 40、70、85、100 的人看起來達到時，改顯示一位小數。

- 23/33＝69.697 → 顯示 69.7，並列為弱項，不顯示 70%。
- 11/13＝84.6 → 顯示 84.6，等級是「熟悉」，不顯示 85%。
- 有答錯就不會顯示 100%。

詳情文字範例：「83%（熟悉）· 6 題、3 種情境；6 題中答對 5 題＝83.3%，四捨五入顯示 83%」。

這個百分比是**練習證據的正確率**，不是科學校準的語法成熟度。RULES.md 和 INTEGRATION.md 都已寫明。

## 三、測試結果（本機實際執行）

| 檢查 | 結果 |
| --- | --- |
| `node modules/learning-profile/test/profile.test.cjs` | **32/32 通過**：原本 24 項依 v1.2 更新預期，新增 25–32 |
| `node modules/learning-profile/test/hand.test.cjs` | **12/12 通過**：手算案例 |
| `node modules/learning-profile/acceptance/check-fixtures.cjs` | **8/8 通過**：驗收存檔和手寫預期一致；用今天的時間重新產生後也通過 |
| `python3 modules/learning-profile/validate_data.py content/learning-profile-v1` | **通過**，0 錯誤、0 警告 |

手算案例在開發中抓到一個真的問題：一開始跨門檻時用「無條件捨去到一位小數」，23/33 會顯示 69.6，但 rawPct 是 69.7，兩個數字互相矛盾。已改成和 rawPct 相同的一位小數。

`test/expected/*.json` 快照已重寫。和 batch-03 相比，只有預期中的變動：

- 顯示分數：80→83、65→67、85→86、70→71。
- 會議「確認事項」「會後行動」的教材句數各減 1，因為談判句的副標籤減少了。
- 新增欄位：`distinctItems`、`trimmed`、`weak`、`lastEvidenceDay`。

## 四、相容性（batch-03 → batch-04）

- `compute()` 的輸出沒有刪除任何欄位，只新增欄位。
- `pct` 的值改變：從 5% 級距變成四捨五入，可能出現一位小數。
- 面板判斷弱項的樣式時，請用 `status` 和 `weak`，不要用 `pct < 70`。
- `mergeEvents()` 還在，但只能用在玩家明確選了「僅合併能力紀錄」的情況。
- 事件格式不變。`at` 仍是 UTC 毫秒，不要換成台北時間。
- 資料版本是 `lp-v1-batch04`。`grammar-items.json` 不變，仍是 batch-02 的 60 題。

## 五、整合驗收案例（29 案 → 37 案）

`acceptance/ACCEPTANCE-INTEGRATION.md` 依 revision 9 修訂：

- 改成比對數值、狀態和證據，不比文字；預期值以手算為主，oracle 只當輔助。
- C1 的預期改為 67%。
- 新增 C9（69.7% 的跨門檻顯示）、C10（台北日期）、E3（移除會議副標籤的句子）、F2（裁切後不虛構歷史）。
- 原本的 F3「還原合併」拆成：
  - F4：整份還原，預覽要寫出裝置上會消失的紀錄。
  - F5：僅合併能力紀錄，預覽新增、重複、衝突、裁切。
  - F6：格式錯誤時，在預覽就擋下。
  - F7：寫入失敗時原子回復。
  - F8：所有還原入口都要先預覽。
  - 不再要求整份還原時保留裝置上較新的紀錄。
- 真機項目和模擬項目分兩欄記錄。
- `make-fixtures.cjs` 會用測試當天的日期產生驗收存檔，不會因為日期過舊而變成「需要重新確認」。

**還沒開始端到端驗收。** 依 revision 9，要等內部 A-ABILITY-INTEGRATION-01 交出 batch-03／04 的串接版。

## 六、給內部的串接前提醒（看過 752f805 原始碼，不是驗收結果）

752f805 是以 batch-02 串接的版本，不是正式驗收對象。下面這些地方換成 batch-04 後要調整：

1. **能力計算的版本**：`ability.js` 載入的是 batch-02 的 `profile.js`（lp-rules-v1：5% 級距、UTC 日期）。換成 batch-04 的 `profile.js` 和資料即可。
2. **談判分類的覆寫**：`ability.js` 裡的 `decide()` 和 `negotiation()` 自己把談判句的會議標籤全部拿掉。batch-04 的資料已經處理好，留著這段會讓 E2 不通過。
3. **弱項樣式**：`cls()` 用 `cell.pct < 70` 判斷弱項，請改用 `cell.weak`。v1.1 起，沒有計分的格也會有 `status: "insufficient"`。
4. **作答來源和連結**：事件沒有 `via`；生活情境（`lifescene.js`）只寫卡冊，沒有寫能力事件，所以 E1 目前沒有入口。
5. **重試和提示的入口**：NPC 時態小任務沒有重試，題目上也沒有提示，所以 B4、B5 在畫面上沒有入口。如果這是設計，請在交件時寫明，驗收會改用其他入口。
6. **還原**：`platform-pm-ability.patch` 是直接覆蓋，這符合 v1 預設的整份還原，但確認畫面要寫出 `deviceOnlyLost`；`validateStore()` 可以取代 patch 裡的形狀檢查。
7. **未提供評估**：面板把沒有題型的時態寫成「還沒有題目（目前沒有能測這個文法的題目）」，可以改用 `describe()` 的「未提供評估」。

## 七、交件檔案

| 檔案 | 說明 |
| --- | --- |
| `modules/learning-profile/profile.js` | lp-rules-v1.2 |
| `modules/learning-profile/test/`：`profile.test.cjs`（32 項）、`hand-fixtures.json`、`hand.test.cjs`（12 項）、`expected/`（快照）、`fixtures/`（範例文法題） | 測試 |
| `modules/learning-profile/acceptance/`：`ACCEPTANCE-INTEGRATION.md`（37 案）、`oracle.cjs`、`make-fixtures.cjs`、`check-fixtures.cjs`、`fixtures/`（以 2026-11-18T12:00Z 為準的範例） | 整合驗收 |
| `modules/learning-profile/`：`tag_source.py`、`build_profile_data.py`、`validate_data.py`、`README.md` | 分類來源和工具 |
| `content/learning-profile-v1/`：`RULES.md`、`INTEGRATION.md`、`event-schema.json`、`item-index.json`、`item-tags.json`、`topic-map.json`、`question-types.json`、`grammar-map.json`、`grammar-items.json`、`coverage.json`、`validation.json`、`report.md` | 資料、規格與報告 |

## 八、限制

- 門檻是 v1 試行值，沒有用真實玩家資料校準。
- 分類和題目是 AI 編輯，沒有老師審核。
- 學習日期固定用 UTC+8。
- 端到端驗收和真機項目都還沒做，要等內部串接版。
