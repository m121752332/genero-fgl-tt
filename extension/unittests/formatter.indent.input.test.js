const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: INPUT and AFTER FIELD', function() {
  it('indents AFTER FIELD bodies under INPUT', function() {
    const src = 'INPUT BY NAME tm\n  AFTER FIELD a\n    DISPLAY "x"\n  BEFORE FIELD b\n    DISPLAY "y"\nEND INPUT\n';
    const out = formatter.formatText(src, { indent: { useTabs: false, size: 3 } });
    assert.ok(/AFTER FIELD a\n\s{3}DISPLAY/.test(out));
    assert.ok(/BEFORE FIELD b\n\s{3}DISPLAY/.test(out));
  });
});
