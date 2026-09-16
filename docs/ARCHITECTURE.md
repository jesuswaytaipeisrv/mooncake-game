# 系統架構

## 系統邊界

本專案是無建置步驟的靜態網頁。主持與玩家載入相同的 `index.html`，由查詢參數決定介面：

- `?view=host&room=ABC123`：主持台。
- `?view=play&room=ABC123`：玩家頁。

## 元件

- `index.html`：語意結構與兩種角色的介面容器。
- `styles.css`：視覺、動畫、觸控介面與 RWD。
- `app.js`：房間初始化、DOM 更新、使用者事件、Firebase／示範模式同步。
- `src/game-core.js`：狀態正規化、計分、分隊、逆轉加成與重設規則。
- `firebase-config.js`：Firebase Web App 公開設定；預設為 `null`。

## 資料流

玩家點擊 → `biteUnits` 與玩家 `taps` 原子遞增 → 所有客戶端收到狀態 → 由 `teamMetrics()` 推導月餅數、目前月餅咬食比例與總進度 → 主持端判定勝負。

Firebase 模式以 Realtime Database transaction/update/increment 同步；未設定 Firebase 時，使用 `localStorage` 保存房間並以 `BroadcastChannel` 同步同瀏覽器分頁。

## 安全限制

- 外部狀態經 `normalizeState()` 驗證與限界後才進入 UI。
- 玩家姓名輸出前經 HTML escaping。
- 房間碼只接受英數、底線與連字號，長度上限 32。
- 匿名登入與公開活動規則無法驗證真正主持人；這是短期活動的已知限制，不適合敏感或高價值資料。
