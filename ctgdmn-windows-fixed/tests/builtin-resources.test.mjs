import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Repository } = require('../electron/repository.cjs');
const { trustedResourceUrl } = require('../electron/trusted-resources.cjs');

test('thêm video hướng dẫn một lần vào SQLite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-resources-'));
  const database = path.join(directory, 'test.sqlite');
  const first = new Repository(database);
  const video = first.db.prepare('SELECT * FROM videos WHERE id=?').get('builtin-video-ctgdmn-guide');
  assert.equal(video.url, 'https://www.youtube.com/watch?v=P5DgJHPLkDk');
  assert.equal(video.category, 'Bắt đầu sử dụng');
  first.db.prepare('DELETE FROM videos WHERE id=?').run(video.id);
  first.close();

  const reopened = new Repository(database);
  assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM videos WHERE id=?').get(video.id).n, 0);
  reopened.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('chỉ mở trợ lý AI có trong danh sách tin cậy', () => {
  assert.equal(
    trustedResourceUrl('preschool-teacher-assistant'),
    'https://chatgpt.com/g/g-68456c84ef908191876388962d011561-co-giao-mam-non',
  );
  assert.throws(() => trustedResourceUrl('https://example.com'), /danh sách được phép/i);
});
