# 專案長期知識

- 遊戲屬於 `jesuswaytaipeisrv` 的手機多人活動遊戲系列，互動慣例參考 `water-relay-game` 與 `dragon-boat-race`。
- 三隊固定順序為豆沙隊、蛋黃隊、抹茶隊；自動分隊依加入時間輪流分配。
- `biteUnits` 是隊伍唯一計分來源；不要新增另一個可獨立寫入的「已吃月餅數」。
- 勝利門檻固定為「每個月餅口數 × 月餅數量」。
- 示範模式只保證同一瀏覽器的分頁同步；跨手機必須設定 Firebase 與 HTTPS 公開網址。
- iPhone/iOS 瀏覽器不支援 `navigator.vibrate()`，不得把震動列為必要回饋。
