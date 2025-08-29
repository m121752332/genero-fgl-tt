const assert = require('assert');
const path = require('path');
const formatter = require(path.join('..','src','formatter'));

describe('Do not split CONTINUE/EXIT with WHILE/FOREACH/FOR', function() {
  it('keeps CONTINUE WHILE on one line', function() {
    const src = 'CONTINUE WHILE\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/CONTINUE WHILE/.test(out));
    assert.ok(!/CONTINUE\s*\n\s*WHILE/.test(out));
  });
  it('keeps EXIT WHILE on one line', function() {
    const src = 'EXIT WHILE\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/EXIT WHILE/.test(out));
    assert.ok(!/EXIT\s*\n\s*WHILE/.test(out));
  });
  it('keeps CONTINUE FOREACH on one line', function() {
    const src = 'CONTINUE FOREACH\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/CONTINUE FOREACH/.test(out));
  });
  it('keeps EXIT FOREACH on one line', function() {
    const src = 'EXIT FOREACH\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/EXIT FOREACH/.test(out));
  });
  it('keeps CONTINUE FOR on one line', function() {
    const src = 'CONTINUE FOR\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/CONTINUE FOR/.test(out));
  });
  it('keeps EXIT FOR on one line', function() {
    const src = 'EXIT FOR\n';
    const out = formatter.formatText(src, { keywordsUppercase: true, indent: { useTabs: false, size: 3 } });
    assert.ok(/EXIT FOR/.test(out));
  });
});
