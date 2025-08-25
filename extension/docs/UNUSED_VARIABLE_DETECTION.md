# Genero FGL 未使用变量检测功能

## 功能概述

该功能为 Genero FGL 扩展新增了未使用变量检测能力，可以检测在 MAIN 到 END MAIN 块和 FUNCTION 到 END FUNCTION 块中定义但未使用的变量，并通过黄色波浪线提醒开发者移除这些未使用的变量声明。

## 功能特性

### 支持的作用域
- **MAIN 块**: 检测 MAIN 到 END MAIN 之间的未使用变量
- **FUNCTION 块**: 检测 FUNCTION 到 END FUNCTION 之间的未使用变量

### 函数参数识别优化
- **增强的参数解析**: 自动识别函数声明行中的括号参数（如 `FUNCTION r667_tm(p_row,p_col)`）
- **DEFINE 参数识别**: 智能解析函数体内通过 DEFINE 语句声明的参数变量
- **参数排除**: 确保函数参数不会被错误标记为未使用变量
- **支持复杂参数模式**: 处理 LIKE 引用、多变量定义等各种参数声明方式

### 支持的变量类型
- 基本类型变量 (INTEGER, STRING, DATE, CHAR, etc.)
- LIKE 引用类型
- RECORD 结构变量
- 单行和多行 DEFINE 声明

### 变量使用检测模式
- 赋值语句 (`LET variable = ...` 或 `LET variable.field = ...`)
- 表达式中使用 (`... = variable + ...`)
- 函数参数 (`CALL func(variable)`)
- 条件语句 (`IF variable THEN`)
- 输出语句 (`DISPLAY variable`)
- SQL INTO 子句 (`SELECT * INTO variable.*` 或 `FETCH cursor INTO variable`)
- INITIALIZE 语句 (`INITIALIZE variable.* TO NULL`)
- INSERT INTO VALUES 语句 (`INSERT INTO table VALUES (variable.*)`)
- UPDATE SET 语句 (`UPDATE table SET field = variable.field`)

## 配置选项

该功能集成到现有的诊断配置中：

```json
{
  "GeneroFGL.4gl.diagnostic.enable": {
    "type": "boolean",
    "default": true,
    "description": "Enable diagnostic (包含未使用变量检测)"
  }
}
```

## 使用示例

### 函数参数识别示例

```4gl
# 修复前的问题：函数参数被错误标记为未使用变量
FUNCTION r667_tm(p_row,p_col)
  DEFINE p_row,p_col       LIKE type_file.num5   # 现在不会被标记为未使用
  
  LET p_row = p_row + 1
  LET p_col = p_col + 2
  
  RETURN p_row, p_col
END FUNCTION

# 混合参数和局部变量的示例
FUNCTION test_mixed(p_param1, p_param2)
  DEFINE p_param1, p_param2 LIKE table.field    # 函数参数，不会被标记
  DEFINE l_local INTEGER                        # 使用的局部变量
  DEFINE l_unused STRING                        # 未使用 - 会显示黄色警告
  
  LET p_param1 = 1
  LET p_param2 = 2
  LET l_local = 42
  
  DISPLAY p_param1, p_param2, l_local
END FUNCTION
```

### 示例代码

```4gl
MAIN
  DEFINE l_used INTEGER        # 这个变量会被使用
  DEFINE l_unused INTEGER      # 未使用 - 会显示黄色警告
  DEFINE l_msg STRING          # 这个变量会被使用
  
  DEFINE l_record RECORD
    name STRING,
    age INTEGER
  END RECORD                   # 这个变量会被使用
  
  DEFINE l_unused_record RECORD
    id INTEGER
  END RECORD                   # 未使用 - 会显示黄色警告
  
  LET l_used = 10
  LET l_msg = "Hello"
  LET l_record.name = "Test"
  
  DISPLAY l_used, l_msg, l_record.name
END MAIN

FUNCTION test_function()
  DEFINE l_func_used INTEGER     # 使用的变量
  DEFINE l_func_unused STRING    # 未使用 - 会显示黄色警告
  
  LET l_func_used = 100
  RETURN l_func_used
END FUNCTION
```

### 诊断消息

- MAIN 块中的未使用变量: `未使用的变量 'variable_name'，建议移除该变量声明`
- FUNCTION 块中的未使用变量: `函数 'function_name' 中未使用的变量 'variable_name'，建议移除该变量声明`

## 技术实现

### 核心组件

1. **变量定义解析器**: 解析 DEFINE 语句并提取变量信息
2. **代码块识别器**: 识别 MAIN 和 FUNCTION 块的边界
3. **增强的函数签名解析器**: 智能识别函数参数，支持括号参数和 DEFINE 参数
4. **变量使用分析器**: 分析变量在代码中的使用情况
5. **诊断管理器**: 生成和管理诊断信息

### 函数参数识别优化

#### 增强的解析策略
- **括号参数解析**: 从函数声明行中提取 `FUNCTION name(param1, param2)` 的参数
- **DEFINE 参数匹配**: 扫描函数体内的 DEFINE 语句，匹配与括号参数同名的变量
- **参数合并**: 将所有类型的参数合并为统一列表，避免漏检
- **智能过滤**: 在未使用变量检测中排除所有识别到的参数

#### 支持的参数模式
- `FUNCTION name(p1, p2)` + `DEFINE p1, p2 LIKE table.field`
- `FUNCTION name(p1)` + `DEFINE p1 INTEGER`
- `FUNCTION name(p1, p2)` + `DEFINE p1 STRING` + `DEFINE p2 DATE`
- 混合参数类型（LIKE、基本类型等）

### 性能优化

- 防抖处理：文档更改后延迟 500ms 进行诊断
- 配置驱动：可通过配置开启/关闭功能
- 增量更新：只在相关配置更改时重新分析

## 启用/禁用功能

在 VS Code 设置中搜索 "GeneroFGL diagnostic" 并切换 `GeneroFGL.4gl.diagnostic.enable` 选项来启用或禁用此功能。

## 兼容性

- 支持所有现有的 4GL 语法
- 不影响现有的语法高亮和其他功能
- 与现有的诊断系统完全集成