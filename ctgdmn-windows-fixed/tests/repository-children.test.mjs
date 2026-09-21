import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Repository } = require('../electron/repository.cjs');
const { ROLES } = require('../electron/security.cjs');

function withRepository(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-children-'));
  const repository = new Repository(path.join(directory, 'test.sqlite'));
  try {
    return run(repository);
  } finally {
    repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('mỗi giáo viên chỉ thấy hồ sơ trẻ và đánh giá do chính mình tạo', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacherA = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const teacherB = repository.createUser(admin, { username: 'giaovien.b', fullName: 'Giáo viên B', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });

    const childA = repository.upsertChild(teacherA, { fullName: 'Nguyễn Văn A', studentCode: 'HS001' });
    repository.upsertChild(teacherB, { fullName: 'Trần Thị B', studentCode: 'HS002' });

    assert.deepEqual(repository.listChildren(teacherA).map((child) => child.fullName), ['Nguyễn Văn A']);
    assert.deepEqual(repository.listChildren(teacherB).map((child) => child.fullName), ['Trần Thị B']);

    assert.throws(() => repository.upsertChildAssessment(teacherB, {
      childId: childA.id,
      domain: 'Giáo dục phát triển ngôn ngữ',
      level: 'Đạt',
      observation: 'Trẻ nói rõ ràng, mạch lạc.',
    }), /Không tìm thấy hồ sơ trẻ/);

    const assessment = repository.upsertChildAssessment(teacherA, {
      childId: childA.id,
      domain: 'Giáo dục phát triển ngôn ngữ',
      level: 'Đạt',
      observation: 'Trẻ nói rõ ràng, mạch lạc.',
    });
    assert.deepEqual(repository.listChildAssessments(teacherA, childA.id).map((item) => item.id), [assessment.id]);
    assert.throws(() => repository.listChildAssessments(teacherB, childA.id), /Không tìm thấy hồ sơ trẻ/);
    assert.deepEqual(repository.listChildAssessments(teacherB), []);
  });
});

test('không thể ghi nhận đánh giá với lĩnh vực hoặc mức độ không hợp lệ', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacher = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const child = repository.upsertChild(teacher, { fullName: 'Nguyễn Văn A' });
    assert.throws(() => repository.upsertChildAssessment(teacher, { childId: child.id, domain: 'Không có thật', level: 'Đạt' }), /Lĩnh vực phát triển không hợp lệ/);
    assert.throws(() => repository.upsertChildAssessment(teacher, { childId: child.id, domain: 'Giáo dục phát triển thể chất', level: 'Xuất sắc' }), /Mức độ đánh giá không hợp lệ/);
  });
});

test('vô hiệu hóa hồ sơ trẻ của người khác bị từ chối', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacherA = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const teacherB = repository.createUser(admin, { username: 'giaovien.b', fullName: 'Giáo viên B', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const child = repository.upsertChild(teacherA, { fullName: 'Nguyễn Văn A' });
    assert.throws(() => repository.deactivateChild(teacherB, child.id), /Không tìm thấy hồ sơ trẻ/);
    repository.deactivateChild(teacherA, child.id);
    assert.deepEqual(repository.listChildren(teacherA), []);
  });
});
