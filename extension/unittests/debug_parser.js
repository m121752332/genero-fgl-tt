const fs = require('fs');

// 模拟VS Code的DocumentSymbol类
class DocumentSymbol {
  constructor(name, detail, kind, range, selectionRange) {
    this.name = name;
    this.detail = detail;
    this.kind = kind;
    this.range = range;
    this.selectionRange = selectionRange;
    this.children = [];
  }
}

// 模拟VS Code的Range类
class Range {
  constructor(startLine, startChar, endLine, endChar) {
    this.start = { line: startLine, character: startChar };
    this.end = { line: endLine, character: endChar };
  }
}

// 模拟SymbolKind
const SymbolKind = {
  Namespace: 3,
  Function: 12,
  Method: 6,
  Struct: 23,
  Variable: 13,
  Field: 8,
  TypeParameter: 26
};

// 常量定义 - 从extension.ts复制
const REGEX_PATTERNS = {
  FUNCTION: /^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\b/i,
  REPORT: /^\s*REPORT\s+([A-Za-z0-9_]+)\b/i,
  MAIN_START: /^\s*MAIN\b/i,
  END_FUNCTION: /^\s*END\s+FUNCTION\b/i,
  END_REPORT: /^\s*END\s+REPORT\b/i,
  END_MAIN: /^\s*END\s+MAIN\b/i,
  END_RECORD: /^\s*END\s+RECORD\b/i,
  DEFINE_START: /^\s*DEFINE\b/i,
  TYPE_START: /^\s*TYPE\s+([A-Za-z0-9_]+)\s+(.+)/i,
  RECORD_START: /([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i,
  COMMENT_LINE: /^\s*#/,
  DOUBLE_DASH_COMMENT: /^\s*--/,
  FGL_KEYWORDS: /^(END|IF|THEN|ELSE|ELSEIF|FOR|WHILE|CASE|WHEN|RETURN|CALL|LET|DISPLAY|PRINT|MESSAGE|CONTINUE|EXIT|FUNCTION|MAIN|RECORD|TYPE|DEFINE|GLOBAL|GLOBALS|LIKE|TO|FROM|WHERE|SELECT|INSERT|UPDATE|DELETE|NULL|TRUE|FALSE)$/i
};

// 简化版的parseDocumentSymbols函数
function parseDocumentSymbols(text) {
  console.log('开始解析文档...');
  const lines = text.split(/\r?\n/);
  const symbols = [];

  // Outline groups: MAIN / FUNCTION / REPORT / MODULE_VARIABLE
  const mainGroup = new DocumentSymbol('MAIN', '', SymbolKind.Namespace, new Range(0, 0, Math.max(lines.length - 1, 0), 0), new Range(0, 0, 0, 0));
  const functionsGroup = new DocumentSymbol('FUNCTION', '', SymbolKind.Namespace, new Range(0, 0, Math.max(lines.length - 1, 0), 0), new Range(0, 0, 0, 0));
  const reportsGroup = new DocumentSymbol('REPORT', '', SymbolKind.Namespace, new Range(0, 0, Math.max(lines.length - 1, 0), 0), new Range(0, 0, 0, 0));
  const moduleVarsGroup = new DocumentSymbol('MODULE_VARIABLE', '', SymbolKind.Namespace, new Range(0, 0, Math.max(lines.length - 1, 0), 0), new Range(0, 0, 0, 0));

  // 使用预定义的正则表达式常量
  const reFunction = REGEX_PATTERNS.FUNCTION;
  const reReport = REGEX_PATTERNS.REPORT;
  const reMainStart = REGEX_PATTERNS.MAIN_START;
  const reRecordStart = REGEX_PATTERNS.RECORD_START;
  const reDefineStart = REGEX_PATTERNS.DEFINE_START;
  const reTypeStart = REGEX_PATTERNS.TYPE_START;
  const reEndRecord = REGEX_PATTERNS.END_RECORD;
  const reEndFunction = REGEX_PATTERNS.END_FUNCTION;
  const reEndReport = REGEX_PATTERNS.END_REPORT;
  const reEndMain = REGEX_PATTERNS.END_MAIN;
  const reNonDefineStmt = /^\s*(LET|MESSAGE|DISPLAY|PRINT|CALL|IF|ELSE|CASE|WHEN|FOR|FOREACH|WHILE|RETURN|OPEN|CLOSE|PREPARE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|INITIALIZE|CONSTRUCT|INPUT|MENU|PROMPT|SLEEP|ERROR|WARN|INFO|OPTIONS|GLOBALS)\b/i;
  const reTypeWord = /(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL|FLOAT|SMALLINT|BIGINT|VARCHAR|NUMERIC|BOOLEAN)\b/i;
  const reDefineContinuation = /^\s*(?:DEFINE\s+)?[A-Za-z0-9_,\s]+(?:\b(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL|FLOAT|SMALLINT|BIGINT|VARCHAR|NUMERIC|BOOLEAN)\b.*)?\s*,?\s*(?:#.*)?$/i;
  let currentFunction = null;
  let inMain = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    console.log(`处理第${i+1}行: ${JSON.stringify(line.substring(0, 50))}...`);
    
    // 使用预定义常量跳过注释行
    if (REGEX_PATTERNS.COMMENT_LINE.test(line)) {
      console.log('  跳过注释行');
      continue;
    }

    // MAIN block start
    if (reMainStart.test(line)) {
      console.log('  找到MAIN块开始');
      inMain = true;
      continue;
    }

    // DEFINE block handling
    if (reDefineStart.test(line)) {
      console.log('  找到DEFINE语句，开始收集块...');
      
      // collect contiguous lines that belong to this DEFINE
      const blockLines = [line];
      let j = i;
      while (j + 1 < lines.length) {
        const nxt = lines[j + 1];
        
        // stop if next line starts a new top-level construct or another DEFINE
        if (/^\s*(?:FUNCTION|REPORT|MAIN|IMPORT|DATABASE|GLOBALS|DEFINE|TYPE)\b/i.test(nxt)) {
          console.log(`  遇到新的顶级结构，停止收集: ${nxt.substring(0, 30)}...`);
          break;
        }
        
        // stop if next line obviously starts a normal statement rather than a DEFINE continuation
        if (reNonDefineStmt.test(nxt)) {
          console.log(`  遇到非DEFINE语句，停止收集: ${nxt.substring(0, 30)}...`);
          break;
        }
        
        // allow record block lines or conservative DEFINE-like continuations; otherwise stop
        const isRecordLine = /\bRECORD\b/i.test(nxt) || /^\s*END\s+RECORD\b/i.test(nxt);
        if (!isRecordLine && !reDefineContinuation.test(nxt.trim())) {
          console.log(`  不是RECORD行且不是DEFINE继续行，停止收集: ${nxt.substring(0, 30)}...`);
          break;
        }
        
        console.log(`  包含继续行: ${nxt.substring(0, 30)}...`);
        j++;
        blockLines.push(nxt);
      }
      
      const blockStart = i;
      const blockEnd = j;
      i = j;
      
      console.log(`  DEFINE块收集完成，从第${blockStart+1}行到第${blockEnd+1}行，共${blockLines.length}行`);

      // remove inline comments but keep commas and newlines for parsing; skip pure comment lines
      const cleanedLines = blockLines
        .map(l => l.replace(/#.*/g, ''))
        .filter(l => l.trim().length > 0);
      
      console.log(`  清理后保留${cleanedLines.length}行:`);
      cleanedLines.forEach((line, idx) => {
        console.log(`    ${idx+1}: ${JSON.stringify(line)}`);
      });

      // parse block lines into segments: either record blocks or normal fragments
      const recordSegments = [];
      let k = 0;
      while (k < cleanedLines.length) {
        const ln = cleanedLines[k].trim();
        if (!ln) { k++; continue; }
        
        // support: 'DEFINE <name> RECORD', '<name> RECORD', or 'DEFINE <name> DYNAMIC ARRAY OF RECORD'
        const recStart = ln.match(/^(?:DEFINE\s+)?([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i);
        if (recStart) {
          const recName = recStart[1];
          console.log(`  找到RECORD定义: ${recName}`);
          
          // single-line: '... RECORD LIKE <table>.*' (no END RECORD block)
          if (/\bLIKE\b/i.test(ln)) {
            console.log(`    是RECORD LIKE类型`);
            recordSegments.push({ name: recName, body: '' });
            k++;
            continue;
          }
          
          // block form: collect until END RECORD
          let bodyLines = [];
          k++;
          while (k < cleanedLines.length && !/^\s*END\s+RECORD\b/i.test(cleanedLines[k])) {
            console.log(`    添加RECORD字段行: ${JSON.stringify(cleanedLines[k])}`);
            bodyLines.push(cleanedLines[k]);
            k++;
          }
          if (k < cleanedLines.length && /^\s*END\s+RECORD\b/i.test(cleanedLines[k])) {
            console.log(`    找到END RECORD`);
            k++;
          }
          recordSegments.push({ name: recName, body: bodyLines.join('\n') });
          continue;
        }
        k++;
      }

      // emit record symbols first
      console.log(`  生成${recordSegments.length}个RECORD符号:`);
      for (const rec of recordSegments) {
        console.log(`    RECORD: ${rec.name}`);
        const r = new Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd] ? lines[blockEnd].length : 0));
        const recSym = new DocumentSymbol(rec.name, '', SymbolKind.Struct, r, r);
        
        // 解析字段
        const bodyLines = rec.body.split('\n');
        let fieldCount = 0;
        for (const bodyLine of bodyLines) {
          const cleanLine = bodyLine.replace(/#.*$/, '').replace(/--.*$/, '').trim();
          if (!cleanLine) continue;
          
          const fldMatch = cleanLine.match(/^\s*([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i);
          if (fldMatch) {
            console.log(`      字段: ${fldMatch[1]} : ${fldMatch[2]}`);
            recSym.children.push(new DocumentSymbol(fldMatch[1], fldMatch[2], SymbolKind.Field, r, r));
            fieldCount++;
          }
        }
        console.log(`      共${fieldCount}个字段`);
        
        if (currentFunction) currentFunction.children.push(recSym);
        else if (inMain) mainGroup.children.push(recSym);
        else moduleVarsGroup.children.push(recSym);
      }

      continue;
    }

    // end markers
    if (reEndFunction.test(line)) { currentFunction = null; continue; }
    if (reEndReport.test(line))   { currentFunction = null; continue; }
    if (reEndMain.test(line))     { inMain = false; continue; }
  }

  // order: MAIN, FUNCTION, REPORT, MODULE_VARIABLE
  if (mainGroup.children.length) symbols.push(mainGroup);
  if (functionsGroup.children.length) symbols.push(functionsGroup);
  if (reportsGroup.children.length) symbols.push(reportsGroup);
  if (moduleVarsGroup.children.length) symbols.push(moduleVarsGroup);

  return symbols;
}

// 读取测试文件并解析
const content = fs.readFileSync('./codes/debug_record.4gl', 'utf8');
console.log('=== 开始调试解析 ===');
const symbols = parseDocumentSymbols(content);

console.log('\n=== 解析结果 ===');
symbols.forEach(group => {
  console.log(`\n${group.name} (${group.children.length} 项):`);
  group.children.forEach(child => {
    console.log(`  - ${child.name} [${child.kind}]`);
    if (child.children && child.children.length > 0) {
      child.children.forEach(grandchild => {
        console.log(`    - ${grandchild.name} : ${grandchild.detail}`);
      });
    }
  });
});