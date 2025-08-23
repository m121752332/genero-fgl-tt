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
  const reRecordStart = /([A-Za-z0-9_]+)\s+RECORD\b/i;
  const reRecordField = /^\s*([A-Za-z0-9_]+)\s+LIKE\s+([A-Za-z0-9_\.]+)/i;
  const reDefineStart = /^\s*DEFINE\b/i;
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
        if (/^\s*(?:FUNCTION|REPORT|MAIN|IMPORT|DATABASE|GLOBALS|DEFINE)\b/i.test(nxt)) break;
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
        // support: 'DEFINE <name> RECORD' or '<name> RECORD'
        const recStart = ln.match(/^(?:DEFINE\s+)?([A-Za-z0-9_]+)\s+RECORD\b/i);
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
        const segs = ln
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
        const fldRegex = /([A-Za-z0-9_]+)\s+LIKE\s+([A-Za-z0-9_\.]+)/ig;
        let fm: RegExpExecArray | null;
        while ((fm = fldRegex.exec(rec.body)) !== null) {
          recSym.children.push(new vscode.DocumentSymbol(fm[1], '', vscode.SymbolKind.Field, r, r));
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
        const fm = lines[k].match(reRecordField);
        if (fm) rfields.push(fm[1]);
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
      const names = left.split(',').map(s => s.replace(/#.*/,'').trim()).filter(Boolean);
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

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: '4gl' }, { provideDocumentSymbols(document) { return parseDocumentSymbols(document.getText()); } }));
  context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: '4gl' }, new FourGLDefinitionProvider()));
}

export function deactivate() {}
