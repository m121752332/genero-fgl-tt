FUNCTION cs_resmed_po_by_clmp001(p_oea01,p_date)
DEFINE p_oea01                LIKE oea_file.oea01
DEFINE p_date                 LIKE oga_file.oga02
DEFINE l_oga                  RECORD LIKE oga_file.*
DEFINE l_oea                  RECORD LIKE oea_file.*
DEFINE l_oeb                  RECORD LIKE oeb_file.*
DEFINE l_rs_check             LIKE type_file.chr10
DEFINE l_tc_prd14             LIKE tc_prd_file.tc_prd14
DEFINE l_cnt                  LIKE type_file.num5
DEFINE l_sql                  STRING
DEFINE l_unused_var           STRING                # 这个变量应该被标记为未使用
                     
   LET l_rs_check='120'
   SELECT * INTO l_oea.* FROM oea_file
    WHERE oea01=p_oea01
    
   SELECT * INTO l_oga.* FROM oga_file 
    WHERE oga01=p_oea01
    
   FETCH cursor_name INTO l_oeb.*
   
   LET l_cnt = 1
   LET l_sql = "SELECT COUNT(*) FROM test"
   
   IF l_tc_prd14 IS NOT NULL THEN
      DISPLAY "Found record"
   END IF

END FUNCTION