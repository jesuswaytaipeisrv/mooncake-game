# 吃月餅大賽 🥮🌕

手機優先的三隊連點競賽。主持人建立房間後，玩家掃描 QR Code、輸入名字並由系統平均分隊；比賽開始後，所有玩家快速按「咬一口」，最先吃完整盤月餅的隊伍獲勝。

本遊戲延續 `water-relay-game` 與 `dragon-boat-race` 的活動流程，但採獨立狀態結構與中秋主題視覺。

## 目前功能

- 主持人自動取得六碼房間碼與玩家加入 QR Code。
- 玩家輸入名字加入，自動平均分到豆沙隊、蛋黃隊、抹茶隊。
- 主持人可設定每個月餅所需口數、月餅數量與倒數秒數。
- 每次點擊即時增加個人與隊伍口數，主持台同步顯示月餅被吃掉的動畫。
- 落後一個月餅以上的隊伍，會定期獲得半個月餅口數的「月兔加油」。
- 最先清空月餅盤的隊伍獲勝，結算顯示勝隊前三名貢獻者。
- 未設定 Firebase 時使用 `localStorage` 與 `BroadcastChannel` 示範模式；設定後可跨手機即時同步。

## 本機啟動

```bash
python3 -m http.server 5175 --bind 127.0.0.1
```

主持台：

```text
http://127.0.0.1:5175/?view=host
```

主持頁會自動產生房間碼。用同一個房間網址改成 `view=play`，即可在另一個分頁模擬玩家。

## 測試

```bash
npm test
npm run check
```

網頁功能仍須以實際瀏覽器跑過主持／玩家流程，並驗證 390px、768px、1280px 三種寬度。

## Firebase 多人同步

1. 在 Firebase Console 建立 Web App、啟用匿名 Authentication 與 Realtime Database。
2. 把 Web App 公開設定填入 `firebase-config.js`。
3. 將 `firebase-database.rules.json` 套用到 Realtime Database Rules。
4. 重新整理主持頁，頂端應顯示「即時多人模式」。

Firebase Web App 設定不是伺服器密鑰；服務帳戶 JSON、私密 token 與後端金鑰不得進入 repository。

## 部署與成本

- GitHub Pages：公開 repository 可免費部署本靜態網站。
- Firebase：可先使用 Spark 免費額度；超過免費額度或升級 Blaze 才可能收費，活動前需確認最新方案與用量。
- 免費替代方案：單機展示可直接使用示範模式；其他即時資料庫可用 Supabase，但需要重寫同步層與權限規則。

## 專案結構

- `index.html`：主持與玩家介面。
- `styles.css`：中秋視覺、動畫與 RWD。
- `app.js`：瀏覽器互動、房間同步與畫面更新。
- `src/game-core.js`：可單元測試的遊戲規則。
- `tests/`：核心規則測試。
- `docs/`：架構、設計決策與長期專案知識。

## 文件

- [開發計畫](PLAN.md)
- [工作清單](TASKS.md)
- [開發紀錄](DEVELOPMENT_LOG.md)
- [系統架構](docs/ARCHITECTURE.md)
- [設計決策](docs/DECISIONS.md)
