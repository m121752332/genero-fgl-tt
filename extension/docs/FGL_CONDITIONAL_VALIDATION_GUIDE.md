# FGL 條件結構驗證功能使用指南

## 功能概述

Genero FGL VSCode 擴展現已支援條件結構驗證功能，可以自動檢測和報告 IF/ELSE/END IF、CASE/WHEN/END CASE、FOR/WHILE/FOREACH 循環等控制流語句的結構完整性問題。

## 主要特性

### 🔍 結構驗證檢查

1. **配對完整性檢查**
   - 每個 IF 必須有對應的 END IF
   - 每個 CASE 必須有對應的 END CASE
   - 每個 FOR/WHILE/FOREACH 必須有對應的 END

2. **語法規則驗證**
   - IF 語句必須包含 THEN 關鍵字
   - ELSE 只能出現在 IF 結構中
   - WHEN/OTHERWISE 只能出現在 CASE 結構中

3. **嵌套結構檢查**
   - 檢查嵌套層級是否正確閉合
   - 防止交錯結構錯誤
   - 最大嵌套深度限制（預設 10 層）

### 🔧 即時診斷

- **即時檢測**：在您輸入代碼時自動檢查（有防跳動處理）
- **錯誤標記**：在編輯器中用紅色波浪線標記錯誤
- **詳細說明**：提供清楚的錯誤訊息和錯誤代碼

## 錯誤類型

| 錯誤代碼 | 描述 | 嚴重程度 |
|---------|------|---------|
| **CS001** | 缺少 END IF | Error |
| **CS002** | 缺少 THEN 關鍵字 | Error |
| **CS003** | 多餘的 ELSE 語句 | Error |
| **CS004** | ELSE 在錯誤位置 | Error |
| **CS005** | 缺少 END CASE | Error |
| **CS006** | WHEN 語句在 CASE 外部 | Error |
| **CS007** | OTHERWISE 在 CASE 外部 | Error |
| **CS008** | 嵌套結構不匹配 | Error |
| **CS009** | 最大嵌套深度超限 | Warning |
| **CS010** | 缺少 END FOR/WHILE/FOREACH | Error |

## 配置選項

### 啟用/停用驗證

```json
{
    "GeneroFGL.4gl.validation.conditional.enable": true
}
```

### 進階設定

```json
{
    "GeneroFGL.4gl.validation.conditional.maxNesting": 10,
    "GeneroFGL.4gl.validation.conditional.strictMode": false,
    "GeneroFGL.4gl.validation.conditional.autoFix": true,
    "GeneroFGL.4gl.validation.conditional.validateOnType": true,
    "GeneroFGL.4gl.validation.conditional.validateOnSave": true
}
```

#### 配置說明

- **enable**: 啟用條件結構驗證功能
- **maxNesting**: 設定最大允許的嵌套深度（1-50）
- **strictMode**: 啟用嚴格驗證模式（更嚴格的檢查）
- **autoFix**: 啟用自動修復建議功能
- **validateOnType**: 在輸入時即時驗證（有防跳動）
- **validateOnSave**: 在儲存文件時驗證

## 使用方法

### 1. 開啟 4GL 文件

只要開啟任何 `.4gl` 或 `.4GL` 文件，驗證功能就會自動啟用。

### 2. 查看問題

- **問題面板**：開啟 VSCode 的「問題」面板（Ctrl+Shift+M）查看所有錯誤
- **編輯器標記**：錯誤會在編輯器中用紅色波浪線標示
- **悬浮提示**：將滑鼠停留在錯誤處可查看詳細說明

### 3. 修正錯誤

根據錯誤訊息提示修正代碼，例如：

- 添加缺少的 END IF/END CASE 等語句
- 在 IF 條件後加上 THEN 關鍵字
- 移除多餘的 ELSE 語句
- 調整錯誤位置的 ELSE/WHEN/OTHERWISE

## 範例

### ✅ 正確的結構

```4gl
FUNCTION correct_example()
   DEFINE l_var INTEGER
   
   IF l_var = 1 THEN
      DISPLAY "條件成立"
   ELSE
      DISPLAY "條件不成立"
   END IF
   
   CASE l_var
   WHEN 1
      DISPLAY "一"
   WHEN 2
      DISPLAY "二"
   OTHERWISE
      DISPLAY "其他"
   END CASE
END FUNCTION
```

### ❌ 錯誤的結構

```4gl
FUNCTION error_example()
   DEFINE l_var INTEGER
   
   IF l_var = 1        -- CS002: 缺少 THEN
      DISPLAY "錯誤"
   END IF
   
   IF l_var = 2 THEN
      DISPLAY "條件1"
   ELSE
      DISPLAY "條件2"
   ELSE                -- CS003: 多餘的 ELSE
      DISPLAY "條件3"
   END IF
   
   CASE l_var
   WHEN 1
      DISPLAY "一"
   OTHERWISE
      DISPLAY "其他"
   -- CS005: 缺少 END CASE
END FUNCTION
```

## 測試文件

擴展包含兩個測試文件幫助您了解驗證功能：

1. **test_simple_conditional.4gl** - 簡單測試案例
2. **test_conditional_validation.4gl** - 完整測試案例

您可以開啟這些文件查看各種錯誤情況的診斷效果。

## 效能與最佳實踐

### 效能優化

- 使用防跳動技術，避免頻繁驗證影響效能
- 僅驗證 4GL 文件，不影響其他文件類型
- 增量驗證，只檢查變更相關的部分

### 最佳實踐

1. **保持適當的嵌套深度**：避免過深的嵌套（建議不超過 5 層）
2. **使用一致的縮排**：配合格式化功能使用，保持代碼整潔
3. **及時修正錯誤**：儘早修正結構錯誤，避免累積
4. **適當的配置**：根據專案需求調整驗證設定

## 疑難排解

### 驗證不生效

1. 確認配置 `GeneroFGL.4gl.validation.conditional.enable` 為 `true`
2. 確認文件副檔名為 `.4gl` 或 `.4GL`
3. 重新載入 VSCode 視窗

### 誤報問題

1. 檢查代碼是否真的有語法錯誤
2. 確認使用支援的 4GL 語法結構
3. 查看開發者控制台的錯誤訊息

### 效能問題

1. 調整 `validateOnType` 設定為 `false`，僅在儲存時驗證
2. 降低 `maxNesting` 數值
3. 關閉嚴格模式

## 版本資訊

- **版本**: v0.1.5+
- **支援文件**: .4gl, .4GL
- **依賴**: VSCode 1.6.0+

## 意見回饋

如果您發現問題或有改進建議，請：

1. 提供具體的測試案例
2. 說明預期結果和實際結果的差異
3. 檢查 VSCode 開發者控制台的錯誤訊息

---

**注意**: 此功能目前專注於基本的條件結構驗證。未來版本將加入更多進階功能，如自動修復建議、更詳細的語法分析等。
