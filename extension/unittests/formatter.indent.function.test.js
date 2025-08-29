const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: FUNCTION nesting', function() {
  it('preserves nested function indentation and keyword uppercasing', function() {
    const src = 'FUNCTION outer()\n  FUNCTION inner()\n    if 1 = 1 then\n      display "ok"\n    end if\n  END FUNCTION\nEND FUNCTION\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/FUNCTION outer\(\)/.test(out));
    assert.ok(/END FUNCTION/.test(out));
    assert.ok(/\n\s{3}FUNCTION inner\(\)/.test(out));
  });
});
