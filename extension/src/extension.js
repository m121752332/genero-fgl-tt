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
exports.parseDocumentSymbols = parseDocumentSymbols;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./parser");
// --- Regex cache ----------------------------------------------------------
const REGEX_PATTERNS = {
    FUNCTION: /^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\b/i,
    REPORT: /^\s*REPORT\s+([A-Za-z0-9_]+)\b/i,
    MAIN_START: /^\s*MAIN\b/i,
    END_FUNCTION: /^\s*END\s+FUNCTION\b/i,
    END_REPORT: /^\s*END\s+REPORT\b/i,
    END_MAIN: /^\s*END\s+MAIN\b/i,
    END_RECORD: /^\s*END\s+RECORD\b/i,
    GLOBALS_START: /^\s*GLOBALS\b/i,
    END_GLOBALS: /^\s*END\s+GLOBALS\b/i,
    DEFINE_START: /^\s*DEFINE\b/i,
    TYPE_START: /^\s*TYPE\s+([A-Za-z0-9_]+)\s+(.+)/i,
    RECORD_START: /([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i,
    COMMENT_LINE: /^\s*#/,
    DOUBLE_DASH_COMMENT: /^\s*--/,
    FGL_KEYWORDS: /^(END|IF|THEN|ELSE|ELSEIF|FOR|WHILE|CASE|WHEN|RETURN|CALL|LET|DISPLAY|PRINT|MESSAGE|CONTINUE|EXIT|FUNCTION|MAIN|RECORD|TYPE|DEFINE|GLOBAL|GLOBALS|LIKE|TO|FROM|WHERE|SELECT|INSERT|UPDATE|DELETE|NULL|TRUE|FALSE)$/i
};
// remove inline single-line comments (# and --) before parsing
function stripInlineComment(line) {
    if (!line)
        return line;
    return line.replace(/#.*/g, '').replace(/--.*$/, '');
}
// --- Document symbol parser ----------------------------------------------
function parseDocumentSymbols(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    // Outline groups used to preserve the extension's previous structure
    const mainGroup = new vscode.DocumentSymbol('MAIN', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
    const functionsGroup = new vscode.DocumentSymbol('FUNCTION', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
    const reportsGroup = new vscode.DocumentSymbol('REPORT', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
    const moduleVarsGroup = new vscode.DocumentSymbol('MODULE_VARIABLE', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
    const globalVarsGroup = new vscode.DocumentSymbol('GLOBALS', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
    function toRange(startLine, endLine) {
        const s = Math.max(0, Math.min(lines.length - 1, startLine));
        const e = Math.max(s, Math.min(lines.length - 1, endLine));
        return new vscode.Range(s, 0, e, Math.max(1, lines[e] ? lines[e].length : 0));
    }
    function convert(sym) {
        const name = sym.name || (sym.kind === 'ModuleVariable' ? 'MODULE_VARIABLE' : sym.kind.toUpperCase());
        const detail = sym.detail || '';
        const range = toRange(sym.start, sym.end);
        const sel = new vscode.Range(sym.start, 0, sym.start, Math.max(1, lines[sym.start] ? lines[sym.start].length : 0));
        let kind = vscode.SymbolKind.Variable;
        switch (sym.kind) {
            case 'ModuleVariable':
                kind = vscode.SymbolKind.Namespace;
                break;
            case 'Globals':
                kind = vscode.SymbolKind.Namespace;
                break;
            case 'Main':
                kind = vscode.SymbolKind.Namespace;
                break;
            case 'Function':
                kind = vscode.SymbolKind.Function;
                break;
            case 'Report':
                kind = vscode.SymbolKind.Method;
                break;
            case 'Record':
                kind = vscode.SymbolKind.Struct;
                break;
            case 'Variable':
                kind = vscode.SymbolKind.Variable;
                break;
        }
        const ds = new vscode.DocumentSymbol(name, detail, kind, range, sel);
        if (sym.children && sym.children.length) {
            for (const c of sym.children) {
                const childSym = convert(c);
                if (childSym)
                    ds.children.push(childSym);
            }
        }
        return ds;
    }
    try {
        const syms = (0, parser_1.parseSymbols)(text);
        for (const s of syms) {
            switch (s.kind) {
                case 'Main': {
                    // add children of Main into mainGroup
                    mainGroup.range = toRange(s.start, s.end);
                    mainGroup.selectionRange = new vscode.Range(s.start, 0, s.start, Math.max(1, lines[s.start] ? lines[s.start].length : 0));
                    if (s.children) {
                        for (const c of s.children) {
                            const cs = convert(c);
                            if (cs)
                                mainGroup.children.push(cs);
                        }
                    }
                    break;
                }
                case 'Function': {
                    const fsym = convert(s);
                    if (fsym)
                        functionsGroup.children.push(fsym);
                    break;
                }
                case 'Report': {
                    const rsym = convert(s);
                    if (rsym)
                        reportsGroup.children.push(rsym);
                    break;
                }
                case 'ModuleVariable': {
                    if (s.children) {
                        for (const c of s.children) {
                            const cs = convert(c);
                            if (cs)
                                moduleVarsGroup.children.push(cs);
                        }
                    }
                    break;
                }
                case 'Globals': {
                    if (s.children) {
                        for (const c of s.children) {
                            const cs = convert(c);
                            if (cs)
                                globalVarsGroup.children.push(cs);
                        }
                    }
                    break;
                }
                case 'Record': {
                    const rs = convert(s);
                    if (rs)
                        moduleVarsGroup.children.push(rs);
                    break;
                }
                case 'Variable': {
                    // top-level variable outside main/function -> module variable area
                    const vsym = convert(s);
                    if (vsym)
                        moduleVarsGroup.children.push(vsym);
                    break;
                }
                default: {
                    const anySym = convert(s);
                    if (anySym)
                        out.push(anySym);
                    break;
                }
            }
        }
    }
    catch (err) {
        console.error('[Genero FGL] parseDocumentSymbols error', err);
    }
    // push groups in expected order if they have children
    if (mainGroup.children.length)
        out.push(mainGroup);
    if (functionsGroup.children.length)
        out.push(functionsGroup);
    if (reportsGroup.children.length)
        out.push(reportsGroup);
    if (moduleVarsGroup.children.length)
        out.push(moduleVarsGroup);
    if (globalVarsGroup.children.length)
        out.push(globalVarsGroup);
    return out;
}
// --- extract MAIN block; tolerate missing END MAIN by falling back to EOF ---
function extractMainBlock(text) {
    const lines = text.split(/\r?\n/);
    let mainStart = -1;
    let mainEnd = -1;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (/^\s*MAIN\b/i.test(l)) {
            mainStart = i;
        }
        if (/^\s*END\s+MAIN\b/i.test(l) && mainStart !== -1) {
            mainEnd = i;
            break;
        }
    }
    if (mainStart === -1)
        return null;
    if (mainEnd === -1)
        mainEnd = lines.length - 1; // EOF fallback
    return { content: lines.slice(mainStart, mainEnd + 1).join('\n'), startLine: mainStart, endLine: mainEnd };
}
// --- Function block extraction and signature helpers ---------------------
function extractFunctionBlocks(text) {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
        const l = stripInlineComment(lines[i]).trim();
        const fm = l.match(REGEX_PATTERNS.FUNCTION);
        if (fm) {
            current = { name: fm[1], content: '', startLine: i, endLine: -1 };
        }
        if (/^\s*END\s+FUNCTION\b/i.test(l) && current) {
            current.endLine = i;
            current.content = lines.slice(current.startLine, i + 1).join('\n');
            blocks.push(current);
            current = null;
        }
    }
    return blocks;
}
function parseEnhancedFunctionSignature(functionContent) {
    const lines = functionContent.split(/\r?\n/);
    const first = stripInlineComment(lines[0] || '');
    const m = first.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/i);
    if (!m)
        return null;
    const name = m[1];
    const bracket = (m[2] || '').trim();
    const bracketParams = bracket ? bracket.split(',').map(s => s.trim()).filter(Boolean) : [];
    const defineParams = extractDefineParameters(functionContent, bracketParams);
    const all = Array.from(new Set([...bracketParams, ...defineParams]));
    return { name, bracketParameters: bracketParams, defineParameters: defineParams, allParameters: all };
}
function extractDefineParameters(functionContent, bracketParameters) {
    const lines = functionContent.split(/\r?\n/);
    const out = [];
    for (let i = 1; i < lines.length; i++) {
        const l = stripInlineComment(lines[i]).trim();
        if (!l)
            continue;
        const rl = l.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+/i);
        if (rl) {
            const vn = rl[1];
            if (bracketParameters.includes(vn))
                out.push(vn);
            continue;
        }
        const dm = l.match(/^\s*DEFINE\s+([^#\n]+?)\s+(?:LIKE\s+[A-ZaZ0-9_\.]+|STRING|INTEGER|CHAR|DECIMAL|SMALLINT|BIGINT|DATE|DATETIME|VARCHAR|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
        if (dm) {
            const vars = dm[1].split(',').map(s => s.trim()).filter(Boolean);
            vars.forEach(v => { if (bracketParameters.includes(v))
                out.push(v); });
        }
    }
    return out;
}
// --- Parse DEFINE statements (returns variable defs) ---------------------
function parseRecordDefinition(lines, startIndex, actualLineNumber, scope) {
    const firstLine = stripInlineComment(lines[startIndex]).trim();
    const m = firstLine.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s*$/i);
    if (!m)
        return null;
    const name = m[1];
    let end = startIndex + 1;
    while (end < lines.length) {
        const candidate = stripInlineComment(lines[end]).trim();
        if (/^\s*END\s+RECORD\s*$/i.test(candidate))
            break;
        end++;
    }
    return { name, type: 'RECORD', line: actualLineNumber, range: new vscode.Range(actualLineNumber, 0, actualLineNumber + (end - startIndex), lines[end] ? lines[end].length : 0), scope };
}
function parseDefineStatements(blockContent, startLineOffset, scope) {
    const out = [];
    const lines = blockContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const actualLine = startLineOffset + i;
        const line = stripInlineComment(rawLine);
        if (!line.trim())
            continue; // empty or comment-only
        if (/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+/i.test(line) || /^\s*END\s+FUNCTION\s*$/i.test(line))
            continue;
        if (/^\s*MAIN\b/i.test(line) || /^\s*END\s+MAIN\b/i.test(line))
            continue;
        const recordLike = line.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+\s*/i);
        if (recordLike) {
            out.push({ name: recordLike[1], type: 'RECORD LIKE', line: actualLine, range: new vscode.Range(actualLine, 0, actualLine, line.length), scope });
            continue;
        }
        const single = line.match(/^\s*DEFINE\s+(.+?)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT|DYNAMIC\s+ARRAY\s+OF\s+\w+|LIKE\s+[A-Za-z0-9_]+\.[A-Za-z0-9_]+|LIKE\s+[A-Za-z0-9_\.]+)\s*.*$/i);
        if (single) {
            const names = single[1].split(',').map(s => s.trim());
            const typ = single[2];
            names.forEach(n => { if (n && !/^(DEFINE|END|RECORD)$/i.test(n))
                out.push({ name: n, type: typ, line: actualLine, range: new vscode.Range(actualLine, 0, actualLine, line.length), scope }); });
            continue;
        }
        const cont = line.match(/^\s+([A-Za-z0-9_]+)\s+(STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT|DYNAMIC\s+ARRAY\s+OF\s+\w+|LIKE\s+[A-Za-z0-9_]+\.[A-Za-z0-9_]+|LIKE\s+[A-Za-z0-9_\.]+|[A-Za-z0-9_\.]+)\s*,?\s*$/i);
        if (cont) {
            const vn = cont[1];
            const vt = cont[2];
            if (!REGEX_PATTERNS.FGL_KEYWORDS.test(vn))
                out.push({ name: vn, type: vt, line: actualLine, range: new vscode.Range(actualLine, 0, actualLine, line.length), scope });
            continue;
        }
        if (/^\s*DEFINE\s+\w+\s+RECORD\s*$/i.test(line)) {
            const rec = parseRecordDefinition(lines, i, actualLine, scope);
            if (rec) {
                out.push(rec);
                while (i < lines.length) {
                    const nxt = stripInlineComment(lines[i]);
                    if (/^\s*END\s+RECORD\s*$/i.test(nxt))
                        break;
                    i++;
                }
            }
        }
    }
    return out;
}
// --- Usage analysis ------------------------------------------------------
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); }
function isVariableUsedInLine(line, variableName) {
    const clean = line.replace(/#.*/g, '').replace(/--.*$/, '');
    const v = escapeRegExp(variableName);
    const pats = [
        new RegExp(`\\bLET\\s+${v}(\\.\\w+)?\\s*[=\\[]`, 'i'),
        new RegExp(`[=+\\-*/()\\s]${v}[+\\-*/()\\s]`, 'i'),
        new RegExp(`\\bCALL\\s+\\w+\\s*\\([^)]*${v}[^)]*\\)`, 'i'),
        new RegExp(`\\bIF\\s+[^\\n]*${v}`, 'i'),
        new RegExp(`\\b(DISPLAY|PRINT|MESSAGE)\\s+[^\\n]*${v}`, 'i'),
        new RegExp(`\\bINTO\\s+[^\\n]*${v}(\\.\\*)?\\b`, 'i'),
        new RegExp(`\\bINITIALIZE\\s+${v}(\\.\\*)?\\s+TO`, 'i'),
        new RegExp(`\\bINSERT\\s+INTO\\s+[^\\n]*VALUES\\s*\\([^)]*${v}(\\.\\*)?[^)]*\\)`, 'i'),
        new RegExp(`\\bUPDATE\\s+[^\\n]*SET\\s+[^\\n]*${v}`, 'i'),
        new RegExp(`\\b${v}\\b`, 'i')
    ];
    return pats.some(p => p.test(clean));
}
function analyzeVariableUsage(blockContent, variables) {
    const map = new Map();
    variables.forEach(v => map.set(v.name, false));
    const lines = blockContent.split(/\r?\n/);
    lines.forEach(line => {
        if (/^\s*#/.test(line) || /^\s*--/.test(line))
            return;
        if (/^\s*DEFINE\s+/.test(line))
            return;
        variables.forEach(v => { if (isVariableUsedInLine(line, v.name))
            map.set(v.name, true); });
    });
    return map;
}
// --- Diagnostic provider -------------------------------------------------
class UnusedVariableDiagnosticProvider {
    constructor() { this.diagnosticCollection = vscode.languages.createDiagnosticCollection('genero-fgl-unused-variables'); }
    updateDiagnostics(document) {
        try {
            const config = vscode.workspace.getConfiguration('GeneroFGL');
            const enabled = config.get('4gl.diagnostic.enable', true);
            if (!enabled) {
                this.diagnosticCollection.clear();
                return;
            }
            const text = document.getText();
            const diagnostics = [];
            const mainBlock = extractMainBlock(text);
            if (mainBlock) {
                const vars = parseDefineStatements(mainBlock.content, mainBlock.startLine, 'main');
                const usage = analyzeVariableUsage(mainBlock.content, vars);
                vars.forEach(v => {
                    const used = usage.get(v.name);
                    if (!used) {
                        const d = new vscode.Diagnostic(v.range, `未使用的變數 '${v.name}'`, vscode.DiagnosticSeverity.Warning);
                        d.source = 'Genero FGL';
                        d.code = 'unused-variable';
                        d.tags = [vscode.DiagnosticTag.Unnecessary];
                        diagnostics.push(d);
                    }
                });
            }
            // Detect GLOBALS blocks and do not emit unused-variable diagnostics for them
            // because GLOBALS are intentionally global/shared and may be referenced elsewhere.
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim();
                if (/^\s*GLOBALS\b/i.test(l)) {
                    let k = i + 1;
                    while (k < lines.length && !/^\s*END\s+GLOBALS\b/i.test(stripInlineComment(lines[k])))
                        k++;
                    const block = lines.slice(i, Math.min(k, lines.length - 1) + 1).join('\n');
                    // parse to register but skip diagnostics
                    parseDefineStatements(block, i, 'global');
                    i = k;
                }
            }
            const funcs = extractFunctionBlocks(text);
            funcs.forEach(fb => {
                const sig = parseEnhancedFunctionSignature(fb.content);
                const allParams = sig ? sig.allParameters : [];
                const fvars = parseDefineStatements(fb.content, fb.startLine, 'function');
                const localVars = fvars.filter(v => !allParams.includes(v.name));
                const usage = analyzeVariableUsage(fb.content, localVars);
                localVars.forEach(v => {
                    const used = usage.get(v.name);
                    if (!used) {
                        const d = new vscode.Diagnostic(v.range, `函式 '${fb.name}' 中未使用的變數 '${v.name}'`, vscode.DiagnosticSeverity.Warning);
                        d.source = 'Genero FGL';
                        d.code = 'unused-variable';
                        d.tags = [vscode.DiagnosticTag.Unnecessary];
                        diagnostics.push(d);
                    }
                });
            });
            this.diagnosticCollection.set(document.uri, diagnostics);
        }
        catch (err) {
            console.error('[Genero FGL] updateDiagnostics error', err);
            this.diagnosticCollection.delete(document.uri);
        }
    }
    clearDiagnostics(uri) { this.diagnosticCollection.delete(uri); }
    dispose() { this.diagnosticCollection.dispose(); }
}
function isDiagnosticEnabled() { const cfg = vscode.workspace.getConfiguration('GeneroFGL'); return cfg.get('4gl.diagnostic.enable', true); }
function getDiagnosticDelay() { const cfg = vscode.workspace.getConfiguration('GeneroFGL'); return cfg.get('4gl.diagnostic.delay', 500); }
let diagnosticTimer;
// --- Definition provider -------------------------------------------------
class FourGLDefinitionProvider {
    async provideDefinition(document, position) {
        const wr = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\.]+/);
        if (!wr)
            return null;
        const word = document.getText(wr);
        const local = this.findDefinitionInText(document.getText(), word, document.uri);
        if (local)
            return local;
        const files = await vscode.workspace.findFiles('**/*.4gl');
        for (const f of files) {
            if (f.toString() === document.uri.toString())
                continue;
            try {
                const doc = await vscode.workspace.openTextDocument(f);
                const def = this.findDefinitionInText(doc.getText(), word, f);
                if (def)
                    return def;
            }
            catch { /* ignore */ }
        }
        return null;
    }
    findDefinitionInText(text, name, uri) {
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i].replace(/#.*/g, '').replace(/--.*$/, '').trim();
            const mf = ln.match(REGEX_PATTERNS.FUNCTION);
            if (mf && mf[1].toLowerCase() === name.toLowerCase())
                return new vscode.Location(uri, new vscode.Position(i, 0));
            const mr = ln.match(REGEX_PATTERNS.REPORT);
            if (mr && mr[1].toLowerCase() === name.toLowerCase())
                return new vscode.Location(uri, new vscode.Position(i, 0));
        }
        return null;
    }
}
// --- Activation ----------------------------------------------------------
function activate(context) {
    console.log('[Genero FGL] activating');
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: '4gl' }, { provideDocumentSymbols(document) { return parseDocumentSymbols(document.getText()); } }));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: '4gl' }, new FourGLDefinitionProvider()));
    const diagProvider = new UnusedVariableDiagnosticProvider();
    context.subscriptions.push(diagProvider);
    const onChange = vscode.workspace.onDidChangeTextDocument(ev => {
        if (ev.document.languageId !== '4gl')
            return;
        if (!isDiagnosticEnabled())
            return;
        if (diagnosticTimer)
            clearTimeout(diagnosticTimer);
        diagnosticTimer = setTimeout(() => diagProvider.updateDiagnostics(ev.document), getDiagnosticDelay());
    });
    context.subscriptions.push(onChange);
    const onOpen = vscode.workspace.onDidOpenTextDocument(doc => { if (doc.languageId === '4gl' && isDiagnosticEnabled())
        diagProvider.updateDiagnostics(doc); });
    context.subscriptions.push(onOpen);
    const cfg = vscode.workspace.onDidChangeConfiguration(ev => {
        if (ev.affectsConfiguration('GeneroFGL.4gl.diagnostic')) {
            vscode.workspace.textDocuments.forEach(d => { if (d.languageId === '4gl') {
                if (isDiagnosticEnabled())
                    diagProvider.updateDiagnostics(d);
                else
                    diagProvider.clearDiagnostics(d.uri);
            } });
        }
    });
    context.subscriptions.push(cfg);
    // initial run
    vscode.workspace.textDocuments.forEach(d => { if (d.languageId === '4gl' && isDiagnosticEnabled())
        diagProvider.updateDiagnostics(d); });
    context.subscriptions.push(vscode.commands.registerCommand('genero-fgl.runDiagnostics', () => {
        const ae = vscode.window.activeTextEditor;
        if (ae && ae.document.languageId === '4gl') {
            diagProvider.updateDiagnostics(ae.document);
            vscode.window.showInformationMessage('已运行未使用变量诊断');
        }
        else {
            vscode.window.showWarningMessage('请打开一个 .4gl 文件');
        }
    }));
    console.log('[Genero FGL] activated');
}
function deactivate() { }
