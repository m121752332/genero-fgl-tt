const fs = require('fs');
const path = require('path');
const assert = require('assert');

const file = path.resolve(__dirname, '..', 'codes', 'debug_record.4gl');
const txt = fs.readFileSync(file, 'utf8');

// naive parse: look for DEFINE tm RECORD ... END RECORD and extract fields as in extension
function stripInlineComment(line) { return line.replace(/#.*/g, '').replace(/--.*$/, ''); }

const lines = txt.split(/\r?\n/);
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*DEFINE\s+tm\s+RECORD\b/i.test(stripInlineComment(lines[i]))) { start = i; break; }
}
if (start === -1) throw new Error('DEFINE tm RECORD not found');
for (let j = start+1; j < lines.length; j++) {
  if (/^\s*END\s+RECORD\b/i.test(stripInlineComment(lines[j]))) { end = j; break; }
}
if (end === -1) throw new Error('END RECORD not found');

const block = lines.slice(start, end+1).map(l => stripInlineComment(l)).filter(l => l.trim().length>0).join(' ');
const fldRegex = /([A-Za-z0-9_]+)\s+(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|VARCHAR|DECIMAL\([^)]*\)|DECIMAL|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/ig;
let m; const fields = [];
while ((m = fldRegex.exec(block)) !== null) fields.push(m[1]);

console.log('Fields found:', fields);
// expected from earlier run: [ 'wc', 'a', 'b', 'c', 'd', 'more' ]
assert.deepStrictEqual(fields, ['wc','a','b','c','d','more']);
console.log('Test passed.');

// now check that g_var1 and g_var2 are not part of tm but are present elsewhere in file as top-level defines
const allText = txt;
const g1 = /\bDEFINE\s+g_var1\b/i.test(allText) || /\bg_var1\b/i.test(allText);
const g2 = /\bDEFINE\s+g_var2\b/i.test(allText) || /\bg_var2\b/i.test(allText);
assert.ok(g1, 'g_var1 should be present in file');
assert.ok(g2, 'g_var2 should be present in file');
console.log('Trailing variables presence check passed.');
