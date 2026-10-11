// In kết quả đọc Word/Excel của bản Node (JSON) để đối chiếu: node node_parse.cjs <word|excel> <tệp>
const fs = require('fs');
const path = require('path');
const { parseWordBuffer } = require('../../../ctgdmn-windows-fixed/electron/import-word.cjs');
const { parseExcelBuffer } = require('../../../ctgdmn-windows-fixed/electron/import-excel.cjs');
(async () => {
  const [kind, file] = process.argv.slice(2);
  const buffer = fs.readFileSync(file);
  const result = kind === 'word' ? await parseWordBuffer(buffer, path.basename(file)) : parseExcelBuffer(buffer, path.basename(file));
  process.stdout.write(JSON.stringify(result));
})();
