# 檢查擴展狀態指南

## 步驟 1: 檢查擴展是否正在運行

1. 在 VS Code 中按 `Ctrl+Shift+P`
2. 輸入 "Extensions: Show Running Extensions"
3. 查找 "Genero FGL" 或類似的擴展名

## 步驟 2: 檢查診斷設置

1. 按 `Ctrl+,` 打開設置
2. 搜索 "genero" 或 "4gl"
3. 確認相關診斷設置已啟用

## 步驟 3: 檢查輸出面板

1. 按 `Ctrl+Shift+U` 打開輸出面板
2. 在下拉菜單中選擇 "Genero FGL" 頻道
3. 查看是否有任何錯誤訊息

## 步驟 4: 強制重新加載

1. 按 `Ctrl+Shift+P`
2. 輸入 "Developer: Reload Window"
3. 等待 VS Code 重新加載

## 步驟 5: 手動觸發診斷

1. 打開一個 .4gl 文件
2. 進行一些編輯（如添加空格再刪除）
3. 查看是否出現診斷標記

## 如果仍然沒有診斷

可能需要：

1. 完全重啟 VS Code
2. 重新安裝擴展
3. 檢查文件是否過大（> 1MB）影響性能
