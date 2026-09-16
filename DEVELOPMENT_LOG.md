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

- 尚未連接 Firebase 或進行多支手機實機測試。

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
- 尚未修改 Firebase：沿用既有專案需新增隔離的資料路徑與 Rules，可能影響提水／龍舟遊戲；建立獨立專案則需要新的 Firebase 設定。等待使用者選擇後再實作與多手機驗收。
