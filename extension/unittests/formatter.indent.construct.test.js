const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: CONSTRUCT and ON siblings', function() {
  it('keeps multiple ON blocks at same indentation level', function() {
    const src = 'CONSTRUCT BY NAME tm.wc\n  ON a\n    CALL do_one()\n  ON b\n    CALL do_two()\nEND CONSTRUCT\n';
    const out = formatter.formatText(src, { indent: { useTabs: false, size: 3 } });
    // ensure both CALL lines have same indent
    const matches = out.match(/CALL do_\w+\(\)/g) || [];
    assert.equal(matches.length, 2);
    assert.ok(/ON a\n\s{3}CALL do_one\(\)/.test(out));
    assert.ok(/ON b\n\s{3}CALL do_two\(\)/.test(out));
  });
});
