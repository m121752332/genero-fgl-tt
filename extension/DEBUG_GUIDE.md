# Debug資訊檢查指南

## 檢查步驟

### 1. 強制重啟 VS Code
1. 完全關閉所有 VS Code 窗口
2. 等待 5 秒
3. 重新開啟 VS Code

### 2. 檢查擴充狀態
1. 按 `Ctrl+Shift+P`
2. 輸入 "Extensions: Show Running Extensions"
3. 確認 "Genero-FGL" 擴充功能正在運行

### 3. 檢查診斷配置
1. 按 `Ctrl+,` 開啟設置
2. 搜尋 "GeneroFGL diagnostic"
3. 確認 `GeneroFGL.4gl.diagnostic.enable` 為 `true`

### 4. 查看偵錯輸出
1. 按 `Ctrl+Shift+U` 開啟輸出面板
2. 在下拉式選單中選擇 "Genero FGL" 或相關頻道
3. 查看是否有錯誤訊息

### 5. 手動觸發診斷
1. 在 .4gl 檔案中
2. 按 `Ctrl+Shift+P`
3. 輸入 "Developer: Reload Window"
4. 等待視窗重新載入後檢查診斷

### 6. 檢查具體問題
如果問題仍然存在：

1. **檔案大小問題**: saxmt400.4gl 可能太大
 - 檢查檔案行數：按 `Ctrl+G` 看總行數
 - 如果超過 10000 行，可能需要最佳化效能

2. **函數分析問題**:
 - 在函數開始處加入一個明顯未使用的變數測試
 - 例如：`DEFINE l_debug_test LIKE type_file.chr1`
 - 看是否被正確標記

3. **擴充錯誤**:
 - 按 `F12` 開啟開發者工具
 - 查看 Console 標籤頁是否有錯誤訊息

## 暫存解決方案

如果問題持續：
1. 嘗試卸載並重新安裝擴充功能
2. 重啟 VS Code
3. 重新執行 `npm run build-install`