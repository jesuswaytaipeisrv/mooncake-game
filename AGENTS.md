# AGENTS.md

本專案固定由單一工具開發（Claude Code、Codex 或 Antigravity CLI，看它建在哪個專案根目錄下），
但 `codex:rescue` 之類的委派會讓另一個代理進來工作，因此本檔對三者都必須成立。
開始任何工作前，依序閱讀：

1. `think.md` —— 專案結構與文件維護的最高規範（Claude Code 讀 `~/Documents/Claude/think.md`，
   Codex 讀 `~/Documents/Codex/think.md`，Antigravity CLI 讀 `~/Documents/Agy/think.md`，
   同一份來源的部署副本，內容相同；勿另存副本）
2. 本檔案 —— 本專案特有規則與加嚴條款
3. 其餘依 think.md 第五章第 4 點的順序（README → PLAN → TASKS → DEVELOPMENT_LOG → docs/）

**在讀上列文件之前，先 `git fetch origin` 跟遠端對時**（think.md 第五章第 3 點）。
`git status` 只看得到本機，它顯示乾淨不代表你是最新的；文件本身可能就是舊的。
落後就先對齊；**兩邊都有對方沒有的 commit 時停下來，先向使用者說明再動手**。

## 〇、本專案特有規則

- 技術棧：純 HTML、CSS、ES Module JavaScript；Firebase Authentication（匿名）與 Realtime Database 為選用的多人同步服務。
- 常用命令（安裝／啟動／測試／部署）：`npm test`、`python3 -m http.server 5175 --bind 127.0.0.1`；部署目標為 GitHub Pages，不需 build。
- 環境變數與取得方式（只寫名稱與來源，絕不寫值）：目前無環境變數；Firebase Web App 公開設定放在 `firebase-config.js`，來源為 Firebase Console。
- 本專案禁止事項：不得提交服務帳戶 JSON、私密 token 或 `.env`；不得用正式 Firebase 房間跑未清理的自動化測試；不得讓玩家端直接決定勝負。
- 交付標準：`npm test` 通過；實際瀏覽器完成主持人與玩家主要流程；390px、768px、1280px 三種寬度無水平溢位且主要操作可用；文件與程式同步。

## 一、測試與品質（不可省略）

1. 功能開發完成後必須完整測試（dry-run、手動觸發或單元測試），確認無誤才可 commit & push。
   測試結果一律記錄在 `DEVELOPMENT_LOG.md` 的本次工作紀錄中。
2. API 或後端功能：必須測試所有主要路徑 —— 成功、失敗、邊界情況。
3. 網頁功能：必須實際在瀏覽器驗證畫面，不可只靠 HTTP status code 判定通過。

## 二、測試資料清理（commit 前必做）

1. 開發或測試過程中以腳本、curl 或直接寫入 DB 建立的假資料，commit 前必須刪除。
2. DB 中不得殘留 `test_`、`測試`、`temp` 前綴或任何明顯是測試用途的資料。
3. 使用 SQLite 本機開發時，commit 前確認 DB 不含測試垃圾資料，或整個 DB 不納入 git。

## 三、開發目錄清理（commit 前掃描確認）

| 類型 | 範例 |
|------|------|
| 測試／暫存程式 | `test_xxx.py`、`temp_xxx.py`、`scratch.py` |
| 測試產出資料檔 | `test_output.xlsx`、`debug_result.json` |
| 執行 log | `*.log`（納入 `.gitignore`，本機定期清除） |
| 廢棄設定檔 | 舊版 `.env.*`、`*_old.py`、已不使用的 config |
| 空資料夾 | 無任何檔案的目錄（`work/` 等骨架目錄除外，以 `.gitkeep` 保留） |
| 過時 example | `.env.example`、`*.example` 欄位須與現行程式同步 |

暫存腳本與研究草稿一律放 `work/`，該目錄只有 `.gitkeep` 進版控、內容全部 ignore。

## 四、網頁 RWD（有網頁介面的專案必須遵守）

純後端或 CLI 專案在此標註「本專案無網頁介面，本節暫不適用」，**保留整節不得刪除**；
日後若加入網頁介面，移除該標註即自動生效。

1. 所有頁面必須支援 RWD，行動版（≤768px）、平板（768–992px）、桌面三個斷點均須可用。
2. 行動版必須有可用導航，不可僅靠桌面側邊欄；需搭配 Offcanvas、底部導航列或 hamburger menu。
3. 表格欄位多時，行動版改為卡片式或卡片列表，避免強迫水平滾動。
4. Modal 加 `modal-dialog-scrollable`，防止手機鍵盤彈出時遮擋內容。
5. 每次新增或修改頁面，須實際以手機寬度確認排版沒有破版。
   注意：縮視窗量測不可靠（headless 最小 500px、瀏覽器 resize 會被 clamp）；
   可靠做法是用同源 iframe 設定目標寬度後量測 `scrollWidth`。

## 五、資安優先原則（不可妥協）

| 風險 | 規範 |
|------|------|
| 金鑰／密碼外洩 | API key、密碼、Service Account JSON 一律存 `.env` 或 Secrets，絕不寫進程式碼或 git |
| 敏感資料進 git | commit 前確認 `.gitignore` 已涵蓋所有敏感檔案 |
| Token 暫存 | 使用後立即清除，不留在 git config、shell history 或任何設定檔 |
| 指令注入 | 任何外部輸入（使用者、API、檔名）不可直接拼入 shell 指令或 SQL |
| 權限最小化 | Service Account、API key 只開必要存取範圍 |
| Public repo | 改為 public 前必須確認 git 歷史中無任何敏感資料 |

## 六、程式碼風格

1. 預設寫註解：函式、類別、重要邏輯段落都應有說明，讓下一位接手者（含 AI 代理）能快速理解。
2. 不加多餘 error handling、不預設未來需求、不做超出任務範圍的重構。
3. 簡潔優先：三行相似程式碼優於提早抽象。

## 七、路徑與規範來源

- 本專案路徑固定，不得因代理不同而另建副本（think.md 第一章第 3、4 條）。
- `think.md` 與本模板**全機只有一份來源**，都在 repo `jesuswaytaipeisrv/pgrule` 內；Codex 端 `~/Documents/Codex/`、Antigravity 端 `~/Documents/Agy/` 下的是部署副本，內容逐字相同。不在單機各自改。
- 本檔案與 `think.md` 衝突時，以 `think.md` 為準；使用者當次明確指示優先於兩者。
