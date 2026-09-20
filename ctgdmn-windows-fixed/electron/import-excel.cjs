const XLSX = require('xlsx');
const { detectPersonalData } = require('./validation.cjs');

function parseExcelBuffer(buffer, filename = '') {
  const workbook = XLSX.read(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer), { type: 'buffer', cellDates: true, cellText: false, cellFormula: false });
  const sheets = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false, blankrows: true });
    const normalized = rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
    const preview = normalized.slice(0, 21);
    return { name, rowCount: normalized.length, headers: preview[0] || [], preview, rows: normalized };
  });
  return { filename, sheets, privacyWarnings: detectPersonalData(sheets.flatMap((sheet) => sheet.preview.flat()).join(' ')) };
}

module.exports = { parseExcelBuffer };
