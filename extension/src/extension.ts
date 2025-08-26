import * as vscode from 'vscode';
import { parseSymbols, Sym } from './parser';

// Clean, single-file implementation for DocumentSymbols, DefinitionProvider
// and unused-variable diagnostics for Genero 4GL.

// --- Types ----------------------------------------------------------------
interface VariableDefinition {
  name: string;
  type: string;
  line: number;
  range: vscode.Range;
  scope: 'main' | 'function' | 'module' | 'global';
}

interface FunctionBlock {
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

interface EnhancedFunctionSignature {
  name: string;
  bracketParameters: string[];
  defineParameters: string[];
  allParameters: string[];
}

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
function stripInlineComment(line: string): string {
  if (!line) return line;
  return line.replace(/#.*/g, '').replace(/--.*$/, '');
}

// --- Document symbol parser ----------------------------------------------
export function parseDocumentSymbols(text: string): vscode.DocumentSymbol[] {
  const lines = text.split(/\r?\n/);
  const out: vscode.DocumentSymbol[] = [];

  // Outline groups used to preserve the extension's previous structure
  const mainGroup = new vscode.DocumentSymbol('MAIN', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const functionsGroup = new vscode.DocumentSymbol('FUNCTION', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const reportsGroup = new vscode.DocumentSymbol('REPORT', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const moduleVarsGroup = new vscode.DocumentSymbol('MODULE_VARIABLE', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));
  const globalVarsGroup = new vscode.DocumentSymbol('GLOBALS', '', vscode.SymbolKind.Namespace, new vscode.Range(0, 0, Math.max(lines.length - 1, 0), 0), new vscode.Range(0, 0, 0, 0));

  function toRange(startLine: number, endLine: number): vscode.Range {
    const s = Math.max(0, Math.min(lines.length - 1, startLine));
    const e = Math.max(s, Math.min(lines.length - 1, endLine));
    return new vscode.Range(s, 0, e, Math.max(1, lines[e] ? lines[e].length : 0));
  }

  function convert(sym: Sym): vscode.DocumentSymbol | null {
    const name = sym.name || (sym.kind === 'ModuleVariable' ? 'MODULE_VARIABLE' : sym.kind.toUpperCase());
    const detail = sym.detail || '';
    const range = toRange(sym.start, sym.end);
    const sel = new vscode.Range(sym.start, 0, sym.start, Math.max(1, lines[sym.start] ? lines[sym.start].length : 0));
    let kind: vscode.SymbolKind = vscode.SymbolKind.Variable;
    switch (sym.kind) {
      case 'ModuleVariable': kind = vscode.SymbolKind.Namespace; break;
      case 'Globals': kind = vscode.SymbolKind.Namespace; break;
      case 'Main': kind = vscode.SymbolKind.Namespace; break;
      case 'Function': kind = vscode.SymbolKind.Function; break;
      case 'Report': kind = vscode.SymbolKind.Method; break;
      case 'Record': kind = vscode.SymbolKind.Struct; break;
      case 'Variable': kind = vscode.SymbolKind.Variable; break;
    }
    const ds = new vscode.DocumentSymbol(name, detail, kind, range, sel);
    if (sym.children && sym.children.length) {
      for (const c of sym.children) {
        const childSym = convert(c);
        if (childSym) ds.children.push(childSym);
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

// --- extract MAIN block; tolerate missing END MAIN by falling back to EOF ---
function extractMainBlock(text: string): { content: string; startLine: number; endLine: number } | null {
  const lines = text.split(/\r?\n/);
  let mainStart = -1; let mainEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^\s*MAIN\b/i.test(l)) { mainStart = i; }
    if (/^\s*END\s+MAIN\b/i.test(l) && mainStart !== -1) { mainEnd = i; break; }
  }
  if (mainStart === -1) return null;
  if (mainEnd === -1) mainEnd = lines.length - 1; // EOF fallback
  return { content: lines.slice(mainStart, mainEnd + 1).join('\n'), startLine: mainStart, endLine: mainEnd };
}

// --- Function block extraction and signature helpers ---------------------
function extractFunctionBlocks(text: string): FunctionBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: FunctionBlock[] = [];
  let current: FunctionBlock | null = null;
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

function parseEnhancedFunctionSignature(functionContent: string): EnhancedFunctionSignature | null {
  const lines = functionContent.split(/\r?\n/);
  const first = stripInlineComment(lines[0] || '');
  const m = first.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*FUNCTION\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/i);
  if (!m) return null;
  const name = m[1];
  const bracket = (m[2] || '').trim();
  const bracketParams = bracket ? bracket.split(',').map(s => s.trim()).filter(Boolean) : [];
  const defineParams = extractDefineParameters(functionContent, bracketParams);
  const all = Array.from(new Set([...bracketParams, ...defineParams]));
  return { name, bracketParameters: bracketParams, defineParameters: defineParams, allParameters: all } as EnhancedFunctionSignature;
}

function extractDefineParameters(functionContent: string, bracketParameters: string[]): string[] {
  const lines = functionContent.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 1; i < lines.length; i++) {
  const l = stripInlineComment(lines[i]).trim(); if (!l) continue;
  const rl = l.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s+LIKE\s+[A-Za-z0-9_\.]+/i);
    if (rl) { const vn = rl[1]; if (bracketParameters.includes(vn)) out.push(vn); continue; }
    const dm = l.match(/^\s*DEFINE\s+([^#\n]+?)\s+(?:LIKE\s+[A-ZaZ0-9_\.]+|STRING|INTEGER|CHAR|DECIMAL|SMALLINT|BIGINT|DATE|DATETIME|VARCHAR|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
    if (dm) { const vars = dm[1].split(',').map(s => s.trim()).filter(Boolean); vars.forEach(v => { if (bracketParameters.includes(v)) out.push(v); }); }
  }
  return out;
}

// --- Parse DEFINE statements (returns variable defs) ---------------------
function parseRecordDefinition(lines: string[], startIndex: number, actualLineNumber: number, scope: 'main' | 'function' | 'module' | 'global'): VariableDefinition | null {
  const firstLine = stripInlineComment(lines[startIndex]).trim();
  const m = firstLine.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD\s*$/i);
  if (!m) return null;
  const name = m[1]; let end = startIndex + 1;
  while (end < lines.length) {
    const candidate = stripInlineComment(lines[end]).trim();
    if (/^\s*END\s+RECORD\s*$/i.test(candidate)) break;
    end++;
  }
  return { name, type: 'RECORD', line: actualLineNumber, range: new vscode.Range(actualLineNumber, 0, actualLineNumber + (end - startIndex), lines[end] ? lines[end].length : 0), scope };
}

function parseDefineStatements(blockContent: string, startLineOffset: number, scope: 'main' | 'function' | 'module' | 'global'): VariableDefinition[] {
  const out: VariableDefinition[] = [];
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
      const rec = parseRecordDefinition(lines, i, actualLine, scope);
      if (rec) { out.push(rec); while (i < lines.length) {
          const nxt = stripInlineComment(lines[i]);
          if (/^\s*END\s+RECORD\s*$/i.test(nxt)) break;
          i++;
        } }
    }
  }
  return out;
}

// --- Usage analysis ------------------------------------------------------
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); }

function isVariableUsedInLine(line: string, variableName: string): boolean {
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

function analyzeVariableUsage(blockContent: string, variables: VariableDefinition[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  variables.forEach(v => map.set(v.name, false));
  const lines = blockContent.split(/\r?\n/);
  lines.forEach(line => {
    if (/^\s*#/.test(line) || /^\s*--/.test(line)) return;
    if (/^\s*DEFINE\s+/.test(line)) return;
    variables.forEach(v => { if (isVariableUsedInLine(line, v.name)) map.set(v.name, true); });
  });
  return map;
}

// --- Diagnostic provider -------------------------------------------------
class UnusedVariableDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  constructor() { this.diagnosticCollection = vscode.languages.createDiagnosticCollection('genero-fgl-unused-variables'); }
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
