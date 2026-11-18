# 網頁到手機 App 的基礎

這一批提供 PWA／平台邊界及可攜式存檔，不是已建置的 Android／iOS 商店 App。仍沿用純靜態 HTML／JavaScript，沒有加入建置依賴。

## 根程式接線

1. 在 index.html head 加相對路徑 manifest.webmanifest 與 theme-color。
2. 於 rpg.js 前載入 platform.js。boot 後呼叫 Platform.init()；不等待它才進遊戲。
3. RPG 選單新增「App 與存檔」，呼叫 Platform.open({onClose})；將 Platform.isOpen 納入世界 busy／暫停判定，開啟後暫停，onClose 恢復原位置。
4. 外部 AudioPractice r2 已接入 AudioBus；AudioSession 提供遊戲內錄音跟讀。瀏覽器錄音／回放與模擬辨識已測，原生插件與實體手機收音仍待驗。

## 存檔

- Platform.backup() 回傳 application、schemaVersion、encoding、日期及原樣 localStorage 字串。面板可下載 JSON，不上傳進度到任何服務。
- Platform.previewImport(text) 完整驗證後回傳新增、取代及移除鍵清單，不寫入任何資料。
- Platform.restore(text, {confirmed:true}) 才會寫入；失敗時清除本次新資料並回復舊快照。回傳 reloadRequired；面板明確按「確認還原並重新載入」後立即 reload，避免舊記憶體再次寫回。
- 還原採整份遊戲快照取代：備份沒有的遊戲鍵會移除。其他網站／功能的 localStorage 鍵完全不碰，沒有 localStorage.clear()。
- 明列白名單：pm-progress、pm-cards、pm-sents、pm-days、pm-log、pm-sound、pm-best-word／sent／place、pm-rpg-v1、pm-drive-pref、pm-learn-v1、pm-life-v1。新模組讀既有進度，不新增未知鍵；未來要新增鍵必須一併審核這份白名單。
- 上限 4 MB、單值 2 MB、巢狀 32 層；未知鍵、錯誤型別、無效數值、原型污染欄位與未支援存檔版本會在寫入前拒絕。空備份不清除進度。
- 備份保留原本字串與原有欄位；不重新命名舊資料。下載可以保存目前壞掉的資料以供救援，但這種備份在修復前不會通過還原檢查。
- 瀏覽器拒絕 localStorage 或回滾寫入時會清楚回報；無法承諾裝置關閉儲存權限時仍能復原。操作前應保留下載的舊備份。
- PWA 在同一來源保留同一份存檔。不同網域或將來 Capacitor 原生來源不會自動共用 localStorage；先用備份匯出／匯入轉移，不能宣稱已具備雲端同步。

## PWA 與更新

manifest 的 id、scope、start_url 全部相對路徑，適用 /picture-english/ 子路徑，不把程式固定到網域根目錄。初版圖示為通用 SVG；Android／iOS 封裝、商店圖示及真實安裝測試仍需另外完成。

Platform.init() 預設只在 http(s) localhost／127.0.0.1，或 https://leecien.github.io/picture-english/ 註冊 worker。raw.githack、rawcdn.githack、claude.ai、file:// 與原生容器不註冊。其他正式網域要經明確設定／程式審核後新增，不以「所有 HTTPS」視為可信。

核心 shell／必要 JSON 預快取，atlas 模組與字典是可選項，缺少不阻止基本安裝。配音不快取；看過的場景／精靈圖片最多十二張、每張上限 512 KB，總量有限。未看過的圖片、未下載配音及語音辨識不保證離線可用。

worker 快取名稱包含本 App 的路徑，更新只清除同一路徑的本 App 舊快取，不刪其他 App 或其他路徑的快取。核心檔使用同一 worker 版本的快取；更新會等待使用者在設定頁按「更新並重新載入」。每次部署核心改動都要提升 service-worker.js 的 VERSION，避免沿用舊版本名稱。不要在此 worker 內放 skipWaiting() 自動強制更新。

這是離線入口的工程基礎，還沒有離線英語音庫、整套離線題材包或原生背景播放。

## 音訊／原生邊界

Platform.setAudioProvider(provider) 可接外部模組（至少 play／stop），或偵測 window.AudioPractice。Platform.play({text,url,lang,rate}) 優先委派該模組，否則委派原 Pron.play。startRecording／stopRecording 缺實作時明確回傳 unsupported，不自動啟動麥克風，也不新增另一套錄音引擎。

目前 Pron、一般 speak、開車 clip、Battle.playAwait、KK 慢速例字都委派 AudioBus／AudioPractice。AudioBus 合併 provider busy 與單字小卡 hold，再送一次 pron:busy；關閉其中一項不會提早恢復其他播放的倒數。

Platform 優先使用 AudioBus；stopAudio 可停止共享播放。沒有新 provider 的舊版才維持 unsupported 的保守回報，不假裝已停止。

偵測到 Capacitor 僅回報 native-shell，不會呼叫尚未安裝的插件。未來封裝應在這層接原生錄音、檔案匯出與生命週期，再做 Android／iOS 權限、背景／前景、真機與商店測試。

## 驗證

執行 node tests/platform.cjs 驗證存檔格式、確認還原、惡意／超量輸入、交易回滾、白名單、其他鍵不受影響、來源 guard、音訊委派、worker 子路徑、有限圖片快取與更新。

若已啟動本機 HTTP 伺服器，可加 TEST_URL 與 CHROMIUM_PATH 執行同檔，驗證 390px 面板下載、壞檔拒絕、選檔不自動還原，以及明確還原後 reload。這些測試不代表手機麥克風、PWA 系統安裝或商店版本已通過。
