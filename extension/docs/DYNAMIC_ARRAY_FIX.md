# DYNAMIC ARRAY OF 類型未使用變數檢測修復

## 問題描述

用戶反報 `DYNAMIC ARRAY OF STRING` 類型的變數 `la_act_type` 被錯誤標記為未使用，儘管該變數在代碼中確實被使用了。

## 問題根因

原有的 `parseDefineStatements` 函數只能處理：
1. 單行 DEFINE 語句（如：`DEFINE var TYPE`）  
2. 多行 RECORD 定義（如：`DEFINE var RECORD ... END RECORD`）

但**無法處理**普通的多行 DEFINE 續行，例如：
```4gl
DEFINE   la_act_type     DYNAMIC ARRAY OF STRING,
         lnode_root      om.DomNode,
         li_i            LIKE type_file.num5
```

在這種情況下，只有第一行的 `la_act_type` 被正確識別，而續行的變數沒有被處理。

## 修復方案

### 1. 增強 DYNAMIC ARRAY OF 類型支持

在 `parseDefineStatements` 函數中，確保正則表達式包含對 `DYNAMIC ARRAY OF` 類型的支持：

```typescript
const singleDefineMatch = line.match(/^\s*DEFINE\s+(.+?)\s+(STRING|INTEGER|...|DYNAMIC\s+ARRAY\s+OF\s+\w+|...)\s*.*$/i);
```

### 2. 添加多行 DEFINE 續行解析

新增對多行 DEFINE 續行的處理邏輯：

```typescript
// 多行 DEFINE 續行解析
// 匹配形如 "         lnode_root      om.DomNode," 的續行
// 排除 4GL 關鍵字以避免誤識別
const defineContMatch = line.match(/^\s+([A-Za-z0-9_]+)\s+(STRING|INTEGER|...|DYNAMIC\s+ARRAY\s+OF\s+\w+|...)\s*,?\s*$/i);
if (defineContMatch) {
  const variableName = defineContMatch[1];
  const variableType = defineContMatch[2];
  
  // 排除 4GL 關鍵字
  const fglKeywords = /^(END|IF|THEN|ELSE|ELSEIF|FOR|WHILE|CASE|WHEN|RETURN|...)$/i;
  if (!fglKeywords.test(variableName)) {
    variables.push({
      name: variableName,
      type: variableType,
      line: actualLineNumber,
      range: new vscode.Range(actualLineNumber, 0, actualLineNumber, line.length),
      scope: scope
    });
  }
}
```

### 3. 關鍵字過濾

為避免將 `END`, `CONTINUE`, `EXIT` 等 4GL 關鍵字誤認為變數名，添加了關鍵字過濾：

```typescript
const fglKeywords = /^(END|IF|THEN|ELSE|ELSEIF|FOR|WHILE|CASE|WHEN|RETURN|CALL|LET|DISPLAY|PRINT|MESSAGE|CONTINUE|EXIT|FUNCTION|MAIN|RECORD|TYPE|DEFINE|GLOBAL|GLOBALS|LIKE|TO|FROM|WHERE|SELECT|INSERT|UPDATE|DELETE|NULL|TRUE|FALSE)$/i;
```

## 修復文件

- **主要修改**: `src/extension.ts` 中的 `parseDefineStatements` 函數 (第 806-850 行)
- **影響範圍**: 未使用變數檢測功能

## 測試驗證

### 測試文件
`unittests/test_unused_variables.4gl` 中的多行 DEFINE 語句：

```4gl
DEFINE   la_act_type     DYNAMIC ARRAY OF STRING,
         lnode_root      om.DomNode,
         li_i            LIKE type_file.num5,
         lst_act_names   base.StringTokenizer,
         ls_act_name     STRING,
         llst_items      om.NodeList,
         li_j            LIKE type_file.num5,
         lnode_item      om.DomNode,
         ls_item_name    STRING,
         ls_item_tag     STRING
```

### 使用位置
`la_act_type` 變數在以下位置被使用：
- 第 25-28 行：數組賦值 (`LET la_act_type[1] = "ActionDefault"`)
- 第 30 行：FOR 迴圈條件 (`FOR li_i = 1 TO la_act_type.getLength()`)
- 第 35 行：方法參數 (`lnode_root.selectByTagName(la_act_type[li_i])`)

### 預期結果
修復後，`la_act_type` 變數應該：
1. ✅ 被正確識別為 `DYNAMIC ARRAY OF STRING` 類型
2. ✅ 被檢測為已使用的變數
3. ✅ 不再顯示未使用變數的黃色警告

## 版本信息

- **修復版本**: 0.1.6+
- **修復日期**: 2025-08-25
- **影響功能**: 未使用變數檢測
- **向後兼容**: 是

## 相關文檔

- [未使用變數檢測功能文檔](./UNUSED_VARIABLE_DETECTION.md)
- [RECORD LIKE 類型修復文檔](./TYPE_RECORD_FIX.md)