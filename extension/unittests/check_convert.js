const p = require('../src/parser.js');
const fs = require('fs');
const path = require('path');
const txt = fs.readFileSync(path.join(__dirname, '..', 'codes', 'apmr901.4gl'), 'utf8');
const syms = p.parseSymbols(txt);

function convertPlain(sym) {
  const node = { kind: sym.kind, name: sym.name || sym.kind, start: sym.start, end: sym.end, children: [] };
  if (sym.children && sym.children.length) {
    for (const c of sym.children) node.children.push(convertPlain(c));
  }
  return node;
}

const funcs = syms.filter(s => s.kind === 'Function');
const apmr = funcs.find(f => f.name && f.name.toLowerCase()==='apmr901');
console.log(JSON.stringify(convertPlain(apmr), null, 2));
