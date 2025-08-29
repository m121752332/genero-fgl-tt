const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Indent: IF/ELSE blocks', function() {
  it('positions ELSE and ELSEIF at same level as IF', function() {
    const src = 'IF a = 1 THEN\n  display "one"\nELSEIF a = 2 THEN\n  display "two"\nELSE\n  display "other"\nEND IF\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    // ELSE should be at one level less than the inner lines
    assert.ok(/IF a = 1 THEN\n\s{3}DISPLAY/.test(out));
    assert.ok(/\nELSE\n\s{3}DISPLAY/.test(out));
  });
});
