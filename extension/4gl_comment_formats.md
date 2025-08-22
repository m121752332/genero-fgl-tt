# Genero 4GL 語法高亮配置分析

這是一個 Visual Studio Code 擴充功能的 JSON 配置，用於定義 **Genero 4GL** 語言的語法高亮規則。

---

### **核心結構**

* **`name`**: `Genero 4gl` (顯示名稱)
* **`fileTypes`**: `4gl` (此配置適用的檔案副檔名)
* **`scopeName`**: `source.4gl` (VS Code 內部識別名稱)
* **`patterns`**: 語法規則的處理順序。
* **`repository`**: 儲存所有詳細規則的資料庫。

---

### **語法元素與對應高亮 ID**

| 語法類別 | 識別方式 (正規表達式) | 高亮 ID (`name`) | 說明 |
| :--- | :--- | :--- | :--- |
| **註解** | `#.*$` | `comment.line.number-sign.4gl` | 以 `#` 開頭的單行註解。 |
| | `--.*$` | `comment.line.double-dash.4gl` | 以 `--` 開頭的單行註解。 |
| | `{ ... }` | `comment.block.4gl` | 以 `{` 和 `}` 包圍的區塊註解。 |
| **關鍵字** | `(AND|OR|MOD|NOT)` | `keyword.operator.4gl` | 運算子。 |
| | `(BOOLEAN|BYTE|...)` | `storage.type.4gl` | 資料型別。 |
| | `(ABSOLUTE|ACCEPT|...)` | `keyword.control.4gl` | 控制流程、命令等。 |
| **字串** | `'...'(?!')` | `string.quoted.single.4gl` | 單引號包圍的字串。 |
| | `"..."(?!")` | `string.quoted.double.4gl` | 雙引號包圍的字串。 |
| | `` `...` `` | `string.quoted.raw.4gl` | 反引號包圍的字串。 |
| **數字** | `...` | `constant.numeric.4gl` | 整數、浮點數、科學記號等數值。 |
| **前置處理器** | `^\\s*&\\s*(elif|...)` | `meta.preprocessor` | 處理 `&define`、`&endif` 等語法。 |

---


# Genero 4GL 語法高亮 ID 對應表

## 註解 (Comments)
**ID:** `comment.line.number-sign.4gl`
- **關鍵字:** `#` 開頭的單行註解
- **範例:** `# 這是註解`

**ID:** `comment.line.double-dash.4gl`
- **關鍵字:** `--` 開頭的單行註解
- **範例:** `-- 這是註解`

**ID:** `comment.block.4gl`
- **關鍵字:** `{` 和 `}` 包圍的區塊註解
- **範例:** `{ 這是區塊註解 }`

## 運算子關鍵字 (Operators)
**ID:** `keyword.operator.4gl`
- **關鍵字:** `AND`, `OR`, `MOD`, `NOT`

## 資料型別 (Data Types)
**ID:** `storage.type.4gl`
- **關鍵字:** `BOOLEAN`, `BYTE`, `CHAR`, `VARCHAR`, `NVARCHAR`, `LVARCHAR`, `FLOAT`, `INTEGER`, `INT`, `INT8`, `SMALLINT`, `BIGINT`, `TINYINT`, `SMALLFLOAT`, `DECIMAL`, `MONEY`, `DATE`, `DATETIME`, `INTERVAL`, `SERIAL8`, `SERIAL`, `STRING`, `TEXT`

## 控制關鍵字 (Control Keywords)
**ID:** `keyword.control.4gl`
包含大量的控制關鍵字，分組如下：

### A-B 開頭
`ABSOLUTE`, `ACCELERATOR`, `ACCEPT`, `ACCESSORYTYPE`, `ACTION`, `ADD`, `AFTER`, `ALL`, `ALTER`, `AND`, `ANSI`, `ANY`, `APPEND`, `APPLICATION`, `ARRAY`, `AS`, `ASC`, `ASCENDING`, `ASCII`, `AT`, `ATTRIBUTE`, `ATTRIBUTES`, `AUDIT`, `AUTHORIZATION`, `AUTO`, `AVG`, `BEFORE`, `BEGIN`, `BETWEEN`, `BIGINT`, `BIGSERIAL`, `BLACK`, `BLINK`, `BLUE`, `BOLD`, `BOOLEAN`, `BORDER`, `BOTTOM`, `BREAKPOINT`, `BUFFER`, `BUFFERED`, `BY`, `BYTE`

### C-D 開頭
`CACHE`, `CALL`, `CANCEL`, `CASCADE`, `CASE`, `CAST`, `CATCH`, `CENTURY`, `CHANGE`, `CHAR`, `CHARACTER`, `CHECK`, `CHECKMARK`, `CIRCUIT`, `CLEAR`, `CLIPPED`, `CLOSE`, `CLUSTER`, `COLLAPSE`, `COLUMN`, `COLUMNS`, `COMMAND`, `COMMENT`, `COMMIT`, `COMMITTED`, `CONCURRENT`, `CONNECT`, `CONNECTION`, `CONSTANT`, `CONSTRAINED`, `CONSTRAINT`, `CONSTRUCT`, `CONTEXTMENU`, `CONTINUE`, `CONTROL`, `COUNT`, `CREATE`, `CROSS`, `CURRENT`, `CURSOR`, `CYAN`, `CYCLE`, `DATABASE`, `DATE`, `DATETIME`, `DAY`, `DBA`, `DBSERVERNAME`, `DEC`, `DECIMAL`, `DECLARE`, `DEFAULT`, `DEFAULTS`, `DEFAULTVIEW`, `DEFER`, `DEFINE`, `DELETE`, `DELIMITER`, `DESC`, `DESCENDING`, `DESCRIBE`, `DESTINATION`, `DETAILACTION`, `DETAILBUTTON`, `DIALOG`, `DICTIONARY`, `DIM`, `DIMENSION`, `DIRTY`, `DISCLOSUREINDICATOR`, `DISCONNECT`, `DISPLAY`, `DISTINCT`, `DORMANT`, `DOUBLE`, `DOUBLECLICK`, `DOWN`, `DRAG_ENTER`, `DRAG_FINISHED`, `DRAG_OVER`, `DRAG_START`, `DROP`, `DYNAMIC`

### E-F 開頭
`ELSE`, `END`, `ERROR`, `ESCAPE`, `EVERY`, `EXCLUSIVE`, `EXECUTE`, `EXISTS`, `EXIT`, `EXPAND`, `EXPLAIN`, `EXTEND`, `EXTENT`, `EXTERNAL`, `FALSE`, `FETCH`, `FGL`, `FGL_DRAWBOX`, `FIELD`, `FIELD_TOUCHED`, `FILE`, `FILL`, `FINISH`, `FIRST`, `FLOAT`, `FLUSH`, `FOCUSONFIELD`, `FOR`, `FOREACH`, `FOREIGN`, `FORM`, `FORMAT`, `FOUND`, `FRACTION`, `FREE`, `FROM`, `FULL`, `FUNCTION`

### G-I 開頭
`GET_FLDBUF`, `GLOBALS`, `GO`, `GOTO`, `GRANT`, `GREEN`, `GROUP`, `HANDLER`, `HAVING`, `HEADER`, `HELP`, `HIDE`, `HOLD`, `HOUR`, `IDLE`, `IF`, `IIF`, `IMAGE`, `IMMEDIATE`, `IMPORT`, `IN`, `INCREMENT`, `INDEX`, `INFIELD`, `INITIALIZE`, `INNER`, `INOUT`, `INPUT`, `INSERT`, `INSTANCEOF`, `INT`, `INT8`, `INTEGER`, `INTERFACE`, `INTERRUPT`, `INTERVAL`, `INTO`, `INVISIBLE`, `IS`, `ISOLATION`

### J-M 開頭
`JAVA`, `JOIN`, `KEEP`, `KEY`, `LABEL`, `LAST`, `LEFT`, `LENGTH`, `LET`, `LIKE`, `LIMIT`, `LINE`, `LINENO`, `LINES`, `LOAD`, `LOCATE`, `LOCK`, `LOCKS`, `LOG`, `LSTR`, `LVARCHAR`, `MAGENTA`, `MAIN`, `MARGIN`, `MATCHES`, `MAX`, `MAXCOUNT`, `MAXVALUE`, `MDY`, `MEMORY`, `MENU`, `MESSAGE`, `MIDDLE`, `MIN`, `MINUTE`, `MINVALUE`, `MOD`, `MODE`, `MODIFY`, `MONEY`, `MONTH`

### N-P 開頭
`NAME`, `NATURAL`, `NAVIGATOR`, `NCHAR`, `NEED`, `NEXT`, `NO`, `NOCACHE`, `NOCYCLE`, `NOMAXVALUE`, `NOMINVALUE`, `NOORDER`, `NORMAL`, `NOT`, `NOTFOUND`, `NULL`, `NUMERIC`, `NVARCHAR`, `NVL`, `OF`, `OFF`, `ON`, `OPEN`, `OPTION`, `OPTIONS`, `OR`, `ORD`, `ORDER`, `OTHERWISE`, `OUT`, `OUTER`, `OUTPUT`, `PACKAGE`, `PAGE`, `PAGENO`, `PAUSE`, `PERCENT`, `PICTURE`, `PIPE`, `POPUP`, `PRECISION`, `PREPARE`, `PREVIOUS`, `PRIMARY`, `PRINT`, `PRINTER`, `PRINTX`, `PRIOR`, `PRIVATE`, `PRIVILEGES`, `PROCEDURE`, `PROGRAM`, `PROMPT`, `PUBLIC`, `PUT`

### Q-Z 開頭
`QUIT`, `RAISE`, `READ`, `REAL`, `RECORD`, `RECOVER`, `RED`, `REFERENCES`, `RELATIVE`, `RELEASE`, `RENAME`, `REOPTIMIZATION`, `REPEATABLE`, `REPORT`, `RESOURCE`, `RESTART`, `RETAIN`, `RETURN`, `RETURNING`, `RETURNS`, `REVERSE`, `REVOKE`, `RIGHT`, `ROLLBACK`, `ROLLFORWARD`, `ROW`, `ROWBOUND`, `ROWS`, `RUN`, `SAVEPOINT`, `SCHEMA`, `SCREEN`, `SCROLL`, `SECOND`, `SELECT`, `SELECTION`, `SEQUENCE`, `SERIAL`, `SERIAL8`, `SESSION`, `SET`, `SFMT`, `SHARE`, `SHIFT`, `SHORT`, `SHOW`, `SIGNAL`, `SITENAME`, `SIZE`, `SKIP`, `SLEEP`, `SMALLFLOAT`, `SMALLINT`, `SOME`, `SORT`, `SPACE`, `SPACES`, `SQL`, `SQLERRMESSAGE`, `SQLERROR`, `SQLSTATE`, `STABILITY`, `START`, `STATISTICS`, `STEP`, `STOP`, `STRING`, `STYLE`, `SUBDIALOG`, `SUM`, `SYNONYM`, `TABLE`, `TEMP`, `TERMINATE`, `TEXT`, `THEN`, `THROUGH`, `THRU`, `TIME`, `TIMER`, `TINYINT`, `TO`, `TODAY`, `TOP`, `TRAILER`, `TRANSACTION`, `TRUE`, `TRUNCATE`, `TRUSTED`, `TRY`, `TYPE`, `UNBUFFERED`, `UNCONSTRAINED`, `UNDERLINE`, `UNION`, `UNIQUE`, `UNITS`, `UNLOAD`, `UNLOCK`, `UP`, `UPDATE`, `USER`, `USING`, `VALIDATE`, `VALUES`, `VAR`, `VARCHAR`, `VIEW`, `WAIT`, `WAITING`, `WARNING`, `WEEKDAY`, `WHEN`, `WHENEVER`, `WHERE`, `WHILE`, `WHITE`, `WINDOW`, `WITH`, `WITHOUT`, `WORDWRAP`, `WORK`, `WRAP`, `XML`, `YEAR`, `YELLOW`, `YES`

## 字串 (Strings)
**ID:** `string.quoted.single.4gl`
- **關鍵字:** 單引號字串 `'...'`
- **範例:** `'Hello World'`

**ID:** `string.quoted.double.4gl`
- **關鍵字:** 雙引號字串 `"..."`
- **範例:** `"Hello World"`

**ID:** `string.quoted.raw.4gl`
- **關鍵字:** 反引號字串 `\`...\``
- **範例:** `\`raw string\``

## 數值 (Numbers)
**ID:** `constant.numeric.4gl`
- **關鍵字:** 整數、浮點數、科學記號
- **範例:** `123`, `45.67`, `1.23e-4`, `-987`

## 字元跳脫 (Escape Characters)
**ID:** `constant.character.escape.untitled`
- **關鍵字:** 跳脫字元如 `\\`, `\"`, `\'`, `\n`, `\t` 等
- **範例:** `'He said \"Hello\"'`

**ID:** `invalid.illegal`
- **關鍵字:** 無效的跳脫字元

## 預處理器 (Preprocessor)
**ID:** `meta.preprocessor`
- **關鍵字:** `&elif`, `&else`, `&endif`, `&ifdef`, `&ifndef`, `&include`, `&undef`, `&define`
- **範例:** `&include "header.4gl"`

## 使用說明

在 VS Code 的顏色主題設定中，您可以透過以下方式自訂這些語法元素的顏色：

1. 開啟 VS Code 設定 (Ctrl+,)
2. 搜尋 "tokenColorCustomizations"
3. 在 settings.json 中新增：

```json
"editor.tokenColorCustomizations": {
    "textMateRules": [
        {
            "scope": "keyword.control.4gl",
            "settings": {
                "foreground": "#569CD6"
            }
        },
        {
            "scope": "storage.type.4gl",
            "settings": {
                "foreground": "#4EC9B0"
            }
        }
        // 依此類推...
    ]
}
```

```json
"editor.tokenColorCustomizations": {
    "textMateRules": [ 
        { "scope": "storage.type.4gl", "settings": { "foreground": "#fff81f" } },
        { "scope": "keyword.operator.4gl", "settings": { "foreground": "#a48bf9" } },
        { "scope": "keyword.control.color.red.4gl", "settings": { "foreground": "#FF0000", "fontStyle": "bold underline" } },
        { "scope": "keyword.control.color.yellow.4gl", "settings": { "foreground": "#fff81f" } },
        { "scope": "keyword.control.4gl", "settings": { "foreground": "#ff8b1f" } },
        { "scope": "constant.numeric.4gl", "settings": { "foreground": "#78ff6c" } },
        { "scope": "comment.line.number-sign.4gl", "settings": { "foreground": "#6ecb7b" } },
        { "scope": "comment.line.double-dash.4gl", "settings": { "foreground": "#6ecb7b" } },
        { "scope": "comment.block.4gl", "settings": { "foreground": "#6ecb7b" } },
        { "scope": "string.quoted.single.4gl", "settings": { "foreground": "#71c4ff" } },
        { "scope": "string.quoted.double.4gl", "settings": { "foreground": "#71c4ff" } },
        { "scope": "string.quoted.raw.4gl", "settings": { "foreground": "#71c4ff" } },
        { "scope": "source.4gl", "settings": { "foreground": "#eff3f5" } },
    ]
}
```