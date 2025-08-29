const assert = require('assert');
const fs = require('fs');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter basic behaviors', function() {
  it('uppercases keywords when enabled', function() {
    const src = 'function myFunc()\n  if x > 0 then\n    display "ok"\n  end if\nend function\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, commentsStyle: 'preserve' });
    assert.ok(out.indexOf('FUNCTION myFunc()') !== -1, 'FUNCTION uppercase expected');
    assert.ok(out.indexOf('IF x > 0 THEN') !== -1, 'IF/THEN uppercase expected');
  });

  it('preserves comments when preserve selected', function() {
    const src = '# comment\nLET x = 1  # inline\n';
    const out = formatter.formatText(src, { commentsStyle: 'preserve' });
    assert.ok(out.indexOf('# comment') !== -1, 'leading # preserved');
    assert.ok(out.indexOf('# inline') !== -1, 'inline # preserved');
  });

  it('converts line comments to dash when chosen', function() {
    const src = '# comment\nLET x = 1  # inline\n-- existing dash\n';
    const out = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: false });
    assert.ok(out.indexOf('-- comment') !== -1, 'leading # -> --');
    // inline should remain when replaceInline false
    assert.ok(out.indexOf('# inline') !== -1, 'inline preserved when replaceInline=false');
  });
});
