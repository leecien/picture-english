# 給內部（遊戲功能）的串接說明：LEARNING-PROFILE-01（batch-01～04，lp-rules-v1.2）

外部只交內容和計算模組。面板、紀錄寫入、備份還原畫面和練習導向由內部實作。本文是建議，不改你的介面。

batch-04 對應派工 revision 9。**和 batch-03 相同的檔名、函式名和欄位名都沿用**；只換掉 `profile.js` 和 `content/learning-profile-v1/` 就能相容接入。

## batch-03 → batch-04 要注意的地方

| 項目 | batch-03（v1.1） | batch-04（v1.2） | 內部要改的地方 |
| --- | --- | --- | --- |
| 顯示百分比 | 以 5% 級距無條件捨去（5/6 → 80） | 四捨五入到整數（5/6 → 83）；跨門檻時顯示一位小數（23/33 → 69.7） | 直接顯示 `pct`／`displayPct` 即可；不要自己再取整數，69.7 要照原樣顯示 |
| 學習日期 | UTC 日期 | 台北日期 | 不用改；面板若顯示日期，用 `basis.lastEvidenceDay` |
| 沒有題型 | 「目前沒有能測…」 | 「未提供評估：…」 | 用 `describe()` 就自動更新 |
| 會議副標籤 | 4 句談判句 | 2 句（I think we have a deal.、Let's put it in writing.） | 換 `item-index.json`。不需要再自己覆寫談判分類 |
| 還原 | `mergeEvents` 聯集 | 整份還原（預設）／明確選用的僅合併能力紀錄，都先預覽 | 見下方「備份與還原」 |
| 新欄位 | — | `weak`（每格）、`totals.distinctItems`、`totals.trimmed`、`basis.lastEvidenceDay`、`previous.asOfDay` | 都是新增欄位，可以不用 |
| 新函式 | — | `previewRestore`、`mergeAbility`、`validateStore`、`atomicWrite`、`displayOf`、`dayOf` | 備份還原才需要 |

## 要載入的檔案

| 檔案 | 大小 | 用途 |
| --- | --- | --- |
| `modules/learning-profile/profile.js` | 小 | 計算模組（`window.LearningProfile`），純函式 |
| `content/learning-profile-v1/item-index.json` | 約 340 KB | 題目 ID → 主題、文法（執行用精簡版，含 60 題文法題） |
| `content/learning-profile-v1/grammar-items.json` | 小 | 文法形式選擇題 60 題（`grammar:form-choice`） |
| `content/learning-profile-v1/topic-map.json` | 小 | 主題、次主題、ctx → 主題 |
| `content/learning-profile-v1/question-types.json` | 小 | 題型 → 通道、真正測到的能力 |
| `content/learning-profile-v1/grammar-map.json` | 小 | 文法地圖（面板列表與順序） |
| `item-tags.json` | 1.1 MB | 完整對照（含來源位置），**不用**在遊戲裡載入，給審核與追溯用 |

## 計算

```js
const p = LearningProfile.compute({
  events,                                  // pm-ability-v1 的作答紀錄（event-schema.json）
  tags: itemIndex.items,                   // item-index.json
  qtypes: questionTypes.types,
  contexts: topicMap.contexts,
  topicMap: topicMap.topics,
  grammarNodes: grammarMap.nodes,
  grammarForms: grammarMap.forms,
  legacy: { cards: CARDS, sents: SENTS },  // 舊存檔只用來列出「舊紀錄」，不計分
  now: Date.now(),
});
LearningProfile.describe(p.topics.food.subtopics.ordering.channels.listening);  // 「83%（熟悉）· 6 題、3 種情境」
```

面板文字可以用自己的說法，但**數值、狀態和證據**要和計算結果一致。用 `describe()` 最省事。

| 狀態 | `describe()` 文字 | 可以算弱項嗎 |
| --- | --- | --- |
| `none` | 尚待評估 | 不行 |
| `insufficient` | 證據不足：還需要…個學習日期… | 不行 |
| `stale` | 需要重新確認（上次 NN%，最後練習 YYYY-MM-DD） | 不行 |
| `scored` | NN%（等級）· N 題、M 種情境 | 只有 `weak: true` 的格 |
| `no-instrument` | 未提供評估：… | 不行 |

- 判斷樣式或弱項，請用每格的 `status` 和 `weak`，**不要**用 `pct < 70`。v1.2 的 `pct` 可能是 69.7 這種一位小數；`status` 不是 `scored` 的格沒有 `pct`。
- 點開詳細時，用 `describe(cell, null, {detail:true})`：「6 題中答對 5 題＝83.3%，四捨五入顯示 83%」。
- 這是練習證據的正確率。不要稱為「語法成熟度」或「獨立造句／口說能力」。

## 每題要寫一筆紀錄（event-schema.json）

| 欄位 | 怎麼填 |
| --- | --- |
| `id` | 唯一值，例如 `t-<毫秒>-<亂數>`。重試只更新同一筆 |
| `item` | `s:<英文句子>`、`w:<單字>`、`g:<文法題 id>` |
| `ctx` | 情境，不是入口：與 `Learn.grade` 的 ctx 相同；文法題用題目附的 `grammar:<主題>/<次主題>` |
| `at` | 第一次作答的 UTC 毫秒（`Date.now()`）。不要換成台北時間，模組會自己換算 |
| `result` | 第一次送出的結果。時間到填 `timeout`，不是 `wrong` |
| `retries`、`final` | 第一次答錯、重試後答對：`result: "wrong"`、`retries: 1`、`final: "correct"` |
| `hint` | 作答前打開中文提示、點字查義、刪去選項、夥伴提示 |
| `assisted` | 只剩一個選項 |
| `revealed` | 跟讀，或作答前已看到／聽到目標英文 |
| `sr` | 只有口說題要填：`{ matched, confidence }` |
| `links` | 句子層級事件連結的單字或句子，例如生活情境填空的 `{ word: "w:<重點字>" }` |
| `via` | `npc:<任務 id>`、`practice`、`battle`。不影響計分 |

- 生活情境填空：`item: "s:<句子>"`、`qtype: "life:context-blank"`、`ctx: "life:<場景>"`、`links: { word: "w:<重點字>" }`。
- 每次寫入後用 `LearningProfile.trimEvents(events)`，保留最新 4000 筆。

## 備份與還原（revision 9）

**不要在還原時靜默合併。** 一定要先顯示預覽，玩家明確按下確認後才寫入。

### 第一版只做一種時：整份還原

```js
const pv = LearningProfile.previewRestore(deviceKeys, backupKeys, "replace", { qtypes });
// 確認畫面顯示：pv.keys、pv.backup（備份能力紀錄筆數）、pv.deviceOnlyLost（裝置上會消失的筆數）
// pv.ok === false 時列出 pv.errors，不能確認
LearningProfile.atomicWrite(localStorage, entriesFromBackup);  // 任何一個鍵失敗就全部回到原狀
```

裝置上較新的能力紀錄在整份還原後**不會保留**。這是預期行為，預覽裡要寫清楚。

### 另外提供「僅合併能力紀錄」時

```js
const pv = LearningProfile.previewRestore(deviceKeys, backupKeys, "merge-ability", { qtypes });
// 顯示：新增 pv.add、重複 pv.duplicate、衝突 pv.conflicts.length（列出 id）、裁切 pv.trimmed、結果 pv.result
const m = LearningProfile.mergeAbility(deviceKeys["pm-ability-v1"], backupKeys["pm-ability-v1"]);
LearningProfile.atomicWrite(localStorage, { "pm-ability-v1": JSON.stringify({ v: 2, events: m.events }) });
```

- 只動 `pm-ability-v1`，其他 pm-* 鍵不動。
- 衝突（同 id、內容不同）時，保留裝置上的原資料，並把衝突 id 告訴玩家。不要自己挑。

### 寫入前驗證

`validateStore(value, qtypes)` 會檢查：形狀、最多 4000 筆、id 不重複、每筆事件合法。內部 752f805 的 `platform-pm-ability.patch` 已經做了類似的形狀檢查，可以改用這個函式，讓兩邊規則一致。

## 面板建議

- 文法、主題各自列出；每一列分成四個通道：閱讀辨識、聽力理解、句子組合、獨立口說。**不要合成單一答對率**。
- 每格點開可看「評估依據」，內容取自 `basis`：
  - 獨立作答次數、題數、答對題數、情境數、學習日期數
  - 被排除的作答（提示、輔助、超時、重複…分開列）
  - 最新證據的台北日期（`lastEvidenceDay`）
  - 最近答錯的題目（`recentErrors`）
- 「練習答對率」和「教材覆蓋率」要另外標名稱，不能寫成掌握度。
- 口說格旁邊固定顯示 `p.speakingNote`。
- 舊存檔顯示 `p.legacy.note` 和舊答對數。

## 文法形式選擇題（grammar:form-choice）

`grammar-items.json` 有 60 題：五個 v1 時態各 12 題，涵蓋肯定、否定、是非問句、疑問詞問句，分布在食物、旅遊、會議。

**出題時**

- 先顯示 `situation`（中文情境）和 `stem`（題幹），再給三個打亂順序的 `options`。
- `options[0]` 是正解，三個選項只差在文法形式。
- **作答前不要顯示時態名稱**，名稱會洩漏答案。

**作答後**

- 顯示完整英文 `en`、中文 `zh`、可播放的發音，以及解說 `explain`。

**入口**

- 先串 NPC 任務和「練習弱項」；只有已在 NPC 任務學過的句型才放進戰鬥（`via: "battle"`）。

## 練習弱項

`p.weak` 只列 `status: "scored"` 而且原始比例低於 70% 的「能力 × 通道」。每項附 `rawPct`、`pct`、`ratio` 和最近答錯的題目 ID。

- 文法弱項：用該時態的文法題，最近答錯的先出。
- 主題弱項：從 `topic-map.json` 的 contexts 找出該次主題的場景，再用 `Learn.sceneQuestion(cat, scene, …)` 出題。
- 練習結束後回到原位置，重新呼叫 `compute()` 更新分析。
