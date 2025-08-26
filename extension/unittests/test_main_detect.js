const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'codes', 'apmr901.4gl');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split(/\r?\n/);

const COMMENT_LINE = /^\s*#/;
const DOUBLE_DASH = /^\s*--/;
const reMainStart = /^\s*MAIN\b/i;

let found = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmedLine = line.trim();
  // mimic original skip logic
  if (COMMENT_LINE.test(trimmedLine) && trimmedLine.match(/^#/)) {
    // skipped as pure comment line
    continue;
  }
  const cleanedLine = line.replace(/#.*/g, '').replace(/--.*$/g, '').trim();
  if (reMainStart.test(cleanedLine)) {
    console.log('FOUND MAIN at line', i+1, 'original:', JSON.stringify(line), 'cleaned:', JSON.stringify(cleanedLine));
    found = true;
    break;
  }
}
if (!found) {
  console.log('MAIN not found by parser simulation');
  // print near lines where MAIN actually is in file
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*MAIN\b/i.test(lines[i])) {
      console.log('Raw MAIN line at', i+1, JSON.stringify(lines[i]));
    }
  }
}
