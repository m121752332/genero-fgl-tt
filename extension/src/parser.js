"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSymbols = parseSymbols;
function stripInlineComment(line) { if (!line)
    return ''; return line.replace(/#.*/g, '').replace(/--.*$/, ''); }
function pushVar(parent, name, type, line) {
    parent.children = parent.children || [];
    parent.children.push({ kind: 'Variable', name, detail: type, start: line, end: line });
}
function parseSymbols(text) {
    const lines = text.split(/\r?\n/);
    const symbols = [];
    const controlStartRegex = /^\s*(IF|LET|FOR|WHILE|RETURN|CALL|END|ELSE|ELSIF|DO|EXIT|NEXT|BREAK)\b/i;
    let i = 0;
    while (i < lines.length) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed) {
            i++;
            continue;
        }
        // MODULE_VARIABLE
        if (/^MODULE_VARIABLE\b/i.test(trimmed)) {
            const start = i;
            const node = { kind: 'ModuleVariable', name: 'MODULE_VARIABLE', start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+MODULE_VARIABLE\b/i.test(stripInlineComment(lines[i]).trim())) {
                const lnRaw = lines[i];
                const ln = stripInlineComment(lnRaw).trim();
                // Handle nested DEFINE <name> RECORD ... END RECORD inside MODULE_VARIABLE
                const recDef = ln.match(/^DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
                if (recDef) {
                    const rname = recDef[1];
                    const rstart = i;
                    const recNode = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                    let k = i + 1;
                    while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                        const fldLn = stripInlineComment(lines[k]).trim();
                        const fld = fldLn.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                        if (fld)
                            pushVar(recNode, fld[1], fld[2] || '', k);
                        k++;
                    }
                    recNode.end = Math.max(k, rstart);
                    node.children = node.children || [];
                    node.children.push(recNode);
                    i = k + 1; // skip past END RECORD
                    continue;
                }
                const controlLike = controlStartRegex.test(ln);
                const m = (!controlLike) && ln.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (m) {
                    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                    const typ = m[2] ? m[2].trim() : '';
                    names.forEach(n => pushVar(node, n, typ, i));
                }
                else {
                    const cont = (!controlLike) && ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (cont)
                        pushVar(node, cont[1], cont[2] || '', i);
                }
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        // GLOBALS: if this is a single-line include (e.g. GLOBALS "path/to/file" or GLOBALS ../file or GLOBALS top.global)
        // then treat it as an include and do not parse as a block. Otherwise parse a GLOBALS ... END GLOBALS block.
        if (/^GLOBALS\b/i.test(trimmed) || /^#GLOBALS\b/i.test(trimmed)) {
            // commented include (#GLOBALS) - skip
            if (/^#GLOBALS\b/i.test(trimmed)) {
                i++;
                continue;
            }
            // detect include form: followed by quoted path or path-like token containing '/' or a dot-extension
            const includeLike = /^\s*GLOBALS\s+(['"]).+\1\s*$/i.test(trimmed)
                || /^\s*GLOBALS\s+\S*\/\S+/i.test(trimmed)
                || /^\s*GLOBALS\s+\S+\.[A-Za-z0-9_]+\s*$/i.test(trimmed);
            if (includeLike) {
                i++;
                continue;
            }
            const start = i;
            const node = { kind: 'Globals', name: 'GLOBALS', start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+GLOBALS\b/i.test(stripInlineComment(lines[i]).trim())) {
                const lnRaw = lines[i];
                const ln = stripInlineComment(lnRaw).trim();
                // Handle nested DEFINE <name> RECORD ... END RECORD inside GLOBALS
                // avoid matching 'DEFINE ... RECORD LIKE ...' which is a single-line alias
                const recDef = ln.match(/^DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
                if (recDef) {
                    const rname = recDef[1];
                    const rstart = i;
                    const recNode = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                    let k = i + 1;
                    while (k < lines.length && !/^END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                        const fldLn = stripInlineComment(lines[k]).trim();
                        const fld = fldLn.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                        if (fld)
                            pushVar(recNode, fld[1], fld[2] || '', k);
                        k++;
                    }
                    recNode.end = Math.max(k, rstart);
                    node.children = node.children || [];
                    node.children.push(recNode);
                    i = k + 1; // skip past END RECORD
                    continue;
                }
                const controlLike = controlStartRegex.test(ln);
                const m = (!controlLike) && ln.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (m) {
                    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                    const typ = m[2] ? m[2].trim() : '';
                    names.forEach(n => pushVar(node, n, typ, i));
                }
                else {
                    const cont = (!controlLike) && ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (cont)
                        pushVar(node, cont[1], cont[2] || '', i);
                }
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        // Top-level DEFINE RECORD: handle block form 'DEFINE <name> RECORD' ... 'END RECORD'
        // Do not treat lines like 'DEFINE foo RECORD LIKE table.*' as a block start.
        if (/^\s*DEFINE\s+[A-Za-z0-9_]+\s+RECORD(?!\s+LIKE)\b/i.test(trimmed)) {
            const mrec = trimmed.match(/^\s*DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
            if (mrec) {
                const rname = mrec[1];
                const rstart = i;
                const node = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                let k = i + 1;
                while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                    const ln = stripInlineComment(lines[k]).trim();
                    const fld = ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (fld)
                        pushVar(node, fld[1], fld[2] || '', k);
                    k++;
                }
                node.end = Math.max(k, rstart);
                symbols.push(node);
                i = k + 1;
                continue;
            }
        }
        // Top-level TYPE RECORD: handle block form 'TYPE <name> RECORD' ... 'END RECORD'
        if (/^\s*TYPE\s+[A-Za-z0-9_]+\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD(?!\s+LIKE)\b/i.test(trimmed)) {
            const mrec = trimmed.match(/^\s*TYPE\s+([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD(?!\s+LIKE)\b/i);
            if (mrec) {
                const rname = mrec[1];
                const rstart = i;
                const node = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                let k = i + 1;
                while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                    const ln = stripInlineComment(lines[k]).trim();
                    const fld = ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (fld)
                        pushVar(node, fld[1], fld[2] || '', k);
                    k++;
                }
                node.end = Math.max(k, rstart);
                symbols.push(node);
                i = k + 1;
                continue;
            }
        }
        // Top-level DEFINE (not inside MAIN/FUNCTION/GLOBALS/MODULE_VARIABLE): treat as module variable(s)
        if (/^DEFINE\b/i.test(trimmed)) {
            // try to capture: DEFINE name1, name2 LIKE ... OR DEFINE name TYPE
            const m = trimmed.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
            if (m) {
                const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                const typ = m[2] ? m[2].trim() : '';
                for (const n of names)
                    pushVar({ children: symbols }, n, typ, i); // pushVar will create entries; we'll collect them at top-level
                i++;
                continue;
            }
            // fallback: simple DEFINE <name> RECORD or other forms - skip here to avoid false positives
        }
        // Top-level TYPE declarations: treat as module-level type aliases (show as variables/types)
        if (/^TYPE\b/i.test(trimmed)) {
            const m = trimmed.match(/^TYPE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
            if (m) {
                const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                const typ = m[2] ? m[2].trim() : '';
                for (const n of names)
                    pushVar({ children: symbols }, n, typ, i);
            }
            i++;
            continue;
        }
        // MAIN
        if (/^MAIN\b/i.test(trimmed)) {
            const start = i;
            const node = { kind: 'Main', name: 'MAIN', start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+MAIN\b/i.test(stripInlineComment(lines[i]).trim())) {
                const lnRaw = lines[i];
                const ln = stripInlineComment(lnRaw).trim();
                // Handle nested DEFINE <name> RECORD ... END RECORD inside MAIN
                // avoid matching 'DEFINE ... RECORD LIKE ...' which is a single-line alias
                const recDef = ln.match(/^DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
                if (recDef) {
                    const rname = recDef[1];
                    const rstart = i;
                    const recNode = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                    let k = i + 1;
                    while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                        const fldLn = stripInlineComment(lines[k]).trim();
                        const fld = fldLn.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                        if (fld)
                            pushVar(recNode, fld[1], fld[2] || '', k);
                        k++;
                    }
                    recNode.end = Math.max(k, rstart);
                    node.children = node.children || [];
                    node.children.push(recNode);
                    i = k + 1; // skip past END RECORD
                    continue;
                }
                const controlLike = controlStartRegex.test(ln);
                const m = (!controlLike) && ln.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (m) {
                    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                    const typ = m[2] ? m[2].trim() : '';
                    names.forEach(n => pushVar(node, n, typ, i));
                }
                else {
                    const cont = (!controlLike) && ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (cont)
                        pushVar(node, cont[1], cont[2] || '', i);
                }
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        // FUNCTION / REPORT
        const fm = trimmed.match(/^\s*(?:PUBLIC|PRIVATE|STATIC)?\s*(FUNCTION)\s+([A-Za-z0-9_]+)\b/i);
        const rm = trimmed.match(/^\s*REPORT\s+([A-Za-z0-9_]+)\b/i);
        if (fm) {
            const name = fm[2];
            const start = i;
            const node = { kind: 'Function', name, start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+FUNCTION\b/i.test(stripInlineComment(lines[i]).trim())) {
                const lnRaw = lines[i];
                const ln = stripInlineComment(lnRaw).trim();
                // Handle nested DEFINE <name> RECORD ... END RECORD inside FUNCTION
                // avoid matching 'DEFINE ... RECORD LIKE ...' which is a single-line alias
                const recDef = ln.match(/^DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
                if (recDef) {
                    const rname = recDef[1];
                    const rstart = i;
                    const recNode = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                    let k = i + 1;
                    while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                        const fldLn = stripInlineComment(lines[k]).trim();
                        const fld = fldLn.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                        if (fld)
                            pushVar(recNode, fld[1], fld[2] || '', k);
                        k++;
                    }
                    recNode.end = Math.max(k, rstart);
                    node.children = node.children || [];
                    node.children.push(recNode);
                    i = k + 1; // skip past END RECORD
                    continue;
                }
                const m = ln.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (m) {
                    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                    const typ = m[2] ? m[2].trim() : '';
                    names.forEach(n => pushVar(node, n, typ, i));
                }
                else {
                    const cont = ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (cont)
                        pushVar(node, cont[1], cont[2] || '', i);
                }
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        if (rm) {
            const name = rm[1];
            const start = i;
            const node = { kind: 'Report', name, start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+REPORT\b/i.test(stripInlineComment(lines[i]).trim())) {
                const lnRaw = lines[i];
                const ln = stripInlineComment(lnRaw).trim();
                // Handle nested DEFINE <name> RECORD ... END RECORD inside REPORT
                const recDef = ln.match(/^DEFINE\s+([A-Za-z0-9_]+)\s+RECORD(?!\s+LIKE)\b/i);
                if (recDef) {
                    const rname = recDef[1];
                    const rstart = i;
                    const recNode = { kind: 'Record', name: rname, start: rstart, end: rstart, children: [] };
                    let k = i + 1;
                    while (k < lines.length && !/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[k]).trim())) {
                        const fldLn = stripInlineComment(lines[k]).trim();
                        const fld = fldLn.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                        if (fld)
                            pushVar(recNode, fld[1], fld[2] || '', k);
                        k++;
                    }
                    recNode.end = Math.max(k, rstart);
                    node.children = node.children || [];
                    node.children.push(recNode);
                    i = k + 1; // skip past END RECORD
                    continue;
                }
                const controlLike = controlStartRegex.test(ln);
                const m = (!controlLike) && ln.match(/^DEFINE\s+(.+?)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (m) {
                    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
                    const typ = m[2] ? m[2].trim() : '';
                    names.forEach(n => pushVar(node, n, typ, i));
                }
                else {
                    const cont = (!controlLike) && ln.match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                    if (cont)
                        pushVar(node, cont[1], cont[2] || '', i);
                }
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        // inline record or type declarations
        // inline record or type declarations - but not 'RECORD LIKE ...'
        const rec = trimmed.match(/([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD(?!\s+LIKE)\b/i);
        if (rec) {
            const name = rec[1];
            const start = i;
            const node = { kind: 'Record', name, start, end: start, children: [] };
            i++;
            while (i < lines.length && !/^END\s+RECORD\b/i.test(stripInlineComment(lines[i]).trim())) {
                const fld = stripInlineComment(lines[i]).trim().match(/^([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i);
                if (fld)
                    pushVar(node, fld[1], fld[2] || '', i);
                i++;
            }
            node.end = Math.max(i, start);
            symbols.push(node);
            i++;
            continue;
        }
        i++;
    }
    return symbols;
}
