const f = require('../src/formatter');
const full = `REPORT test_report(p_data)
--------格式前-----------------------------
        DEFINE a,b,c  INTEGER  -- 測試
        DEFINE p_data STRING
        DEFINE l_temp STRING
        DEFINE l_ac_t          LIKE type_file.num5,                 #未取消的ARRAY CNT  #No.FUN-690010 SMALLINT
                     l_n             LIKE type_file.num5,                 #處理狀態  #No.FUN-690010 VARCHAR(1)
                     l_allow_insert  LIKE type_file.chr1,                 #No.FUN-690010 VARCHAR(01),
                     l_allow_delete  LIKE type_file.chr1                  #No.FUN-690010 VARCHAR(01)
        DEFINE l_tc_rmidesc    LIKE tc_rmi_file.tc_rmidesc
--------格式後---------------------------
`;

// extract block between the two markers
const m = full.match(/--------格式前[\s\S]*?\n([\s\S]*?)\n--------格式後/);
if (!m) {
    console.error('Could not find markers in sample'); process.exit(1);
}
const originalBlock = m[1];
console.log('--- original block ---');
const origLines = originalBlock.split(/\r?\n/);
for (let i = 0; i < origLines.length; i++) console.log((i+1).toString().padStart(3,' ') + ': ' + origLines[i]);

const formatted = f.formatText(originalBlock, { commentsStyle: 'preserve', keywordsUppercase: false });
console.log('\n--- formatted block ---');
const fmtLines = formatted.split(/\r?\n/);
for (let i = 0; i < fmtLines.length; i++) console.log((i+1).toString().padStart(3,' ') + ': ' + fmtLines[i]);
console.log('\n--- end ---');
