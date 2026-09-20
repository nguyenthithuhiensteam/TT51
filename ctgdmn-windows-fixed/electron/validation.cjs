const path = require('path');

const IMPORT_EXTENSIONS = Object.freeze({
  word: ['.docx'],
  excel: ['.xlsx', '.xls'],
  pdf: ['.pdf'],
});
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

function allowedExtensions(kind) {
  return IMPORT_EXTENSIONS[kind] || [];
}

function validateImportFile(filename, size, kind) {
  const extension = path.extname(String(filename || '')).toLowerCase();
  if (!allowedExtensions(kind).includes(extension)) throw new Error(`Định dạng ${extension || '(không có)'} không được phép cho loại nhập này.`);
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) throw new Error('Tệp trống hoặc không đọc được.');
  if (Number(size) > MAX_IMPORT_BYTES) throw new Error('Tệp vượt quá giới hạn 25 MB.');
  return { extension, size: Number(size) };
}

function safeImportName(filename) {
  const base = path.basename(String(filename || '')).normalize('NFC');
  if (!base || /[<>:"/\\|?*\x00-\x1F]/.test(base)) throw new Error('Tên tệp không tương thích Windows.');
  return base;
}

function detectPersonalData(value) {
  const text = String(value || '');
  const warnings = [];
  if (/(?:^|\D)(?:\+?84|0)(?:[ .-]?\d){9,10}(?:\D|$)/.test(text)) warnings.push('Có thể chứa số điện thoại.');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) warnings.push('Có thể chứa địa chỉ email.');
  if (/(?:ngày\s*sinh|sinh\s*ngày)\s*[:：-]?\s*(?:0?[1-9]|[12]\d|3[01])[\/.\-](?:0?[1-9]|1[0-2])[\/.\-](?:19|20)?\d{2}/i.test(text)) warnings.push('Có thể chứa ngày sinh.');
  return warnings;
}

module.exports = { IMPORT_EXTENSIONS, MAX_IMPORT_BYTES, allowedExtensions, validateImportFile, safeImportName, detectPersonalData };
