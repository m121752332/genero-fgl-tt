// 测试 INTO 检测的正则表达式
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function testIntoDetection() {
  const variableName = 'l_oea';
  const testLines = [
    'SELECT * INTO l_oea.* FROM oea_file',
    '   SELECT * INTO l_oea.* FROM oea_file',
    'FOREACH cs_cursor INTO l_oea.*',
    'EXECUTE stmt INTO l_oea.*',
    '  WHERE oea01=p_oea01'
  ];

  // 我们的 INTO 检测正则表达式
  const intoRegex = new RegExp(`\\bINTO\\s+[^\\n]*${escapeRegExp(variableName)}(\\.\\*)?\\b`, 'i');
  
  console.log('测试 INTO 检测正则表达式:');
  console.log('正则表达式:', intoRegex.toString());
  console.log();
  
  testLines.forEach((line, index) => {
    const matches = intoRegex.test(line);
    console.log(`测试 ${index + 1}: "${line}"`);
    console.log(`匹配结果: ${matches ? '✓' : '✗'}`);
    console.log();
  });
}

testIntoDetection();