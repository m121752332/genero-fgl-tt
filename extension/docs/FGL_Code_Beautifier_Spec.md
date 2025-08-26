# FGL 程式碼美化規格書

本文件定義 **Genero BDL / FGL** 程式碼的美化（Formatter / Beautifier）規範，作為開發人員與工具實作的統一依據。

參考：[Genero BDL / FGL Code Formatter](https://4js.com/online_documentation/fjs-gst-manual-html/index.html#gst-topics/c_gst_preferences_code_editor_behavior_display.html) | [繁體中文說明](/extension/docs/FGL_preferences_CODE_EDITOR_BEHAVIOR_DISPLAY.md)

---

## 1. 縮排與排版規則（Indentation & Tabs）

- **縮排寬度 (Tab size)**：`3` 空格  
- **Tab 轉換**：所有 Tab 皆轉換為空格 (`Insert spaces for tab = true`)  
- **智慧縮排 (Smart indent)**：依語法自動縮排  
- **智慧刪除 (Smart backspace)**：刪除時以縮排單位運作
- **智慧 Tab (Smart tab)**：補齊縮排至正確層級  
- **行尾空白 (Strip trailing whitespaces)**：允許存在，不自動移除  

---

## 2. 語言專屬規則（Language Specific）

- **關鍵字大小寫 (Keyword case conversion)**：全部轉換為 **大寫 (UPPERCASE)**  
- **註解符號 (Comment operator)**：使用預設 -- 2個字符當單行註解

---

## 3. 程式碼美化規則（Code Beautifier）

- **每行長度限制 (Column limit)**：`120` 字元  
- **縮排寬度 (Indent width)**：`3` 空格  
- **跨行縮排 (Continuation indent width)**：`3` 空格  

### 語句區塊縮排

- **Indent instruction clauses**：啟用  
  - IF / CASE / FOR / WHILE 等控制語句的區塊內容需縮排  

### 空白行處理

- **Pack**：啟用  
  - 移除多餘的空白行，保持程式碼緊湊  

### 自動化

- **Indent on save**：啟用  
  - 儲存檔案時自動執行美化  

### 對齊規則

- **Align assignments**：啟用 → `=` 賦值符號對齊  
- **Align types**：啟用 → 變數宣告型別對齊  
- **Align comments**：啟用 → 行尾註解對齊  

---

## 4. 總體風格總結

1. **縮排風格**：統一 `3` 空格，禁止 Tab 字元  
2. **關鍵字風格**：全部大寫，保持程式碼一致性  
3. **程式碼長度**：單行程式碼不超過 `120` 字元，必要時自動換行並縮排  
4. **對齊規則**：賦值符號、型別、註解皆對齊，維持整齊可讀  
5. **自動化**：儲存即美化，減少人工調整成本  

---

## 5. 範例（Before → After）

### Before

```fgl
function test()
define id integer, name varchar(50) --customer id
let id=1
let name="Tiger"
if id=1 then
display name
end if
end function
```

### After

```fgl
FUNCTION test()
   DEFINE id   INTEGER,       -- customer id
          name VARCHAR(50)

   LET id   = 1
   LET name = "Tiger"

   IF id = 1 THEN
      DISPLAY name
   END IF
END FUNCTION
```
