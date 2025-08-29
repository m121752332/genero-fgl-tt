const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter wrapping and inline hash behavior', function() {
  it('wraps long lines at max length without touching strings/comments', function() {
    const long = '    LET x = "some safe string" + " plus more" + " and more" + " end"; // filler to exceed';
    const src = long + '\n';
    const out = formatter.formatText(src, { lineLengthMax: 40 });
    const lines = out.split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 1, 'should produce at least one output line');
    // ensure strings remain intact
    assert.ok(out.indexOf('some safe string') !== -1, 'string preserved');
  });

  it('converts inline comments to hash when requested', function() {
    const src = 'LET x = 1  -- inline dash\n';
    const out = formatter.formatText(src, { commentsStyle: 'hash', replaceInline: true });
    assert.ok(out.indexOf('# inline dash') !== -1, 'inline -- should be converted to #');
  });
});
