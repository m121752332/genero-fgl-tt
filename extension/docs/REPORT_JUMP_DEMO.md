# Genero FGL REPORT 跳躍功能示範

這個延伸模組現在支援 REPORT 的定義跳躍功能，類似於 FUNCTION 的跳躍。

## 支援的語句類型

1. **START REPORT** - 啟動報表

   ```4gl
   START REPORT p620_rep TO l_name
   ```

2. **OUTPUT TO REPORT** - 輸出到報表

   ```4gl
   OUTPUT TO REPORT p620_rep(data1, data2, data3)
   ```

3. **FINISH REPORT** - 結束報表

   ```4gl
   FINISH REPORT p620_rep
   ```

## 使用方式

1. 在任何包含 `START REPORT`、`OUTPUT TO REPORT` 或 `FINISH REPORT` 的程式行中
2. 將游標移到報表名稱上（例如 `p620_rep`）
3. 按下 **F12** 或 **Ctrl+Click** 或點選右鍵選擇 "前往定義"
4. 延伸模組會自動跳躍到對應的 `REPORT p620_rep(...)` 定義

## 功能特色

- ✅ 支援在目前檔案中尋找 REPORT 定義
- ✅ 支援跨檔案尋找 REPORT 定義（在工作區的其他 .4gl 檔案中）
- ✅ 智慧型識別內容（區分 FUNCTION 呼叫和 REPORT 呼叫）
- ✅ 與現有的 FUNCTION 跳躍功能完全相容

## 測試檔案

可以開啟 `test_report_jump.4gl` 檔案進行測試，該檔案包含：

- 第8行：`START REPORT p620_rep TO l_name`
- 第11行：`OUTPUT TO REPORT p620_rep(...)`
- 第16行：`FINISH REPORT p620_rep`
- 第22行：`REPORT p620_rep(sr)` （目標定義）

在前三行的 `p620_rep` 上按 F12，都應該跳躍到第22行的 REPORT 定義。
