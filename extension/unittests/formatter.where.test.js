const assert = require('assert');
const fmt = require('../out/formatter') || require('../src/formatter');

describe('SELECT/WHERE indentation', function() {
  it('keeps WHERE on its own indented line (does not dedent to column 0)', function() {
    const src = "   IF g_bgjob = 'Y' THEN\n" +
                "         SELECT zz08 INTO l_cmd FROM zz_file\t#get exec cmd (fglgo xxxx)\n" +
                "          WHERE zz01='cxmr667'\n" +
                "   END IF\n";
    const out = fmt.formatText(src, { keywordsUppercase: false });
    // WHERE must appear on its own line and be indented (not at column 0)
    assert.ok(/\n\s+WHERE\b/.test(out), 'Expected WHERE to be on its own indented line');
  });
});
