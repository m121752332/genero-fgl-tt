const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter indented comment behavior', function() {
  it('converts non-indented leading # to -- when dash selected', function() {
    const src = '# Sample loop\nIF a=b THEN\n  LET x = 1\nEND IF\n';
    const out = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: false });
    assert.ok(out.indexOf('-- Sample loop') !== -1, 'leading non-indented # -> -- expected');
  });

  it('converts indented leading # to -- when dash selected (replaceInline=false)', function() {
    const src = '    # Sample loop\n    IF a=b THEN\n        LET x = 1\n    END IF\n';
    const out = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: false });
    assert.ok(out.indexOf('-- Sample loop') !== -1 || out.indexOf('    -- Sample loop') !== -1, 'indented leading # -> -- expected');
  });

  it('does not convert inline # when replaceInline=false but does when true', function() {
    const src = 'LET x = 1  # inline comment\n';
    const outFalse = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: false });
    assert.ok(outFalse.indexOf('# inline comment') !== -1, 'inline preserved when replaceInline=false');
    const outTrue = formatter.formatText(src, { commentsStyle: 'dash', replaceInline: true });
    assert.ok(outTrue.indexOf('-- inline comment') !== -1, 'inline converted when replaceInline=true');
  });
});
