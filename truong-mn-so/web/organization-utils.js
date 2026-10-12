const clean = (value) => String(value ?? '').trim();
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const INTERNAL_SCHOOL_NAME = 'Trường Mầm non Số';

export const STAFF_ROLES = ['Người soạn', 'Giáo viên phối hợp', 'Tổ trưởng chuyên môn', 'Người nhận xét', 'Người duyệt', 'Cán bộ quản trị'];
export const SIGNATURE_ROLES = ['Người lập kế hoạch', 'Giáo viên phụ trách', 'Tổ trưởng chuyên môn', 'Phó hiệu trưởng', 'Hiệu trưởng'];
export const REVIEW_TYPES = ['Góp ý', 'Yêu cầu chỉnh sửa', 'Đồng ý', 'Đề nghị phê duyệt'];

export function defaultSchoolProfile(meta = {}) {
  return { id: 'school-main', name: INTERNAL_SCHOOL_NAME, governingBody: '', address: '', phone: '', email: '', schoolCode: '', schoolYear: '2026–2027', principal: '', vicePrincipal: '', signingPlace: '', logoData: '', userEdited: false, updatedAt: now() };
}

export function migrateWorkspace(workspace = {}, meta = {}) {
  const base = { edits: {}, customRecords: [], plans: [], sourceDocuments: [], importHistory: [], importLog: [] };
  const schoolProfile = { ...defaultSchoolProfile(meta), ...(workspace.schoolProfile || {}) };
  if (!schoolProfile.userEdited) {
    schoolProfile.name = INTERNAL_SCHOOL_NAME;
    schoolProfile.schoolYear = '2026–2027';
  }
  const plans = (workspace.plans || []).map((plan) => ({ version: 1, workflowStatus:'draft', schoolId: schoolProfile.id, classId: '', authorTeacherId: '', collaboratingTeacherIds: [], reviewerIds: [], approverId: '', signatureConfigurationIds: [], ...plan }));
  return { ...base, ...workspace, schemaVersion: 4, schoolProfile, plans, classes: workspace.classes || [], staff: workspace.staff || [], professionalReviews: workspace.professionalReviews || [], signatures: workspace.signatures || [], signatureLog: workspace.signatureLog || [], planVersions: workspace.planVersions || [], publicationSnapshots: workspace.publicationSnapshots || [], planStatusHistory: workspace.planStatusHistory || [] };
}

export function validateSchool(profile = {}) {
  const errors = [];
  if (!clean(profile.name)) errors.push('Tên trường là bắt buộc.');
  if (!clean(profile.schoolYear)) errors.push('Năm học mặc định là bắt buộc.');
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.push('Email không hợp lệ.');
  return errors;
}

export function upsertClass(classes = [], value = {}) {
  const item = { id: clean(value.id) || id('class'), name: clean(value.name), ageGroup: clean(value.ageGroup), schoolYear: clean(value.schoolYear), campus: clean(value.campus), childCount: Math.max(0, Number(value.childCount) || 0), leadTeacherId: clean(value.leadTeacherId), collaboratingTeacherIds: value.collaboratingTeacherIds || [], active: value.active !== false && value.active !== 'false', notes: clean(value.notes), updatedAt: now() };
  if (!item.name || !item.ageGroup || !item.schoolYear) throw new Error('Tên lớp, nhóm độ tuổi và năm học là bắt buộc.');
  const index = classes.findIndex((entry) => entry.id === item.id);
  return index < 0 ? [...classes, item] : classes.map((entry, position) => position === index ? { ...entry, ...item } : entry);
}

export function deactivateClass(classes = [], classId) {
  return classes.map((item) => item.id === classId ? { ...item, active: false, updatedAt: now() } : item);
}

export function upsertStaff(staff = [], value = {}) {
  const roles = Array.isArray(value.roles) ? value.roles : [value.role || 'Người soạn'];
  const item = { id: clean(value.id) || id('staff'), name: clean(value.name), title: clean(value.title), roles: roles.filter((role) => STAFF_ROLES.includes(role)), classIds: value.classIds || [], team: clean(value.team), active: value.active !== false && value.active !== 'false', contact: clean(value.contact), updatedAt: now() };
  if (!item.name || !item.title || !item.roles.length) throw new Error('Họ tên, chức vụ và ít nhất một vai trò là bắt buộc.');
  const index = staff.findIndex((entry) => entry.id === item.id);
  return index < 0 ? [...staff, item] : staff.map((entry, position) => position === index ? { ...entry, ...item } : entry);
}

export function deactivateStaff(staff = [], staffId) {
  return staff.map((item) => item.id === staffId ? { ...item, active: false, updatedAt: now() } : item);
}

export function staffHasHistory(workspace = {}, staffId) {
  return (workspace.plans || []).some((plan) => plan.authorTeacherId === staffId || plan.approverId === staffId || (plan.collaboratingTeacherIds || []).includes(staffId) || (plan.reviewerIds || []).includes(staffId)) || (workspace.professionalReviews || []).some((review) => review.reviewerId === staffId);
}

export function addProfessionalReview(reviews = [], value = {}) {
  const review = Object.freeze({ id: id('review'), planId: clean(value.planId), planVersion: Number(value.planVersion) || 1, reviewerId: clean(value.reviewerId), reviewerNameSnapshot: clean(value.reviewerNameSnapshot), reviewerRoleSnapshot: clean(value.reviewerRoleSnapshot), createdAt: now(), content: clean(value.content), type: REVIEW_TYPES.includes(value.type) ? value.type : 'Góp ý', resolved: false, response: '', resolvedAt: '' });
  if (!review.planId || !review.reviewerId || !review.content) throw new Error('Kế hoạch, người nhận xét và nội dung là bắt buộc.');
  return [...reviews, review];
}

export function resolveProfessionalReview(reviews = [], reviewId, response = '') {
  if (!clean(response)) throw new Error('Cần nhập phản hồi xử lý.');
  return reviews.map((review) => review.id === reviewId && !review.resolved ? { ...review, resolved: true, response: clean(response), resolvedAt: now() } : review);
}

export function canApprovePlan(planId, reviews = []) {
  return !reviews.some((review) => review.planId === planId && review.type === 'Yêu cầu chỉnh sửa' && !review.resolved);
}

export function savePlanWithVersion(workspace = {}, draft = {}) {
  const plans = [...(workspace.plans || [])];
  const index = plans.findIndex((plan) => plan.id === draft.id);
  if (index < 0) { const created = { ...draft, id: draft.id || id('plan'), version: 1, createdAt: now(), updatedAt: now() }; return { ...workspace, plans: [created, ...plans], saved: created }; }
  const previous = plans[index];
  const snapshot = { ...previous, snapshotAt: now() };
  const saved = { ...previous, ...draft, version: (Number(previous.version) || 1) + 1, updatedAt: now() };
  plans[index] = saved;
  return { ...workspace, plans, planVersions: [...(workspace.planVersions || []), snapshot], saved };
}

export function createPublicationSnapshot(workspace = {}, plan = {}, signerIds = []) {
  const school = workspace.schoolProfile || {};
  const classroom = (workspace.classes || []).find((item) => item.id === plan.classId) || {};
  const people = (workspace.staff || []).filter((item) => [plan.authorTeacherId, ...(plan.collaboratingTeacherIds || []), plan.approverId, ...signerIds].includes(item.id));
  return { createdAt: now(), school: { id: school.id, name: school.name, governingBody: school.governingBody, address: school.address }, classroom: { id: classroom.id, name: classroom.name, ageGroup: classroom.ageGroup }, people: people.map((person) => ({ id: person.id, name: person.name, title: person.title })) };
}

export function validateLocalImage(file = {}, options = {}) {
  const maxBytes = options.maxBytes || 2 * 1024 * 1024;
  const maxDimension = options.maxDimension || 2400;
  const type = clean(file.type).toLowerCase();
  if (!['image/png', 'image/jpeg'].includes(type)) throw new Error('Chỉ chấp nhận ảnh PNG hoặc JPG.');
  if (Number(file.size) > maxBytes) throw new Error(`Ảnh không được vượt quá ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  if (Number(file.width) > maxDimension || Number(file.height) > maxDimension) throw new Error(`Kích thước ảnh không được vượt quá ${maxDimension} × ${maxDimension} px.`);
  return true;
}

export function buildTechnicalBackup(workspace, review) {
  return { format: 'ctgdmn-technical-backup', version: 3, exportedAt: now(), workspace, review };
}

export function restoreTechnicalBackup(payload = {}, meta = {}, currentWorkspace = {}) {
  if (!['ctgdmn-technical-backup', 'ctgdmn-review-backup'].includes(payload.format)) throw new Error('Tệp không đúng định dạng sao lưu CTGDMN.');
  return { workspace: migrateWorkspace(payload.workspace || currentWorkspace, meta), review: payload.review || {} };
}
