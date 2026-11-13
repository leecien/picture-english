# 看圖記英語

用圖像記憶練英文單字和句子的網頁遊戲。程式、內容和素材分開放，不會寫程式的人也能新增單字、句子或替換音效。

## 資料夾

```
index.html              遊戲程式（畫面、玩法、音效、存檔）
data/words.json         單字
data/sentences.json     句子
data/themes.json        主題、元素、句子路線
data/levels.json        程度等級、卡片等級、成就
data/scenes.json        開車模式的情境對話（8 大類、59 個場景、465 句）
assets/manifest.json    音效、背景音樂、短片的素材空位
assets/sfx/             音效檔
assets/bgm/             背景音樂
assets/video/           劇情短片
assets/voice/words/     單字配音
assets/voice/sentences/ 句子配音
assets/voice/zh/        開車模式的中文提示（words、sentences、ui 固定用語）
assets/images/words/    單字圖片
```

## 新增單字

在 `data/words.json` 加一筆：

```json
{"word":"orange","zh":"柳橙","emoji":"🍊","kk":"[ˋɔrɪndʒ]","theme":"food","level":1,"image":"","audio":""}
```

- `theme`：`food` 美食市場（火）、`animal` 動物森林（木）、`nature` 天氣與自然（水）、`transport` 交通與旅行（風）、`things` 生活與城市（土）
- `level`：1 是 A1、2 是 A2、3 是 B1、4 是 B2。玩家升到對應等級才會出現（等級表在 `data/levels.json` 的 `maxLevel`）。分級測驗會從各級抽題，所以每一級最好至少有 12 個單字、6 句句子
- `image`、`audio`：有素材就填路徑，例如 `assets/images/words/orange.png`；留空就用 emoji 和裝置朗讀
- `audioZh`：開車模式用的中文提示語音（單字是「柳橙，英文怎麼說？」，句子是中文翻譯），例如 `assets/voice/zh/words/orange.mp3`；留空就用裝置的中文朗讀

## 新增句子

在 `data/sentences.json` 加一筆：

```json
{"en":"I buy bread at the bakery.","zh":"我在麵包店買麵包。","scene":"🧑 🥖","blank":"bakery","distractors":["river","sky","bed"],"level":1,"route":"daily","image":"","audio":""}
```

- `blank`：填空題要挖掉的字，必須真的出現在句子裡
- `distractors`：三個錯誤選項
- `route`：`daily` 日常、`travel` 旅遊、`school` 校園、`business` 商務
- 句子排序題只會用 8 個字以內的句子

## 替換音效和素材

`assets/manifest.json` 列出每個空位。把檔案放進對應資料夾，再把路徑填進 `file`：

```json
"correct": {"file":"assets/sfx/correct.mp3", "use":"答對", "spec":"mp3，1 秒內"}
```

`file` 留空時遊戲會用內建的合成音效，所以素材可以一個一個慢慢補。

| 空位 | 用途 | 建議格式與長度 |
|---|---|---|
| sfx/correct | 答對 | mp3，1 秒內 |
| sfx/wrong | 答錯 | mp3，1 秒內 |
| sfx/tap | 點字母、點單字 | mp3，0.2 秒內 |
| sfx/pair | 配對成功一組 | mp3，0.5 秒內 |
| sfx/cover | 閃現記憶蓋牌 | mp3，0.5 秒內 |
| sfx/streak | 連對 3 題以上 | mp3，1 到 2 秒 |
| sfx/levelup | 程度升級 | mp3，2 到 4 秒 |
| sfx/newcard | 獲得新卡片 | mp3，1 秒內 |
| sfx/cardup | 卡片升級 | mp3，2 秒內 |
| sfx/badge | 獲得成就 | mp3，1 秒內 |
| sfx/roundend | 回合結束 | mp3，2 秒內 |
| sfx/combo | 元素合體技（下一階段） | mp3，2 秒內 |
| sfx/hit | 射擊場打中靶（下一階段） | mp3，1 秒內 |
| bgm/* | 各場景背景音樂 | mp3，30 到 60 秒循環 |
| video/* | 路線開場短片 | mp4，15 到 30 秒 |
| 單字、句子配音 | 資料檔的 audio 欄位 | mp3，每個字或每句一檔 |
| 單字圖片 | 資料檔的 image 欄位 | png，正方形，512×512 |

## 存檔

玩家的分數、卡片和學習紀錄存在瀏覽器裡（localStorage，鍵名以 `pm-` 開頭）。改版時不要改這些鍵名，玩家的進度才會保留。

## 提交修改

1. 開一個新分支
2. 改資料檔或放素材
3. 用瀏覽器開 `index.html` 試玩（需要用本機伺服器，例如 `npx serve .`，直接雙擊檔案會讀不到資料檔）
4. 發 Pull Request，說明新增了什麼

## 滿版 RPG

開啟網頁直接進入佔滿手機畫面的遊戲。上方是 HP／MP、目前目標（點開是任務日誌）與選單；右下角是補給、休息、背包、戰鬥與互動（💬 會自動走到目前目標的居民）。選單可開世界地圖、任務日誌、開車模式、練習與成就、卡冊、學習紀錄、麥克風檢查與音效。

- **KK 新手村**：新玩家的出生地。四位老師教母音、子音、重音與整字發音（每課 5 題，題目用題庫的 `kk` 與錄音；單一音標用示範單字的錄音，不用語音合成念音標）。四課完成後與村口的搗蛋音節泡泡進行教學戰鬥，畢業後傳送門通往風之旅行群島。
- **風之旅行群島**：初級旅遊英文故事，機場報到 → 海關（回答觀光或出差會改變後續問題）→ 找回行李（到櫃檯申報或自己追海鷗，飯店對話會不同）→ 飯店入住。每段標示會學什麼、程度與多益準備目標（只說明題型方向，不換算分數）。內容使用 `data/scenes.json` 的共用 ID（例如 `wind/travel/customs/1`），任務中可直接切到開車模式練同一批情境，回來時位置和任務不變。
- **五個主題地圖**（美食市場、動物森林、自然湖畔、旅行車站、生活小鎮）：保留原本的兩項十題任務、寶箱與依序解鎖；任務改在場景內的對話框中作答。
- **回合制戰鬥**：碰到怪物進入戰鬥，選攻擊（不耗 MP）、技能（答英文題，耗 MP）、道具或逃跑。答對立刻造成傷害或回復；勝利拿掉落物後回到原地，倒下會在地圖入口醒來。只有答對的英文會寫進卡冊、成就、XP 與學習紀錄。

RPG 存檔在 `pm-rpg-v1`，原有 `pm-` 學習紀錄維持相容。程式：`world.js`（場景引擎）、`learn.js`（共用英文題與計分）、`battle.js`（數值、道具、回合制戰鬥）、`rpg.js`（地圖、NPC、故事、選單），樣式 `rpg.css`、`shell.css`。角色精靈圖在 `assets/sprites/`，原圖可用 `tools/prepare_sprites.py` 整理。改版計畫見 [RO_PLAN.md](docs/RO_PLAN.md)，合作方式見 [Claude 合作文件](docs/CLAUDE_HANDOFF.md)。

測試（需本機伺服器與 Playwright）：`node tests/story.cjs`（滿版與開場路線）、`node tests/battle.cjs`、`node tests/rpg.cjs`（存檔相容與舊地圖）、`node tests/drive.cjs`（開車模式與麥克風檢查）。

## 開車模式

可選單字、句子、混合，或「情境對話」：8 大類（旅遊、餐廳、購物、生活、社交、職場、校園、緊急狀況）共 59 個場景、465 句，例如旅遊有機場報到、安檢、飛機上、海關入境、領行李、換匯、飯店入住、客房問題、問路、叫車、地鐵、租車、觀光景點。選單一場景會依真實對話順序練習，選整個分類或「🎲 隨機」會打散。對方先用英文開口，你聽中文提示後用英文回答；答對記進句子紀錄，學習紀錄會標出場景名稱。判斷答案時接受數字（5 days）、縮寫（I'm）與連寫（checkout），但關鍵字要對。播放速度（慢／稍慢／正常）和「想一想」秒數可在開始前或播放中調整，畫面底部固定有暫停與停止鍵。收不到聲音時用「🎤 麥克風檢查」分別測權限、收音音量與語音辨識；練習中收音失敗會暫停並說明原因，可重試或改用跟讀。錄音回放尚未實作。偏好存在 `pm-drive-pref`。

新增情境：在 `data/scenes.json` 的分類裡加一個場景，每句寫 `en`（要說的英文）、`zh`（中文提示），需要對方先開口就加 `q`。情境句沒有錄音檔時用裝置朗讀。
