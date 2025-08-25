# Debug信息检查指南

## 检查步骤

### 1. 强制重启 VS Code
1. 完全关闭所有 VS Code 窗口
2. 等待 5 秒
3. 重新打开 VS Code

### 2. 检查扩展状态
1. 按 `Ctrl+Shift+P`
2. 输入 "Extensions: Show Running Extensions"
3. 确认 "Genero-FGL" 扩展正在运行

### 3. 检查诊断配置
1. 按 `Ctrl+,` 打开设置
2. 搜索 "GeneroFGL diagnostic"
3. 确认 `GeneroFGL.4gl.diagnostic.enable` 为 `true`

### 4. 查看调试输出
1. 按 `Ctrl+Shift+U` 打开输出面板
2. 在下拉菜单中选择 "Genero FGL" 或相关频道
3. 查看是否有错误信息

### 5. 手动触发诊断
1. 在 .4gl 文件中
2. 按 `Ctrl+Shift+P`
3. 输入 "Developer: Reload Window"
4. 等待窗口重新加载后检查诊断

### 6. 检查具体问题
如果问题仍然存在：

1. **文件大小问题**: saxmt400.4gl 可能太大
   - 检查文件行数：按 `Ctrl+G` 查看总行数
   - 如果超过 10000 行，可能需要优化性能

2. **函数分析问题**: 
   - 在函数开始处添加一个明显未使用的变量测试
   - 例如：`DEFINE l_debug_test LIKE type_file.chr1`
   - 看是否被正确标记

3. **扩展错误**:
   - 按 `F12` 打开开发者工具
   - 查看 Console 标签页是否有错误信息

## 临时解决方案

如果问题持续：
1. 尝试卸载并重新安装扩展
2. 重启 VS Code
3. 重新运行 `npm run build-install`