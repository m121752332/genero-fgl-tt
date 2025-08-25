# Genero FGL 未使用變數檢測功能

## 功能概述

此功能為 Genero FGL 擴充功能新增了未使用變數偵測能力，可以偵測在 MAIN 到 END MAIN 區塊和 FUNCTION 到 END FUNCTION 區塊中定義但未使用的變量，並透過黃色波浪線提醒開發者移除這些未使用的變數宣告。

## 功能特性

### 支援的作用域

- **MAIN 區塊**: 偵測 MAIN 到 END MAIN 之間的未使用變數
- **FUNCTION 區塊**: 偵測 FUNCTION 到 END FUNCTION 之間的未使用變數

### 支援的變數類型

- 基本型別變數 (INTEGER, STRING, DATE, CHAR, etc.)
- LIKE 引用類型
- RECORD 結構變數
- 單行和多行 DEFINE 聲明

### 變數使用偵測模式

- 賦值語句 (`LET variable = ...` 或 `LET variable.field = ...`)
- 表達式中使用 (`... = variable + ...`)
- 函數參數 (`CALL func(variable)`)
- 條件語句 (`IF variable THEN`)
- 輸出語句 (`DISPLAY variable`)
- SQL INTO 子句 (`SELECT * INTO variable.*` 或 `FETCH cursor INTO variable`)
- INITIALIZE 語句 (`INITIALIZE variable.* TO NULL`)
- INSERT INTO VALUES 語句 (`INSERT INTO table VALUES (variable.*)`)
- UPDATE SET 語句 (`UPDATE table SET field = variable.field`)

## 配置選項

該功能整合到現有的診斷配置中：

```json
{
 "GeneroFGL.4gl.diagnostic.enable": {
 "type": "boolean",
 "default": true,
 "description": "Enable diagnostic (包含未使用變數偵測)"
 }
}
```

## 使用範例

### 函數參數辨識範例

```4gl
# 修復前的問題：函數參數被錯誤標記為未使用變數
FUNCTION r667_tm(p_row,p_col)
 DEFINE p_row,p_col LIKE type_file.num5 # 現在不會被標記為未使用

 LET p_row = p_row + 1
 LET p_col = p_col + 2

 RETURN p_row, p_col
END FUNCTION

# 混合參數和局部變數的範例
FUNCTION test_mixed(p_param1, p_param2)
 DEFINE p_param1, p_param2 LIKE table.field # 函數參數，不會被標記
 DEFINE l_local INTEGER # 使用的局部變數
 DEFINE l_unused STRING # 未使用 - 會顯示黃色警告

 LET p_param1 = 1
 LET p_param2 = 2
 LET l_local = 42

 DISPLAY p_param1, p_param2, l_local
END FUNCTION
```

### 範例程式碼

```4gl
MAIN
 DEFINE l_used INTEGER # 這個變數會被使用
 DEFINE l_unused INTEGER # 未使用 - 會顯示黃色警告
 DEFINE l_msg STRING # 這個變數會被使用

 DEFINE l_record RECORD
 name STRING,
 age INTEGER
 END RECORD # 這個變數會被使用

 DEFINE l_unused_record RECORD
 id INTEGER
 END RECORD # 未使用 - 會顯示黃色警告

 LET l_used = 10
 LET l_msg = "Hello"
 LET l_record.name = "Test"

 DISPLAY l_used, l_msg, l_record.name
END MAIN

FUNCTION test_function()
 DEFINE l_func_used INTEGER # 使用的變數
 DEFINE l_func_unused STRING # 未使用 - 會顯示黃色警告

 LET l_func_used = 100
 RETURN l_func_used
END FUNCTION
```

### 診斷訊息

- MAIN 區塊中的未使用變數: `未使用的變數 'variable_name'，建議移除該變數宣告`
- FUNCTION 區塊中的未使用變數: `函數 'function_name' 中未使用的變數 'variable_name'，建議移除該變數宣告`

## 技術實現

### 核心元件

1. **變數定義解析器**: 解析 DEFINE 語句並擷取變數資訊
2. **代碼區塊識別器**: 識別 MAIN 和 FUNCTION 區塊的邊界
3. **增強的函數簽章解析器**: 智慧識別函數參數，支援括號參數和 DEFINE 參數
4. **變數使用分析器**: 分析變數在程式碼中的使用情況
5. **診斷管理器**: 產生和管理診斷訊息

### 函數參數辨識最佳化

#### 增強的解析策略

- **括號參數解析**: 從函數宣告行中擷取 `FUNCTION name(param1, param2)` 的參數
- **DEFINE 參數匹配**: 掃描函數體內的 DEFINE 語句，匹配與括號參數同名的變量
- **參數合併**: 將所有類型的參數合併為統一列表，避免漏檢
- **智慧過濾**: 在未使用變數偵測中排除所有辨識到的參數

#### 支援的參數模式

- `FUNCTION name(p1, p2)` + `DEFINE p1, p2 LIKE table.field`
- `FUNCTION name(p1)` + `DEFINE p1 INTEGER`
- `FUNCTION name(p1, p2)` + `DEFINE p1 STRING` + `DEFINE p2 DATE`
- 混合參數類型（LIKE、基本型別等）

### 效能優化

- 防手震處理：文件變更後延遲 500ms 進行診斷
- 配置驅動：可透過設定開啟/關閉功能
- 增量更新：僅在相關配置變更時重新分析

## 啟用/停用功能

在 VS Code 設定中搜尋 "GeneroFGL diagnostic" 並切換 `GeneroFGL.4gl.diagnostic.enable` 選項來啟用或停用此功能。

## 相容性

- 支援所有現有的 4GL 語法
- 不影響現有的語法高亮和其他功能
- 與現有的診斷系統完全集成
