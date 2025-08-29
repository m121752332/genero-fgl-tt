const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter FUNCTION block cases', function() {
  it('uppercases keywords inside FUNCTION block when enabled', function() {
    const src = 'FUNCTION myf()\n  define x integer\n  if x = 1 then\n    display "ok"\n  end if\nEND FUNCTION\n';
    const out = formatter.formatText(src, { keywordsUppercase: true });
    assert.ok(out.indexOf('FUNCTION myf()') !== -1);
    assert.ok(out.indexOf('END FUNCTION') !== -1);
    assert.ok(/\bIF\b/.test(out));
  });
});
