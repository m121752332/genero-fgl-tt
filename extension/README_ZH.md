# [English](/extension/README.md)｜[繁體中文](/extension/README_ZH.md)
# Genero fglcomp/fglform 指令介面

## 功能

* 語法高亮（4gl, per）
* 格式化（4gl）
* 跳轉定義（4gl）
* 自動完成（4gl, per）
* 診斷 - 錯誤與警告底線標示 -（4gl, per）
* 懸浮提示（4gl）
* 導覽列（4gl）
* 除錯
* 任務

## 除錯

* 可使用 internalConsole、integratedTerminal、externalTerminal 啟動。
* 可選擇 fglrun 程序 ID 進行附加。

## 建置

此擴充功能提供 'genero-fgl' 任務（code:Terminal/Run Task, code:Terminal/Run Build Task）。

可自訂建置任務（Terminal/Configure Tasks）。
重要：請設置屬性 **"problemMatcher": "$fglcomp"**，否則 vscode 無法解析 fglcomp 與 fglform 的輸出。

範例 1：編譯工作區所有檔案：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "fglcomp-all-4gl",
      "type": "shell",
      "command": "fglcomp -r --make -M *.4gl",
      "problemMatcher": "$fglcomp",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": {
        "kind": "build",
      }
    }
  ]
}
```

範例 2：執行 make

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "make",
      "type": "shell",
      "command": "make",
      "problemMatcher": "$fglcomp",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": "build"
    }
  ]
}
```
