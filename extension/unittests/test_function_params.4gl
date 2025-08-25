# 测试函数参数识别修复效果的测试用例

# 场景1：基础函数参数（来自原始问题）
FUNCTION r667_tm(p_row,p_col)
  DEFINE p_row,p_col       LIKE type_file.num5          #No.FUN-680137 SMALLINT
  
  LET p_row = p_row + 1
  LET p_col = p_col + 2
  
  RETURN p_row, p_col
END FUNCTION

# 场景2：单参数函数
FUNCTION test_single_param(p_id)
  DEFINE p_id INTEGER
  
  LET p_id = 100
  DISPLAY p_id
END FUNCTION

# 场景3：多参数LIKE定义
FUNCTION test_multi_params(p_user, p_name, p_age)
  DEFINE p_user, p_name LIKE user_table.username
  DEFINE p_age LIKE user_table.age
  
  LET p_user = "admin"
  LET p_name = p_user
  LET p_age = 25
  
  DISPLAY p_user, p_name, p_age
END FUNCTION

# 场景4：混合参数和局部变量
FUNCTION test_mixed_variables(p_param1, p_param2)
  DEFINE p_param1, p_param2 LIKE table.field
  DEFINE l_local INTEGER     # 这是局部变量，会被使用
  DEFINE l_unused STRING     # 这是未使用的局部变量，应该被检测到
  
  LET p_param1 = 1
  LET p_param2 = 2
  LET l_local = 42
  
  DISPLAY p_param1, p_param2, l_local
  # l_unused 未使用，应该被标记为警告
END FUNCTION

# 场景5：无参数函数
FUNCTION test_no_params()
  DEFINE l_unused STRING     # 未使用变量，应该被检测到
  DEFINE l_used INTEGER      # 使用的变量
  
  LET l_used = 42
  DISPLAY l_used
  # l_unused 应该被标记为警告
END FUNCTION

# 场景6：复杂参数类型
FUNCTION test_complex_params(p_date, p_amount)
  DEFINE p_date DATE
  DEFINE p_amount DECIMAL(10,2)
  DEFINE l_result STRING     # 局部变量，会被使用
  DEFINE l_temp INTEGER      # 局部变量，未使用，应该被检测到
  
  LET l_result = "Processing date: " || p_date || " amount: " || p_amount
  DISPLAY l_result
  # l_temp 应该被标记为警告
END FUNCTION

MAIN
  DEFINE l_main_unused STRING    # 主程序中的未使用变量
  DEFINE l_main_used INTEGER     # 主程序中的使用变量
  
  LET l_main_used = 1
  
  CALL r667_tm(10, 20)
  CALL test_single_param(l_main_used)
  
  # l_main_unused 应该被标记为警告
END MAIN