import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Repository } = require('../electron/repository.cjs');

test('nhập nhiều tài khoản, bỏ qua trùng và không ghi mật khẩu vào nhật ký', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-account-import-'));
  const repository = new Repository(path.join(directory, 'test.sqlite'));
  const admin = repository.createFirstAdmin({ username:'admin', fullName:'Quản trị', password:'Admin!234' });
  const rows = [
    { username:'ctg001', fullName:'Nguyễn A', password:'Temp!2345', roles:['teacher'], team:'Trường A', title:'GV' },
    { username:'ctg002', fullName:'Trần B', password:'Temp!6789', roles:['team_lead','teacher'], team:'Trường B', title:'TTCM - GV' },
    { username:'ctg003', fullName:'Lê C', password:'Temp!9999', roles:['system_admin'], team:'Trường C', title:'Quản trị' },
  ];

  const first = repository.importUsers(admin, rows);
  assert.deepEqual({ created:first.created, skipped:first.skipped, errors:first.errors.length }, { created:2, skipped:0, errors:1 });
  assert.match(first.errors[0].error, /không được phép/i);
  const second = repository.importUsers(admin, rows.slice(0, 2));
  assert.deepEqual({ created:second.created, skipped:second.skipped }, { created:0, skipped:2 });

  const imported = repository.db.prepare("SELECT * FROM users WHERE username='ctg001'").get();
  assert.equal(imported.must_change_password, 1);
  assert.notEqual(imported.password_hash, 'Temp!2345');
  const audit = repository.db.prepare("SELECT details_json FROM audit_log WHERE action='account.import' ORDER BY id DESC").get();
  assert.doesNotMatch(audit.details_json, /Temp!|password/i);
  repository.close();
  fs.rmSync(directory, { recursive:true, force:true });
});
