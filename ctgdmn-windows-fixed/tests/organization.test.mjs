import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERNAL_SCHOOL_NAME, addProfessionalReview, buildTechnicalBackup, canApprovePlan, createPublicationSnapshot, deactivateClass, deactivateStaff, defaultSchoolProfile, migrateWorkspace, restoreTechnicalBackup, savePlanWithVersion, staffHasHistory, upsertClass, upsertStaff, validateLocalImage, validateSchool } from '../src/organization-utils.js';

test('thông tin bên trong mặc định là Trường Mầm non Hương Sen', () => {
  assert.equal(defaultSchoolProfile({ schoolName: 'Trường Mầm non Tràng Đà' }).name, INTERNAL_SCHOOL_NAME);
});

test('giữ mọi tên trường do người dùng đã sửa', () => {
  const migrated = migrateWorkspace({ schoolProfile: { name: 'Trường Mầm non Tràng Đà', userEdited: true } });
  const customized = migrateWorkspace({ schoolProfile: { name: 'Trường Mầm non Hoa Mai', userEdited: true } });
  assert.equal(migrated.schoolProfile.name, 'Trường Mầm non Tràng Đà');
  assert.equal(customized.schoolProfile.name, 'Trường Mầm non Hoa Mai');
});

test('sửa tên trường và dữ liệu hiển thị lấy từ hồ sơ', () => {
  const workspace = migrateWorkspace({}, { schoolName: 'Trường A' });
  workspace.schoolProfile.name = 'Trường B';
  assert.equal(workspace.schoolProfile.name, 'Trường B');
  assert.deepEqual(validateSchool(workspace.schoolProfile), []);
});

test('thêm, sửa và ngừng sử dụng lớp', () => {
  let classes = upsertClass([], { id:'l1', name:'Lá 1', ageGroup:'4–5 tuổi', schoolYear:'2026–2027' });
  classes = upsertClass(classes, { ...classes[0], name:'Lá A' });
  classes = deactivateClass(classes, 'l1');
  assert.equal(classes[0].name, 'Lá A'); assert.equal(classes[0].active, false);
});

test('thêm, sửa và ngừng sử dụng giáo viên', () => {
  let staff = upsertStaff([], { id:'gv1', name:'Nguyễn A', title:'Giáo viên', roles:['Người soạn'] });
  staff = upsertStaff(staff, { ...staff[0], team:'Tổ Mẫu giáo' });
  staff = deactivateStaff(staff, 'gv1');
  assert.equal(staff[0].team, 'Tổ Mẫu giáo'); assert.equal(staff[0].active, false);
});

test('không cho xóa giáo viên đã có lịch sử', () => {
  assert.equal(staffHasHistory({ plans:[{authorTeacherId:'gv1'}] }, 'gv1'), true);
  assert.equal(staffHasHistory({ plans:[] }, 'gv1'), false);
});

test('gắn lớp và giáo viên vào kế hoạch bằng ID', () => {
  const result = savePlanWithVersion({ plans:[], planVersions:[] }, { title:'Kế hoạch', classId:'l1', authorTeacherId:'gv1', collaboratingTeacherIds:['gv2'] });
  assert.equal(result.saved.classId, 'l1'); assert.equal(result.saved.authorTeacherId, 'gv1');
});

test('thêm nhận xét chuyên môn có phiên bản kế hoạch', () => {
  const reviews = addProfessionalReview([], { planId:'p1', planVersion:2, reviewerId:'cb1', reviewerNameSnapshot:'Cán bộ A', content:'Cần bổ sung', type:'Góp ý' });
  assert.equal(reviews[0].planVersion, 2); assert.equal(reviews[0].resolved, false);
});

test('chặn phê duyệt khi còn yêu cầu chỉnh sửa', () => {
  const reviews = addProfessionalReview([], { planId:'p1', reviewerId:'cb1', content:'Sửa mục tiêu', type:'Yêu cầu chỉnh sửa' });
  assert.equal(canApprovePlan('p1', reviews), false);
});

test('tạo phiên bản mới sau khi chỉnh sửa', () => {
  const workspace = { plans:[{id:'p1', title:'V1', version:1}], planVersions:[] };
  const result = savePlanWithVersion(workspace, { id:'p1', title:'V2' });
  assert.equal(result.saved.version, 2); assert.equal(result.planVersions[0].title, 'V1');
});

test('tải và kiểm tra ảnh chữ ký', () => {
  assert.equal(validateLocalImage({type:'image/png',size:2000,width:800,height:400}), true);
  assert.throws(() => validateLocalImage({type:'image/svg+xml',size:200}), /PNG hoặc JPG/);
  assert.throws(() => validateLocalImage({type:'image/jpeg',size:3*1024*1024}), /2 MB/);
});

test('không tự động chọn chữ ký khi migration hoặc phê duyệt', () => {
  const workspace = migrateWorkspace({ plans:[{id:'p1',status:'Đã phê duyệt'}] });
  assert.deepEqual(workspace.plans[0].signatureConfigurationIds, []);
});

test('snapshot xuất bản giữ tên cũ sau khi danh mục đổi tên', () => {
  const workspace = migrateWorkspace({ classes:[{id:'l1',name:'Lớp cũ'}], staff:[{id:'gv1',name:'Tên cũ',title:'Giáo viên'}] });
  const snapshot = createPublicationSnapshot(workspace, {classId:'l1',authorTeacherId:'gv1'}, ['gv1']);
  workspace.classes[0].name = 'Lớp mới'; workspace.staff[0].name = 'Tên mới';
  assert.equal(snapshot.classroom.name, 'Lớp cũ'); assert.equal(snapshot.people[0].name, 'Tên cũ');
});

test('sao lưu và khôi phục đầy đủ cấu hình', () => {
  const workspace = migrateWorkspace({ classes:[{id:'l1'}], staff:[{id:'gv1'}], signatures:[{id:'s1'}] }, {schoolName:'Trường A'});
  const restored = restoreTechnicalBackup(buildTechnicalBackup(workspace, {reviewed:['d1']}));
  assert.equal(restored.workspace.classes[0].id, 'l1'); assert.equal(restored.workspace.signatures[0].id, 's1'); assert.deepEqual(restored.review.reviewed, ['d1']);
});

test('migration bản sao lưu cũ chỉ cập nhật rà soát và giữ workspace hiện tại', () => {
  const current = migrateWorkspace({ classes:[{id:'lop-cu'}] });
  const restored = restoreTechnicalBackup({format:'ctgdmn-review-backup',review:{watch:['d1']}},{},current);
  assert.equal(restored.workspace.classes[0].id,'lop-cu'); assert.deepEqual(restored.review.watch,['d1']);
});
