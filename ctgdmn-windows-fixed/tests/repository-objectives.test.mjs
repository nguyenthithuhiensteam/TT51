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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctgdmn-objectives-'));
  const repository = new Repository(path.join(directory, 'test.sqlite'));
  try {
    return run(repository);
  } finally {
    repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('mỗi giáo viên chỉ thấy ngân hàng mục tiêu do chính mình tạo', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacherA = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const teacherB = repository.createUser(admin, { username: 'giaovien.b', fullName: 'Giáo viên B', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });

    repository.upsertObjective(teacherA, { ageGroup: '4–5 tuổi', code: 'MT1', domain: 'Giáo dục phát triển thể chất', description: 'Trẻ thực hiện được vận động cơ bản.' });
    repository.upsertObjective(teacherB, { ageGroup: '4–5 tuổi', code: 'MT1', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu của giáo viên B.' });

    assert.deepEqual(repository.listObjectives(teacherA, '4–5 tuổi').map((item) => item.description), ['Trẻ thực hiện được vận động cơ bản.']);
    assert.deepEqual(repository.listObjectives(teacherB, '4–5 tuổi').map((item) => item.description), ['Mục tiêu của giáo viên B.']);
  });
});

test('mã MT trùng trong cùng nhóm tuổi của cùng một giáo viên bị từ chối', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacher = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    repository.upsertObjective(teacher, { ageGroup: '4–5 tuổi', code: 'MT1', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu 1.' });
    assert.throws(() => repository.upsertObjective(teacher, { ageGroup: '4–5 tuổi', code: 'MT1', domain: 'Giáo dục phát triển nhận thức', description: 'Mục tiêu trùng mã.' }), /đã tồn tại/);
    // Cùng mã nhưng khác nhóm tuổi thì được phép.
    const other = repository.upsertObjective(teacher, { ageGroup: '3–4 tuổi', code: 'MT1', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu nhóm tuổi khác.' });
    assert.equal(other.code, 'MT1');
  });
});

test('nhóm nhà trẻ dùng khung 4 lĩnh vực, từ chối lĩnh vực của mẫu giáo', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacher = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const objective = repository.upsertObjective(teacher, { ageGroup: '25–36 tháng', code: 'MT1', domain: 'Giáo dục phát triển tình cảm, kỹ năng xã hội và thẩm mỹ', description: 'Mục tiêu nhà trẻ.' });
    assert.equal(objective.domain, 'Giáo dục phát triển tình cảm, kỹ năng xã hội và thẩm mỹ');
    assert.throws(() => repository.upsertObjective(teacher, { ageGroup: '25–36 tháng', code: 'MT2', domain: 'Giáo dục phát triển thẩm mỹ', description: 'Lĩnh vực mẫu giáo không hợp lệ cho nhà trẻ.' }), /không hợp lệ/);
  });
});

test('vô hiệu hóa mục tiêu của người khác bị từ chối', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacherA = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const teacherB = repository.createUser(admin, { username: 'giaovien.b', fullName: 'Giáo viên B', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const objective = repository.upsertObjective(teacherA, { ageGroup: '4–5 tuổi', code: 'MT1', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu A.' });
    assert.throws(() => repository.deactivateObjective(teacherB, objective.id), /Không tìm thấy mục tiêu/);
    repository.deactivateObjective(teacherA, objective.id);
    assert.deepEqual(repository.listObjectives(teacherA, '4–5 tuổi'), []);
  });
});
