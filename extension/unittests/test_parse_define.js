const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'codes', 'debug_record.4gl');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split(/\r?\n/);

// find first DEFINE line index
let idx = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*DEFINE\s+tm\b/i.test(lines[i])) { idx = i; break; }
}
if (idx === -1) { console.log('DEFINE tm not found'); process.exit(1); }

// emulate the updated block collection logic
const reNonDefineStmt = /^\s*(LET|MESSAGE|DISPLAY|PRINT|CALL|IF|ELSE|CASE|WHEN|FOR|FOREACH|WHILE|RETURN|OPEN|CLOSE|PREPARE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|INITIALIZE|CONSTRUCT|INPUT|MENU|PROMPT|SLEEP|ERROR|WARN|INFO|OPTIONS|GLOBALS)\b/i;
const reDefineContinuation = /^\s*(?:DEFINE\s+)?[A-Za-z0-9_,\s]+(?:\b(LIKE|STRING|INTEGER|DATE|CHAR|NUM|REAL|DECIMAL|FLOAT|SMALLINT|BIGINT|VARCHAR|NUMERIC|BOOLEAN)\b.*)?\s*,?\s*(?:#.*)?$/i;

const blockLines = [lines[idx]];
let j = idx;
while (j + 1 < lines.length) {
  const nxt = lines[j + 1];
  if (/^\s*(?:FUNCTION|REPORT|MAIN|IMPORT|DATABASE|GLOBALS|DEFINE|TYPE)\b/i.test(nxt)) break;
  if (reNonDefineStmt.test(nxt)) break;
  const isRecordLine = /\bRECORD\b/i.test(nxt) || /^\s*END\s+RECORD\b/i.test(nxt);
  const isCommentOnlyLine = /^\s*(?:#|--)\s*/.test(nxt);
  if (!isRecordLine && !isCommentOnlyLine && !reDefineContinuation.test(nxt.trim())) break;
  j++;
  blockLines.push(nxt);
}

console.log('Collected lines from', idx, 'to', j);
console.log('---- BLOCK START ----');
console.log(blockLines.join('\n'));
console.log('---- BLOCK END ----');

// check for RECORD and END RECORD presence
const hasEndRecord = blockLines.some(l => /^\s*END\s+RECORD\b/i.test(l));
console.log('Has END RECORD in collected block?', hasEndRecord);

// try parse record body similar to code: remove inline comments and filter
const cleanedLines = blockLines.map(l => l.replace(/#.*/g,'')).filter(l => l.trim().length > 0);
console.log('Cleaned lines count:', cleanedLines.length);

// find recordSegments
let k = 0;
const recordSegments = [];
while (k < cleanedLines.length) {
  const ln = cleanedLines[k].trim();
  const recStart = ln.match(/^(?:DEFINE\s+)?([A-Za-z0-9_]+)\s+(?:DYNAMIC\s+ARRAY\s+OF\s+)?RECORD\b/i);
  if (recStart) {
    const recName = recStart[1];
    if (/\bLIKE\b/i.test(ln)) {
      recordSegments.push({ name: recName, body: '' });
      k++;
      continue;
    }
    let bodyLines = [];
    k++;
    while (k < cleanedLines.length && !/^\s*END\s+RECORD\b/i.test(cleanedLines[k])) {
      bodyLines.push(cleanedLines[k]);
      k++;
    }
    if (k < cleanedLines.length && /^\s*END\s+RECORD\b/i.test(cleanedLines[k])) k++;
    recordSegments.push({ name: recName, body: bodyLines.join('\n') });
    continue;
  }
  k++;
}

console.log('recordSegments:', recordSegments.map(r => ({ name: r.name, bodyLines: r.body ? r.body.split('\n').length : 0 })));

if (recordSegments.length === 0) process.exit(2);
process.exit(0);
