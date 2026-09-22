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

test('mỗi giáo viên chỉ thấy MT riêng do chính mình tạo, cộng chung bộ MT dùng chung toàn trường', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacherA = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });
    const teacherB = repository.createUser(admin, { username: 'giaovien.b', fullName: 'Giáo viên B', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });

    repository.upsertObjective(teacherA, { ageGroup: '4–5 tuổi', code: 'RIENG-A', domain: 'Giáo dục phát triển thể chất', description: 'Trẻ thực hiện được vận động cơ bản.' });
    repository.upsertObjective(teacherB, { ageGroup: '4–5 tuổi', code: 'RIENG-B', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu của giáo viên B.' });

    const customA = repository.listObjectives(teacherA, '4–5 tuổi').filter((item) => item.scope === 'custom');
    const customB = repository.listObjectives(teacherB, '4–5 tuổi').filter((item) => item.scope === 'custom');
    assert.deepEqual(customA.map((item) => item.description), ['Trẻ thực hiện được vận động cơ bản.']);
    assert.deepEqual(customB.map((item) => item.description), ['Mục tiêu của giáo viên B.']);

    const systemForA = repository.listObjectives(teacherA, '4–5 tuổi').filter((item) => item.scope === 'system');
    const systemForB = repository.listObjectives(teacherB, '4–5 tuổi').filter((item) => item.scope === 'system');
    assert.ok(systemForA.length > 0, 'giáo viên A phải thấy bộ MT dùng chung toàn trường');
    assert.deepEqual(systemForA.map((item) => item.id), systemForB.map((item) => item.id));
  });
});

test('chỉ hiệu trưởng/quản trị mới thêm hoặc sửa được MT dùng chung toàn trường', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const teacher = repository.createUser(admin, { username: 'giaovien.a', fullName: 'Giáo viên A', password: 'MatKhau12345!', roles: [ROLES.TEACHER] });

    assert.throws(() => repository.upsertObjective(teacher, { ageGroup: '4–5 tuổi', code: 'HE-THONG-1', domain: 'Giáo dục phát triển thể chất', description: 'Giáo viên cố thêm MT dùng chung.', scope: 'system' }), /Chỉ hiệu trưởng/);

    const systemObjective = repository.upsertObjective(admin, { ageGroup: '4–5 tuổi', code: 'HE-THONG-1', domain: 'Giáo dục phát triển thể chất', description: 'MT dùng chung do quản trị thêm.', scope: 'system' });
    assert.equal(systemObjective.scope, 'system');

    assert.throws(() => repository.upsertObjective(teacher, { id: systemObjective.id, ageGroup: '4–5 tuổi', code: 'HE-THONG-1', domain: 'Giáo dục phát triển thể chất', description: 'Bị sửa trái phép.' }), /không có quyền sửa/);
    assert.throws(() => repository.deactivateObjective(teacher, systemObjective.id), /không có quyền xóa/);

    const updated = repository.upsertObjective(admin, { id: systemObjective.id, ageGroup: '4–5 tuổi', code: 'HE-THONG-1', domain: 'Giáo dục phát triển thể chất', description: 'Đã cập nhật bởi quản trị.' });
    assert.equal(updated.description, 'Đã cập nhật bởi quản trị.');
  });
});

test('ngân hàng mục tiêu chuẩn GDMN được nạp sẵn cho cả 4 nhóm tuổi, gồm lĩnh vực Tiếp cận với việc học ở 5-6 tuổi', () => {
  withRepository((repository) => {
    const admin = repository.createFirstAdmin({ username: 'admin1', fullName: 'Quản trị', password: 'MatKhau12345!' });
    const counts = {};
    for (const ageGroup of ['25–36 tháng', '3–4 tuổi', '4–5 tuổi', '5–6 tuổi']) {
      counts[ageGroup] = repository.listObjectives(admin, ageGroup).filter((item) => item.scope === 'system').length;
    }
    assert.deepEqual(counts, { '25–36 tháng': 43, '3–4 tuổi': 70, '4–5 tuổi': 103, '5–6 tuổi': 71 });
    const extraDomainCount = repository.listObjectives(admin, '5–6 tuổi').filter((item) => item.domain === 'Giáo dục phát triển tiếp cận với việc học').length;
    assert.equal(extraDomainCount, 7);
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
    const objective = repository.upsertObjective(teacherA, { ageGroup: '4–5 tuổi', code: 'RIENG-A', domain: 'Giáo dục phát triển thể chất', description: 'Mục tiêu A.' });
    assert.throws(() => repository.deactivateObjective(teacherB, objective.id), /Không tìm thấy mục tiêu/);
    repository.deactivateObjective(teacherA, objective.id);
    assert.deepEqual(repository.listObjectives(teacherA, '4–5 tuổi').filter((item) => item.scope === 'custom'), []);
  });
});
