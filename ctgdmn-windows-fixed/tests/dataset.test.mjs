import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'program-index.json'), 'utf8'));

test('bộ dữ liệu có đủ 5 nhóm độ tuổi và 246 tài liệu', () => {
  assert.equal(data.ageGroups.length, 5);
  assert.equal(data.documents.length, 246);
  assert.equal(data.summary.pages, 3780);
});

test('mỗi tài liệu có định danh duy nhất và PDF nguồn tồn tại', () => {
  const ids = new Set(data.documents.map((item) => item.id));
  assert.equal(ids.size, data.documents.length);
  for (const document of data.documents) {
    assert.ok(document.title);
    assert.ok(document.fullText.length > 0);
    assert.ok(fs.existsSync(path.join(root, 'program-documents', document.relativePdfPath)), document.relativePdfPath);
  }
});

test('mọi cảnh báo đều trỏ tới tài liệu hợp lệ', () => {
  const ids = new Set(data.documents.map((item) => item.id));
  for (const issue of data.issues) assert.ok(ids.has(issue.documentId), issue.id);
});

test('kho 246 PDF nguồn hiện có vẫn được bảo toàn', () => {
  const sourceRoot = path.join(root, 'program-documents');
  const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]);
  const pdfFiles = walk(sourceRoot).filter((file) => path.extname(file).toLowerCase() === '.pdf');
  assert.equal(pdfFiles.length, 246);
  assert.ok(pdfFiles.every((file) => fs.statSync(file).size > 0));
});
