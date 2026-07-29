// ============================================================================
// CTGDMN — cầu nối tới máy chủ THẬT (thay thế bản chạy hoàn toàn trong trình
// duyệt). Tệp này giữ NGUYÊN chữ ký window.ctgdmnDesktop mà auth-client.js và
// app.js đang gọi — không cần sửa bất kỳ tệp giao diện nào khác.
//
// Khác với bản cũ (dữ liệu lưu trong localStorage của từng máy), mọi tài
// khoản, kế hoạch, nhận xét, nhật ký hoạt động và video hướng dẫn giờ được
// lưu trong cơ sở dữ liệu thật trên máy chủ (server/), dùng chung cho mọi
// người dùng/máy tính trong trường.
'use strict';

const API_BASE = '/api/ctgdmn';

async function apiFetch(path, { method = 'GET', token, body, isJsonBody = true } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isJsonBody && body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isJsonBody ? JSON.stringify(body) : body,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Máy chủ trả về lỗi (${res.status}).`);
  }
  return data;
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function readJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        resolve(JSON.parse(await file.text()));
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

function pickMp4File() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,.mp4';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null);
      input.remove();
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

function isSafeHttpsUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return false;
  }
}

window.ctgdmnDesktop = {
  platform: 'web-remote',

  // ---- Thiết lập lần đầu / đăng nhập / phiên ----
  needsFirstRunSetup: async () => {
    const r = await apiFetch('/auth/needs-setup');
    return r.needsSetup;
  },
  createFirstAdmin: async (username, password, fullName) => apiFetch('/auth/first-admin', { method: 'POST', body: { username, password, fullName } }),
  login: async (username, password) => apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
  logout: async (token) => apiFetch('/auth/logout', { method: 'POST', token }),
  whoAmI: async (token) => apiFetch('/auth/whoami', { token }),
  changePassword: async (token, currentPassword, newPassword) => apiFetch('/auth/change-password', { method: 'POST', token, body: { currentPassword, newPassword } }),

  // ---- Tài khoản ----
  listAccounts: async (token) => apiFetch('/accounts', { token }),
  createAccount: async (token, input) => apiFetch('/accounts', { method: 'POST', token, body: input }),
  setAccountLocked: async (token, targetUserId, locked) => apiFetch(`/accounts/${targetUserId}/lock`, { method: 'POST', token, body: { locked } }),
  adminResetPassword: async (token, targetUserId, temporaryPassword) => apiFetch(`/accounts/${targetUserId}/reset-password`, { method: 'POST', token, body: { temporaryPassword } }),

  // ---- Kế hoạch ----
  listPlans: async (token) => apiFetch('/plans', { token }),
  getPlan: async (token, planId) => apiFetch(`/plans/${planId}`, { token }),
  createPlan: async (token, input) => apiFetch('/plans', { method: 'POST', token, body: input }),
  updatePlanContent: async (token, planId, content) => apiFetch(`/plans/${planId}/content`, { method: 'PUT', token, body: { content } }),
  submitPlan: async (token, planId) => apiFetch(`/plans/${planId}/submit`, { method: 'POST', token }),
  commentPlan: async (token, planId, content) => apiFetch(`/plans/${planId}/comment`, { method: 'POST', token, body: { content } }),
  listComments: async (token, planId) => apiFetch(`/plans/${planId}/comments`, { token }),
  returnPlan: async (token, planId, note) => apiFetch(`/plans/${planId}/return`, { method: 'POST', token, body: { note } }),
  proposeNextStage: async (token, planId) => apiFetch(`/plans/${planId}/propose`, { method: 'POST', token }),
  approvePlan: async (token, planId) => apiFetch(`/plans/${planId}/approve`, { method: 'POST', token }),
  reviseApprovedPlan: async (token, planId) => apiFetch(`/plans/${planId}/revise`, { method: 'POST', token }),
  getPlanHistory: async (token, planId) => apiFetch(`/plans/${planId}/history`, { token }),
  markSignedExport: async (token, planId, fileInfo) => apiFetch(`/plans/${planId}/mark-signed-export`, { method: 'POST', token, body: { fileInfo } }),

  // ---- Nhật ký hoạt động ----
  listActivityLog: async (token, limit) => apiFetch(`/activity-log?limit=${limit || 200}`, { token }),

  // ---- Sao lưu / khôi phục / di chuyển dữ liệu cũ ----
  exportBackup: async (token) => {
    const backup = await apiFetch('/backup/export', { token });
    downloadJsonFile(`ctgdmn-sao-luu-${new Date().toISOString().slice(0, 10)}.json`, backup);
    return { ok: true };
  },
  restoreBackup: async (token) => {
    const backup = await readJsonFile();
    if (!backup) return { ok: false, canceled: true };
    await apiFetch('/backup/restore', { method: 'POST', token, body: { backup } });
    return { ok: true };
  },
  migrateLegacyLocalStorage: async (token, legacyExport) => apiFetch('/backup/migrate-legacy', { method: 'POST', token, body: { legacyExport } }),

  // ---- Video hướng dẫn ----
  listVideosForMe: async (token) => apiFetch('/videos/mine', { token }),
  listAllVideos: async (token) => apiFetch('/videos/all', { token }),
  addVideo: async (token, input) => apiFetch('/videos', { method: 'POST', token, body: input }),
  updateVideo: async (token, videoId, patch) => apiFetch(`/videos/${videoId}`, { method: 'PATCH', token, body: patch }),
  deleteVideo: async (token, videoId) => apiFetch(`/videos/${videoId}`, { method: 'DELETE', token }),
  openOnlineVideo: async (token, url) => {
    if (!token) throw new Error('Phiên làm việc đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.');
    if (!isSafeHttpsUrl(url)) throw new Error('Chỉ được mở liên kết HTTPS hợp lệ.');
    window.open(url, '_blank', 'noopener');
    return { ok: true };
  },
  pickOfflineVideoFile: async (token) => {
    const file = await pickMp4File();
    if (!file) return { ok: false, canceled: true };
    if (!file.name.toLowerCase().endsWith('.mp4')) throw new Error('Chỉ chấp nhận tệp .mp4.');
    const result = await apiFetch(`/videos/upload?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST', token, body: file, isJsonBody: false,
    });
    return { ok: true, ...result };
  },
  getOfflineVideoUrl: async (token, storedName) => {
    const res = await fetch(`${API_BASE}/videos/file/${encodeURIComponent(storedName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Không tìm thấy video trong kho học liệu.');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  deleteOfflineVideoFile: async (token, storedName) => apiFetch(`/videos/file/${encodeURIComponent(storedName)}`, { method: 'DELETE', token }),
};
