FUNCTION r667_tm(p_row,p_col)
  DEFINE p_row,p_col       LIKE type_file.num5          #No.FUN-680137 SMALLINT
  
  LET p_row = p_row + 1
  LET p_col = p_col + 2
  
  RETURN p_row, p_col
END FUNCTION

MAIN
  CALL r667_tm(10, 20)
END MAIN