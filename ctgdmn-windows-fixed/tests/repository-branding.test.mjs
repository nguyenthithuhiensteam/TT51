import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Repository } = require('../electron/repository.cjs');

test('thương hiệu công khai đọc đúng tên trường đã lưu trong SQLite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-branding-'));
  const repository = new Repository(path.join(directory, 'test.sqlite'));
  try {
    assert.equal(repository.getPublicBranding().schoolName, 'Trường Mầm non Hương Sen');
    repository.setJson('workspace', {
      schoolProfile: {
        name: 'Trường Mầm non Hoa Mai',
        schoolYear: '2027–2028',
        address: 'Không được đưa ra màn hình đăng nhập',
      },
    });
    assert.deepEqual(repository.getPublicBranding(), {
      schoolName: 'Trường Mầm non Hoa Mai',
      schoolYear: '2027–2028',
    });
  } finally {
    repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
