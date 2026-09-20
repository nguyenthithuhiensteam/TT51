import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GUIDE_FILES, resolveGuidePath } = require('../electron/guide-files.cjs');
const projectRoot = path.resolve(import.meta.dirname, '..');
const guidesRoot = path.join(projectRoot, 'guides');

test('cả hai tài liệu hướng dẫn được đóng gói và có dữ liệu', () => {
  assert.deepEqual(Object.keys(GUIDE_FILES).sort(), ['docx', 'pdf']);
  for (const filename of Object.values(GUIDE_FILES)) {
    const file = path.join(guidesRoot, filename);
    assert.equal(fs.existsSync(file), true, `${filename} phải tồn tại`);
    assert.ok(fs.statSync(file).size > 10_000, `${filename} phải có dữ liệu`);
  }
});

test('chỉ chấp nhận định dạng hướng dẫn trong danh sách cho phép', () => {
  assert.equal(path.extname(resolveGuidePath(guidesRoot, 'pdf')), '.pdf');
  assert.equal(path.extname(resolveGuidePath(guidesRoot, 'docx')), '.docx');
  assert.throws(() => resolveGuidePath(guidesRoot, '../pdf'), /không hợp lệ/i);
  assert.throws(() => resolveGuidePath(guidesRoot, 'exe'), /không hợp lệ/i);
});
