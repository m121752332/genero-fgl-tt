# 测试未使用变量检测功能的示例文件

MAIN
  DEFINE l_used INTEGER        # 这个变量会被使用
  DEFINE l_unused INTEGER      # 这个变量未使用，应该产生警告
  DEFINE l_msg STRING          # 这个变量会被使用
  DEFINE l_unused_string STRING # 这个变量未使用，应该产生警告
  
  DEFINE l_record RECORD
    name STRING,
    age INTEGER
  END RECORD                   # RECORD 变量会被使用
  
  DEFINE l_unused_record RECORD
    id INTEGER,
    status STRING
  END RECORD                   # 这个 RECORD 变量未使用，应该产生警告
  
  # 使用一些变量
  LET l_used = 10
  LET l_msg = "Hello World"
  LET l_record.name = "Test"
  
  DISPLAY l_used, l_msg
  DISPLAY l_record.name
END MAIN

FUNCTION test_function()
  DEFINE l_func_used INTEGER     # 函数中使用的变量
  DEFINE l_func_unused STRING    # 函数中未使用的变量，应该产生警告
  DEFINE l_temp INTEGER          # 未使用的变量，应该产生警告
  
  LET l_func_used = 100
  RETURN l_func_used
END FUNCTION

FUNCTION another_test()
  DEFINE l_param STRING
  DEFINE l_result INTEGER        # 未使用的变量，应该产生警告
  
  CALL some_function(l_param)
  # l_result 未被使用
END FUNCTION