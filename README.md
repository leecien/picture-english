# 看圖記英語

用圖像記憶練英文單字和句子的網頁遊戲。程式、內容和素材分開放，不會寫程式的人也能新增單字、句子或替換音效。

## 資料夾

```
index.html              遊戲程式（畫面、玩法、音效、存檔）
data/words.json         單字
data/sentences.json     句子
data/themes.json        主題、元素、句子路線
data/levels.json        程度等級、卡片等級、成就
assets/manifest.json    音效、背景音樂、短片的素材空位
assets/sfx/             音效檔
assets/bgm/             背景音樂
assets/video/           劇情短片
assets/voice/words/     單字配音
assets/voice/sentences/ 句子配音
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
