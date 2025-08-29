const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: single-line IF expansion', function() {
  it('expands and indents single-line IF ... THEN ... END IF', function() {
    const src = 'IF  l_table1 = -1 THEN EXIT PROGRAM END IF\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    // Expect it to be split into three lines with proper indentation
    assert.ok(/IF\s+l_table1 = -1 THEN\n\s{3}EXIT PROGRAM\nEND IF/.test(out), 'Output did not match expected multi-line IF');
  });
});
