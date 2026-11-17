# 遊戲內錄音與跟讀

`audio-session.js` / `audio-session.css` 提供滿版面板，使用外部 `modules/audio-practice/audio-practice.js` 的播放、錄音、語音辨識與逐字比對，不另建辨識引擎。

## 接線

先載入外部 `audio-practice.js`，再載入 `audio-session.js`；樣式載入 `audio-session.css`。若有中央 `AudioBus`，示範優先走 `AudioBus.play()`，套用既有音訊對照與音量處理。自己的 Blob 錄音直接由 `AudioPractice.play()` 回放，不改寫來源。

```js
AudioSession.open({
  label: '風之旅行・海關',
  items: [{id: 'customs-1', en: 'I am here for sightseeing.', zh: '我是來觀光的。', audio: 'assets/voice/example.mp3', kind: 'sentence'}],
  onClose() { /* 回復 RPG 暫停狀態 */ },
  onResult(result) { /* 主程式決定是否更新學習紀錄 */ }
});
AudioSession.isOpen; // boolean getter，主程式 busy / World.pause 納入此值
AudioSession.close();
```

每次 `open` 最多接受 100 項非空英文；英文長度上限 600。輸入資料以 `textContent` 顯示。面板不讀寫 `pm-*`，也不自行發送 `pron:busy`，避免和中央播放暫停狀態重複。

## 學習流程與完成判定

1. 示範確實播放完才開放跟讀。播放取消或失敗不算聽完。
2. 跟讀以辨識文字逐字顯示「聽到、漏字、不同詞、多說、不確定」；吻合才顯示「試著自己念」。跟讀不回報通關。
3. 自己念階段在作答前清除英文文字與逐字提示，只留中文。使用者選「需要示範」會返回跟讀並重新要求示範及吻合。
4. 自己念的最佳辨識候選吻合才呼叫 `onResult`，同一題本輪只回報一次。每次重新開啟為新的練習輪次，跨輪去重由主程式負責。

```js
{
  status: 'match',
  item: originalInputItem, // 原物件；保留 kind / 題庫其他欄位
  id, index, en, zh,
  basis: 'speech-recognition-text-match',
  shadowPassed: true,
  independentPassed: true,
  attempts,
  recordingAvailable
}
```

Session 以 `{allowHomophones:true}` 做朗讀容錯，並在提示標示不是句意評分。需要判斷拼字或句意的呼叫端必須使用 `compare(target,result,{allowHomophones:false})` 或 `{mode:"meaning"}`；後者即使同時設 true 也維持嚴格。移除 `red/read` 無條件同音判定，因為 read 的讀音依時態而異。

低信心、沒有結果、權限拒絕、無辨識支援、聆聽、只錄音、略過都不算完成。綠色代表語音辨識聽到相應文字，**不是 KK 音素或口音評分**。畫面有持續的說明和文字標籤，不只依賴紅綠色。

## 麥克風、回放與降級

收音從使用者點擊直接呼叫 `AudioPractice.listen()` 或 `startRecording()`，沒有先 await 播放破壞手勢權限。跟讀勾選「保留錄音」時使用 r2 的 `record:"auto"`，裝置衝突後自動改只辨識；結果的 `recordSkipped` / `recordConflict` 會明說「本次未保留錄音」，不提供靜音失敗錄音回放。取消勾選則傳 `record:false`，只做辨識；也可獨立「只錄音回放」，不冒充自動評分。無辨識支援時仍可錄音回放。權限或裝置不可用會顯示具體失敗原因。

部分手機不允許瀏覽器 SpeechRecognition 與 MediaRecorder 同時使用麥克風；這需要真機驗證。面板提供上述兩條替代操作，不保證所有 Android / iOS 瀏覽器可同時錄音與辨識。辨識服務可能需要網路，錄音本身不代表能離線評分。音訊不由面板自動上傳；瀏覽器語音辨識可能使用其供應商的服務。

`levelMeasured:false` 只顯示「無法確認音量」，不宣稱沒聲音。使用者可重聽、重錄和播放自己的錄音；回放帶 r2 的 `playbackGainDb` 與 `durationMs`，可取消「回放音量平衡」。缺少長度時沿用引擎的回放看門狗。每次替換錄音會釋放舊 Blob URL。取消、離開、切背景均停止播放、取消辨識、停止錄音及釋放 URL；切回畫面不會自動重新收音，必須點「我準備好了」。共用引擎不會在關閉面板時 `destroy()`，保留中央 busy 訂閱。頁面最終離開的 `destroy()` 由主程式處理。

## 外部套件的最小增量

- 新增 `AudioPractice.clearRecording()`：清除最後錄音及其 URL，不破壞共享訂閱。呼叫前先取消/停止當前錄音。
- 修正 `listen({record:true})` 在 `getUserMedia` 權限尚未回應時取消會卡住：立即取消並讓 Promise 結束；稍後才取得的 stream 全部停止。
- README 修正 `onBusy((busy, detail) => ...)` 的實際介面，加入安全關閉流程。
- 外部測試支援 `CHROMIUM_PATH=/usr/bin/chromium`，r2 的 54 項加兩項生命週期回歸測試與一項嚴格比對測試，共 57 項。

## 驗證

```sh
TEST_URL=http://127.0.0.1:8137 CHROMIUM_PATH=/usr/bin/chromium node modules/audio-practice/tests/audio-practice.test.cjs
TEST_URL=http://127.0.0.1:8137 CHROMIUM_PATH=/usr/bin/chromium node tests/audio-session.cjs
```

獨立驗收結果：外部套件 57/57；面板 10 項流程契約全部通過。面板測試使用真實逐字比對函式，控制錄音與辨識傳輸，涵蓋示範閘門、逐字回饋、獨立完成回報、作答前隱藏英文、聆聽/略過不計分、失敗中性處理、Blob 釋放、背景暫停、390px 深淺模式、提示對比至少 4.5:1、存檔不變與輸入安全。外部套件的錄音測試實際經過 Chromium 假麥克風 → MediaRecorder → Blob → 回放；SpeechRecognition 使用控制假件。

另外在完整遊戲入口以實際 AudioBus / AudioPractice 執行：示範 WAV → 假麥克風錄音一秒 → 停止後確認全部 tracks ended → Blob 回放 → 關閉面板；沒有非預期頁面錯誤、沒有錯計完成。尚未以實體手機麥克風驗證。
