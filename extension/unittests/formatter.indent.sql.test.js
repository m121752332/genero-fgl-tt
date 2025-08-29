const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: SQL / string continuation', function() {
  it('indents continuation lines for concatenated LET strings', function() {
    const src = 'LET g_sql = "a," ||\n"b," ||\n"c"\n';
    const out = formatter.formatText(src, { indent: { useTabs: false, size: 3 } });
    // second line should be indented more than the first
    const lines = out.split(/\r?\n/);
    assert.ok(lines[0].indexOf('LET g_sql') !== -1);
    assert.ok(/\s{3}\|\|/.test(lines[1]) || /\s{6}\|\|/.test(lines[1]));
  });
});
