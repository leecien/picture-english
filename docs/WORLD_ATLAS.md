# 共鳴群島：九元素世界圖鑑

這一輪把完整世界觀做成可瀏覽、可進入現有內容的世界圖鑑。九個地區各有三個故事階段，共 27 階段與 24 個情境；未實作的地圖和故事以「製作中／故事藍圖」顯示，不能用圖鑑的數量宣稱九張探索地圖或全部主線已完成。

## 世界與內容來源

| 地區 | 目前探索地圖 | 可連接的實際情境 |
| --- | --- | --- |
| 音之新手村 | kk | 已有 KK 老師與原野，字母／聲音／組音 |
| 風之旅行群島 | wind、transport | 機場、海關、行李、飯店 |
| 火之料理港 | food | 餐廳、廚房、購物 |
| 木之森林聚落 | animal、nature | 公園、天氣興趣、問路 |
| 水之療癒鎮 | 地區製作中 | 診所、盥洗、一般健康對話 |
| 土之生活城 | things | 臥室、洗衣、客廳與鄰里 |
| 光之學園 | 地區製作中 | 桌面學習用品、課堂、圖書館 |
| 金之商務都會 | 地區製作中 | 辦公室、自我介紹、會議、電話 |
| 星之文化樂園 | 地區製作中 | 公園興趣、邀約、旅伴心情 |

- 地圖開放狀態由 RPG adapter 提供，不自行改存檔或解鎖。
- 圖片引用來自 data/life-scenes.json；對話引用來自 data/scenes.json；詞語只引用既有計分詞庫或已接入的生活圖目標。沒有把 3,000 詞草稿轉成考題。
- 每個圖片情境有四個真實玩法入口：探索、聽音找物、找物拼字、生活小任務；沒有相應 adapter 就不渲染無效按鈕。
- 現有五區主題地圖保留原名及進度，納入對應元素。這不代表舊主題任務已自動變成世界故事或能領取新獎勵。
- 故事階段的獎勵以「構想」標示；實際取得與完成由任務日誌負責。角色等級與語言程度分開，沒有自稱通過 CEFR 或取得 TOEIC 分數。

## 接線

在 index.html 引用 atlas.css 及 atlas.js；RPG 選單呼叫：

```js
Atlas.open({
  currentMapId: data.at,
  getStatus(region) {
    return {
      unlockedMapIds: region.maps.filter(m => unlocked(m.id)).map(m => m.id),
      completedStoryIds: [], // 只有已有實際紀錄的故事可標完成
      progressLabel: "目前的任務進度"
    };
  },
  onClose: () => { syncPause(); refresh(); },
  travel: mapId => travel(mapId),
  openLife: (sceneId, {mode}) => {
    World.paused = true;
    return Life.open({scene:sceneId,mode,onClose:() => {syncPause();refresh();}});
  },
  openDrive: ({cat,scene,label}) => openDriveFrom({cat,scene,label}),
  openPractice: ({kind,theme,label}) => { /* 原有單字練習；主題篩選由根整合處理 */ },
  openWord: word => Pron.openWord(word)
});
```

Atlas.isOpen 為 boolean getter，應加入 RPG 的 busy/pause 判斷。Atlas 自己不控制 World，也不寫 localStorage。

轉場會先 Atlas.close()、執行 onClose，再呼叫 travel／openLife／openDrive／openPractice。下一個面板的暫停狀態由該 adapter 接手，避免 Atlas 關閉後把生活練習背後的世界恢復。若 adapter 回傳 false 或丟錯，會回到地區詳情並顯示可理解的狀態。

openWord 為可選；沒有提供時會優先使用 Pron.lookup/openWord，詞典尚未有該字時可用 Pron.play 唸整字，不猜 KK。若完全沒有發音能力，單字顯示為一般文字。

## 狀態與限制

- unlockedMapIds 只接受該區已列出的地圖 ID，點擊時再驗一次；最後仍由原 travel() 驗證。
- planned 故事永遠以故事藍圖顯示，即使 adapter 誤送該 stage ID 也不當成已完成。
- 無 getStatus 時保守顯示地圖尚未連接，不預設開放所有地圖。
- 不把部分教材或預覽聲音算成學完 41 音，也不自動發放旅伴、印記、服裝或主線 XP。
- 健康情境只練一般服務對話，不提供診斷、藥名或劑量建議。

## 驗證

```sh
TEST_URL=http://127.0.0.1:8017 CHROMIUM_PATH=/usr/bin/chromium node tests/atlas.cjs
```

tests/atlas.cjs 檢查所有地圖、對話、圖片、單字引用，並在 390px 深淺模式測試鎖定／未製作地區、四種圖片玩法參數、轉場、錯誤復原與存檔不變。

tests/world-app.cjs 使用真正的 RPG 選單與接線，驗證海關跟讀、診所聽音找物、圖鑑上方可見可點的單字小卡、主題單字題池與備份。各入口暫停地圖，返回時保留原位置；一般練習會清除圖鑑的主題篩選。從圖鑑進入的練習可直接回到冒險，不需要先繞回首頁。這些測試使用模擬音訊，不代表 Android／iOS 或真機麥克風已驗收。
