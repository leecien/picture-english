# modules/audio-practice — AudioPractice 音訊、錄音回放與跟讀模組

英語小旅人 B 組獨立模組。基準：b646116250fb33227c46b5fbf6411208892b9882。
不修改根目錄任何檔案；只讀取 `assets/voice/` 作為示範音源。

## 檔案

| 檔案 | 用途 |
|---|---|
| `audio-practice.js` | 模組本體，全域 `AudioPractice`（也可 `require`） |
| `audio-practice.css` | demo／元件樣式，全部 `ap-` 前綴，支援深淺色 |
| `demo.html` | 可獨立執行的完整流程頁 |
| `processed-audio/` | 254 個正規化後音檔，與 `assets/voice/` 同結構；含 `normalize-plan.json` |
| `tools/loudness.py` | 響度量測、正規化、前後比較腳本 |
| `reports/` | 處理前後量測 JSON 與比較表 |
| `tests/audio-practice.test.cjs` | 自動測試（Node 單元＋Playwright Chromium） |

## 啟動

把本資料夾放在專案根目錄的 `modules/audio-practice/`，在**專案根目錄**執行：

```
python3 -m http.server 8000
```

電腦瀏覽器開 `http://localhost:8000/modules/audio-practice/demo.html`。
麥克風只在 `localhost` 或 `https://` 可用；手機要測收音必須用 HTTPS 網址（區網 `http://192.168…` 會被瀏覽器擋）。

## 介面（依 task.md B2 草案）

```js
AudioPractice.play({ text, url, lang = "en-US", rate = 1, fallbackTts = true })
  // → Promise<{ status: "ended" | "cancelled" | "error", source: "file" | "tts", reason?, message? }>
  // 新播放一定先結束前一次（前一次以 cancelled 結束）；url 載入失敗且有 text 時改用裝置朗讀。
AudioPractice.stop()                       // 等待中的 play 以 cancelled 結束
AudioPractice.startRecording({ maxMs, onLevel })  // → { ok } 或 { ok:false, error, message }；必須在點擊事件中呼叫
AudioPractice.stopRecording()              // → { ok, blob, url, mimeType, size, durationMs, peakDb, rmsDb, silent, playable }
AudioPractice.onBusy(cb)                   // cb(busy:boolean, detail) → 回傳取消訂閱
AudioPractice.destroy()                    // 停止全部、釋放麥克風 track、臨時 URL、事件；reset() 可重新啟用
```

草案以外的補充（新增，不改變草案行為）：

```js
AudioPractice.capabilities()   // 播放／朗讀／錄音／辨識來源（browser、claude-dictation、none）
AudioPractice.permissionState()// granted | denied | prompt | unknown
AudioPractice.listen({ lang, maxMs, record, onPartial })  // 一次辨識，可同時錄音
AudioPractice.stopListen()     // 「說完了」：等最後結果
AudioPractice.cancelListen()   // 取消，錄音丟棄
AudioPractice.compare(target, listenResult, { allowHomophones: true })  // 朗讀逐字回饋；句意/拼字用 {mode:"meaning"} 或 {allowHomophones:false}
AudioPractice.useFile(file)    // 不能直接收音時，用選取的錄音檔回放
AudioPractice.lastRecording()
AudioPractice.resetRecordConflict()  // 清除「這台裝置不能同時辨識和錄音」的記憶
AudioPractice.clearRecording() // 只釋放已完成的錄音／blob URL，保留根遊戲的 busy 訂閱
```

### v0.2.0 手機相容（B-AUDIO-01 r2）

- `onBusy(cb)`：`cb(busy:boolean, detail)`，第一參數是布林值。
- 錄音的 AudioContext 在點擊當下同步建立並共用（iOS 在 await 之後建立會停在 suspended）。即時音量計沒有真正運作時，停止後改用 `OfflineAudioContext.decodeAudioData` 解碼錄音檔再量，不會把有聲音誤判成沒聲音；量不到時不宣稱沒聲音。結果帶 `levelMethod: "live" | "decoded" | "none"`。
- 停止錄音先關 track 再回放（iOS 麥克風開著時會走聽筒、聲音很小）。
- `stopRecording()` 另回傳 `activeDb`（說話段電平）與 `playbackGainDb`：把自己的錄音回放調到約 -20 dBFS，+12／-6 dB 為限，峰值不超過 -1 dBFS。`play({ url, gainDb, durationMs })` 經 GainNode 放大；AudioContext 沒有 running 時自動退回一般播放，以免無聲。`durationMs` 補足 webm 沒有長度資訊時的看門狗。
- `listen({ record: "auto" })`：偵測到部分 Android 不能同時辨識和錄音（錄音時辨識回報 audio-capture、辨識有結果但錄音全無聲、或辨識時錄音裝置被占用）後，本分頁記住（sessionStorage），之後跟讀只做辨識，結果帶 `recordSkipped` / `recordConflict`。辨識因此失敗時錯誤為 `record-conflict`，不算答錯。`record: true` 仍強制同時錄音。
- 逐字比對：預設常見同音詞（two/to/too、for/four、there/their…）算「聽到（同音字）」，供朗讀辨識容錯，不代表句意或拼字正確。`compare(target, result, {mode:"meaning"})` 或 `{allowHomophones:false}` 會嚴格比對同音詞，包含其他候選的判斷；`mode:"meaning"` 優先於 `allowHomophones:true`。`red/read` 因 read 有時態發音歧義，不做無條件同音容錯。
- `capabilities()` 增加 `platform`（ios／android／desktop）、`shadowRecord`。

### 錯誤代碼（都不是「英文答錯」）

`permission-denied` 權限沒開 · `env-blocked` 頁面環境不允許（非 HTTPS、內嵌預覽）· `no-device` · `device-busy` ·
`unsupported-recording` · `no-sound` 沒收到聲音 · `no-speech` 沒聽到說話 · `unsupported-recognition` ·
`recognition-failed` 辨識服務失敗 · `recognition-language` · `too-short` · `autoplay-blocked` · `load-failed` · `no-tts`。
每個結果都附 `message`（繁中說明）。

### 逐字回饋

`compare()` 回傳 `status`：`match`／`partial`／`mismatch`／`uncertain`／`no-result`，
`items` 每項有 `state`（`heard` 聽到、`missing` 漏字、`different` 不同詞＋`heard` 聽成什麼、`extra` 多說、`unsure` 不確定）、
文字 `label` 與符號 `mark`，畫面不只靠顏色。低信心（<0.4）或次佳候選吻合時全部標中性「不確定」。
這是**文字辨識比對**，不是 KK 音素或口音評分。

## 接入建議（由協調人整合）

1. `index.html` 載入 `modules/audio-practice/audio-practice.js`，之後把現有 `VOICE`／`speak()`／`clip()` 的播放改呼叫 `AudioPractice.play()`，保持「一次只有一個音訊管理者」。
2. 戰鬥／KK 倒數：`AudioPractice.onBusy((busy, detail) => busy ? pauseTimer() : resumeTimer())`。模組在切背景時會自己停止播放與收音並送出 busy=false，遊戲的倒數凍結仍由遊戲自己判斷 `visibilitychange`。
3. 開車模式的跟讀可改用 `listen({ record:"auto" })` 取得錄音回放；`compare()` 的狀態可對應目前 `Speech.judge()` 的 pass／partial／fail／uncertain／silent。
4. 正規化音檔：確認試聽後，由協調人決定是否以 `processed-audio/` 取代 `assets/voice/`（同檔名同結構，只換資料夾即可）。
5. 離開練習畫面先 stop／cancelListen，若有單獨錄音則 await stopRecording，再 clearRecording。不要每次關閉面板都 destroy 共享引擎，因為它會清掉根遊戲的 busy 訂閱；整個頁面卸載時才 destroy。

整合時補修：等待 getUserMedia 權限提示期間取消辨識，現在會立即完成 cancelled，不繼續等待尚未回來的權限 Promise。若使用者稍後才允許，晚到的 stream 會全部 stop，不開始錄音。新增 clearRecording 僅是生命週期清理介面，不改逐字比對演算法。

## 響度處理

```
python3 tools/loudness.py measure   --root <專案根> --out reports/loudness-before.json
python3 tools/loudness.py normalize --root <專案根> --dest processed-audio --target -18 --ceiling -1.5
python3 tools/loudness.py measure   --root processed-audio --prefix "" --out reports/loudness-after.json
python3 tools/loudness.py compare   reports/loudness-before.json reports/loudness-after.json --md reports/loudness-table.md
```

需要 ffmpeg 與 numpy。來源檔不會被修改。

## 測試

```
python3 -m http.server 8811     # 在專案根目錄
node modules/audio-practice/tests/audio-practice.test.cjs
```

需要 playwright 與 Chromium。錄音測試使用 Chromium 假麥克風（播放 `tests/fixtures/*.wav`）；
語音辨識在無頭瀏覽器中為模擬。兩者都**不等於**真機測試。
