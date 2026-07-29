// Quản lý phiên đăng nhập phía renderer. Token chỉ giữ trong bộ nhớ của
// tiến trình renderer (biến module), KHÔNG lưu vào localStorage/sessionStorage,
// để tránh lộ khi máy dùng chung. Mỗi lần mở lại ứng dụng phải đăng nhập lại.

const bridge = () => window.ctgdmnDesktop;

const session = { token: null, user: null };

export function currentUser() {
  return session.user;
}

export function currentToken() {
  return session.token;
}

export function isLoggedIn() {
  return Boolean(session.token && session.user);
}

export async function needsFirstRunSetup() {
  return bridge().needsFirstRunSetup();
}

export async function createFirstAdmin(username, password, fullName) {
  const result = await bridge().createFirstAdmin(username, password, fullName);
  session.token = result.token;
  session.user = result.user;
  return session.user;
}

export async function login(username, password) {
  const result = await bridge().login(username, password);
  if (!result.ok) {
    throw new Error(result.message || 'Đăng nhập không thành công.');
  }
  session.token = result.token;
  session.user = result.user;
  return session.user;
}

export async function logout() {
  if (session.token) {
    try { await bridge().logout(session.token); } catch { /* phiên có thể đã hết hạn */ }
  }
  session.token = null;
  session.user = null;
}

export async function refreshSession() {
  if (!session.token) return null;
  const result = await bridge().whoAmI(session.token);
  if (!result.ok) {
    session.token = null;
    session.user = null;
    return null;
  }
  session.user = result.user;
  return session.user;
}

export async function changeOwnPassword(currentPassword, newPassword) {
  return bridge().changePassword(session.token, currentPassword, newPassword);
}

// ---- Trợ giúp gọi API có gắn token hiện tại tự động ----------------------

function withToken(fn) {
  return (...args) => fn(session.token, ...args);
}

export const api = {
  listAccounts: withToken((token) => bridge().listAccounts(token)),
  createAccount: withToken((token, input) => bridge().createAccount(token, input)),
  setAccountLocked: withToken((token, id, locked) => bridge().setAccountLocked(token, id, locked)),
  adminResetPassword: withToken((token, id, temp) => bridge().adminResetPassword(token, id, temp)),

  listPlans: withToken((token) => bridge().listPlans(token)),
  getPlan: withToken((token, id) => bridge().getPlan(token, id)),
  createPlan: withToken((token, input) => bridge().createPlan(token, input)),
  updatePlanContent: withToken((token, id, content) => bridge().updatePlanContent(token, id, content)),
  submitPlan: withToken((token, id) => bridge().submitPlan(token, id)),
  commentPlan: withToken((token, id, content) => bridge().commentPlan(token, id, content)),
  listComments: withToken((token, id) => bridge().listComments(token, id)),
  returnPlan: withToken((token, id, note) => bridge().returnPlan(token, id, note)),
  proposeNextStage: withToken((token, id) => bridge().proposeNextStage(token, id)),
  approvePlan: withToken((token, id) => bridge().approvePlan(token, id)),
  reviseApprovedPlan: withToken((token, id) => bridge().reviseApprovedPlan(token, id)),
  getPlanHistory: withToken((token, id) => bridge().getPlanHistory(token, id)),
  markSignedExport: withToken((token, id, info) => bridge().markSignedExport(token, id, info)),

  listActivityLog: withToken((token, limit) => bridge().listActivityLog(token, limit)),

  exportBackup: withToken((token) => bridge().exportBackup(token)),
  restoreBackup: withToken((token) => bridge().restoreBackup(token)),
  migrateLegacyLocalStorage: withToken((token, legacy) => bridge().migrateLegacyLocalStorage(token, legacy)),

  listVideosForMe: withToken((token) => bridge().listVideosForMe(token)),
  listAllVideos: withToken((token) => bridge().listAllVideos(token)),
  addVideo: withToken((token, input) => bridge().addVideo(token, input)),
  updateVideo: withToken((token, id, patch) => bridge().updateVideo(token, id, patch)),
  deleteVideo: withToken((token, id) => bridge().deleteVideo(token, id)),
  openOnlineVideo: withToken((token, url) => bridge().openOnlineVideo(token, url)),
  pickOfflineVideoFile: withToken((token) => bridge().pickOfflineVideoFile(token)),
  getOfflineVideoUrl: withToken((token, storedName) => bridge().getOfflineVideoUrl(token, storedName)),
  deleteOfflineVideoFile: withToken((token, storedName) => bridge().deleteOfflineVideoFile(token, storedName)),
};

export const ROLE_LABELS = {
  admin: 'Quản trị hệ thống',
  principal: 'Hiệu trưởng',
  vice_principal: 'Phó hiệu trưởng chuyên môn',
  team_lead: 'Tổ trưởng chuyên môn',
  teacher: 'Giáo viên',
  viewer: 'Người xem',
};

export const PLAN_STATUS_LABELS = {
  draft: 'Bản nháp',
  submitted_to_lead: 'Đã gửi tổ trưởng',
  lead_commented: 'Tổ trưởng đã nhận xét',
  revising: 'Đang chỉnh sửa',
  submitted_to_academic: 'Đã gửi chuyên môn',
  academic_reviewed: 'Chuyên môn đã rà soát',
  submitted_for_approval: 'Chờ phê duyệt',
  approved: 'Đã phê duyệt',
};

export const VIDEO_CATEGORIES = [
  'Bắt đầu sử dụng',
  'Quản lý dữ liệu',
  'Xây dựng chương trình',
  'Soạn kế hoạch',
  'Nhận xét và phê duyệt',
  'Xuất Word/Excel',
  'AI và an toàn dữ liệu',
  'Quản trị hệ thống',
];
