# 九元素世界：四區可玩內容

本批新增水、光、金、星四張實際地圖，補足原有音／風／火／木／土區域的世界框架。這四區各有三位居民、三段按順序完成的任務、五種不同 HP 與招式的普通怪物，以及最後一段的守衛戰。這份文件只把新增的 **4 張地圖、12 段任務、60 個實際題目引用**列為交付；圖鑑中的其他故事不因此自動變成已完成的任務。

## 故事與教材

| 區域 | 三段任務 | 現有題庫 | 普通怪物 HP／守衛 HP |
|---|---|---|---|
| 水之療癒鎮 | 求助指引 → 藥局詢問 → 關心居民、點亮庭院 | life/doctor、life/pharmacy、social/feelings | 28／46／72／58／90；120 |
| 光之學園 | 課堂提問 → 圖書館找資料 → 分工完成展覽 | school/class、school/library、school/group | 30／50／78／64／96；130 |
| 金之商務都會 | 團隊介紹 → 釐清會議訊息 → 協調合作日 | work/intro、work/meeting、work/schedule | 34／56／84／68／104；140 |
| 星之文化樂園 | 分享興趣 → 發出邀請 → 舉辦文化日 | social/hobbies、social/invite、social/party | 32／54／82／66／100；135 |

題庫全部引用 `data/scenes.json` 已有的英文與中文。每段使用該情境前五句，不把 3,000 詞草稿或未審核內容灌入計分。每個引用含 `cat`、`scene`、`index`、`mode:'meaning'`，由 `Learn.sceneQuestion` 產生真正的選擇題；`Learn.grade`／`Talk.quiz` 延續學習紀錄。明確的中文意圖讓「我頭痛」與「我肚子痛」這類都能回應同一個問題的句子，不會被錯當成唯一的自然對話答案。

這一輪的問題模式是「依照中文意圖選英文說法」，並可聽對方的問句。它不是發音評分，也不把答對率換算成 CEFR／多益分數。角色等級與語言程度分開。

## 地圖與角色

`WorldRegions.maps` 可直接加入 RPG 的 maps 陣列，沿用 `World.mount`、同一套 NPC 和玩家繪製器。每張圖為 24×16，`P` 出生點、`@` 回程入口、`m` 普通怪生成點；居民標記為 `a/d/c`，避開繪製器的保留字元。五種普通怪依地圖生成點的掃描次序輪替，實際生成點覆蓋泡泡／史萊姆、鳥、龜、光靈、甲蟲五種外形，各自生命值不同。光靈和甲蟲使用新增 Canvas 造型，沒有食物混種。鳥會蓄力、龜會防禦、光靈會汲取 MP、甲蟲會準備回復，意圖在作答前顯示，答對可打斷。

居民 ID 為 `<region>-guide`、`<region>-helper`、`<region>-keeper`，各自提供 `questId`。對應任務提供 `npcId`。所有居民旁邊都有可達的落腳點；普通怪和入口也可從出生點走到。

全域地圖解鎖由 RPG 判斷。`WorldRegions.status(...).unlocked` 只表示本模組有這張可用內容，不應拿它繞過 RPG 原本的解鎖條件。

## API 與存檔

模組沒有 DOM、音效、localStorage 或直接發獎的副作用。RPG 保存 `pm-rpg-v1.regions`，並將每次操作回傳的 `state` 原子地取代舊資料。

```js
WorldRegions.maps;                  // 四個 World.mount 地圖定義
WorldRegions.has(mapId);
WorldRegions.map(mapId);             // 地圖、NPC、quests、mobs、boss
WorldRegions.normalize(savedState);  // 清理為 version:1 狀態
WorldRegions.status(mapId, state);   // next/active/result/rewardReady/done/seal
WorldRegions.next(mapId, state);     // 第一段尚未完成任務，全部完成則 null
WorldRegions.start(mapId, state, optionalQuestId);
WorldRegions.question(mapId, state, Learn); // 目前尚未回答的 Learn 題目
WorldRegions.questionRefs(mapId, optionalQuestId);
WorldRegions.answer(mapId, state, {index, correct, assisted:false});
WorldRegions.recordBattle(mapId, state, {won:true});
WorldRegions.complete(mapId, state);
WorldRegions.validate(WorldRegions.catalog, scenesJSON); // [] 表示通過
```

所有進度操作回傳 `{ok, state, reason?}`。成功時另附 `quest`、`run`／`result` 等資訊。`start` 重入會接上原題目；傳入後續任務 ID 會回 `quest-locked`。`answer` 只接受目前的 index，阻擋重送與跳題。`question` 在五題已答完後回 null。

狀態結構：

```js
{
  version: 1,
  completed: {water: ['water-1']},
  claimed: {'regions:water-1:first': true},
  runs: {water: {
    questId:'water-2', index:1,
    answers:[{index:0, correct:true, assisted:false}],
    battleWon:false, battleAttempts:0
  }},
  history: {'water-1': {attempts:1, passed:true}},
  seals: {}
}
```

答題結果只依實際答案紀錄重新計算，不採信存檔的 correct 計數。每段必須答完五題，至少四題未經協助答對；`assisted:true` 的答案即使正確，也不算獨立答對。這裡的 assisted 指替代玩家作答／洩漏答案；單純播放發音不應被標成 assisted。失敗後 `complete` 回 `quiz-not-passed`、清除本次 run，保存完成的前段任務及嘗試次數，可重新挑戰。

第三段額外要求 `battleRequired:true`。五題通過後，`complete` 仍回 `battle-required`；RPG 必須真的開啟該任務的 `boss` 戰鬥。`recordBattle({won:false})` 保留已通過的五題，讓玩家直接再戰。獲勝後才可完成任務。

## 領獎流程

`complete` 成功才提供 `reward`，格式如下：

```js
{ id:'regions:water-3:first', xp:45,
  items:{berry:1, dew:1}, seal:{id:'water', name:'水之印記'} }
```

第一段 XP24＋補血1，第二段 XP28＋補魔1，第三段 XP45＋補血1＋補魔1及元素印記。各獎勵有穩定唯一 ID；完成會同時更新 completed／claimed／seals，再次呼叫不會再回 reward。從完成紀錄載入時也補回 claimed，避免舊存檔重領。元素印記是這次確實保存的故事成果，不能宣稱已發送沒有實作的服裝或夥伴。

RPG 必須依序保存回傳狀態、套用該次實際提供的獎勵並保存整體進度。不要用同一份舊 state 同時呼叫 complete 多次；純函式無法替外部非同步呼叫實作交易鎖。若獎勵與進度分開存檔，主程式應以 reward.id 記錄已套用的獎勵，避免崩潰重試造成重領。

建議整合順序：`start → Talk.quiz(question(...)) → answer`，五題完成後一般任務 `complete`；第三段先 `recordBattle → complete`。主程式負責 Talk 關閉／取消、Battle 真實勝敗、XP和背包、地圖解鎖、HUD及對話回原位。

## 驗證

`node tests/world-regions.cjs` 驗證嵌入資料與 JSON 一致、來源引用有效、60 題都能由真正的 Learn 產生唯一答案、四圖通行性、12 種普通怪的 HP、任務順序、協助作答門檻、答題重送、存檔接續、守衛戰敗再戰，以及通關及重載後不重複領獎。這不是手機實際點擊或完整 RPG/Battle 整合測試；整合後仍需由主程式測試走完 NPC→答題→守衛→印記的流程。

## 守衛壓力與公平性

守衛依血量進入三階段，逐步提高攻擊壓力、縮短答題時間並改變意圖。句子至少十秒、其他題至少七秒；聽題／重播／單字小卡／暫停期間都不倒數，長選項仍保留額外時間。蓄力、護盾、汲取都有明確文字預告，答對可以打斷，玩家護盾能阻擋汲取與回復等錯答效果。沒有在播放聽力題時疊加音樂或警報遮住人聲。
