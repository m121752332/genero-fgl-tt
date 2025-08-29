// Load the TypeScript source directly so tests exercise the .ts changes
const f = require('../src/formatter.ts');
const assert = require('assert');

// Test: multiline DEFINE with continuation commas must preserve commas after formatting
const src = `MAIN
    DEFINE l_main_var       LIKE type_file.chr20
    DEFINE l_ac_t           LIKE type_file.num5,                 #未取消的ARRAY CNT  #No.FUN-690010 SMALLINT
           l_n              LIKE type_file.num5,                 #檢查重複用  #No.FUN-690010 SMALLINT
           l_lock_sw        LIKE type_file.chr1,                 #單身鎖住否  #No.FUN-690010 VARCHAR(1)
           p_cmd            LIKE type_file.chr1,                 #處理狀態  #No.FUN-690010 VARCHAR(1)
           l_allow_insert   LIKE type_file.chr1,                 #No.FUN-690010 VARCHAR(01)
           l_allow_delete   LIKE type_file.chr1
END MAIN
`;

const formatted = f.formatText(src, { commentsStyle: 'preserve', keywordsUppercase: false });
const lines = formatted.split(/\r?\n/).map(l => l.replace(/\s+$/,''));

// Without DEFINE-splitting, continuation variables remain on indented
// lines. Verify that for each declared variable (except the last), the
// corresponding output line still contains a comma to preserve continuation.
const vars = ['l_ac_t','l_n','l_lock_sw','p_cmd','l_allow_insert','l_allow_delete'];
for (let vi = 0; vi < vars.length; vi++) {
  const name = vars[vi];
  const found = lines.find(l => l.includes(name));
  if (!found) throw new Error('Missing variable in formatted output: ' + name);
  if (vi < vars.length - 1) {
    assert(/,/.test(found), 'Expected a comma for continuation variable ' + name + ' but line was: ' + found);
  }
}

console.log('formatter.define-commas.test.js: PASS');
