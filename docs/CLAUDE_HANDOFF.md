# 看圖記英語：RPG 藍圖與美術合作

## 目前交付範圍

純靜態網頁，不需要建置。`index.html` 保留原有題庫載入、十種題型、音效、朗讀、卡冊、成就、分級、開車模式與學習紀錄。`world.js` 是俯視角 Canvas 場景引擎（點地面走路、八方向尋路、鏡頭跟隨、角色與怪物動畫、素材替換接口）；`rpg.js` 放五張 24×16 地圖內容、NPC 對話、主題任務、探索寶箱與地圖解鎖；`rpg.css` 負責介面與手機版。

RO 風格改版的分階段計畫、目前完成度與美術清單見 [RO_PLAN.md](RO_PLAN.md)。`battle.js` 是第二階段戰鬥（HP／MP、普攻、掉落、補給、休息、倒地恢復），存在 `pm-rpg-v1.hero`。英文技能戰鬥與 KK 新手村尚未實作。測試：`node tests/rpg.cjs`、`node tests/battle.cjs`。

五站依序為莓果美食市場、兔兔動物森林、雨滴自然湖畔、微風旅行車站、星光生活小鎮。每站有單字、句子各一個十題任務；答對七題完成，首次完成加 30 XP，兩項都完成後解鎖下一站。每張地圖另有一次性的 15 XP 寶箱。任務重玩仍保留正常答題 XP 與卡片紀錄，但不重複發放首次獎勵。離開未完成任務不會完成或解鎖。

單字依原有 theme 抽題；句子沿用 daily / school / travel / business 路線。若目前程度沒有指定路線的句子，先用 daily，避免向初學者提供過難題目。點地面或觸控走路，點居民或寶箱會自動走過去；鍵盤方向鍵 / WASD 移動、E 互動。

## 不可破壞的相容契約

- 不改名、不清除、不遷移原有 `pm-progress`、`pm-cards`、`pm-sents`、`pm-days`、`pm-log`、`pm-sound`、`pm-best-*` 等鍵及其資料形狀。
- RPG 使用獨立 `pm-rpg-v1` 鍵，包含 version、map、positions、cleared、chests；場景位置另存在新增的 `world` 欄位（`positions` 保留 PR #1 的九宮格意義，不再寫入）。
- 共用原有 `start`、`take`、`done`、`record`、`finish`、`addXP`，讓任務答題繼續產生卡片、成就與紀錄。
- 原有單字、句子、程度和素材 manifest 保留；沒有插圖繼續使用 emoji。
- 使用新分支和 PR，不直接推送 main。接手前先查看本次 RPG PR，避免同時修改同一個分支。

## 美術合作方式

1. ChatGPT 負責畫圖；使用者確認風格、下載並上傳素材；Claude 負責引用素材、整合與回歸測試。
2. 先畫 apple、cat、sun 三張風格樣張，使用者確認後再完成第一批十張：apple、cat、sun、car、book、umbrella、elephant、bread、rain、key。
3. 其餘以 `data/words.json` 的實際內容為準，依 level 1、2、3、4 分批，不預設總張數。
4. 檔案放 `assets/images/words/`，透過該筆單字的 `image` 欄位引用。檔名英文小寫，空格換成 `-`，例如 `ice-cream.png`。
5. PNG、512×512、透明背景（或白底），單一主體置中留白，沒有文字、字母、品牌或現有卡通角色。縮小至約 80×80 仍能辨識。風格為明亮、輪廓清晰的扁平插畫，線條及光影一致。
6. 原版藍 `#2C59F0`、黃 `#FFB400` 與本次 RPG 的柔和草綠／奶油色皆是參考；先由使用者確認一套共用風格，避免單字圖、NPC 和地圖各自使用不同畫風。

目前角色、NPC、場景裝飾使用 emoji + CSS；本次未產生或整合新插圖。後續可逐步改為原創角色、方向動畫、地圖 tile、NPC 肖像、句子情境圖與卡片外框。這些屬後續藍圖，尚未實作。

## 接圖驗收

確認路徑及檔名大小寫、圖片透明度、手機辨識度與無文字要求。檢查看圖選字、看字選圖、配對、記憶、拼字以及卡冊；有圖與無圖的單字應可混用。不要將圖片檔名當作單字 ID，也不要改掉已存在的英文單字鍵值。

## 本機驗證

執行 `python -m http.server 8000`，用瀏覽器開啟 `http://localhost:8000`。測試腳本見 `tests/rpg.cjs`，需要 Node、Playwright 與 Chromium：

```sh
npm install --no-save --package-lock=false playwright
node tests/rpg.cjs                      # 使用 Playwright 內建 Chromium
CHROMIUM_PATH=/usr/bin/chromium node tests/rpg.cjs   # 或指定系統 Chromium
```

可用 `TEST_URL` 指定其他本機網址。腳本測試舊存檔保留、手機版寬度、碰撞、任務共用紀錄流程、成就、重複獎勵防止、失敗任務、地圖解鎖、重載存檔、五張地圖及低程度句子題池。任務答對紀錄是透過共用 grading API 注入，未自動逐一操作所有拼字及配對答案；新素材仍需人工試玩確認。截圖輸出到 `/tmp/picture-rpg-desktop.png` 與 `/tmp/picture-rpg-mobile.png`。
