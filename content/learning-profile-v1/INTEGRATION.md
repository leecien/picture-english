# 給內部（遊戲功能）的串接說明：LEARNING-PROFILE-01（batch-01～03，lp-rules-v1.1）

外部只交內容和計算模組。面板、紀錄寫入和練習導向由內部實作。本文是建議，不改你的介面。

## 要載入的檔案

| 檔案 | 大小 | 用途 |
| --- | --- | --- |
| `modules/learning-profile/profile.js` | 小 | 計算模組（`window.LearningProfile`），純函式 |
| `content/learning-profile-v1/item-index.json` | 約 330 KB | 題目 ID → 主題、文法（執行用精簡版，含 batch-02 文法題） |
| `content/learning-profile-v1/grammar-items.json` | 小 | batch-02 文法形式選擇題 60 題（新題型 `grammar:form-choice`） |
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
LearningProfile.describe(p.topics.food.subtopics.ordering.channels.listening);  // 「80%（熟悉）· 6 題、3 種情境」
```

面板文字請一律用 `describe()`，各狀態才會用同一套說法。狀態有五種（v1.1 起，原本的 pending 拆成 none 和 insufficient）：

| 狀態 | 面板文字 |
| --- | --- |
| `none` | 尚待評估 |
| `insufficient` | 證據不足：還需要… |
| `stale` | 需要重新確認（上次 NN%…） |
| `scored` | NN%（等級）… |
| `no-instrument` | 目前沒有能測… |

- 百分比請顯示 `displayPct`；點開詳細時，用 `describe(cell, null, {detail:true})` 顯示 rawPct 和換算方式。

## 每題要寫一筆紀錄（event-schema.json）

| 欄位 | 怎麼填 |
| --- | --- |
| `item` | `s:<英文句子>`、`w:<單字>`，等同 Learn 的 `keyOf(recK, item)` |
| `ctx` | 與 `Learn.grade` 的 ctx 相同 |
| `result` | 第一次送出的結果。時間到填 `timeout`，不是 `wrong` |
| `retries`、`final` | 重試情況。重試只更新同一筆，不另寫新筆 |
| `hint` | 作答前有打開中文提示、點字查義、刪去選項、夥伴提示 |
| `assisted` | 對應目前的 `q.assisted`（只剩一個選項） |
| `revealed` | 跟讀，或作答前已看到／聽到目標英文 |
| `sr` | 只有口說題要填：`{ matched, confidence }` |

### 目前程式中可對應的題型（請以實際程式為準）

| 程式位置 | qtype |
| --- | --- |
| `Learn.wordQuestion` mode `pic`／`listen`／`zh` | `word:pic2word`／`word:listen`／`word:zh` |
| 首頁題型 `TYPES` | `word:<id>`、`sent:<id>`（例如 `sent:order`、`sent:blank`） |
| `Learn.sceneQuestion`，`opt.mode === "listen"` 且有 `q` | `scene:listen`；其他情況是 `scene:zh` |
| 開車模式自己說／跟讀／聆聽 | `drive:speak`／`drive:shadow`／`drive:listen` |
| vocab.js 的 `onAnswer({mode, firstTry, tries})` | `vocab:listen-spelling`、`vocab:example-spelling`。`firstTry` 決定 `result` |
| 生活情境句子填空 | `life:context-blank`（item 是重點字 `w:`，ctx 是 `life:<場景>`）。同一回合用過點字查義，就填 `hint: true` |

舊的 `pm-cards`、`pm-sents`、`pm-learn-v1` 保持原樣。新紀錄建議存在新鍵 `pm-ability-v1`，保留最近 4000 筆。

## 面板建議

- 文法、主題各自列出；每一列分成四個通道：閱讀辨識、聽力理解、句子組合、獨立口說。**不要合成單一答對率**。
- 每格點開可看「評估依據」，內容取自 `basis`：
  - 獨立作答次數、題數、情境數、天數
  - 被排除的作答次數（提示、重試、輔助、重複、超時）
  - 最新證據日期
  - 最近答錯的題目（`recentErrors`）
- 「練習答對率」和「教材覆蓋率」要另外標名稱，不能寫成掌握度。
- 口說格旁邊固定顯示 `p.speakingNote`。
- 舊存檔顯示 `p.legacy.note` 和舊答對數。

## 協調人 2026-11-18 決定的串接重點

1. **一次作答只寫一筆事件**：重試只更新同一筆的 `retries`、`final`。
   - 生活情境填空記成 `item: "s:<句子>"`、`qtype: "life:context-blank"`、`links: { word: "w:<重點字>" }`。
2. **保留筆數**：`pm-ability-v1` 每次寫入後執行 `LearningProfile.trimEvents(events)`，最多保留 4000 筆。
3. **備份與還原**：
   - 備份時把 `pm-ability-v1` 一起匯出。
   - 還原時用 `LearningProfile.mergeEvents(目前裝置的事件, 備份的事件)` 合併，不要直接覆蓋。
4. **入口與情境**：
   - 事件要帶 `via`（`npc:<任務 id>`、`practice`、`battle`）。
   - `ctx` 填情境；文法題用題目內附的 `ctx`。
5. **文法欄**：只顯示 `channels.reading`（標題「文法辨識掌握度」）；其他通道顯示 `describe()` 傳回的「這個通道目前沒有題型」。
6. **入口順序**：先串 NPC 任務和「練習弱項」的入口；已經學過的句型才放進戰鬥。作答前不顯示時態名稱。

## 練習弱項

`p.weak` 只列已達門檻、但低於 70% 的「能力 × 通道」，附最近答錯的題目 ID。

- 主題弱項：從 `topic-map.json` 的 contexts 找出該次主題的場景，再用 `Learn.sceneQuestion(cat, scene, …)` 出題。
- 文法弱項：要等 batch-02 的文法題。
- 練習結束後重新呼叫 `compute()` 即可更新分析。

## 文法形式選擇題（batch-02，新題型 grammar:form-choice）

`grammar-items.json` 有 60 題：五個 v1 時態各 12 題，涵蓋肯定、否定、是非問句、疑問詞問句，分布在食物、旅遊、會議。

**出題時**

- 先顯示 `situation`（中文情境）和 `stem`（題幹），再給三個打亂順序的 `options`。
- `options[0]` 是正解，三個選項只差在文法形式。
- **作答前不要顯示時態名稱**，名稱會洩漏答案。

**作答後**

- 顯示完整英文 `en`、中文 `zh` 和解說 `explain`。

**寫紀錄時**

- `item` 用題目的 `id`（`g:…`），`qtype` 用 `grammar:form-choice`。
- `ctx` 建議用題目裡的 `ctx`（`grammar:<主題>/<次主題>`），跨情境門檻才算得出來。
- 文法題也會算進該次主題的句子層級證據。

**面板的變化**

- 尚未接上這個題型前，時態顯示「目前沒有能測這個文法的題目」，這是正確結果。
- 載入 batch-02 之後的 `item-index.json`，v1 時態改為「尚待評估」；開始作答後會顯示「證據不足：還需要…」，累積到門檻才顯示百分比。
- 非 v1 時態（例如現在完成式）仍維持「目前沒有能測這個文法的題目」。
