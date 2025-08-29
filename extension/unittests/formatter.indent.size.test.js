const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Formatter indentation options', function() {
  it('applies 3-space indentation when indent.size = 3 and useTabs = false', function() {
    const src = '\tIF a=b THEN\n\tLET x = 1\nEND IF\n';
    // request spaces of size 3
    const out = formatter.formatText(src, { keywordsUppercase: true, commentsStyle: 'preserve', indent: { useTabs: false, size: 3 } });
    const lines = out.split(/\r?\n/);
    // first non-empty line should start with 3 spaces (converted from tab)
    const first = lines.find(l => l.trim().length > 0);
    assert.ok(first.startsWith('   '), 'expected leading 3 spaces');
  });

  it('applies tabs when indent.useTabs = true', function() {
    const src = '    IF a=b THEN\n    LET x = 1\nEND IF\n';
    // request tabs
    const out = formatter.formatText(src, { keywordsUppercase: true, commentsStyle: 'preserve', indent: { useTabs: true, size: 3 } });
    const lines = out.split(/\r?\n/);
    const first = lines.find(l => l.trim().length > 0);
    assert.ok(first.startsWith('\t') || first.startsWith('\t\t'), 'expected leading tab(s)');
  });
});
