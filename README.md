# jev-mvp

比較 **Jev（TypeSafe）** 與 **Google Gemini** 在中文文章判斷上的正確率、速度與成本的內部評測工具。
同一篇文章分別丟給兩邊，判斷三個維度：**情緒強度**（1–10）、**地區**、**是否為雜訊**。

## 功能

| 頁面 | 說明 |
|---|---|
| `/` 單篇模式 | 貼一篇文章，並排看兩邊的答案、成本、延遲，分歧時由你判定誰對 |
| `/batch` 批次分析 | 上傳 CSV 批次跑；Gemini 可選 live / flex（五折）/ batch（五折、非同步）三種模式，並記錄各模式實際耗時 |
| `/sweep` 全模型掃描 | 同一批文章跑多個 Gemini 模型 + Jev，比較成本 × 正確率，並可重複多次測回應穩定度 |

**黃金答案（golden set）**：你判定過的結果與內建「對抗測試包」的已知答案會存下來，下次同一篇文章直接計分，不必重複判定。
共識（兩邊答一樣）**不會**寫進黃金答案——兩個模型一起答錯，正是黃金答案要抓的情況。

## 快速開始

需求：Node.js 20+。

```bash
npm install
cp .env.local.example .env.local   # 填入你自己的金鑰
npm run dev                        # http://localhost:3000
```

### 環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `TYPESAFE_API_KEY` | 是 | Jev（TypeSafe）API 金鑰 |
| `GEMINI_API_KEY` | 是 | Google Gemini API 金鑰 |
| `APP_BASIC_AUTH_PASSWORD` | 正式環境必填 | 設定後所有頁面與 API 都需要 HTTP Basic 登入 |
| `APP_BASIC_AUTH_USER` | 否 | Basic 登入帳號，預設 `admin` |

`.env.local` 已列入 `.gitignore`，**請勿提交任何真實金鑰**。

## 指令

```bash
npm run dev         # 開發伺服器（Turbopack）
npm run build       # 正式建置
npm start           # 啟動正式建置
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest 單元測試
```

## 架構

```
app/                  Next.js App Router：頁面與 API route（薄薄一層，只做 I/O 與組裝）
  api/analyze/          單次分析（Jev / Gemini 可個別跳過）
  api/gemini-batch/     Gemini batch job 的送出與狀態輪詢
components/           純顯示元件
hooks/                有狀態的畫面邏輯，頁面只負責組裝
  useBatchRun             一次批次執行：Jev / Gemini 兩條獨立賽道、並行上限、計時
  useGeminiBatchJob       進行中的 Gemini batch job：送出、重新整理後還原、每 30 秒輪詢
  useGoldenSet            黃金答案（localStorage）
  useBatchHistory         各模式實際耗時與成本紀錄
lib/
  apiClient.ts          瀏覽器端呼叫自家 API 的唯一入口（URL 與錯誤格式只在這裡）
  providers/            AnalysisProvider<TOptions> 介面 + jev / gemini 實作
                        （各家專屬參數放在自己的 options，例如 GeminiOptions）
  schema.ts             zod schema：請求驗證 + 共用型別
  compareResults.ts     誰對誰錯的判定規則（golden > 共識 > 人工判定）
  batchRows.ts          批次列的純函式轉換（合併 Gemini 結果、成本加總、還原）
  *Metrics.ts, sweep*   彙總與統計（純函式）
  goldenSet.ts, storage localStorage 持久化
middleware.ts         HTTP Basic 驗證
tests/                Vitest 單元測試
```

依賴方向：`app` / `components` → `lib` → 外部 SDK。`lib` 的計算邏輯不依賴 React 或 Next，可單獨測試。

## 安全與隱私

- **API 金鑰只在伺服器端讀取**（`process.env`），不會進入前端 bundle。
- **你貼上或上傳的文章會被送到第三方**：Jev（TypeSafe）與 Google Gemini。請勿送出不能外流的資料，並留意各家的資料使用條款。
- 黃金答案、批次歷史與進行中的 batch job 存在**你自己瀏覽器的 localStorage**，不會上傳到任何伺服器（進行中的 batch job 會含文章全文，但不含原始 request/response）。
- 每次呼叫都會消耗你的 API 額度。部署到公開網址時**務必**設定 `APP_BASIC_AUTH_PASSWORD`；正式環境若未設定，伺服器會直接回 503 而不是對外開放。
- 單篇文章上限 50,000 字、單次 batch 上限 1,000 篇。
