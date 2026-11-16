# 網頁、PWA 與未來手機 App

這次實作保留現有網頁遊戲，新增世界總覽、App／存檔面板、有限離線能力及可輸出的 www/。沒有產生 Android APK、iOS IPA，也沒有提交商店。

## 現在可用

- RPG 選單的「九元素世界」可看世界故事與主題，連到實際已開地圖、既有生活照片與開車情境。未製作地圖和故事階段明確標示，不能把九區藍圖當九張新地圖已完成。
- 「App 與存檔」可匯出本遊戲 pm-* 白名單備份、預覽匯入並明確確認還原。跨網域／未來原生 App 不會自動拿到網頁 localStorage，先用備份檔轉移。
- 正式第一方 HTTPS／localhost 可用 PWA 與有限離線殼；預覽網域不註冊 worker。未下載的錄音、網路語音辨識、裝置 TTS 及未快取照片不保證離線可用。
- 語音與錄音由平台介面接外部 AudioPractice；模組尚未交件時保留現有實作與能力提示，不假裝已支援原生收音。

## 建置網頁資產

開發版仍可直接用 HTTP 伺服器開啟根目錄。Node 22 以上執行：

```sh
npm run build:web
```

不需要安裝 npm 依賴也能建置 www/。腳本只複製執行所需檔案、聲音、壓縮場景圖與必要授權，排除 Git、來源美術及未接入教材。www/ 沒有本專案建置標記時拒絕覆蓋。每次建置依內容產生 worker 版本，減少舊快取卡住；發布整個 www/，不要只換 index.html。

## Android／iOS 路線

選用 Capacitor 作後續原生外殼，保留現有 HTML／JS 玩法。專案已備 package.json、capacitor.config.json 與 www 建置流程；原生平台依賴尚未安裝，原生工程尚未建立。appId 的 com.example.pictureenglish 是開發占位值，正式上架前必須換成專案正式識別碼。

依 [Capacitor 安裝說明](https://capacitorjs.com/docs/getting-started) 與 [環境要求](https://capacitorjs.com/docs/getting-started/environment-setup)，後續安裝依賴，再建立要開發的平台：

```sh
npm install
npm run app:add:android
# 有 macOS／Xcode 的環境再建立 iOS
npm run app:add:ios
```

日後改網頁後執行 npm run app:sync。Android 仍需對應 SDK／Android Studio，iOS 仍需 macOS／Xcode 與簽章環境；以上不是在此機器已成功產出安裝包的宣稱。只需網頁／PWA 時可跳過原生依賴與命令。

## 原生化前仍要完成

1. 將音訊／錄音功能接穩，實測 Android Chrome、iOS Safari 與原生 WebView；瀏覽器的語音辨識 API 不保證能直接在原生外殼工作。
2. 原生存檔接 Preferences／本地檔案或適當資料庫。保持既有 pm-* 語意，在啟動讀取遊戲狀態前完成 hydration；避免非同步原生讀取與現有同步 LS 相互覆寫。
3. [Preferences 官方說明](https://capacitorjs.com/docs/apis/preferences) 指出行動系統可能清除 WebView 的 localStorage。現階段備份功能先解決可攜性，不能把它當成原生持久存檔已完成。
4. 確定正式 App 識別碼、圖示、啟動畫面、音訊／麥克風權限及需要的裝置測試；大型教材與配音採分批下載，不把所有原圖和來源詞典塞進安裝包。
5. 整合前仍維持原存檔相容，不清空主題、卡冊、成就、旅伴或 KK 進度。3,000 詞與 1,000 圖片詞按實際校對和可玩量回報，不因新增原生外殼而算完成。
