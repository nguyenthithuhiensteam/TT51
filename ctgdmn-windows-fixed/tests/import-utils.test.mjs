import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportBatch, mapExcelRows, undoLastImport, validateMappedRecord } from '../src/import-utils.js';

test('ánh xạ cột Excel và phát hiện ID trùng', () => {
  const rows = [['Mã','Tuổi','Mục tiêu'],['a1','4–5 tuổi','Nhận biết cây'],['a1','4–5 tuổi','Phân loại lá']];
  const result = mapExcelRows(rows, { id:'Mã', ageGroup:'Tuổi', objective:'Mục tiêu' });
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].errors.join(' '), /ID trùng/);
});

test('phát hiện ID trùng với dữ liệu đã có', () => {
  const rows = [['ID','Tuổi','Nội dung'],['old-1','3–4 tuổi','Quan sát cây']];
  const result = mapExcelRows(rows, { id:'ID', ageGroup:'Tuổi', content:'Nội dung' }, ['old-1']);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].errors.join(' '), /ID trùng/);
});

test('phát hiện dòng trống và thiếu trường bắt buộc', () => {
  const rows = [['ID','Tuổi','Nội dung'],['','',''],['b1','','Quan sát lá']];
  const result = mapExcelRows(rows, { id:'ID', ageGroup:'Tuổi', content:'Nội dung' });
  assert.equal(result.skipped.length, 1);
  assert.match(result.rejected[0].errors.join(' '), /độ tuổi/);
  assert.match(validateMappedRecord({ id:'x', ageGroup:'4–5 tuổi' }).join(' '), /mục tiêu/);
});

test('từ chối riêng dòng thiếu dữ liệu bắt buộc', () => {
  assert.deepEqual(validateMappedRecord({ id:'x1', content:'Nội dung' }), ['Thiếu độ tuổi.']);
  assert.match(validateMappedRecord({ id:'x2', ageGroup:'5–6 tuổi' }).join(' '), /mục tiêu, nội dung hoặc hoạt động/);
});

test('hoàn tác lần nhập gần nhất không xóa dữ liệu cũ', () => {
  const original = { customRecords:[{id:'old'}], importHistory:[], importLog:[] };
  const imported = createImportBatch(original, [{id:'new',ageGroup:'4–5 tuổi',objective:'Mục tiêu'}], {filename:'data.xlsx',kind:'excel'}, 'batch-1');
  const result = undoLastImport(imported);
  assert.deepEqual(result.workspace.customRecords.map((item)=>item.id), ['old']);
  assert.equal(result.undone.batchId, 'batch-1');
});
