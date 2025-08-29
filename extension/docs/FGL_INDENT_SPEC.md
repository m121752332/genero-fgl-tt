# 格式化文件功能條目 — 縮進改良規格

## 一句話說明

此文件定義適用於 4GL 檔案的縮進與反縮進（indent / dedent）規則，預設使用空白（spaces）作為縮排單位，並可整合到現有的 `extension/src/formatter.ts` 格式化流程。

## 目標

- 以保守、安全的方式，對 4GL 程式語法產生語意化縮排。
- 保留字串、註解與 block comment 內容不被破壞。
- 支援多行 SQL/字串串接的可讀對齊（continuation line）。
- 預設使用 spaces（tabs 預設關閉），縮排單位可參數化（建議預設 3）。

## 假設

- 輸入為合法或近似合法的 4GL 檔案；對不完整語法採保守處理，不丟失原始內容。
- 註解語法包括單行 `#`、`--` 與 block comment `{ ... }`。
- 字串使用單引號或雙引號。字串內不可被格式化器改變內容。

## 規格要點（逐條）

### 1) 基本縮排單位

- 縮排使用 spaces，參數為 `indent.size`（整數），預設 `3`。
- `indent.useTabs` 預設為 `false`。

### 2) 區塊與關鍵字識別（決定何時 +1 / -1）

- increase-after（在該行輸出後 level++）關鍵字（不分大小寫）：
  - FUNCTION, MAIN, RECORD, TYPE, CASE, FOR, WHILE, FOREACH, CONSTRUCT, INPUT, MENU, SELECT, LOOP, IF, WHEN（視情況）
  - 多字 token：`PUBLIC FUNCTION`, `PRIVATE FUNCTION`, `AFTER FIELD`, `BEFORE FIELD`, `DISPLAY ARRAY`
- decrease-before（在該行輸出前 level--）關鍵字：
  - 任何以 `END` 開頭的行（END、END FUNCTION、END RECORD...）
  - `ELSE`, `ELSEIF`（輸出前先 -1，輸出後根據內容再 +1）
  - siblings token：`ON`, `AFTER`, `BEFORE`, `WHEN`（使多個同級事件保持同一層級）

### 3) ELSE / ELSEIF 規則

- 在輸出 `ELSE` / `ELSEIF` 前先做 level = max(0, level-1)。
- `ELSE` 輸出後對其內部語句可再次 increase（如原語法要求）。

### 4) CASE / WHEN 規則

- `CASE` 出現後 level++。
- `WHEN` 視為 `CASE` 內的同級分支：在輸出 `WHEN` 前先把 level 恢復到 `CASE` 內層（可視為先 -1 再 +1），以確保多個 `WHEN` 為同級。

### 5) CONSTRUCT / ON / AFTER / BEFORE 行為

- `CONSTRUCT` 開始後 level++。
- `ON` / `AFTER` / `BEFORE` 在實務上常為同一層多個事件，實作策略：把它們同時放在 increase-after 與 decrease-before 中，達到「首次增加縮排但後續 siblings 保持同級」的效果。

### 6) INPUT / AFTER FIELD / BEFORE FIELD

- `INPUT` 開啟後 level++。
- `AFTER FIELD` / `BEFORE FIELD` 視為事件控制點，與 ON 類似：increase-after + decrease-before 處理。

### 7) 多行字串與 SQL 串接（continuation）

- 若上一有效碼行（非註解、非 block comment）以串接運算子（例如 `||`）結尾或為 SQL 建構（如 `LET g_sql =`）且下一行為字串或資料連接，下一行視為 continuation，縮排應相對於該語句的起始位置多一個或固定 2 spaces（可參數化）。
- 不在字串內拆行；字串內換行保持原狀。

### 8) DEFINE / RECORD 欄位

- `DEFINE ... RECORD` 內的欄位行輸出時縮排一級（record 內部 +1）。
- 欄位內 `LIKE` 與註解保留原內容，不做強制欄位對齊（此為進階選項）。

### 9) 註解處理

- 單行註解（行首 `#` 或 `--`）會遵循所在區塊的縮排層級（leading spaces 由 formatter 調整）。
- 行尾註解保留在原行（若該行被拆分則保留位置於其語句行尾）。
- `{ ... }` block comment 內部不做內容變更，外部縮排可調整到 block 所在行的縮排。

### 10) 關鍵字大小寫（選項）

- 提供 `keywordsUppercase` boolean 選項；啟用時僅關鍵字被轉為大寫，不改變字串與註解。

## 建議的正規表達式（TypeScript / JS）

- increaseAfterRe:

  ```js
  /^(?:\s*((?:PUBLIC|PRIVATE)\s+)?FUNCTION|\s*MAIN|\s*IF|\s*FOR|\s*WHILE|\s*FOREACH|\s*CASE|\s*RECORD|\s*TYPE|\s*CONSTRUCT|\s*INPUT|\s*SELECT|\s*LOOP)\b/i
  ```

- decreaseBeforeRe:

  ```js
  /^\s*(END\b|ELSE\b|ELSEIF\b|ON\b|AFTER\b|BEFORE\b|WHEN\b)/i
  ```

- continuation 檢測（上行）：

  ```js
  /(?:\|\|\s*$|,\s*$|\+\s*$)/
  ```

  （根據情況可加入 `=` 右側的多行 SQL 連接判斷）

## 整合 `extension/src/formatter.ts` 的具體建議

1. 在 `formatCodeWithIndent` 中替換或擴充 `increaseAfterRe` 與 `decreaseBeforeRe` 為上述 regex。
2. 處理順序：對每個原始行（rawLine）採用：
   - 若 `decreaseBeforeRe.test(rawLine)` => level = Math.max(0, level - 1)（special-case WHEN/ON/AFTER 以避免過度減少）。
   - 輸出 trimmed 行（以 current level 計算縮排）。
   - 若 `increaseAfterRe.test(trimmed)` => level++。
3. `WHEN` 與 siblings 處理：當匹配 `WHEN` 時，先將 level 恢復到 case 內層（可用 state stack 或先 -1 再 +1），確保多個 WHEN 同級。
4. continuation 支援：在遍歷行時，檢查上一輸出行是否為 continuation（以上方 regex），若是，將當前行縮排為 base + level + continuationOffset（預設 2）而不是 base + level。
5. Tokenization：保留現有 `tokenizePreserve` 行為（strings/comments 分離），確保換行拆分僅作用於 code 片段。

## 示例（節錄自 `cxmr667.4gl`）

- 原（片段）：

  ```4gl
  LET g_sql = "oga01.oga_file.oga01,"                      #出貨單號
           || "oga02.oga_file.oga02,"                      #出貨日期
  ```

- 格式化後（建議）：

  ```4gl
  LET g_sql = "oga01.oga_file.oga01,"                      #出貨單號
             || "oga02.oga_file.oga02,"                    #出貨日期
  ```

- 原（CONSTRUCT/ON 範例片段）：

  ```4gl
  CONSTRUCT BY NAME tm.wc
     ON oga01,oga03,oga04,oga16,ogaud04

     BEFORE CONSTRUCT
        CALL cl_qbe_init()

     ON ACTION CONTROLP
        IF INFIELD(oga01) THEN
           CALL cl_init_qry_var()
  ```

- 格式化後（建議，size=3）：

  ```4gl
  CONSTRUCT BY NAME tm.wc
     ON oga01,oga03,oga04,oga16,ogaud04

     BEFORE CONSTRUCT
        CALL cl_qbe_init()

     ON ACTION CONTROLP
        IF INFIELD(oga01) THEN
           CALL cl_init_qry_var()
  ```

  （重點：`ON` 及 `BEFORE` 內的行縮排一級；多個 `ON` 保持同級）

## 邊界條件與例外情況

- 非成對的 `END`：formatter 應保守處理，不讓 level < 0。
- 複雜的 inline SQL（含多層 quote）或動態字串組合：不改變字串內內容；對 SQL 欄位分行僅在確定為連接運算時進行。
- 巨長註解或 block comment：內部不變，只調整外圍縮排。

## 單元測試建議（最小集）

- test-1: FUNCTION / END FUNCTION（巢狀兩層）
- test-2: IF / ELSEIF / ELSE / END IF
- test-3: CONSTRUCT + 多個 ON / BEFORE / AFTER
- test-4: INPUT + AFTER FIELD / BEFORE FIELD
- test-5: LET g_sql 多行字串串接

測試標準：格式化後為 deterministic，格式化兩次結果不再改變（idempotent）。

## Quality Gates（簡短）

- TypeScript 編譯（若改動 `formatter.ts`）: PASS/FAIL
- 單元測試（上面最小集）: PASS/FAIL
- 對 `extension/codes/cxmr667.4gl` 產生格式化輸出並人工比對關鍵片段。

## 實作與部署步驟（簡潔）

1. 在 `extension/src/formatter.ts` 更新 regex 與 `formatCodeWithIndent` 行處理邏輯（按上文 參數化 continuationOffset 與 indent.size）。
2. 新增/更新 `unittests` 中的 5 個測試檔案。
3. 執行 TypeScript build 與 unit tests；修正錯誤直到綠燈。
4. 在 VS Code extension 中測試擴充功能的格式化快捷鍵或儲存時格式化。

## 交付物（建議）

- `docs/FGL_INDENT_SPEC.md`（此文件）
- `extension/src/formatter.ts` 的小幅 patch（implement 規則）
- `unittests/formatter.indent.*.test.js`（5 個最小測試）

## 下一步

- 我可以：
  - 直接把上述規格實作到 `extension/src/formatter.ts` 並新增最小單元測試，然後執行測試並回報（建議）；或
  - 只產生更詳細的規格範例集（多個 before/after 範例）。

---

要求覆蓋對照：

- 產生 Markdown 規格書（Done）
- 規格需能套入 `extension/src/formatter.ts`（已包含具體整合建議，Done）
- 以 `cxmr667.4gl` 為範例觀察並提出具體變更（已於範例段落說明，Done）
