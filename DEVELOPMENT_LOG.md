# 開發紀錄

## 2026-09-16

### 目標

依照 `jesuswaytaipeisrv/water-relay-game` 與 `jesuswaytaipeisrv/dragon-boat-race` 的主持／玩家活動模式，建立獨立的吃月餅遊戲 MVP。

### 實際修改

- 在固定位置 `/Users/garyhuang/Documents/Codex/mooncake-game` 建立正式專案骨架。
- 建立主持頁、玩家加入頁、玩家連點頁與結算畫面。
- 將同步狀態簡化為每隊單一 `biteUnits`，所有月餅進度由此推導。
- 建立豆沙、蛋黃、抹茶三隊及中秋夜景、月餅被咬、月兔加油、連吃與彩帶動畫。
- 將純規則拆到 `src/game-core.js`，供 Node 內建測試執行。
- Firebase 預設不連線，避免開發測試污染既有正式資料；填入 Web App 公開設定後才啟用。
- 瀏覽器測試時發現主持台的 250ms 重繪會覆蓋正在編輯的設定欄位；改為輸入事件立即同步，且不覆寫目前聚焦欄位。

### 測試與驗證

- `npm test`：6 項核心規則測試全部通過，涵蓋預設門檻、月餅邊界、外部狀態限界、分隊、月兔加油資格與下一輪重設。
- `npm run check`：`app.js`、`src/game-core.js` 語法檢查通過。
- 實際瀏覽器示範模式：玩家加入 → 主持分隊 → 設定每餅 5 口／1 個月餅／倒數 1 秒 → 玩家連點 5 次 → 豆沙隊勝利與結算畫面，流程通過。
- RWD：主持頁在 390、768、1280px 的 `scrollWidth` 均未超過 `clientWidth`；玩家加入頁在三種寬度也無水平溢位；390px 玩家操作頁主按鈕完整位於視窗內。
- 瀏覽器 console：主持、玩家與行動版頁面均無 error。
- 下一輪按鈕未在瀏覽器點擊，以免清除本輪測試狀態；其呼叫的 `resetRoundState()` 已由單元測試確認保留分隊並清空口數。

### 未完成

- 尚未進行多支實體手機的完整比賽與正式活動參數校正。

### GitHub 發布

- 建立公開 repository：`https://github.com/jesuswaytaipeisrv/mooncake-game`。
- 以原生 Git 將本機 `main` 推送至 `origin/main`，並設定 upstream tracking。
- 啟用 GitHub Pages，來源為 `main` 分支根目錄；正式網址為 `https://jesuswaytaipeisrv.github.io/mooncake-game/`。
- GitHub Pages build 狀態為 `built`；主持台、玩家頁、`app.js`、`styles.css` 與 `src/game-core.js` 均以 HTTP 200 驗證。
- 實際開啟正式主持台確認自動產生房間碼與正式玩家 QR Code；Firebase 尚未設定，因此目前仍是示範模式。

### 正式站跨裝置同步診斷

- 使用者從手機加入正式房間後，主持台仍顯示 0 人。
- 紅／綠檢查直接讀取正式 `firebase-config.js`，確認 `apiKey` 與 `databaseURL` 皆為 `null`，因此穩定重現「無共享後端」的失敗條件。
- 正式主持台顯示「示範模式」，且瀏覽器 console 無 Firebase Auth／Database 錯誤；可排除已連線後遭 Rules 拒絕的情況。
- 根因：手機與主持台各自使用隔離的 `localStorage`；`BroadcastChannel` 只同步同一瀏覽器分頁，不能跨裝置。
- 使用者選擇沿用既有活動 Firebase，後續修正與驗證如下。

### 沿用 Firebase 與跨裝置同步修正

- 先新增 `npm run test:firebase` 線上 smoke test；在設定仍為空值時穩定失敗，錯誤指出缺少 `apiKey`、`databaseURL`、`projectId`。
- 填入既有活動 Firebase Web 公開設定後再次測試，匿名登入成功，但寫入原訂 `mooncake-feast-race/rooms` 頂層路徑收到 HTTP 401 `Permission denied`，確認第二個缺口是已部署 Rules 未授權該頂層。
- 本機沒有 Firebase 管理登入，無法安全匯出與合併線上完整 Rules；為避免覆蓋龍舟與提水規則，改沿用提水已授權的 `water-splash-race/rooms/$room`，並把所有月餅房間集中在 `mooncake-feast-race/<房間碼>` 專屬子樹。
- 將 `app.js` 與其 `firebase-config.js` import 快取版本更新為 `20260916-2`，避免 GitHub Pages 或手機繼續使用舊的空白 Firebase 設定。
- `npm run test:firebase` 轉綠：匿名登入、唯一測試房間寫入、讀回、刪除後確認為 `null`，以及刪除匿名測試帳號全部成功。
- `npm test`：8/8 測試通過，包含 6 項核心規則與 2 項 Firebase 暫時性網路錯誤重試測試。
- `npm run check`：`app.js`、`src/game-core.js`、`tests/firebase-smoke.mjs` 語法檢查通過。
- 實際瀏覽器使用 `FBTEST9` 房間：主持端與玩家端都顯示「即時多人模式」；玩家「瀏覽器同步測試」加入後，主持端即時由 0 人更新為 1 人；玩家離開後主持端回到 0 人。
- 首次開啟正式站時曾出現一次 `auth/network-request-failed`，重新整理即恢復；新增只針對此暫時性錯誤的最多三次遞增延遲重試，設定或權限錯誤不會被重試掩蓋，並加入 2 項單元測試。
- 測試資料清理：精確刪除 `FBTEST9` 房間並確認不存在；清理腳本放在 `work/` 且執行後移除。smoke test 自建房間與匿名帳號也在每次測試後自動刪除。
- GitHub Pages 部署 `a70ff0f` 後，以正式網址建立 `LIVEFB9`：主持與玩家頁均顯示「即時多人模式」，玩家「正式站同步測試」加入後，主持端即時由 0 人更新為 1 人。
- 正式站測試結束後，精確刪除 `LIVEFB9` 整個房間並確認不存在；暫存清理腳本已移除。
- 重新整理使用者原房間 `EDV62A`，已確認頁首顯示「即時多人模式」且 QR Code 指向相同房號的正式玩家網址。
- 尚未驗證：兩支實體手機的完整加入、分隊、倒數、連點與勝負流程。

## 2026-09-23

### 正式站完整遊戲回歸測試

- 使用正式 GitHub Pages 與獨立 Firebase 房間 `QA923A`，主持端及玩家端均確認顯示「即時多人模式」。
- 實際完成：玩家「自動測試玩家」加入 → 主持端即時顯示 1 人 → 自動分到豆沙隊 → 設定每餅 5 口、1 個月餅、倒數 1 秒 → 倒數後玩家按鈕啟用 → 快速連點 5 次。
- 玩家與主持端同步顯示 5 口、100% 與豆沙隊獲勝；結算畫面正確顯示「自動測試玩家」為 5 口 MVP。
- 主持人按「下一輪」後，玩家與分隊保留，個人及隊伍口數均回到 0，遊戲回到可再次開始狀態。
- 主持與玩家頁的瀏覽器 console 均無 warning 或 error。
- 自動化回歸：8/8 單元測試通過，JavaScript 語法檢查通過，Firebase smoke test 的匿名登入、寫入、讀回與自動清理通過。
- 測試完成後關閉獨立測試分頁，精確刪除 Firebase `QA923A` 房間並讀回確認為 `null`；清理用匿名帳號也已刪除。
- 此次驗證使用同一瀏覽器的兩個獨立分頁連接正式 Firebase；兩支實體手機的完整流程仍需活動前實機驗收。

### 賽末視覺強化

- 將月兔起點移到隊員席旁，並依 390px、768px、1280px 版面分別調整前進距離，讓每一口造成的位移更容易辨識。
- 進度達 85% 後，增加兔子頭部擺動、嘴巴快速咀嚼、身體彈跳、雙耳擺動、月餅吞咬與放大碎屑動畫。
- 同一門檻會讓背景圓月放大、提亮並增加兩層光暈；到達 100% 且結算後停止衝刺動畫，避免干擾勝利畫面。
- 本機 Firebase 房間 `VIS923` 完成 0% → 90% → 100% 流程；90% 時確認兔子與月亮強化動畫啟動，100% 時確認豆沙隊勝利、10 口 MVP 與衝刺動畫停止。
- RWD 實際瀏覽器驗證：390px、768px、1280px 三種同源 iframe 的內容寬度精確符合目標值，`scrollWidth - clientWidth` 均為 0；三種寬度在 90% 都套用兔子與月亮強化動畫。
- 主持端、玩家端與 RWD 驗收頁的瀏覽器 console 均無 warning 或 error。
- `VIS923` 測試房已精確刪除並讀回確認為 `null`；測試分頁、暫存 RWD 驗收頁與本機伺服器均已清除或關閉。
- GitHub Pages 部署 `5487026` 後，以正式站獨立房間 `VFX923` 驗證新版資源；玩家推進至 90% 時，主持台實際套用 `finale-head-bob`、`moon-throb` 與賽末光暈，畫面無水平溢位，console 無 warning 或 error。
- 正式站驗收後關閉測試分頁，精確刪除 Firebase `VFX923` 房間並讀回確認為 `null`；未改動使用者的 `EDV62A` 房間。

### 遊戲音效

- 新增 `src/game-audio.js`，以 Web Audio API 即時合成短促咀嚼、上升衝刺與和弦／歡呼三種效果，沒有外部音檔、素材授權或額外服務成本。
- 玩家每次按「咬一口」直接播放本機咀嚼聲；主持端依 Firebase 同步後的總口數增量播放；任一隊進入 85% 與公布勝隊時，主持及玩家各自播放一次對應音效。
- 新增固定顯示的音效開關，預設靜音並保存瀏覽器偏好；玩家加入後按鈕移到右上角，不遮住咬一口與離開按鈕。
- 單元測試新增音效預設靜音、偏好保存、四種 cue 建立音訊節點與靜音後立即停止排程；全套測試 10/10 通過，JavaScript 語法與 diff 檢查通過。
- 實際瀏覽器以 `AUD923` 完成 0% → 10% → 90% → 100%：玩家與主持端都觸發咀嚼，90% 都觸發衝刺；玩家在最後一口前靜音後保持 `muted`，主持端結算觸發 `victory`，直接主持／玩家頁 console 無 warning 或 error。
- RWD 同源 iframe 精確驗證 390px、768px、1280px 主持頁，三種寬度均無水平溢位且音效按鈕完整位於視窗內；390px 玩家加入後，音效按鈕位於右上角且不與 280px 咬一口按鈕重疊。
- 測試後精確刪除 Firebase `AUD923`、`AUDRWD`、`AUDMOB` 三個房間並讀回確認為 `null`；測試分頁、RWD 暫存頁與本機伺服器均已關閉或清除。
