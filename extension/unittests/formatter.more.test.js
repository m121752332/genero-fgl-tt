const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter additional edge cases', function() {
  it('does not treat # inside strings as comments', function() {
    const src = 'LET s = "this is not a #comment"\nLET x = 1  # real comment\n';
    const out = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: true });
    assert.ok(out.indexOf('"this is not a #comment"') !== -1, 'string content unchanged');
    assert.ok(out.indexOf('-- real comment') !== -1, 'inline comment converted to --');
  });

  it('preserves block comments { ... } intact', function() {
    const src = 'DISPLAY "start"\n{ this is a block comment # with symbols -- }\nDISPLAY "end"\n';
    const out = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: true });
    assert.ok(out.indexOf('{ this is a block comment') !== -1, 'block comment preserved');
  });
});
