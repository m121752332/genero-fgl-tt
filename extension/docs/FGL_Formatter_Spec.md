
# Genero-FGL Formatter 規格文件

此文件為為 `Genero-FGL` 擴充功能設計的格式化（formatter）規格，目標是將先前討論的需求形式化，包含設定（settings）schema、formatter contract、邊緣情況、測試與實作建議。

## 目標要點（需求核對清單）

- 全文件 document-level format 功能（參考現有 `GeneroFGL.4gl.format.enable`）
- 可單獨套用於 `FUNCTION ... END FUNCTION` 區段的格式化（可單獨執行，或在 document scope 中只套用 functions）
- 可控制縮排（indent）相關參數（tabs vs spaces、寬度）
- 可控制是否把單行註解統一替換為 `--` 或 `#`（獨立開關與選項）
- 每項功能皆應有設定參數可獨立開/關與調整（便於使用者在 settings.json 修改）

## 總體設計概念

- 提供 DocumentFormatter 與 RangeFormatter 以配合 VS Code 的格式化 API。
- 提供一個可選的「functions-only」模式：只對 `FUNCTION ... END FUNCTION` 的區塊做格式化。
- 設計設定（configuration）以便使用者在 `settings.json` 或 GUI 設定中逐項開關。

## 建議的 settings（可新增到 `extension/package.json` 的 `contributes.configuration.properties`）

範例（JSON）：

```json
{
  "GeneroFGL.4gl.format.enable": true,
  "GeneroFGL.4gl.format.functions.enable": true,
  "GeneroFGL.4gl.format.indent.useTabs": false,
  "GeneroFGL.4gl.format.indent.size": 3,
  "GeneroFGL.4gl.format.lineLength.max": 120,
  "GeneroFGL.4gl.format.comments.style": "preserve",
  "GeneroFGL.4gl.format.comments.replaceInline": false,
  "GeneroFGL.4gl.format.onSave": false,
  "GeneroFGL.4gl.format.onlyChanges": false,
  // `define.splitter` setting removed from extension (feature now internal)
  "GeneroFGL.4gl.format.keywords.uppercase.enable": true
}
```

範例：

輸入：

```4gl
function myFunc()
  if x > 0 then
    display "ok"
  end if
end function
```

輸出（`keywords.uppercase=true`）：

```4gl
FUNCTION myFunc()
  IF x > 0 THEN
    DISPLAY "ok"
  END IF
END FUNCTION
```

實作注意：

- 只轉換 token 類型為 keyword 的字串，務必先 tokenise 並忽略字串 literals、數值與註解內容，避免把字串內或註解內的文字誤判為關鍵字。
- 關鍵字列表應以 parser 為準（若 `parser.ts` 可用則重用），否則維護一份穩定的關鍵字集。
- 提供例外/白名單機制作為未來擴充（例如：保留特定 identifier 的大小寫）。
- 範例：

輸入：

```4gl
function myFunc()
  if x > 0 then
    display "ok"
  end if
end function
```

輸出（`keywords.uppercase=true`）：

```4gl
FUNCTION myFunc()
  IF x > 0 THEN
    DISPLAY "ok"
  END IF
END FUNCTION
```

實作注意：

- 只轉換 token 類型為 keyword 的字串，務必先 tokenise 並忽略字串 literals、數值與註解內容，避免把字串內或註解內的文字誤判為關鍵字。
- 關鍵字列表應以 parser 為準（若 `parser.ts` 可用則重用），否則維護一份穩定的關鍵字集。
- 提供例外/白名單機制作為未來擴充（例如：保留特定 identifier 的大小寫）。

## Formatter contract（輸入 / 輸出 / 錯誤模式）

- 輸入：
  - 文件全文或一個 range 的文字 (language = `4gl`)。
  - 當前使用者設定（如上）。

- 輸出：
  - VS Code 的 `TextEdit[]` 或完整的 replacement text。

- 錯誤模式：
  - 若解析失敗：回傳空的 edits（不修改文件），並把解析錯誤寫入 output channel 或 log。
  - 若某功能的設定值不支援：顯示警告訊息並跳過該設定處理。

- 成功準則：不改變程式語意（不移動 tokens，只調整 whitespace、換行、註解標記與縮排）。

## FUNCTION 區段格式化的處理流程

1. 先以輕量 tokenizer 或重用現有 `parser.ts`（若可用）掃描文件，找出 `FUNCTION` / `END FUNCTION` 範圍。
2. Tokenizer 必須忽略：字串 literal、行與區塊註解（避免在註解或字串中誤判 `FUNCTION`）。
3. 對每個 function block 呼叫 block-specific formatter，產生局部 edits。
4. 若透過 Document Format 呼叫，則先格式化 file header/非 function 區域，再套用每個 function block 的 edits（或反向，視合併策略）。

注意：要能處理巢狀 function（若語言允許）或類似結構，也要能處理缺少 `END` 的不完整程式（保守處理）。

## DEFINE 分割器（已移除）

此專案原先提供 `define.splitter` 功能，用以將多變數 `DEFINE` 拆分為多行獨立 `DEFINE`；該設定已從 extension 設定中移除，功能改為內部控制或停用。如需此行為，請參考 formatter 實作中保留的拆分邏輯（內部函式 `splitDefineLines` / `splitDefineLinesFallback`），或與維護者討論重新公開設定的方案。

## 要求清單（Checklist）

- 提供整份文件（document-level）格式化功能。
- 支援只格式化 `FUNCTION ... END FUNCTION` 區塊（functions-only 模式或 range-format）。
- 可配置縮排（tabs vs spaces、寬度）。
- 可配置單行註解風格（`--` / `#` / `preserve`）並可選是否替換行內註解。
- 每項功能皆以設定項目獨立開關，並可透過 command / 右鍵 / CodeLens 單獨執行 function 範圍格式化。

## FUNCTION 區段格式化處理流程

1. 以 `parser.ts`（若可用）或輕量 tokenizer 掃描文件，找出 `FUNCTION` / `END FUNCTION` 範圍。
2. Tokenizer 必須忽略字串 literal、單行與區塊註解，避免在註解或字串中誤判 `FUNCTION`。
3. 對每個 function block 呼叫 block-specific formatter，產生局部 edits。
4. 若由 Document Format 呼叫，合併非 function 區域與 function 區塊 edits，並產生最小差異的 edits（prefer minimal, stable edits）。

注意：處理不完整的程式（缺少 END）時應採保守策略，避免移動或重排 token；支援巢狀結構（若語言允許）。

## 註解替換規則

- `preserve`：保留原註解標記與樣式（保守）。
- `dash`：將單行註解標記（例如 `#`）改為 `--`。
- `hash`：將單行註解標記改為 `#`。
- `replaceInline` 控制是否也替換行內註解（預設 false）。

實作重點：

- 僅處理單行註解標記（`#`、`--`）；不要改變 block comment `{ ... }` 內容。
- 逐行掃描並使用狀態機判斷是否在字串或 block-comment 內；只有在 code 範圍內的註解標記才會被轉換。

建議額外命令：`genero-fgl.format.normalizeComments`（repository-wide 正規化，需使用者主動執行）。

## 縮排策略

- 根據語法深度決定縮排，預設參考 `language-configuration.json` 的 indentation 規則。
- `useTabs` 與 `indent.size` 控制前導空白或 tab 寬度。
- 保留檔案原本換行風格（CRLF / LF），除非新增設定要求轉換。

## 邊緣情況

- 大型檔案（>200KB）或大量函式：避免在 onSave 同步格式化整個檔案，採 incremental/range 或 background 策略。
- 檔案語法不完整：只做保守 whitespace 調整，不重排 token。
- 註解/字串內含 `FUNCTION`：tokenizer 必須忽略註解與字串內容。

## 測試計劃（最少涵蓋案例）

### Parser / tokenizer unit tests

- 簡單 function block 的正確切割與範圍定位（happy path）。
- 註解內含 `FUNCTION` 時，不應切割區塊。

### Formatter unit tests

- `comments.style` 為 `dash` / `hash` / `preserve` 的行首與行內範例測試。
- `define.splitter` 的拆分行為（包含多行、尾註解保留）。
- selection / range formatting：只改動選取範圍內內容。

### Integration / smoke

- VS Code provider 註冊測試：DocumentFormattingEditProvider / DocumentRangeFormattingEditProvider 回傳有效 edits 並可套用。

## 測試說明（Manual + Automated）

以下為實作後可直接執行的測試步驟與驗證要點，包含手動驗證與自動化指令範例。

### 手動測試（快速驗證）

1. 在 `settings.json` 中啟用或修改設定：

   - `GeneroFGL.4gl.format.enable = true`
   - `GeneroFGL.4gl.format.comments.style = "dash"`
   - `GeneroFGL.4gl.format.comments.replaceInline = false`

2. 打開範例檔案（例如 `codes/test_outline.4gl`），在 Command 面板（Ctrl+Shift+P）執行 `genero-fgl.format.document`。

3. 驗證：

   - 行首註解已統一為 `--`（若設定為 dash）。
   - `FUNCTION` 區塊縮排與關鍵字大小寫符合設定。
   - 若啟用 `define.splitter`，多變數的 `DEFINE` 已正確拆分且尾註解保留。

### 自動化測試（Node + Mocha 範例）

1. 安裝 mocha（若尚未）：

```powershell
npm install --save-dev mocha
```

2. 新增測試檔案 `unittests/formatter.test.js`（或在現有 `unittests/` 下擴充），建議包含：

   - parse 範例 -> 檢查 function range
   - format 範例 -> 檢查 output 是否包含期待的註解標準化與縮排

3. 執行測試：

```powershell
npx mocha "unittests/**/*.js"
```

4. 品質檢查：

   - TypeScript build: `npm run test-compile` 或 `tsc -b`。
   - Lint: `npm run lint`（若使用 eslint）。

### 手動 smoke 測試（VS Code）

1. 開發模式啟動 extension（F5）。
2. 在 Extension 開發視窗中，打開 `.4gl` 檔案，執行 `Format Document` 或使用 CodeLens 的 `Format Function`。
3. 驗證檔案變更是否與預期一致，測試 undo/redo 與編輯器整合行為。

## 品質門檻（Quality gates）

- TypeScript build: `tsc -b`（修改 source 時必須通過）。
- Lint: eslint（新增檔案需符合規則）。
- Unit tests: 新增至少 4 個涵蓋 parser/formatter 的測試案例。
- Smoke: 在 sample `.4gl` 檔案上執行 format 並確認行為。

## 實作建議（優先順序）

1. 將設定 schema 新增到 `extension/package.json`（非破壞性）。
2. 優先重用 `parser.ts`，若不足則補上輕量 tokenizer。
3. 實作 `FunctionBlockFormatter` 並新增 unit tests（範例驅動）。
4. 註冊 VS Code provider 並新增 commands / CodeLens / 右鍵選單。

---

規格文件版本: 2025-08-27
