// 测试函数参数识别逻辑
function testParameterRecognition() {
  // 模拟函数内容
  const functionContent = `FUNCTION cs_resmed_po_by_orderid(p_oea01,p_oga01)
DEFINE p_oea01       LIKE oea_file.oea01
DEFINE p_oga01       LIKE oga_file.oga01
DEFINE l_oga         RECORD LIKE oga_file.*
DEFINE l_oea         RECORD LIKE oea_file.*
DEFINE l_oeb         RECORD LIKE oeb_file.*
DEFINE l_rs_check    LIKE type_file.chr10
DEFINE l_cnt         LIKE type_file.num5
DEFINE l_sql         STRING
DEFINE l_azo06       LIKE azo_file.azo06

   LET l_rs_check='60'
   SELECT * INTO l_oea.* FROM oea_file
    WHERE oea01=p_oea01
END FUNCTION`;

  // 解析函数声明
  const lines = functionContent.split(/\r?\n/);
  const firstLine = lines[0];
  
  console.log('第一行:', firstLine);
  
  const functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*$/i);
  
  if (functionMatch) {
    const functionName = functionMatch[1];
    const bracketParameterString = functionMatch[2].trim();
    
    console.log('函数名:', functionName);
    console.log('括号参数字符串:', bracketParameterString);
    
    // 解析括号内参数
    const bracketParameters = bracketParameterString 
      ? bracketParameterString.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : [];
    
    console.log('括号参数:', bracketParameters);
    
    // 查找 DEFINE 中的参数和局部变量
    const defineParameters = [];
    const localVariables = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('#') || line.startsWith('--')) continue;
      
      console.log(`\n处理行 ${i}: ${line}`);
      
      // 检查 RECORD LIKE 定义
      const recordLikeMatch = line.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+\s*\*?\s*$/i);
      if (recordLikeMatch) {
        const variableName = recordLikeMatch[1];
        console.log(`  → RECORD LIKE 变量: ${variableName}`);
        
        if (bracketParameters.includes(variableName)) {
          defineParameters.push(variableName);
          console.log(`  ✓ 识别为参数: ${variableName}`);
        } else {
          localVariables.push(variableName);
          console.log(`  ✗ 识别为局部变量: ${variableName}`);
        }
        continue;
      }
      
      // 检查普通 DEFINE 定义
      const defineMatch = line.match(/^\s*DEFINE\s+([^#\n]+?)\s+(?:LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|CHAR|DECIMAL|SMALLINT|BIGINT|DATE|DATETIME|VARCHAR|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
      
      if (defineMatch) {
        const variableList = defineMatch[1].trim();
        console.log(`  → 普通 DEFINE: ${variableList}`);
        
        const variables = variableList.split(',').map(v => v.trim()).filter(v => v.length > 0);
        console.log(`  → 解析变量: `, variables);
        
        variables.forEach(variable => {
          if (bracketParameters.includes(variable)) {
            defineParameters.push(variable);
            console.log(`  ✓ 识别为参数: ${variable}`);
          } else {
            localVariables.push(variable);
            console.log(`  ✗ 识别为局部变量: ${variable}`);
          }
        });
      }
    }
    
    console.log('\n=== 最终识别结果 ===');
    console.log('括号参数:', bracketParameters);
    console.log('DEFINE参数:', defineParameters);
    console.log('所有参数:', [...new Set([...bracketParameters, ...defineParameters])]);
    console.log('局部变量:', localVariables);
    
    console.log('\n=== 验证结果 ===');
    console.log('✓ 正确识别的参数:');
    ['p_oea01', 'p_oga01'].forEach(param => {
      const allParams = [...new Set([...bracketParameters, ...defineParameters])];
      if (allParams.includes(param)) {
        console.log(`  ✓ ${param}`);
      } else {
        console.log(`  ✗ 漏识别参数: ${param}`);
      }
    });
    
    console.log('✓ 正确识别的局部变量:');
    ['l_oga', 'l_oea', 'l_oeb', 'l_rs_check', 'l_cnt', 'l_sql', 'l_azo06'].forEach(localVar => {
      if (localVariables.includes(localVar)) {
        console.log(`  ✓ ${localVar}`);
      } else {
        console.log(`  ✗ 漏识别局部变量: ${localVar}`);
      }
    });
    
  } else {
    console.log('无法匹配函数声明');
  }
}

testParameterRecognition();