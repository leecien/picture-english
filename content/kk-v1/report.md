開發方：外部開發者（Claude，claude.ai 工作階段）
交件編號：B-KK-DATA-01 / batch-01（generation 1，task.md revision 7，sha256 22f3bf44…已核對）
使用的基準版本：無 Git 開發來源包 picture-english-fbfb7f9-source-no-original-art.zip（SHA256 a9a70f9e702ba9040f1aac2d48e4765cf473c97f286cb63d2198fd52f83cc2b6，ref fbfb7f9）
交件時間（UTC）：2026-11-17

## 一句話

**41 音教材支援資料一次交齊**（N01–N11，含優先的 N04–N11 共 28 音）。validator 0 錯誤、0 警告。41 音全部接受；189 個例字中 187 個 reviewed、2 個 needs-review。這是 AI 教材編輯，不是真人教師審核，也不是真人錄音。

## 交付內容

| 檔案 | 內容 |
| --- | --- |
| content/kk-v1/kk-sounds-reviewed.json | 12 章（N00–N11）、41 音。每章：新音、配對資料（matches）、完整組音字（builds）、位置辨認題候選（positionQuestions）。每音：口形／氣流提示、拼字規律、例外、例字、有錄音的例字、易混音、口音說明、reviewer/source。 |
| content/kk-v1/words-reviewed.json | 189 個例字。每字：word、zh、kk、sounds、chunks（text＋soundTokens，不發音的 chunk 是空陣列並標 silent）、syllables（count／stress／spelling）、positions（first／last／vowel）、uniqueSounds、readyChapter、audio、avoidDistractors、reviewStatus。 |
| content/kk-v1/validation.json | 獨立 validator 的實際輸出。 |
| modules/kk-data/kk-validate.cjs | 可獨立執行的內容驗證器（純 Node，無相依套件，只讀不寫）。 |
| modules/kk-data/kk_source.py、build_kk.py | 人工編寫的原始資料與產生 JSON 的工具，方便協調人修改後重建。 |

沒有修改 index.html、novice.js、rpg.js、learn.js、pron.js、battle.js、存檔或 assets。

## 各章摘要

| 章 | 音 | 配對資料 | 完整組音字 | 位置題候選 | 有錄音的例字數 |
| --- | --- | --- | --- | --- | --- |
| N01 | /k/ /æ/ /t/ | 4 | 2（有錄音 1） | 92 | /k/ 3、/æ/ 3、/t/ 3 |
| N02 | /m/ /n/ /s/ /f/ | 6 | 4（有錄音 0） | 85 | /m/ 3、/n/ 3、/s/ 3、/f/ 3 |
| N03 | /p/ /b/ /d/ /g/ /h/ /l/ | 8 | 8（有錄音 2） | 90 | /p/ 2、/b/ 3、/d/ 3、/g/ 3、/h/ 3、/l/ 3 |
| N04 | /ɛ/ /ɪ/ /ɑ/ /ʌ/ | 12 | 10（有錄音 6） | 62 | /ɛ/ 2、/ɪ/ 3、/ɑ/ 3、/ʌ/ 2 |
| N05 | /ʊ/ /ɔ/ | 8 | 8（有錄音 3） | 15 | /ʊ/ 2、/ɔ/ 3 |
| N06 | /i/ /u/ /e/ /o/ | 19 | 10（有錄音 4） | 49 | /i/ 2、/u/ 2、/e/ 3、/o/ 2 |
| N07 | /v/ /z/ /θ/ /ð/ | 10 | 10（有錄音 1） | 25 | /v/ 2、/z/ 2、/θ/ 2、/ð/ **0** |
| N08 | /ʃ/ /ʒ/ /tʃ/ /dʒ/ | 11 | 10（有錄音 3） | 24 | /ʃ/ 2、/ʒ/ **0**、/tʃ/ 2、/dʒ/ 2 |
| N09 | /ŋ/ /r/ /w/ /j/ | 12 | 15（有錄音 10） | 22 | /ŋ/ 2、/r/ 2、/w/ 1、/j/ 2 |
| N10 | /aɪ/ /aʊ/ /ɔɪ/ | 10 | 10（有錄音 2） | 27 | /aɪ/ 2、/aʊ/ 2、/ɔɪ/ **0** |
| N11 | /ə/ /ɝ/ /ɚ/ | 8 | 11（有錄音 7） | 29 | /ə/ 2、/ɝ/ 2、/ɚ/ 3 |

- 「完整組音字」：該章結束時，字裡每個音都已教過，不需要預填任何格子。
- 「位置題候選」：目標音是這一章新教的音，而且就在那個位置。有錄音、沒錄音的都列出，各附 audio 欄位，可依需要過濾。

## 依 task.md 逐項說明

1. **順序與內容**
   - 41 音照 novice.js 的 Novice.CHAPTERS 排列。validator 用 --root 時會直接載入 novice.js 比對。
   - N01–N03 的口形說明沿用 novice.js 原文（source 註明），拼字和例字重新核對過。N04–N11 由我新寫。
   - 每音都有中文口形／氣流提示、至少 2 個美式例字、常見字母組合、例外說明、章節 ID 和 reviewer/source。
   - KK 全部手寫。原 80 詞的 KK、中文、錄音直接取自 data/words.json，validator 會逐字比對，沒有改。
2. **例字資料**
   - chunks 依拼字切開，文字拼回整字，音素合回去掉重音後的 KK，validator 每個字都會核對。
   - 一個 chunk 可以有多個音（x → /k s/、qu → /k w/）；不發音的 chunk 是空陣列。
   - 音節數和重音位置由 KK 重新計算後比對；拼字分音節也要能拼回整字。
   - 「母音」位置題只用在只有一個母音的字，多音節字不會出「中間母音」這種含糊的題。
   - uniqueSounds 列出在字裡只出現一次的音。只有這些音適合做「點出發這個音的字母」題，例如 dad 的 /d/ 出現兩次，就不列。
3. **配對資料**
   - 共 108 筆「字母組合＋情境例字→聲音」，每筆都標出是哪個 chunk。
   - 同一個字母組合在不同字念不同音時，全部標 contextDependent，並放對照例。例如 ea：bread /ɛ/ 對 tea /i/；oo：book /ʊ/ 對 moon /u/；ow：snow /o/ 對 cow /aʊ/；s、th、g、y、o、u、er 也都有對照。
   - a_e、o_e、i_e 標出母音 chunk 和字尾不發音的 e 兩個位置。
   - qu 一律是 /k w/（quit、quick、有錄音的 squirrel），validator 強制檢查。
4. **完整組音**：每章至少 2 個字，實際是 2–15 個。都用已教的音，沒有預填未教的音。
   - /ʒ/ 的字都有兩個以上音節，而且帶 N11 才教的 /ə/、/ɚ/，所以 N08 只做聽音和拼字對應，不硬湊 /ʒ/ 的組音題。
   - function words（this、that、his、my、you、her）較抽象，建議用聽音拼讀，不做看圖題。
5. **音訊**
   - 有錄音的例字共 52 個，都已確認檔案存在於來源包的 assets/voice/words/。
   - 其他字標 device-whole-word（file 為 null），附註「不是單音示範，不可用 TTS 念 KK 符號」。
   - 每個音的 demo.singleSoundRecording 都是 null。
   - /ɑ/–/ɔ/：所有不在 r 前的 /ɔ/ 字（dog、ball、talk、walk、tall、law、song）都附口音說明，avoidDistractors 含 /ɑ/，出題時不拿 /ɑ/ 當干擾選項，裝置朗讀念成 /ɑ/ 也不判玩家錯。r 前的 /ɔ/（horse、passport）美式穩定，不受影響。
   - /e/、/o/ 用本遊戲傳統 KK 記法，並註明等於 IPA 的 /eɪ/、/oʊ/。
   - 共 17 個母音、24 個子音。
6. **validator**
   - 檢查項目：41 個唯一音、17／24 分類、每音兩個例字、拼字與 KK 拆解、題目位置、配對情境、各章的先備音。
   - 另外檢查：qu 必須是 /k w/、/ɔ/ 合流標註、錄音檔是否真的存在、原 80 詞沒被改。
   - 已用 8 種故意寫錯的資料測試，validator 全部抓到：qu 只念 /k/、組音字含未教音、多母音字出母音題、少了合流標註、假的錄音、改動原詞 KK、例字只有一個、缺 contextDependent。

## 實際接受／待核對數

- 音：41 接受、0 待核對。
- 例字：187 reviewed、2 needs-review。
  - **with**：th 美式多念 /θ/，也常聽到 /ð/。暫不作考題。
  - **usually**：辭典 KK 記四音節 [ˋjuʒʊəlɪ]，口語常念三音節。暫不出音節或拆字題。
  - 兩字都不在任何完整組音字或位置題裡，也不算進任何音的兩個例字。

## 給內部 Claude（A 線）的接法建議（不改他的介面，僅供參考）

- 欄位對應：words-reviewed.json 的 chunks 可直接轉成 novice.js 的 WORDS_SPLIT（[text, soundTokens.join("")]），結果和現有 WORDS_SPLIT 完全一致，我已逐字比對。
- 位置題：positionQuestions 的格式等同 Novice.POOL（word, place, sound）。要只用錄音字，就過濾 audio === "recording"。
- 干擾選項：先排除該字的 avoidDistractors，再挑易混音，可用每個音的 confusableWith。
- 資料到手不等於課程完成：課程 runner、關卡和戰鬥仍由 A 線負責。

## 素材缺口（請協調人安排）

- **沒有任何單音錄音。**
- /ð/、/ʒ/、/ɔɪ/ 沒有任何有錄音的例字；/w/ 只有 squirrel 一個。
- 建議補錄的整字（KK 已在本資料內）：
  - /ð/：this、that、mother
  - /ʒ/：measure、television
  - /ɔɪ/：boy、toy、oil
  - /w/：wet、window
- N02 的完整組音字都沒有錄音（cat 之外，原 80 詞裡沒有只含 N01–N02 音的字），建議補錄 man、fast。

## 驗證方法

```sh
node modules/kk-data/kk-validate.cjs --data content/kk-v1 --root .    # 在專案根目錄；--root 會比對 novice.js、data/words.json、assets
python3 modules/kk-data/build_kk.py --root . --out content/kk-v1       # 修改 kk_source.py 後重建
```

## 誠實聲明

- 這是外部 AI 依美式 KK 手動編寫和核對的資料，沒有經過真人教師審核，也沒有真人錄音或單音錄音。
- 口形提示用來輔助理解，不保證每位學習者都適用。
