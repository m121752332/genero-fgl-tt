const assert = require('assert');
const fmt = require('../out/formatter') || require('../src/formatter');

describe('Keep CURSOR FOR together', function() {
  it('does not split CURSOR FOR across lines', function() {
    const src = "DECLARE clmp001_chk_cs1 CURSOR FOR select * from table\n";
    const out = fmt.formatText(src, { keywordsUppercase: false });
    // Expect "CURSOR FOR" to remain on same line
    assert.ok(/CURSOR\s+FOR/.test(out), 'Expected CURSOR FOR to remain on same line');
  });
});
