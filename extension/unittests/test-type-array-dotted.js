const assert = require('assert');
const p = require('../src/parser.js');

const text = `DEFINE j_uni_numbers java.lang.String
TYPE t_cnum ARRAY [] OF java.lang.String
TYPE t_cx ARRAY [] OF INTEGER
`;

const syms = p.parseSymbols(text);
console.log('Parsed symbols:');
console.log(JSON.stringify(syms, null, 2));

function findByName(list, name) {
  for (const s of list) {
    if (s.name === name) return s;
    if (s.children) {
      const r = findByName(s.children, name);
      if (r) return r;
    }
  }
  return null;
}

const juni = findByName(syms, 'j_uni_numbers');
const tcnum = findByName(syms, 't_cnum');
const tcx = findByName(syms, 't_cx');

let ok = true;
if (!juni) { console.error('Missing j_uni_numbers'); ok = false; }
else if (!/java\.lang\.String/i.test(juni.detail || '')) { console.error('j_uni_numbers detail wrong:', juni.detail); ok = false; }

if (!tcnum) { console.error('Missing t_cnum'); ok = false; }
else if (!/ARRAY\s*\[\s*\]\s*OF\s*java\.lang\.String/i.test(tcnum.detail || '')) { console.error('t_cnum detail wrong:', tcnum.detail); ok = false; }

if (!tcx) { console.error('Missing t_cx'); ok = false; }
else if (!/ARRAY\s*\[\s*\]\s*OF\s*INTEGER/i.test(tcx.detail || '')) { console.error('t_cx detail wrong:', tcx.detail); ok = false; }

if (!ok) {
  console.error('TEST FAILED');
  process.exit(2);
}

console.log('TEST PASSED');
process.exit(0);
