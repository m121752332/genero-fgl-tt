"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
// Robust parser + symbol & definition providers for Genero 4GL
function parseDocumentSymbols(text) {
    const lines = text.split(/\r?\n/);
    const symbols = [];
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
    let currentFunction = null;
    let inMain = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // skip full-line comments
        if (/^\s*#/.test(line))
            continue;
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
                const bodyLines = [];
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
                            console.log(`[DEBUG] Pattern ${p + 1} matched - Found field: ${fieldName} : ${fieldType}`);
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
                if (currentFunction)
                    currentFunction.children.push(recSym);
                else if (inMain)
                    mainGroup.children.push(recSym);
                else
                    moduleVarsGroup.children.push(recSym);
                // Skip to the END RECORD line
                i = blockEnd;
                continue;
            }
            else {
                // Simple TYPE definition (like TYPE t_cc ARRAY [] OF STRING)
                const vr = new vscode.Range(i, 0, i, Math.max(1, line.length));
                const vsym = new vscode.DocumentSymbol(typeName, typeDefinition, vscode.SymbolKind.TypeParameter, vr, vr);
                console.log(`[DEBUG] Found TYPE definition: ${typeName} = ${typeDefinition}`);
                if (currentFunction)
                    currentFunction.children.push(vsym);
                else if (inMain)
                    mainGroup.children.push(vsym);
                else
                    moduleVarsGroup.children.push(vsym);
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
        if (reEndFunction.test(line)) {
            currentFunction = null;
            continue;
        }
        if (reEndReport.test(line)) {
            currentFunction = null;
            continue;
        }
        if (reEndMain.test(line)) {
            inMain = false;
            continue;
        }
        // DEFINE block handling (tightened): treat RECORD blocks atomically and collect only proper DEFINE continuation lines
        if (reDefineStart.test(line)) {
            // collect contiguous lines that belong to this DEFINE (lines until next top-level token)
            const blockLines = [line];
            let j = i;
            while (j + 1 < lines.length) {
                const nxt = lines[j + 1];
                // stop if next line starts a new top-level construct or another DEFINE
                if (/^\s*(?:FUNCTION|REPORT|MAIN|IMPORT|DATABASE|GLOBALS|DEFINE|TYPE)\b/i.test(nxt))
                    break;
                // stop if next line obviously starts a normal statement rather than a DEFINE continuation
                if (reNonDefineStmt.test(nxt))
                    break;
                // allow record block lines or conservative DEFINE-like continuations; otherwise stop
                const isRecordLine = /\bRECORD\b/i.test(nxt) || /^\s*END\s+RECORD\b/i.test(nxt);
                if (!isRecordLine && !reDefineContinuation.test(nxt.trim()))
                    break;
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
            const normalParts = [];
            const recordSegments = [];
            let k = 0;
            while (k < cleanedLines.length) {
                const ln = cleanedLines[k].trim();
                if (!ln) {
                    k++;
                    continue;
                }
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
                    let bodyLines = [];
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
                    if (!cleanLine)
                        continue;
                    // Match field definitions: fieldname TYPE or fieldname LIKE table.field (with optional comma)
                    const fldMatch = cleanLine.match(/^\s*([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i);
                    if (fldMatch) {
                        recSym.children.push(new vscode.DocumentSymbol(fldMatch[1], fldMatch[2], vscode.SymbolKind.Field, r, r));
                    }
                }
                if (currentFunction)
                    currentFunction.children.push(recSym);
                else if (inMain)
                    mainGroup.children.push(recSym);
                else
                    moduleVarsGroup.children.push(recSym);
            }
            // process normalParts: merge into a single string and apply name/type extraction
            const afterDefine = normalParts.join(', ');
            if (afterDefine) {
                const parts = afterDefine.split(',').map(p => p.trim()).filter(Boolean);
                let pending = [];
                let sawType = false;
                for (const part of parts) {
                    // skip pure keywords that shouldn't be treated as names
                    if (/^(DEFINE|END|RECORD)$/i.test(part))
                        continue;
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
                            if (!nm)
                                continue;
                            const vr = new vscode.Range(blockStart, 0, blockEnd, Math.max(1, lines[blockEnd].length));
                            const vsym = new vscode.DocumentSymbol(nm, '', vscode.SymbolKind.Variable, vr, vr);
                            if (currentFunction)
                                currentFunction.children.push(vsym);
                            else if (inMain)
                                mainGroup.children.push(vsym);
                            else
                                moduleVarsGroup.children.push(vsym);
                        }
                        pending = [];
                        sawType = true;
                    }
                    else {
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
            const rfields = [];
            while (k < lines.length && !reEndRecord.test(lines[k])) {
                // Remove comments (both # and --) from the line
                const cleanLine = lines[k].replace(/#.*$/, '').replace(/--.*$/, '').trim();
                if (cleanLine) {
                    // Match field definitions: fieldname TYPE or fieldname LIKE table.field (with optional comma)
                    const fm = cleanLine.match(/^\s*([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\s*,?\s*$/i);
                    if (fm)
                        rfields.push(fm[1]);
                }
                k++;
            }
            const r = new vscode.Range(i, 0, k < lines.length ? k : i, Math.max(1, lines[k] ? lines[k].length : lines[i].length));
            const recSym = new vscode.DocumentSymbol(recName, '', vscode.SymbolKind.Struct, r, r);
            for (const fn of rfields)
                recSym.children.push(new vscode.DocumentSymbol(fn, '', vscode.SymbolKind.Field, r, r));
            if (currentFunction)
                currentFunction.children.push(recSym);
            else if (inMain)
                mainGroup.children.push(recSym);
            else
                moduleVarsGroup.children.push(recSym);
            if (k < lines.length)
                i = k;
            continue;
        }
        // single-line DEFINE like 'DEFINE l_msg STRING'
        const singleDef = line.match(/^\s*DEFINE\s+(.+?)\s+(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL)\b/i);
        if (singleDef) {
            const left = singleDef[1].trim();
            // Remove both # and -- comments before processing
            const names = left.split(',').map(s => s.replace(/#.*$/, '').replace(/--.*$/, '').trim()).filter(Boolean);
            for (const nm of names) {
                const vr = new vscode.Range(i, 0, i, Math.max(1, line.length));
                const vsym = new vscode.DocumentSymbol(nm, '', vscode.SymbolKind.Variable, vr, vr);
                if (currentFunction)
                    currentFunction.children.push(vsym);
                else if (inMain)
                    mainGroup.children.push(vsym);
                else
                    moduleVarsGroup.children.push(vsym);
            }
            continue;
        }
    }
    // order: MAIN, FUNCTION, REPORT, MODULE_VARIABLE
    if (mainGroup.children.length)
        symbols.push(mainGroup);
    if (functionsGroup.children.length)
        symbols.push(functionsGroup);
    if (reportsGroup.children.length)
        symbols.push(reportsGroup);
    if (moduleVarsGroup.children.length)
        symbols.push(moduleVarsGroup);
    return symbols;
}
// Definition provider
class FourGLDefinitionProvider {
    async provideDefinition(document, position) {
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_.]+/);
        if (!wordRange)
            return null;
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
        }
        else {
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
            if (f.toString() === document.uri.toString())
                continue;
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
                }
                else {
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
            }
            catch {
                // ignore
            }
        }
        console.log(`[DEBUG] No definition found for '${shortName}' (isReportCall: ${isReportCall})`);
        vscode.window.showWarningMessage(`No definition found for '${shortName}'${isReportCall ? ' (REPORT)' : ' (FUNCTION)'}`);
        return null;
    }
}
let diagnosticTimeout;
function activate(context) {
    // 注册文档符号提供器
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: '4gl' }, { provideDocumentSymbols(document) { return parseDocumentSymbols(document.getText()); } }));
    // 注册定义提供器
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: '4gl' }, new FourGLDefinitionProvider()));
    // 注册未使用变量诊断提供器
    const unusedVariableDiagnosticProvider = new UnusedVariableDiagnosticProvider();
    context.subscriptions.push(unusedVariableDiagnosticProvider);
    // 文档变更监听
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === '4gl' && isDiagnosticEnabled()) {
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
        if (document.languageId === '4gl' && isDiagnosticEnabled()) {
            unusedVariableDiagnosticProvider.updateDiagnostics(document);
        }
    });
    context.subscriptions.push(documentOpenListener);
    // 配置变更监听
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('GeneroFGL.4gl.diagnostic')) {
            vscode.workspace.textDocuments.forEach(document => {
                if (document.languageId === '4gl') {
                    if (isDiagnosticEnabled()) {
                        unusedVariableDiagnosticProvider.updateDiagnostics(document);
                    }
                    else {
                        unusedVariableDiagnosticProvider.clearDiagnostics(document.uri);
                    }
                }
            });
        }
    });
    context.subscriptions.push(configChangeListener);
    // 初始化时处理已打开的文档
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === '4gl' && isDiagnosticEnabled()) {
            unusedVariableDiagnosticProvider.updateDiagnostics(document);
        }
    });
}
// 提取 MAIN 块内容
function extractMainBlock(text) {
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
function extractFunctionBlocks(text) {
    const lines = text.split(/\r?\n/);
    const functionBlocks = [];
    let currentFunction = null;
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
function parseFunctionSignature(functionContent) {
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
function extractDefineParameters(functionContent, bracketParameters) {
    const lines = functionContent.split(/\r?\n/);
    const defineParameters = [];
    console.log(`[DEBUG] extractDefineParameters: 括号参数`, bracketParameters);
    for (let i = 1; i < lines.length; i++) { // 跳过函数声明行
        const line = lines[i].trim();
        // 跳过注释和空行
        if (!line || line.startsWith('#') || line.startsWith('--'))
            continue;
        // 修复：增强DEFINE语句匹配，支持更多类型格式
        const defineMatch = line.match(/^\s*DEFINE\s+([^#\n]+?)\s+(?:LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|CHAR|DECIMAL|SMALLINT|BIGINT|DATE|DATETIME|VARCHAR|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
        if (defineMatch) {
            const variableList = defineMatch[1].trim();
            console.log(`[DEBUG] 找到DEFINE行: '${line}', 变量列表: '${variableList}'`);
            const variables = variableList.split(',').map(v => v.trim()).filter(v => v.length > 0);
            console.log(`[DEBUG] 解析变量: `, variables);
            // 检查这些变量是否在括号参数中
            variables.forEach(variable => {
                console.log(`[DEBUG] 检查变量 '${variable}' 是否在括号参数中:`, bracketParameters.includes(variable));
                if (bracketParameters.includes(variable)) {
                    defineParameters.push(variable);
                    console.log(`[DEBUG] 添加DEFINE参数: ${variable}`);
                }
            });
        }
    }
    console.log(`[DEBUG] extractDefineParameters 结果:`, defineParameters);
    return defineParameters;
}
// 增强的函数签名解析器
function parseEnhancedFunctionSignature(functionContent) {
    const lines = functionContent.split(/\r?\n/);
    // 解析函数声明行 - 修复：支持函数声明后跟括号的格式
    const firstLine = lines[0];
    let functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*$/i);
    // 如果第一行没有括号，检查是否是 FUNCTION name(params) 的格式，但括号可能在同一行
    if (!functionMatch) {
        functionMatch = firstLine.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/i);
    }
    if (!functionMatch) {
        console.log(`[DEBUG] 无法解析函数声明: '${firstLine}'`);
        return null;
    }
    const functionName = functionMatch[1];
    const bracketParameterString = functionMatch[2].trim();
    console.log(`[DEBUG] 解析函数: ${functionName}, 括号参数: '${bracketParameterString}'`);
    // 解析括号内参数
    const bracketParameters = bracketParameterString
        ? bracketParameterString.split(',').map(p => p.trim()).filter(p => p.length > 0)
        : [];
    console.log(`[DEBUG] 函数 ${functionName} 括号参数:`, bracketParameters);
    // 解析函数体内的 DEFINE 参数
    const defineParameters = extractDefineParameters(functionContent, bracketParameters);
    console.log(`[DEBUG] 函数 ${functionName} DEFINE参数:`, defineParameters);
    // 合并所有参数
    const allParameters = [...new Set([...bracketParameters, ...defineParameters])];
    console.log(`[DEBUG] 函数 ${functionName} 所有参数:`, allParameters);
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
function parseRecordDefinition(lines, startIndex, actualLineNumber, scope) {
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
function parseDefineStatements(blockContent, startLineOffset, scope) {
    const variables = [];
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
        // 先检查是否是 RECORD LIKE 的单行定义
        const recordLikeMatch = line.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+\s*\*?\s*$/i);
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
        
        // 普通的单行 DEFINE 解析
        const singleDefineMatch = line.match(/^\s*DEFINE\s+(.+?)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT|LIKE\s+[A-Za-z0-9_]+\.[A-Za-z0-9_]+|LIKE\s+[A-Za-z0-9_\.]+)\s*.*$/i);
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
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// 检测变量是否在行中被使用
function isVariableUsedInLine(line, variableName) {
    // 移除注释
    const cleanLine = line.replace(/#.*$/, '').replace(/--.*$/, '');
    // 创建变量名的正则表达式（确保完整匹配）
    const variableRegex = new RegExp(`\\b${escapeRegExp(variableName)}\\b`, 'i');
    // 检查各种使用模式
    const usagePatterns = [
        // 赋值语句: LET variable = ...
        new RegExp(`\\bLET\\s+${escapeRegExp(variableName)}\\s*[=\\[]`, 'i'),
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
        // 简单的变量引用
        new RegExp(`\\b${escapeRegExp(variableName)}\\b`, 'i')
    ];
    return usagePatterns.some(pattern => pattern.test(cleanLine));
}
// 分析变量使用情况
function analyzeVariableUsage(blockContent, variables) {
    const usageMap = new Map();
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
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('genero-fgl-unused-variables');
    }
    updateDiagnostics(document) {
        // 检查配置是否启用
        const config = vscode.workspace.getConfiguration('GeneroFGL');
        if (!config.get('4gl.diagnostic.enable', true)) {
            this.diagnosticCollection.clear();
            return;
        }
        const text = document.getText();
        const diagnostics = [];
        // 处理 MAIN 块
        const mainBlock = extractMainBlock(text);
        if (mainBlock) {
            const mainVariables = parseDefineStatements(mainBlock.content, mainBlock.startLine, 'main');
            const mainUsageMap = analyzeVariableUsage(mainBlock.content, mainVariables);
            mainVariables.forEach(variable => {
                if (!mainUsageMap.get(variable.name)) {
                    const diagnostic = new vscode.Diagnostic(variable.range, `未使用的变量 '${variable.name}'，建议移除该变量声明`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'Genero FGL';
                    diagnostic.code = 'unused-variable';
                    diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
                    diagnostics.push(diagnostic);
                }
            });
        }
        // 处理 FUNCTION 块
        const functionBlocks = extractFunctionBlocks(text);
        functionBlocks.forEach(funcBlock => {
            // 使用增强的函数签名解析器，获取所有参数列表
            const enhancedSignature = parseEnhancedFunctionSignature(funcBlock.content);
            const allParameters = enhancedSignature ? enhancedSignature.allParameters : [];
            console.log(`[DEBUG] 函数 ${funcBlock.name} 的所有参数:`, allParameters);
            // 解析函数中的所有变量定义
            const allFuncVariables = parseDefineStatements(funcBlock.content, funcBlock.startLine, 'function');
            // 过滤掉所有参数变量（括号内参数和 DEFINE 语句参数），只检查局部变量
            const localVariables = allFuncVariables.filter(variable => !allParameters.includes(variable.name));
            console.log(`[DEBUG] 函数 ${funcBlock.name} 的局部变量:`, localVariables.map(v => v.name));
            // 分析局部变量的使用情况
            const funcUsageMap = analyzeVariableUsage(funcBlock.content, localVariables);
            // 只为未使用的局部变量生成诊断信息
            localVariables.forEach(variable => {
                if (!funcUsageMap.get(variable.name)) {
                    const diagnostic = new vscode.Diagnostic(variable.range, `函数 '${funcBlock.name}' 中未使用的变量 '${variable.name}'，建议移除该变量声明`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'Genero FGL';
                    diagnostic.code = 'unused-variable';
                    diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
                    diagnostics.push(diagnostic);
                }
            });
        });
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    clearDiagnostics(uri) {
        this.diagnosticCollection.delete(uri);
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
// 配置读取函数
function isDiagnosticEnabled() {
    const config = vscode.workspace.getConfiguration('GeneroFGL');
    return config.get('4gl.diagnostic.enable', true);
}
function getDiagnosticDelay() {
    const config = vscode.workspace.getConfiguration('GeneroFGL');
    return config.get('4gl.diagnostic.delay', 500);
}
function deactivate() { }
