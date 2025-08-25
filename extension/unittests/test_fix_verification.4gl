FUNCTION test_into_detection()
DEFINE l_test_var    RECORD LIKE oea_file.*
DEFINE l_unused_var  STRING
DEFINE l_used_var    INTEGER

   # 这个变量通过 SELECT INTO 使用，不应该被标记为未使用
   SELECT * INTO l_test_var.* FROM oea_file WHERE oea01='TEST'
   
   # 这个变量被正常使用，不应该被标记为未使用
   LET l_used_var = 100
   
   # l_unused_var 没有被使用，应该被标记为未使用变量

END FUNCTION