import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const { planTableXml, TemplateManager } = require('../electron/template-manager.cjs');

test('builds a dynamic weekly OOXML table with Monday through Friday', () => {
  const xml = planTableXml({
    level: 'weekly',
    weeklyRows: 'Hoạt động học | Thể dục | Văn học | Toán | Âm nhạc | Tạo hình',
  });
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /Thứ hai/);
  assert.match(xml, /Tạo hình/);
});

test('escapes user-authored content in custom DOCX tables', () => {
  const xml = planTableXml({
    level: 'annual',
    annualRows: 'Tháng 9 | Bé & trường | Mục tiêu < 1 | Nội dung | Hoạt động',
  });
  assert.match(xml, /Bé &amp; trường/);
  assert.match(xml, /Mục tiêu &lt; 1/);
  assert.doesNotMatch(xml, /Bé & trường/);
});

test('accepts a PLAN_TABLE marker split across Word text runs', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-template-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source.docx');
  const zip = new JSZip();
  zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>{{PLAN_</w:t></w:r><w:r><w:t>TABLE}}</w:t></w:r></w:p></w:body></w:document>');
  fs.writeFileSync(source, await zip.generateAsync({ type: 'nodebuffer' }));
  const manager = new TemplateManager(path.join(root, 'store'));
  const result = await manager.importTemplate(source, { type: 'weekly', name: 'Mẫu tuần' });
  assert.equal(result.templates.some((item) => item.name === 'Mẫu tuần'), true);
});
