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
- `npm test`：6/6 核心規則測試通過。
- `npm run check`：`app.js`、`src/game-core.js`、`tests/firebase-smoke.mjs` 語法檢查通過。
- 實際瀏覽器使用 `FBTEST9` 房間：主持端與玩家端都顯示「即時多人模式」；玩家「瀏覽器同步測試」加入後，主持端即時由 0 人更新為 1 人；玩家離開後主持端回到 0 人。
- 首次開啟正式站時曾出現一次 `auth/network-request-failed`，重新整理即恢復；新增只針對此暫時性錯誤的最多三次遞增延遲重試，設定或權限錯誤不會被重試掩蓋，並加入 2 項單元測試。
- 測試資料清理：精確刪除 `FBTEST9` 房間並確認不存在；清理腳本放在 `work/` 且執行後移除。smoke test 自建房間與匿名帳號也在每次測試後自動刪除。
- 尚未驗證：兩支實體手機的完整加入、分隊、倒數、連點與勝負流程。
