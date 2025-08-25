import * as vscode from 'vscode';

// Robust parser + symbol & definition providers for Genero 4GL

function parseDocumentSymbols(text: string): vscode.DocumentSymbol[] {
  const lines = text.split(/\r?\n/);
  const symbols: vscode.DocumentSymbol[] = [];

  // Outline groups: MAIN / FUNCTION / REPORT / MODULE_VARIABLE
  const mainGroup = new vscode.DocumentSymbol('MAIN', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const functionsGroup = new vscode.DocumentSymbol('FUNCTION', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const reportsGroup = new vscode.DocumentSymbol('REPORT', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const moduleVarsGroup = new vscode.DocumentSymbol('MODULE_VARIABLE', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));

  const reFunction = /^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\b/i;
  const reReport = /^\s*REPORT\s+([A-Za-z0-9_]+)\b/i;
  const reMainStart = /^\s*MAIN\b/i;
  const reRecordStart = /([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i;
  const reRecordField = /^\s*([A-Za-z0-9_]+)\s+LIKE\s+([A-Za-z0-9_\.]+)/i;
  const reDefineStart = /^\s*DEFINE\b/i;
  const reTypeStart = /^\s*TYPE\s+([A-Za-z0-9_]+)\s+(.+)/i;
  const reEndRecord = /^\s*END\s+RECORD\b/i;
  const reEndFunction = /^\s*END\s+FUNCTION\b/i;
  const reEndReport = /^\s*END\s+REPORT\b/i;
  const reEndMain = /^\s*END\s+MAIN\b/i;
  // common statement starters that are NOT part of DEFINE continuation
  const reNonDefineStmt = /^\s*(LET|MESSAGE|DISPLAY|PRINT|CALL|IF|ELSE|CASE|WHEN|FOR|FOREACH|WHILE|RETURN|OPEN|CLOSE|PREPARE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|INITIALIZE|CONSTRUCT|INPUT|MENU|PROMPT|SLEEP|ERROR|WARN|INFO|OPTIONS|GLOBALS)\b/i;
  // a conservative check for lines that look like a DEFINE continuation (names and optional type)
  const reTypeWord = /(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL|FLOAT|SMALLINT|BIGINT|VARCHAR|NUMERIC|BOOLEAN)\b/i;
  const reDefineContinuation = /^\s*(?:DEFINE\s+)?[A-Za-z0-9_,\s]+(?:\b(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL|FLOAT|SMALLINT|BIGINT|VARCHAR|NUMERIC|BOOLEAN)\b.*)?\s*,?\s*(?:#.*)?$/i;
  let currentFunction: vscode.DocumentSymbol | null = null;
  let inMain = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // skip full-line comments
    if (/^\s*#/.test(line)) continue;

    // TYPE definition - handle both simple types and TYPE ... RECORD structures
    const typeDef = line.match(reTypeStart);
    if (typeDef) {
      const typeName = typeDef[1];
      const typeDefinition = typeDef[2].trim();
      
      console.log(`[DEBUG] Found TYPE definition: ${typeName} = '${typeDefinition}'`);
      
      // Check if this is a TYPE ... RECORD structure
      if (/^RECORD\b/i.test(typeDefinition)) {
        console.log(`[DEBUG] Processing TYPE RECORD: ${typeName}, starting from line ${i}`);
        
        // This is a TYPE name RECORD structure - collect until END RECORD
        const blockStart = i;
        const bodyLines: string[] = [];
        let k = i + 1;
        
        while (k < lines.length && !reEndRecord.test(lines[k])) {
          console.log(`[DEBUG] Line ${k}: '${lines[k]}'`);
          // Remove comments (both # and --) from the line but preserve structure
          const cleanLine = lines[k].replace(/#.*$/, '').replace(/--.*$/, '').trim();
          console.log(`[DEBUG] Cleaned line ${k}: '${cleanLine}'`);
          if (cleanLine && !cleanLine.match(/^\s*$/)) {
            bodyLines.push(cleanLine);
          }
          k++;
        }
        
        console.log(`[DEBUG] Found END RECORD at line ${k}: '${k < lines.length ? lines[k] : 'EOF'}'`);
        console.log(`[DEBUG] Collected ${bodyLines.length} body lines:`, bodyLines);
        
        const blockEnd = k < lines.length ? k : i;
        const r = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd] ? lines[blockEnd].length : lines[i].length));
        const recSym = new vscode.DocumentSymbol(typeName, 'TYPE RECORD', vscode.SymbolKind.Struct, r, r);
        
        // Parse fields in the RECORD body - more comprehensive pattern matching
        for (const bodyLine of bodyLines) {
          console.log(`[DEBUG] Processing body line: '${bodyLine}'`);
          
          // Enhanced field matching patterns
          const patterns = [
            // Pattern 1: fieldname LIKE table.field (with optional comma)
            /^\s*([A-Za-z0-9_]+)\s+LIKE\s+([A-Za-z0-9_\.]+)\s*,?\s*$/i,
            // Pattern 2: fieldname TYPE (with optional comma)
            /^\s*([A-Za-z0-9_]+)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i,
            // Pattern 3: fieldname CHAR(n), VARCHAR(n), DECIMAL(p,s) etc (with optional comma)
            /^\s*([A-Za-z0-9_]+)\s+(CHAR|VARCHAR|DECIMAL)\s*\([^)]+\)\s*,?\s*$/i,
            // Pattern 4: fieldname ARRAY [n] OF TYPE
            /^\s*([A-Za-z0-9_]+)\s+ARRAY\s*\[\s*\d*\s*\]\s*OF\s+(\w+)\s*,?\s*$/i
          ];
          
          let fieldFound = false;
          for (let p = 0; p < patterns.length; p++) {
            const fldMatch = bodyLine.match(patterns[p]);
            if (fldMatch) {
              const fieldName = fldMatch[1];
              const fieldType = fldMatch[2];
              console.log(`[DEBUG] Pattern ${p+1} matched - Found field: ${fieldName} : ${fieldType}`);
              recSym.children.push(new vscode.DocumentSymbol(fieldName, fieldType, vscode.SymbolKind.Field, r, r));
              fieldFound = true;
              break;
            }
          }
          
          if (!fieldFound) {
            console.log(`[DEBUG] No pattern matched for line: '${bodyLine}'`);
          }
        }
        
        console.log(`[DEBUG] Final TYPE RECORD: ${typeName} with ${recSym.children.length} fields`);
        
        if (currentFunction) currentFunction.children.push(recSym);
        else if (inMain) mainGroup.children.push(recSym);
        else moduleVarsGroup.children.push(recSym);
        
        // Skip to the END RECORD line
        i = blockEnd;
        continue;
      } else {
        // Simple TYPE definition (like TYPE t_cc ARRAY [] OF STRING)
        const vr = new vscode.Range(i, 0, i, Math.max(1, line.length));
        const vsym = new vscode.DocumentSymbol(typeName, typeDefinition, vscode.SymbolKind.TypeParameter, vr, vr);
        console.log(`[DEBUG] Found TYPE definition: ${typeName} = ${typeDefinition}`);
        if (currentFunction) currentFunction.children.push(vsym);
        else if (inMain) mainGroup.children.push(vsym);
        else moduleVarsGroup.children.push(vsym);
        continue;
      }
    }

    // function
    const mFunc = line.match(reFunction);
    if (mFunc) {
      const name = mFunc[1];
      const r = new vscode.Range(i, 0, i, Math.max(1, line.length));
  const sym = new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Function, r, r);
      functionsGroup.children.push(sym);
      currentFunction = sym;
      continue;
    }

    // report
    const mRep = line.match(reReport);
    if (mRep) {
      const name = mRep[1];
      const r = new vscode.Range(i, 0, i, Math.max(1, line.length));
  const sym = new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Method, r, r);
      reportsGroup.children.push(sym);
      currentFunction = sym;
      continue;
    }

    // MAIN block start
    if (reMainStart.test(line)) {
      inMain = true;
      // no separate MAIN node; variables will be nested directly under MAIN group
      continue;
    }

    // end markers: only reset on END FUNCTION / END REPORT / END MAIN (avoid generic END)
    if (reEndFunction.test(line)) { currentFunction = null; continue; }
    if (reEndReport.test(line))   { currentFunction = null; continue; }
    if (reEndMain.test(line))     { inMain = false; continue; }

    // DEFINE block handling (tightened): treat RECORD blocks atomically and collect only proper DEFINE continuation lines
    if (reDefineStart.test(line)) {
      // collect contiguous lines that belong to this DEFINE (lines until next top-level token)
      const blockLines: string[] = [line];
      let j = i;
      while (j + 1 < lines.length) {
        const nxt = lines[j + 1];
        // stop if next line starts a new top-level construct or another DEFINE
        if (/^\s*(?:FUNCTION|REPORT|MAIN|IMPORT|DATABASE|GLOBALS|DEFINE|TYPE)\b/i.test(nxt)) break;
        // stop if next line obviously starts a normal statement rather than a DEFINE continuation
        if (reNonDefineStmt.test(nxt)) break;
        // allow record block lines or conservative DEFINE-like continuations; otherwise stop
        const isRecordLine = /\bRECORD\b/i.test(nxt) || /^\s*END\s+RECORD\b/i.test(nxt);
        if (!isRecordLine && !reDefineContinuation.test(nxt.trim())) break;
        // include continuation line
        j++;
        blockLines.push(nxt);
      }
      const blockStart = i;
      const blockEnd = j;
      i = j;

      // remove inline comments but keep commas and newlines for parsing; skip pure comment lines
      const cleanedLines = blockLines
        .map(l => l.replace(/#.*/g, ''))
        .filter(l => l.trim().length > 0);

      // parse block lines into segments: either record blocks or normal fragments
      const normalParts: string[] = [];
      const recordSegments: { name: string; body: string }[] = [];
      let k = 0;
      while (k < cleanedLines.length) {
        const ln = cleanedLines[k].trim();
        if (!ln) { k++; continue; }
        // support: 'DEFINE <name> RECORD', '<name> RECORD', or 'DEFINE <name> DYNAMIC ARRAY OF RECORD'
        const recStart = ln.match(/^(?:DEFINE\s+)?([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i);
        if (recStart) {
          const recName = recStart[1];
          // single-line: '... RECORD LIKE <table>.*' (no END RECORD block)
          if (/\bLIKE\b/i.test(ln)) {
            recordSegments.push({ name: recName, body: '' });
            k++;
            continue;
          }
          // block form: collect until END RECORD (allow trailing spaces/commas)
          let bodyLines: string[] = [];
          k++;
          while (k < cleanedLines.length && !/^\s*END\s+RECORD\b/i.test(cleanedLines[k])) {
            bodyLines.push(cleanedLines[k]);
            k++;
          }
          if (k < cleanedLines.length && /^\s*END\s+RECORD\b/i.test(cleanedLines[k])) {
            k++;
          }
          recordSegments.push({ name: recName, body: bodyLines.join('\n') });
          continue;
        }
        // not a record start: split this line by commas and append parts
        // also strip any leading 'DEFINE ' token to avoid names like 'DEFINE l_var'
        // Remove both # and -- comments before processing
        const cleanedLn = ln.replace(/#.*$/, '').replace(/--.*$/, '').trim();
        const segs = cleanedLn
          .split(',')
          .map(s => s.replace(/^\s*DEFINE\s+/i, '').trim())
          .filter(Boolean);
        normalParts.push(...segs);
        k++;
      }

      // emit record symbols first
      for (const rec of recordSegments) {
        const r = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd].length));
  const recSym = new vscode.DocumentSymbol(rec.name, '', vscode.SymbolKind.Struct, r, r);
        
        // Improved field parsing - support both LIKE and direct types, and handle comments
        const bodyLines = rec.body.split('\n');
        for (const bodyLine of bodyLines) {
          // Remove comments (both # and --)
          const cleanLine = bodyLine.replace(/#.*$/, '').replace(/--.*$/, '').trim();
          if (!cleanLine) continue;
          
          // Match field definitions: fieldname TYPE or fieldname LIKE table.field (with optional comma)
          const fldMatch = cleanLine.match(/^\s*([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i);
          if (fldMatch) {
            recSym.children.push(new vscode.DocumentSymbol(fldMatch[1], fldMatch[2], vscode.SymbolKind.Field, r, r));
          }
        }
        
  if (currentFunction) currentFunction.children.push(recSym);
  else if (inMain) mainGroup.children.push(recSym);
  else moduleVarsGroup.children.push(recSym);
      }

      // process normalParts: merge into a single string and apply name/type extraction
      const afterDefine = normalParts.join(', ');
      if (afterDefine) {
        const parts = afterDefine.split(',').map(p => p.trim()).filter(Boolean);
        let pending: string[] = [];
        let sawType = false;
        for (const part of parts) {
          // skip pure keywords that shouldn't be treated as names
          if (/^(DEFINE|END|RECORD)$/i.test(part)) continue;
          const mt = part.match(reTypeWord);
          if (mt) {
            const idx = part.search(new RegExp(`\\b${mt[1]}\\b`, 'i'));
            const namesStr = idx >= 0 ? part.substring(0, idx) : part;
            const names = namesStr
              .split(',')
              .map(s => s.replace(/^\s*DEFINE\s+/i, '').trim())
              .filter(Boolean)
              .filter(n => !/^(DEFINE|END|RECORD)$/i.test(n));
            const all = pending.concat(names);
            for (const nm of all) {
              if (!nm) continue;
              const vr = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd].length));
              const vsym = new vscode.DocumentSymbol(nm, '', vscode.SymbolKind.Variable, vr, vr);
              if (currentFunction) currentFunction.children.push(vsym);
              else if (inMain) mainGroup.children.push(vsym);
              else moduleVarsGroup.children.push(vsym);
            }
            pending = [];
            sawType = true;
          } else {
            const names = part
              .split(',')
              .map(s => s.replace(/^\s*DEFINE\s+/i, '').trim())
              .filter(Boolean)
              .filter(n => !/^(DEFINE|END|RECORD)$/i.test(n));
            pending.push(...names);
          }
        }
        // don't emit dangling names without a detected type to avoid false positives
      }

      continue;
    }

    // inline RECORD without DEFINE
    const inlineRec = line.match(reRecordStart);
    if (inlineRec) {
      const recName = inlineRec[1];
      let k = i + 1;
      const rfields: string[] = [];
      
      while (k < lines.length && !reEndRecord.test(lines[k])) {
        // Remove comments (both # and --) from the line
        const cleanLine = lines[k].replace(/#.*$/, '').replace(/--.*$/, '').trim();
        if (cleanLine) {
          // Match field definitions: fieldname TYPE or fieldname LIKE table.field (with optional comma)
          const fm = cleanLine.match(/^\s*([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i);
          if (fm) rfields.push(fm[1]);
        }
        k++;
      }
      
      const r = new vscode.Range(i, 0, k < lines.length ? k : i, Math.max(1, lines[k] ? lines[k].length : lines[i].length));
  const recSym = new vscode.DocumentSymbol(recName, '', vscode.SymbolKind.Struct, r, r);
      for (const fn of rfields) recSym.children.push(new vscode.DocumentSymbol(fn, '', vscode.SymbolKind.Field, r, r));
  if (currentFunction) currentFunction.children.push(recSym);
  else if (inMain) mainGroup.children.push(recSym);
  else moduleVarsGroup.children.push(recSym);
      if (k < lines.length) i = k;
      continue;
    }

    // single-line DEFINE like 'DEFINE l_msg STRING'
    const singleDef = line.match(/^\s*DEFINE\s+(.+?)\s+(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL)\b/i);
    if (singleDef) {
      const left = singleDef[1].trim();
      // Remove both # and -- comments before processing
      const names = left.split(',').map(s => s.replace(/#.*$/,'').replace(/--.*$/,'').trim()).filter(Boolean);
      for (const nm of names) {
        const vr = new vscode.Range(i, 0, i, Math.max(1, line.length));
        const vsym = new vscode.DocumentSymbol(nm, '', vscode.SymbolKind.Variable, vr, vr);
  if (currentFunction) currentFunction.children.push(vsym);
  else if (inMain) mainGroup.children.push(vsym);
  else moduleVarsGroup.children.push(vsym);
      }
      continue;
    }
  }

  // order: MAIN, FUNCTION, REPORT, MODULE_VARIABLE
  if (mainGroup.children.length) symbols.push(mainGroup);
  if (functionsGroup.children.length) symbols.push(functionsGroup);
  if (reportsGroup.children.length) symbols.push(reportsGroup);
  if (moduleVarsGroup.children.length) symbols.push(moduleVarsGroup);

  return symbols;
}

// Definition provider
class FourGLDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | vscode.Location[] | null> {
    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_.]+/);
    if (!wordRange) return null;
    const word = document.getText(wordRange);
    const shortName = word.includes('.') ? word.split('.').pop() || word : word;

    // Get the line containing the word to determine if it's a report or function call
    const line = document.lineAt(position.line).text;
    const isReportCall = /\b(START\s+REPORT|OUTPUT\s+TO\s+REPORT|FINISH\s+REPORT)\b/i.test(line);
    
    // Debug information
    const debugInfo = `Word: '${word}', Line: '${line.trim()}', IsReportCall: ${isReportCall}`;
    console.log(`[DEBUG] ${debugInfo}`);
    
    // search in current document
    const lines = document.getText().split(/\r?\n/);
    
    if (isReportCall) {
      // Search for REPORT definition
      const reRepLine = new RegExp(`^\\s*REPORT\\s+${shortName}\\b`, 'i');
      console.log(`[DEBUG] Searching for REPORT pattern: ${reRepLine.source}`);
      for (let i = 0; i < lines.length; i++) {
        if (reRepLine.test(lines[i])) {
          console.log(`[DEBUG] Found REPORT at line ${i + 1}: '${lines[i].trim()}'`);
          vscode.window.showInformationMessage(`Found REPORT '${shortName}' at line ${i + 1}`);
          return new vscode.Location(document.uri, new vscode.Range(i, 0, i, Math.max(1, lines[i].length)));
        }
      }
      console.log(`[DEBUG] REPORT '${shortName}' not found in current document`);
      vscode.window.showWarningMessage(`REPORT '${shortName}' not found in current document`);
    } else {
      // Search for FUNCTION definition
      const reFuncLine = new RegExp(`^\\s*(?:PUBLIC|PRIVATE|STATIC)?\\s*FUNCTION\\s+${shortName}\\b`, 'i');
      console.log(`[DEBUG] Searching for FUNCTION pattern: ${reFuncLine.source}`);
      for (let i = 0; i < lines.length; i++) {
        if (reFuncLine.test(lines[i])) {
          console.log(`[DEBUG] Found FUNCTION at line ${i + 1}: '${lines[i].trim()}'`);
          vscode.window.showInformationMessage(`Found FUNCTION '${shortName}' at line ${i + 1}`);
          return new vscode.Location(document.uri, new vscode.Range(i, 0, i, Math.max(1, lines[i].length)));
        }
      }
      console.log(`[DEBUG] FUNCTION '${shortName}' not found in current document`);
    }

    // search other workspace files
    const files = await vscode.workspace.findFiles('**/*.{4gl,4GL}', '**/node_modules/**', 500);
    console.log(`[DEBUG] Searching in ${files.length} workspace files`);
    for (const f of files) {
      if (f.toString() === document.uri.toString()) continue;
      try {
        const doc = await vscode.workspace.openTextDocument(f);
        const docLines = doc.getText().split(/\r?\n/);
        
        if (isReportCall) {
          // Search for REPORT definition in other files
          const reRepLine = new RegExp(`^\\s*REPORT\\s+${shortName}\\b`, 'i');
          for (let i = 0; i < docLines.length; i++) {
            if (reRepLine.test(docLines[i])) {
              console.log(`[DEBUG] Found REPORT in ${f.fsPath} at line ${i + 1}`);
              vscode.window.showInformationMessage(`Found REPORT '${shortName}' in ${f.fsPath} at line ${i + 1}`);
              return new vscode.Location(f, new vscode.Range(i, 0, i, Math.max(1, docLines[i].length)));
            }
          }
        } else {
          // Search for FUNCTION definition in other files
          const reFuncLine = new RegExp(`^\\s*(?:PUBLIC|PRIVATE|STATIC)?\\s*FUNCTION\\s+${shortName}\\b`, 'i');
          for (let i = 0; i < docLines.length; i++) {
            if (reFuncLine.test(docLines[i])) {
              console.log(`[DEBUG] Found FUNCTION in ${f.fsPath} at line ${i + 1}`);
              vscode.window.showInformationMessage(`Found FUNCTION '${shortName}' in ${f.fsPath} at line ${i + 1}`);
              return new vscode.Location(f, new vscode.Range(i, 0, i, Math.max(1, docLines[i].length)));
            }
          }
        }
      } catch {
        // ignore
      }
    }

    console.log(`[DEBUG] No definition found for '${shortName}' (isReportCall: ${isReportCall})`);
    vscode.window.showWarningMessage(`No definition found for '${shortName}'${isReportCall ? ' (REPORT)' : ' (FUNCTION)'}`);
    return null;
  }
}

let diagnosticTimeout: NodeJS.Timeout;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Genero FGL] Extension activating...');
  
  // 注册文档符号提供器
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: '4gl' }, { provideDocumentSymbols(document) { return parseDocumentSymbols(document.getText()); } }));
  
  // 注册定义提供器
  context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: '4gl' }, new FourGLDefinitionProvider()));
  
  // 注册未使用变量诊断提供器
  const unusedVariableDiagnosticProvider = new UnusedVariableDiagnosticProvider();
  context.subscriptions.push(unusedVariableDiagnosticProvider);
  console.log('[Genero FGL] Diagnostic provider registered');
  
  // 文档变更监听
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    console.log(`[Genero FGL] Document change: ${event.document.uri.fsPath}, language: ${event.document.languageId}`);
    if (event.document.languageId === '4gl' && isDiagnosticEnabled()) {
      console.log('[Genero FGL] Running diagnostics for change...');
      // 防抖处理
      clearTimeout(diagnosticTimeout);
      diagnosticTimeout = setTimeout(() => {
        unusedVariableDiagnosticProvider.updateDiagnostics(event.document);
      }, getDiagnosticDelay());
    }
  });
  
  context.subscriptions.push(documentChangeListener);
  
  // 文档打开监听
  const documentOpenListener = vscode.workspace.onDidOpenTextDocument(document => {
    console.log(`[Genero FGL] Document opened: ${document.uri.fsPath}, language: ${document.languageId}`);
    if (document.languageId === '4gl' && isDiagnosticEnabled()) {
      console.log('[Genero FGL] Running diagnostics for opened document...');
      unusedVariableDiagnosticProvider.updateDiagnostics(document);
    }
  });
  
  context.subscriptions.push(documentOpenListener);
  
  // 配置变更监听
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('GeneroFGL.4gl.diagnostic')) {
      console.log('[Genero FGL] Configuration changed');
      vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === '4gl') {
          if (isDiagnosticEnabled()) {
            unusedVariableDiagnosticProvider.updateDiagnostics(document);
          } else {
            unusedVariableDiagnosticProvider.clearDiagnostics(document.uri);
          }
        }
      });
    }
  });
  
  context.subscriptions.push(configChangeListener);
  
  // 初始化时处理已打开的文档
  console.log(`[Genero FGL] Processing ${vscode.workspace.textDocuments.length} open documents`);
  vscode.workspace.textDocuments.forEach(document => {
    console.log(`[Genero FGL] Document: ${document.uri.fsPath}, language: ${document.languageId}`);
    if (document.languageId === '4gl' && isDiagnosticEnabled()) {
      console.log('[Genero FGL] Running initial diagnostics...');
      unusedVariableDiagnosticProvider.updateDiagnostics(document);
    }
  });
  
  // 添加手动触发诊断的命令
  const manualDiagnosticCommand = vscode.commands.registerCommand('genero-fgl.runDiagnostics', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === '4gl') {
      console.log(`[Genero FGL] Manual diagnostic triggered for ${activeEditor.document.uri.fsPath}`);
      unusedVariableDiagnosticProvider.updateDiagnostics(activeEditor.document);
      vscode.window.showInformationMessage('已运行未使用变量诊断');
    } else {
      console.log('[Genero FGL] No 4gl document active');
      vscode.window.showWarningMessage('请打开一个 .4gl 文件');
    }
  });
  
  context.subscriptions.push(manualDiagnosticCommand);
  
  console.log('[Genero FGL] Extension activation completed');
}

// ================ 未使用变量检测功能 ================

// 变量定义接口
interface VariableDefinition {
  name: string;           // 变量名
  type: string;          // 变量类型
  line: number;          // 定义行号
  range: vscode.Range;   // 定义范围
  scope: 'main' | 'function'; // 作用域
  category?: 'parameter' | 'local'; // 新增分类字段
}

// 函数块接口
interface FunctionBlock {
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

// 函数签名接口
interface FunctionSignature {
  name: string;           // 函数名
  parameters: string[];   // 参数列表
  startLine: number;      // 函数开始行
  endLine: number;        // 函数结束行
}

// 增强的函数签名接口
interface EnhancedFunctionSignature {
  name: string;              // 函数名
  bracketParameters: string[];    // 括号内参数 (p_row, p_col)
  defineParameters: string[];     // DEFINE语句参数
  allParameters: string[];        // 所有参数的合并列表
  startLine: number;         // 函数开始行
  endLine: number;           // 函数结束行
}

// 提取 MAIN 块内容
function extractMainBlock(text: string): { content: string; startLine: number; endLine: number } | null {
  const lines = text.split(/\r?\n/);
  let mainStart = -1;
  let mainEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检测 MAIN 开始
    if (/^\s*MAIN\s*$/i.test(line)) {
      mainStart = i;
    }
    
    // 检测 END MAIN
    if (/^\s*END\s+MAIN\s*$/i.test(line) && mainStart !== -1) {
      mainEnd = i;
      break;
    }
  }
  
  if (mainStart === -1 || mainEnd === -1) {
    return null;
  }
  
  return {
    content: lines.slice(mainStart, mainEnd + 1).join('\n'),
    startLine: mainStart,
    endLine: mainEnd
  };
}

// 提取 FUNCTION 块内容
function extractFunctionBlocks(text: string): FunctionBlock[] {
  const lines = text.split(/\r?\n/);
  const functionBlocks: FunctionBlock[] = [];
  let currentFunction: FunctionBlock | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检测 FUNCTION 开始
    const functionMatch = line.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\b/i);
    if (functionMatch) {
      currentFunction = {
        name: functionMatch[1],
        content: '',
        startLine: i,
        endLine: -1
      };
    }
    
    // 检测 END FUNCTION
    if (/^\s*END\s+FUNCTION\s*$/i.test(line) && currentFunction) {
      currentFunction.endLine = i;
      currentFunction.content = lines.slice(currentFunction.startLine, i + 1).join('\n');
      functionBlocks.push(currentFunction);
      currentFunction = null;
    }
  }
  
  return functionBlocks;
}

// 解析函数签名，提取参数列表
function parseFunctionSignature(functionContent: string): FunctionSignature | null {
  const lines = functionContent.split(/\r?\n/);
  const firstLine = lines[0];
  
  // 匹配函数声明模式： FUNCTION name() 或 FUNCTION name(param1, param2, ...)
  const functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*$/i);
  
  if (!functionMatch) {
    return null;
  }
  
  const functionName = functionMatch[1];
  const parameterString = functionMatch[2].trim();
  
  // 解析参数列表
  const parameters = parameterString 
    ? parameterString.split(',').map(p => p.trim()).filter(p => p.length > 0)
    : [];
  
  return {
    name: functionName,
    parameters: parameters,
    startLine: 0,
    endLine: lines.length - 1
  };
}

// 从函数体内的 DEFINE 语句中提取与括号参数匹配的参数变量
function extractDefineParameters(functionContent: string, bracketParameters: string[]): string[] {
  const lines = functionContent.split(/\r?\n/);
  const defineParameters: string[] = [];
  
  for (let i = 1; i < lines.length; i++) { // 跳过函数声明行
    const line = lines[i].trim();
    
    // 跳过注释和空行
    if (!line || line.startsWith('#') || line.startsWith('--')) continue;
    
    // 修复：增强DEFINE语句匹配，支持 RECORD LIKE 类型
    // 先检查是否是 RECORD LIKE 的定义
    const recordLikeMatch = line.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+\s*\*?\s*$/i);
    if (recordLikeMatch) {
      const variableName = recordLikeMatch[1];
      
      // 检查这个变量是否在括号参数中
      if (bracketParameters.includes(variableName)) {
        defineParameters.push(variableName);
      }
      continue;
    }
    
    // 普通的 DEFINE 语句匹配
    const defineMatch = line.match(/^\s*DEFINE\s+([^#\n]+?)\s+(?:LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|CHAR|DECIMAL|SMALLINT|BIGINT|DATE|DATETIME|VARCHAR|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
    
    if (defineMatch) {
      const variableList = defineMatch[1].trim();
      
      const variables = variableList.split(',').map(v => v.trim()).filter(v => v.length > 0);
      
      // 检查这些变量是否在括号参数中
      variables.forEach(variable => {
        if (bracketParameters.includes(variable)) {
          defineParameters.push(variable);
        }
      });
    }
  }
  
  return defineParameters;
}

// 增强的函数签名解析器
function parseEnhancedFunctionSignature(functionContent: string): EnhancedFunctionSignature | null {
  const lines = functionContent.split(/\r?\n/);
  
  // 解析函数声明行 - 修复：支持函数声明后跟括号的格式
  const firstLine = lines[0];
  let functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*$/i);
  
  // 如果第一行没有括号，检查是否是 FUNCTION name(params) 的格式，但括号可能在同一行
  if (!functionMatch) {
    functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/i);
  }
  
  if (!functionMatch) {
    return null;
  }
  
  const functionName = functionMatch[1];
  const bracketParameterString = functionMatch[2].trim();
  
  // 解析括号内参数
  const bracketParameters = bracketParameterString 
    ? bracketParameterString.split(',').map(p => p.trim()).filter(p => p.length > 0)
    : [];
  
  // 解析函数体内的 DEFINE 参数
  const defineParameters = extractDefineParameters(functionContent, bracketParameters);
  
  // 合并所有参数
  const allParameters = [...new Set([...bracketParameters, ...defineParameters])];
  
  return {
    name: functionName,
    bracketParameters,
    defineParameters,
    allParameters,
    startLine: 0,
    endLine: lines.length - 1
  };
}

// 解析 RECORD 结构定义
function parseRecordDefinition(lines: string[], startIndex: number, actualLineNumber: number, scope: 'main' | 'function'): VariableDefinition | null {
  const recordMatch = lines[startIndex].match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s*$/i);
  if (!recordMatch) {
    return null;
  }
  
  const variableName = recordMatch[1];
  let endIndex = startIndex + 1;
  
  // 找到 END RECORD
  while (endIndex < lines.length && !/^\s*END\s+RECORD\s*$/i.test(lines[endIndex])) {
    endIndex++;
  }
  
  return {
    name: variableName,
    type: 'RECORD',
    line: actualLineNumber,
    range: new vscode.Range(actualLineNumber, 0, actualLineNumber + (endIndex - startIndex), lines[endIndex] ? lines[endIndex].length : 0),
    scope: scope
  };
}

// 解析 DEFINE 语句中的变量定义
function parseDefineStatements(blockContent: string, startLineOffset: number, scope: 'main' | 'function'): VariableDefinition[] {
  const variables: VariableDefinition[] = [];
  const lines = blockContent.split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const actualLineNumber = startLineOffset + i;
    
    // 跳过 FUNCTION 声明行和 END FUNCTION 行
    if (/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+/i.test(line) || /^\s*END\s+FUNCTION\s*$/i.test(line)) {
      continue;
    }
    
    // 跳过 MAIN 声明行和 END MAIN 行
    if (/^\s*MAIN\s*$/i.test(line) || /^\s*END\s+MAIN\s*$/i.test(line)) {
      continue;
    }
    
    // 跳过注释行
    if (/^\s*#/.test(line) || /^\s*--/.test(line)) {
      continue;
    }
    
    // 单行 DEFINE 解析 - 修复：正确处理 RECORD LIKE 类型
    // 先检查是否是 RECORD LIKE 的单行定义（支持行尾注释）
    const recordLikeMatch = line.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+\s*\*?\s*(?:#.*)?$/i);
    if (recordLikeMatch) {
      const variableName = recordLikeMatch[1];
      console.log(`[DEBUG] 解析到 RECORD LIKE 语句: ${variableName}`);
      
      variables.push({
        name: variableName,
        type: 'RECORD LIKE',
        line: actualLineNumber,
        range: new vscode.Range(actualLineNumber, 0, actualLineNumber, line.length),
        scope: scope
      });
      continue;
    }
    
    // 普通的单行 DEFINE 解析（增强支持 DYNAMIC ARRAY OF 类型）
    const singleDefineMatch = line.match(/^\s*DEFINE\s+(.+?)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT|DYNAMIC\s+ARRAY\s+OF\s+\w+|LIKE\s+[A-Za-z0-9_]+\.[A-Za-z0-9_]+|LIKE\s+[A-Za-z0-9_\.]+)\s*.*$/i);
    if (singleDefineMatch) {
      const variableNames = singleDefineMatch[1].split(',').map(name => name.trim());
      const variableType = singleDefineMatch[2];
      
      console.log(`[DEBUG] 解析到 DEFINE 语句: ${variableNames} : ${variableType}`);
      
      variableNames.forEach(name => {
        if (name && !/^(DEFINE|END|RECORD)$/i.test(name)) {
          console.log(`[DEBUG] 添加变量: ${name} (作用域: ${scope})`);
          variables.push({
            name: name,
            type: variableType,
            line: actualLineNumber,
            range: new vscode.Range(actualLineNumber, 0, actualLineNumber, line.length),
            scope: scope
          });
        }
      });
      continue;
    }
    
    // 多行 DEFINE 续行解析
    // 匹配形如 "         lnode_root      om.DomNode," 的续行
    // 排除 4GL 关键字以避免误识别
    const defineContMatch = line.match(/^\s+([A-Za-z0-9_]+)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT|DYNAMIC\s+ARRAY\s+OF\s+\w+|LIKE\s+[A-Za-z0-9_]+\.[A-Za-z0-9_]+|LIKE\s+[A-Za-z0-9_\.]+|[A-Za-z0-9_\.]+)\s*,?\s*$/i);
    if (defineContMatch) {
      const variableName = defineContMatch[1];
      const variableType = defineContMatch[2];
      
      // 排除 4GL 关键字
      const fglKeywords = /^(END|IF|THEN|ELSE|ELSEIF|FOR|WHILE|CASE|WHEN|RETURN|CALL|LET|DISPLAY|PRINT|MESSAGE|CONTINUE|EXIT|FUNCTION|MAIN|RECORD|TYPE|DEFINE|GLOBAL|GLOBALS|LIKE|TO|FROM|WHERE|SELECT|INSERT|UPDATE|DELETE|NULL|TRUE|FALSE)$/i;
      if (!fglKeywords.test(variableName)) {
        console.log(`[DEBUG] 解析到多行 DEFINE 续行: ${variableName} : ${variableType}`);
        
        variables.push({
          name: variableName,
          type: variableType,
          line: actualLineNumber,
          range: new vscode.Range(actualLineNumber, 0, actualLineNumber, line.length),
          scope: scope
        });
      }
      continue;
    }
    
    // 多行 DEFINE 解析 (RECORD 结构)
    if (/^\s*DEFINE\s+\w+\s+RECORD\s*$/i.test(line)) {
      const recordVar = parseRecordDefinition(lines, i, actualLineNumber, scope);
      if (recordVar) {
        variables.push(recordVar);
        // 跳过 RECORD 内容直到 END RECORD
        while (i < lines.length && !/^\s*END\s+RECORD\s*$/i.test(lines[i])) {
          i++;
        }
      }
    }
  }
  
  return variables;
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 检测变量是否在行中被使用
function isVariableUsedInLine(line: string, variableName: string): boolean {
  // 移除注释
  const cleanLine = line.replace(/#.*$/, '').replace(/--.*$/, '');
  
  // 创建变量名的正则表达式（确保完整匹配）
  const variableRegex = new RegExp(`\\b${escapeRegExp(variableName)}\\b`, 'i');
  
  // 检查各种使用模式
  const usagePatterns = [
    // 赋值语句: LET variable = ... 或 LET variable.field = ...
    new RegExp(`\\bLET\\s+${escapeRegExp(variableName)}(\\.\\w+)?\\s*[=\\[]`, 'i'),
    // 表达式中使用: ... = variable + ...
    new RegExp(`[=+\\-*/()\\s]${escapeRegExp(variableName)}[+\\-*/()\\s]`, 'i'),
    // 函数参数: CALL func(variable)
    new RegExp(`\\bCALL\\s+\\w+\\s*\\([^)]*${escapeRegExp(variableName)}[^)]*\\)`, 'i'),
    // 条件语句: IF variable THEN
    new RegExp(`\\bIF\\s+[^\\n]*${escapeRegExp(variableName)}`, 'i'),
    // 输出语句: DISPLAY variable
    new RegExp(`\\b(DISPLAY|PRINT|MESSAGE)\\s+[^\\n]*${escapeRegExp(variableName)}`, 'i'),
    // SQL INTO 子句: SELECT ... INTO variable.* 或 INTO variable
    new RegExp(`\\bINTO\\s+[^\\n]*${escapeRegExp(variableName)}(\\.\\*)?\\b`, 'i'),
    // INITIALIZE 语句: INITIALIZE variable.* TO NULL
    new RegExp(`\\bINITIALIZE\\s+${escapeRegExp(variableName)}(\\.\\*)?\\s+TO`, 'i'),
    // INSERT INTO VALUES 语句: INSERT INTO table VALUES (variable.*)
    new RegExp(`\\bINSERT\\s+INTO\\s+[^\\n]*VALUES\\s*\\([^)]*${escapeRegExp(variableName)}(\\.\\*)?[^)]*\\)`, 'i'),
    // UPDATE SET 语句: UPDATE table SET field = variable
    new RegExp(`\\bUPDATE\\s+[^\\n]*SET\\s+[^\\n]*${escapeRegExp(variableName)}`, 'i'),
    // 简单的变量引用
    new RegExp(`\\b${escapeRegExp(variableName)}\\b`, 'i')
  ];
  
  return usagePatterns.some(pattern => pattern.test(cleanLine));
}

// 分析变量使用情况
function analyzeVariableUsage(blockContent: string, variables: VariableDefinition[]): Map<string, boolean> {
  const usageMap = new Map<string, boolean>();
  const lines = blockContent.split(/\r?\n/);
  
  // 初始化所有变量为未使用
  variables.forEach(variable => {
    usageMap.set(variable.name, false);
  });
  
  // 分析每一行的变量使用
  lines.forEach((line, index) => {
    // 跳过注释行
    if (/^\s*#/.test(line) || /^\s*--/.test(line)) {
      return;
    }
    
    // 跳过 DEFINE 行
    if (/^\s*DEFINE\s+/.test(line)) {
      return;
    }
    
    // 跳过函数声明和结束行
    if (/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+/i.test(line) || 
        /^\s*END\s+FUNCTION\s*$/i.test(line) ||
        /^\s*MAIN\s*$/i.test(line) ||
        /^\s*END\s+MAIN\s*$/i.test(line)) {
      return;
    }
    
    variables.forEach(variable => {
      if (isVariableUsedInLine(line, variable.name)) {
        usageMap.set(variable.name, true);
      }
    });
  });
  
  return usageMap;
}

// 未使用变量诊断提供器
class UnusedVariableDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('genero-fgl-unused-variables');
  }
  
  public updateDiagnostics(document: vscode.TextDocument): void {
    console.log(`[Diagnostic] Called for ${document.uri.fsPath}`);
    
    // 检查配置是否启用
    const config = vscode.workspace.getConfiguration('GeneroFGL');
    const diagnosticEnabled = config.get('4gl.diagnostic.enable', true);
    console.log(`[Diagnostic] Enabled: ${diagnosticEnabled}`);
    
    if (!diagnosticEnabled) {
      this.diagnosticCollection.clear();
      return;
    }
    
    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    console.log(`[Diagnostic] Processing ${text.split('\n').length} lines`);
    
    // 处理 MAIN 块
    const mainBlock = extractMainBlock(text);
    if (mainBlock) {
      console.log(`[Diagnostic] Found MAIN block`);
      const mainVariables = parseDefineStatements(mainBlock.content, mainBlock.startLine, 'main');
      console.log(`[Diagnostic] MAIN variables: ${mainVariables.map(v => v.name)}`);
      const mainUsageMap = analyzeVariableUsage(mainBlock.content, mainVariables);
      
      mainVariables.forEach(variable => {
        const isUsed = mainUsageMap.get(variable.name);
        console.log(`[Diagnostic] MAIN ${variable.name}: ${isUsed ? 'used' : 'unused'}`);
        if (!isUsed) {
          const diagnostic = new vscode.Diagnostic(
            variable.range,
            `未使用的变量 '${variable.name}'，建议移除该变量声明`,
            vscode.DiagnosticSeverity.Warning
          );
          
          diagnostic.source = 'Genero FGL';
          diagnostic.code = 'unused-variable';
          diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
          
          diagnostics.push(diagnostic);
        }
      });
    } else {
      console.log(`[Diagnostic] No MAIN block found`);
    }
    
    // 处理 FUNCTION 块
    const functionBlocks = extractFunctionBlocks(text);
    console.log(`[Diagnostic] Found ${functionBlocks.length} functions`);
    
    functionBlocks.forEach(funcBlock => {
      console.log(`[Diagnostic] Processing function ${funcBlock.name}`);
      
      // 使用增强的函数签名解析器，获取所有参数列表
      const enhancedSignature = parseEnhancedFunctionSignature(funcBlock.content);
      const allParameters = enhancedSignature ? enhancedSignature.allParameters : [];
      console.log(`[Diagnostic] Function ${funcBlock.name} parameters: ${allParameters}`);
      
      // 解析函数中的所有变量定义
      const allFuncVariables = parseDefineStatements(funcBlock.content, funcBlock.startLine, 'function');
      console.log(`[Diagnostic] Function ${funcBlock.name} all variables: ${allFuncVariables.map(v => v.name)}`);
      
      // 过滤掉所有参数变量（括号内参数和 DEFINE 语句参数），只检查局部变量
      const localVariables = allFuncVariables.filter(variable => 
        !allParameters.includes(variable.name)
      );
      console.log(`[Diagnostic] Function ${funcBlock.name} local variables: ${localVariables.map(v => v.name)}`);
      
      // 分析局部变量的使用情况
      const funcUsageMap = analyzeVariableUsage(funcBlock.content, localVariables);
      
      // 只为未使用的局部变量生成诊断信息
      localVariables.forEach(variable => {
        const isUsed = funcUsageMap.get(variable.name);
        console.log(`[Diagnostic] Function ${funcBlock.name} variable ${variable.name}: ${isUsed ? 'used' : 'unused'}`);
        if (!isUsed) {
          const diagnostic = new vscode.Diagnostic(
            variable.range,
            `函数 '${funcBlock.name}' 中未使用的变量 '${variable.name}'，建议移除该变量声明`,
            vscode.DiagnosticSeverity.Warning
          );
          
          diagnostic.source = 'Genero FGL';
          diagnostic.code = 'unused-variable';
          diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
          
          diagnostics.push(diagnostic);
        }
      });
    });
    
    console.log(`[Diagnostic] Generated ${diagnostics.length} diagnostics`);
    this.diagnosticCollection.set(document.uri, diagnostics);
  }
  
  public clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }
  
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

// 配置读取函数
function isDiagnosticEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('GeneroFGL');
  return config.get('4gl.diagnostic.enable', true);
}

function getDiagnosticDelay(): number {
  const config = vscode.workspace.getConfiguration('GeneroFGL');
  return config.get('4gl.diagnostic.delay', 500);
}

export function deactivate() {}
