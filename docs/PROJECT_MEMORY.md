# 專案長期知識

- 遊戲屬於 `jesuswaytaipeisrv` 的手機多人活動遊戲系列，互動慣例參考 `water-relay-game` 與 `dragon-boat-race`。
- 三隊固定順序為豆沙隊、蛋黃隊、抹茶隊；自動分隊依加入時間輪流分配。
- `biteUnits` 是隊伍唯一計分來源；不要新增另一個可獨立寫入的「已吃月餅數」。
- 勝利門檻固定為「每個月餅口數 × 月餅數量」。
- 正式站沿用 `dragon-boat-race` Firebase，資料根路徑為 `water-splash-race/rooms/mooncake-feast-race`；不要改用提水遊戲的六碼房間鍵層級。
- 示範模式只保證同一瀏覽器的分頁同步；正式站正常時頁首必須顯示「即時多人模式」。
- `firebase-database.rules.json` 只適用於未來獨立頂層路徑；共用資料庫規則必須先讀取線上完整版本再合併，不可整份覆蓋。
- iPhone/iOS 瀏覽器不支援 `navigator.vibrate()`，不得把震動列為必要回饋。
- 賽末視覺衝刺門檻為 85%；隊伍使用 `.lane.is-near` 強化兔子動作，賽場使用 `.field.is-sprint` 強化月亮，完成 100% 後停止衝刺動畫並顯示結算。
