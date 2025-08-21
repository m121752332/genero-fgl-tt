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
      const sym = new vscode.DocumentSymbol(name, 'FUNCTION', vscode.SymbolKind.Function, r, r);
      functionsGroup.children.push(sym);
      currentFunction = sym;
      continue;
    }

    // report
    const mRep = line.match(reReport);
    if (mRep) {
      const name = mRep[1];
      const r = new vscode.Range(i, 0, i, Math.max(1, line.length));
      const sym = new vscode.DocumentSymbol(name, 'REPORT', vscode.SymbolKind.Method, r, r);
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

    // DEFINE block handling (improved): treat RECORD blocks atomically and collect other comma-separated fragments
    if (reDefineStart.test(line)) {
      // collect contiguous lines that belong to this DEFINE (lines until next top-level token)
      const blockLines: string[] = [line];
      let j = i;
      while (j + 1 < lines.length) {
        const nxt = lines[j + 1];
        // stop if next line starts a new top-level construct (FUNCTION/REPORT/IMPORT/DATABASE/GLOBALS/DEFINE)
        if (/^\s*(?:FUNCTION|REPORT|IMPORT|DATABASE|GLOBALS|DEFINE)\b/i.test(nxt)) break;
        // otherwise include continuation lines
        j++;
        blockLines.push(nxt);
      }
      const blockStart = i;
      const blockEnd = j;
      i = j;

      // remove inline comments but keep commas and newlines for parsing
      const cleanedLines = blockLines.map(l => l.replace(/#.*/g, ''));

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
        const segs = ln.split(',').map(s => s.trim()).filter(Boolean);
        normalParts.push(...segs);
        k++;
      }

      // emit record symbols first
      for (const rec of recordSegments) {
        const r = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd].length));
        const recSym = new vscode.DocumentSymbol(rec.name, 'RECORD', vscode.SymbolKind.Struct, r, r);
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
        for (const part of parts) {
          // skip pure keywords that shouldn't be treated as names
          if (/^(DEFINE|END|RECORD)$/i.test(part)) continue;
          const mt = part.match(/\b(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL)\b/i);
          if (mt) {
            const idx = part.search(new RegExp(`\\b${mt[1]}\\b`, 'i'));
            const namesStr = idx >= 0 ? part.substring(0, idx) : part;
            const names = namesStr.split(',').map(s => s.trim()).filter(Boolean).filter(n => !/^(DEFINE|END|RECORD)$/i.test(n));
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
          } else {
            const names = part.split(',').map(s => s.trim()).filter(Boolean).filter(n => !/^(DEFINE|END|RECORD)$/i.test(n));
            pending.push(...names);
          }
        }
        for (const nm of pending) {
          if (!nm) continue;
          const vr = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd].length));
          const vsym = new vscode.DocumentSymbol(nm, '', vscode.SymbolKind.Variable, vr, vr);
          if (currentFunction) currentFunction.children.push(vsym);
          else if (inMain) mainGroup.children.push(vsym);
          else moduleVarsGroup.children.push(vsym);
        }
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
      const recSym = new vscode.DocumentSymbol(recName, 'RECORD', vscode.SymbolKind.Struct, r, r);
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

    // search in current document
    const lines = document.getText().split(/\r?\n/);
    const reFuncLine = new RegExp(`^\\s*(?:PUBLIC|PRIVATE|STATIC)?\\s*FUNCTION\\s+${shortName}\\b`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (reFuncLine.test(lines[i])) return new vscode.Location(document.uri, new vscode.Range(i, 0, i, Math.max(1, lines[i].length)));
    }

    // search other workspace files
    const files = await vscode.workspace.findFiles('**/*.{4gl,4GL}', '**/node_modules/**', 500);
    for (const f of files) {
      if (f.toString() === document.uri.toString()) continue;
      try {
        const doc = await vscode.workspace.openTextDocument(f);
        const docLines = doc.getText().split(/\r?\n/);
        for (let i = 0; i < docLines.length; i++) {
          if (reFuncLine.test(docLines[i])) return new vscode.Location(f, new vscode.Range(i, 0, i, Math.max(1, docLines[i].length)));
        }
      } catch {
        // ignore
      }
    }

    return null;
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: '4gl' }, { provideDocumentSymbols(document) { return parseDocumentSymbols(document.getText()); } }));
  context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: '4gl' }, new FourGLDefinitionProvider()));
}

export function deactivate() {}
