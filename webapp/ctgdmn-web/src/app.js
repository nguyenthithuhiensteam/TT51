import { countBy, filterDocuments, normalizeText, paginate, reviewSummary, safeFilename } from './data-utils.js';
import * as auth from './auth-client.js';
import {
  RECORD_STATUS, createRecord, validateRecord, transitionRecord, bumpVersionAfterApprovedEdit,
  linkRecordToPlan, unlinkRecordFromPlan, resolveLinkedRecords, computeCoverageMatrix, buildWorkQueue,
} from './curriculum-utils.js';

const els = {
  app: document.querySelector('#app'),
  loading: document.querySelector('#loading'),
  authScreen: document.querySelector('#auth-screen'),
  authBody: document.querySelector('#auth-body'),
  authSchoolName: document.querySelector('#auth-school-name'),
  main: document.querySelector('#main-content'),
  nav: document.querySelector('.sidebar'),
  globalSearch: document.querySelector('#global-search'),
  issueBadge: document.querySelector('#issue-badge'),
  drawer: document.querySelector('#document-drawer'),
  drawerContent: document.querySelector('#drawer-content'),
  drawerBackdrop: document.querySelector('#drawer-backdrop'),
  toast: document.querySelector('#toast'),
  backupImport: document.querySelector('#backup-import'),
  openDataImport: document.querySelector('#open-data-import'),
  profileName: document.querySelector('#profile-name'),
  profileRole: document.querySelector('#profile-role'),
  profileAvatar: document.querySelector('#profile-avatar'),
  logoutButton: document.querySelector('#logout-button'),
};

// Danh sách route chỉ dành cho vai trò quản trị (ẩn khỏi menu cho vai trò
// khác để đỡ rối giao diện — quyền THẬT được kiểm tra lại ở tầng IPC/dữ
// liệu dù người dùng có cố mở route này bằng cách khác hay không).
const ADMIN_ONLY_ROUTES = new Set(['accounts', 'activity-log']);

const defaultReviewState = () => ({ reviewed: [], watch: [], notes: {}, resolvedIssues: [] });
const state = {
  data: null,
  route: 'dashboard',
  query: '',
  ageGroup: 'all',
  collection: 'all',
  page: 1,
  issueCategory: 'all',
  showResolved: false,
  review: loadReviewState(),
  workspace: loadWorkspace(),
  videoCategory: 'all',
  workflowPlanId: '',
  accountsMessage: '',
  aiRecordId: '',
  aiPromptDraft: null,
  aiSuggestion: null,
  aiSuggestionBusy: false,
  aiHealth: null,
  aiSettingsOpen: false,
  aiSettings: null,
};

function loadWorkspace() {
  try {
    const stored = JSON.parse(localStorage.getItem('ctgdmn-open-workspace-v1'));
    return { edits: {}, customRecords: [], plans: [], ...(stored || {}) };
  } catch { return { edits: {}, customRecords: [], plans: [] }; }
}

function saveWorkspace() {
  localStorage.setItem('ctgdmn-open-workspace-v1', JSON.stringify(state.workspace));
}

function loadReviewState() {
  try {
    const stored = JSON.parse(localStorage.getItem('ctgdmn-review-v1'));
    return { ...defaultReviewState(), ...(stored || {}) };
  } catch {
    return defaultReviewState();
  }
}

function saveReviewState() {
  localStorage.setItem('ctgdmn-review-v1', JSON.stringify(state.review));
  updateIssueBadge();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi'));
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

// ---- Đăng nhập / thiết lập lần đầu ---------------------------------------

function renderFirstRunSetupForm() {
  els.authBody.innerHTML = `
    <h1>Thiết lập tài khoản quản trị đầu tiên</h1>
    <p class="auth-hint">Đây là lần khởi động đầu tiên. Hãy tạo tài khoản quản trị hệ thống trước khi sử dụng ứng dụng.</p>
    <form id="setup-form" class="auth-form">
      <label class="field"><span>Họ và tên</span><input class="input" name="fullName" required autocomplete="name"></label>
      <label class="field"><span>Tên đăng nhập</span><input class="input" name="username" required autocomplete="username"></label>
      <label class="field"><span>Mật khẩu (tối thiểu 8 ký tự)</span>
        <div class="password-field"><input class="input" name="password" type="password" minlength="8" required autocomplete="new-password" id="setup-password"><button type="button" class="link-button" data-toggle-password="setup-password">Hiện</button></div>
      </label>
      <div id="auth-error" class="auth-error is-hidden"></div>
      <button class="primary-button" type="submit">Tạo tài khoản quản trị</button>
    </form>`;
}

function renderLoginForm(message = '') {
  els.authBody.innerHTML = `
    <h1>Đăng nhập</h1>
    <p class="auth-hint">Nhập tên đăng nhập và mật khẩu được cấp để vào ứng dụng.</p>
    <form id="login-form" class="auth-form">
      <label class="field"><span>Tên đăng nhập</span><input class="input" name="username" required autocomplete="username"></label>
      <label class="field"><span>Mật khẩu</span>
        <div class="password-field"><input class="input" name="password" type="password" required autocomplete="current-password" id="login-password"><button type="button" class="link-button" data-toggle-password="login-password">Hiện</button></div>
      </label>
      <div id="auth-error" class="auth-error ${message ? '' : 'is-hidden'}">${escapeHtml(message)}</div>
      <button class="primary-button" type="submit">Đăng nhập</button>
    </form>`;
}

function showAuthError(message) {
  const box = els.authBody.querySelector('#auth-error');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('is-hidden');
}

async function runAuthGate() {
  els.loading.classList.add('is-hidden');
  els.app.classList.add('is-hidden');
  els.authScreen.classList.remove('is-hidden');
  const needsSetup = await auth.needsFirstRunSetup();
  if (needsSetup) renderFirstRunSetupForm();
  else renderLoginForm();

  return new Promise((resolve) => {
    els.authScreen.addEventListener('submit', async function handler(event) {
      if (event.target.id === 'setup-form') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target));
        try {
          const user = await auth.createFirstAdmin(data.username, data.password, data.fullName);
          els.authScreen.removeEventListener('submit', handler);
          els.authScreen.classList.add('is-hidden');
          resolve(user);
        } catch (error) {
          showAuthError(error.message || 'Không thể tạo tài khoản quản trị.');
        }
      } else if (event.target.id === 'login-form') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target));
        try {
          const user = await auth.login(data.username, data.password);
          els.authScreen.removeEventListener('submit', handler);
          els.authScreen.classList.add('is-hidden');
          resolve(user);
        } catch (error) {
          showAuthError(error.message || 'Đăng nhập không thành công.');
        }
      }
    });
    els.authScreen.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-toggle-password]');
      if (!toggle) return;
      const input = document.querySelector(`#${toggle.dataset.togglePassword}`);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.textContent = showing ? 'Hiện' : 'Ẩn';
    });
  });
}

function applyRoleVisibility(user) {
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.classList.toggle('is-hidden', user.role !== 'admin');
  });
  els.profileName.textContent = user.fullName;
  els.profileRole.textContent = auth.ROLE_LABELS[user.role] || user.role;
  els.profileAvatar.textContent = (user.fullName || '?').trim().charAt(0).toUpperCase();
}

function openGuideCategory(category) {
  state.route = 'videos';
  state.videoCategory = category;
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
}

function updateIssueBadge() {
  if (!state.data) return;
  const resolved = new Set(state.review.resolvedIssues);
  els.issueBadge.textContent = state.data.issues.filter((item) => !resolved.has(item.id)).length;
}

function pageHead(eyebrow, title, description, action = '') {
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      ${action}
    </div>`;
}

function statCard(icon, label, value, note) {
  return `
    <article class="stat-card">
      <span class="stat-icon">${icon}</span>
      <div><span class="stat-label">${escapeHtml(label)}</span><b class="stat-value">${escapeHtml(value)}</b><small class="stat-note">${escapeHtml(note)}</small></div>
    </article>`;
}

function unresolvedIssues() {
  const resolved = new Set(state.review.resolvedIssues);
  return state.data.issues.filter((item) => !resolved.has(item.id));
}

function standardizedRecords() {
  // Chỉ các bản ghi do người dùng tạo/chuẩn hóa (mục tiêu-nội dung-hoạt động
  // riêng biệt) mới tham gia ma trận và quy trình rà soát. Tài liệu trích
  // xuất thô từ PDF vẫn dùng được để tra cứu nhưng không coi là 1 bản ghi
  // chuẩn hóa cho tới khi người dùng "Thêm dữ liệu" từ đó.
  return state.workspace.customRecords || [];
}

function standardizedPlans() {
  return state.workspace.plans || [];
}

function renderDashboard() {
  const records = standardizedRecords();
  const plans = standardizedPlans();
  const queue = buildWorkQueue({ records, plans, deadlineWithinDays: 7 });

  const cardRow = (icon, title, count, note, routeJump, extraAttrs = '') => `
    <button class="work-card" data-route-jump="${routeJump}" ${extraAttrs}>
      <span class="stat-icon">${icon}</span>
      <div><strong>${escapeHtml(title)}</strong><b>${count}</b><span>${escapeHtml(note)}</span></div>
    </button>`;

  els.main.innerHTML = `
    ${pageHead('Trung tâm công việc', 'Việc cần làm hôm nay', 'Bối cảnh → mục tiêu → nội dung → hoạt động → kế hoạch → minh chứng → rà soát → phê duyệt.', '<button class="primary-button" data-create-program>Tạo chương trình năm học 2026–2027</button>')}
    <section class="stats-grid work-queue-grid">
      ${cardRow('✎', 'Tiếp tục soạn', queue.continueDrafting.length, 'Kế hoạch chưa hoàn tất', 'planner')}
      ${cardRow('◎', 'Mục tiêu chưa phân bổ', queue.unassignedObjectives.length, 'Chưa gắn vào kế hoạch nào', 'matrix')}
      ${cardRow('✓', 'Chờ rà soát', queue.pendingReview.length, 'Đã gửi, chờ nhận xét', 'workflow-plans')}
      ${cardRow('!', 'Thiếu minh chứng', queue.missingEvidencePlans.length, 'Kế hoạch có mục tiêu chưa có minh chứng', 'matrix')}
      ${cardRow('⚠', 'Cảnh báo dữ liệu', queue.dataWarnings, 'Trùng lặp hoặc phân bổ quá nhiều', 'matrix')}
      ${cardRow('⏰', 'Gần đến hạn', queue.nearDeadline.length, 'Trong 7 ngày tới', 'planner')}
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-title-row"><div><h2>Kế hoạch đang soạn</h2><p class="panel-subtitle">Tiếp tục ngay từ đây.</p></div></div>
        <div class="document-list">${queue.continueDrafting.length ? queue.continueDrafting.map((p) => `
          <article class="document-card"><div class="doc-mark open">${escapeHtml((p.status || 'Bản nháp').slice(0,3).toUpperCase())}</div>
            <div><h3>${escapeHtml(p.title || 'Kế hoạch chưa đặt tên')}</h3><p>${escapeHtml(p.level || '')} • ${escapeHtml(p.status || RECORD_STATUS.DRAFT)}</p></div>
            <div class="doc-actions"><button class="small-button" data-edit-plan="${escapeHtml(p.id)}">Mở</button></div>
          </article>`).join('') : '<div class="empty-state">Chưa có kế hoạch đang soạn.</div>'}</div>
      </article>
      <article class="panel">
        <div class="panel-title-row"><div><h2>Tổng quan kho dữ liệu nguồn</h2><p class="panel-subtitle">246 PDF vẫn là nguồn đối chiếu, không bị thay đổi.</p></div><button class="secondary-button" data-route-jump="reports">Xem báo cáo</button></div>
        <div class="stats-grid">
          ${statCard('▤', 'TÀI LIỆU NGUỒN', formatNumber(state.data.summary.documents), '246 PDF gốc')}
          ${statCard('◫', 'BẢN GHI CHUẨN HÓA', formatNumber(records.length), 'Mục tiêu/nội dung/hoạt động riêng lẻ')}
          ${statCard('✎', 'KẾ HOẠCH', formatNumber(plans.length), 'Năm/tháng/chủ đề/tuần/ngày')}
        </div>
      </article>
    </section>`;
}

function openStandardizedRecordFromCard(recordId) {
  state.route = 'open-data';
  render();
  window.setTimeout(() => openRecordEditor(recordId), 0);
}

function openRecords() {
  const source = state.data.documents.map((doc) => ({
    id: doc.id, title: doc.title, ageGroup: doc.ageGroup, type: doc.documentType,
    topic: doc.collection, objective: '', content: doc.fullText, activity: '',
    evidence: '', sourceDocumentId: doc.id, sourcePage: '', status: 'Trích xuất – cần rà soát',
    ...(state.workspace.edits[doc.id] || {}),
  }));
  return [...state.workspace.customRecords, ...source];
}

function renderOpenData() {
  const records = openRecords();
  const q = normalizeText(state.query);
  const visible = records.filter((item) => !q || normalizeText(`${item.title} ${item.ageGroup} ${item.topic} ${item.objective} ${item.content}`).includes(q)).slice(0, 30);
  els.main.innerHTML = `
    ${pageHead('Dữ liệu làm việc', 'Kho dữ liệu mở', 'Dữ liệu có thể chỉnh sửa và xuất JSON/CSV. PDF chỉ là nguồn đối chiếu, không phải nơi lưu bản chỉnh sửa.', '<div class="button-row"><button class="ghost-button" data-open-guide="Quản lý dữ liệu">▶ Xem hướng dẫn</button><button class="secondary-button" data-import-open>Nhập JSON</button><button class="secondary-button" data-export-csv>Xuất CSV</button><button class="primary-button" data-new-record>Thêm dữ liệu</button></div>')}
    <div class="notice">Mọi bản sửa được lưu riêng trên máy. Trường “Nguồn” giúp truy ngược về PDF gốc; ứng dụng không ghi đè tài liệu nguồn.</div>
    <section class="toolbar"><label class="field" style="flex:1"><span>Tìm trong dữ liệu mở</span><input id="open-query" class="input" value="${escapeHtml(state.query)}" placeholder="Mục tiêu, nội dung, hoạt động..."></label><div class="result-count">${records.length} bản ghi</div></section>
    <section class="document-list">${visible.map((item) => `<article class="document-card"><div class="doc-mark open">DATA</div><div><h3>${escapeHtml(item.title || 'Bản ghi chưa đặt tên')}</h3><p>${escapeHtml((item.objective || item.content || '').slice(0, 240))}</p><div class="doc-meta"><span class="chip teal">${escapeHtml(item.ageGroup || 'Chưa chọn tuổi')}</span><span class="chip">${escapeHtml(item.type || 'Dữ liệu mở')}</span><span class="chip amber">${escapeHtml(item.status || 'Bản nháp')}</span></div></div><div class="doc-actions"><button class="small-button" data-edit-record="${escapeHtml(item.id)}">Chỉnh sửa</button><button class="small-button" data-use-record="${escapeHtml(item.id)}">Dùng soạn kế hoạch</button></div></article>`).join('')}</section>`;
}

function planTemplate(plan = {}) {
  return `<form id="plan-form" class="plan-form">
    <input type="hidden" name="id" value="${escapeHtml(plan.id || '')}">
    <label class="field"><span>Tên kế hoạch</span><input class="input" required name="title" value="${escapeHtml(plan.title || '')}" placeholder="Kế hoạch giáo dục..."></label>
    <div class="form-grid"><label class="field"><span>Cấp kế hoạch</span><select class="select" name="level">${['Năm','Tháng','Chủ đề','Tuần','Ngày/hoạt động'].map(v=>`<option ${plan.level===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Độ tuổi</span><select class="select" name="ageGroup">${state.data.ageGroups.map(a=>`<option ${plan.ageGroup===a.label?'selected':''}>${escapeHtml(a.label)}</option>`).join('')}</select></label><label class="field"><span>Năm học</span><input class="input" name="schoolYear" value="${escapeHtml(plan.schoolYear || '2026–2027')}"></label><label class="field"><span>Thời gian</span><input class="input" name="period" value="${escapeHtml(plan.period || '')}" placeholder="Tháng/tuần/từ ngày..."></label></div>
    <label class="field"><span>Căn cứ và đặc điểm tình hình</span><textarea name="context">${escapeHtml(plan.context || '')}</textarea></label>
    <label class="field"><span>Mục tiêu / yêu cầu cần đạt</span><textarea name="objectives">${escapeHtml(plan.objectives || '')}</textarea></label>
    <label class="field"><span>Nội dung và hoạt động</span><textarea name="activities">${escapeHtml(plan.activities || '')}</textarea></label>
    <div class="form-grid"><label class="field"><span>Môi trường và học liệu</span><textarea name="materials">${escapeHtml(plan.materials || '')}</textarea></label><label class="field"><span>Phân hóa/hỗ trợ</span><textarea name="differentiation">${escapeHtml(plan.differentiation || '')}</textarea></label></div>
    <label class="field"><span>Minh chứng, đánh giá và điều chỉnh</span><textarea name="assessment">${escapeHtml(plan.assessment || '')}</textarea></label>
    <label class="field"><span>Phối hợp cha mẹ trẻ</span><textarea name="family">${escapeHtml(plan.family || '')}</textarea></label>
    <div class="button-row"><button class="primary-button" type="submit">Lưu kế hoạch</button><button class="secondary-button" type="button" data-export-plans>Xuất toàn bộ JSON</button></div>
  </form>`;
}

function renderPlanner(editId = '') {
  const plan = state.workspace.plans.find((item) => item.id === editId) || {};
  els.main.innerHTML = `${pageHead('Công cụ chuyên môn', 'Soạn kế hoạch 2026–2027', 'Soạn theo cấu trúc mở; có thể tiếp tục chỉnh sửa, sao lưu và chuyển sang máy khác.', '<button class="ghost-button" data-open-guide="Soạn kế hoạch">▶ Xem hướng dẫn</button>')}
    <section class="planner-layout"><article class="panel">${planTemplate(plan)}</article><aside class="panel plan-list"><div class="panel-title-row"><div><h2>Kế hoạch đã lưu</h2><p class="panel-subtitle">${state.workspace.plans.length} kế hoạch trên máy</p></div></div>${state.workspace.plans.map(p=>`<button class="saved-plan" data-edit-plan="${p.id}"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.level)} • ${escapeHtml(p.ageGroup)} • ${escapeHtml(p.schoolYear)}</span></button>`).join('') || '<div class="empty-state">Chưa có kế hoạch.</div>'}</aside></section>`;
}

function recordStatusActions(item, isCustom) {
  if (!isCustom) return '';
  const actionsByStatus = {
    [RECORD_STATUS.DRAFT]: [['submit', 'Gửi rà soát']],
    [RECORD_STATUS.SUBMITTED]: [['review', 'Đánh dấu đã rà soát'], ['request_revision', 'Yêu cầu chỉnh sửa']],
    [RECORD_STATUS.NEEDS_REVISION]: [['submit', 'Gửi rà soát lại']],
    [RECORD_STATUS.REVIEWED]: [['approve', 'Phê duyệt'], ['request_revision', 'Yêu cầu chỉnh sửa']],
    [RECORD_STATUS.APPROVED]: [],
  };
  const actions = actionsByStatus[item.status] || [];
  if (!actions.length) return '';
  return `<div class="button-row" style="margin:10px 0">${actions.map(([transition, label]) =>
    `<button type="button" class="secondary-button" data-record-transition="${transition}" data-record-id="${escapeHtml(item.id)}">${label}</button>`
  ).join('')}</div>`;
}

function recordHistoryList(item) {
  if (!item.history?.length) return '';
  return `<h3 style="font-size:12px;margin-top:14px">Lịch sử rà soát (phiên bản ${item.version || 1})</h3>
    <div class="document-list">${item.history.slice().reverse().map((h) => `
      <article class="document-card"><div class="doc-mark">→</div><div><p>${escapeHtml(h.toStatus)}${h.note ? ` — ${escapeHtml(h.note)}` : ''}</p><div class="doc-meta"><span class="chip">${escapeHtml(h.actor || '')}</span><span class="chip">${escapeHtml(new Date(h.at).toLocaleString('vi-VN'))}</span></div></div></article>`).join('')}</div>`;
}

function openRecordEditor(id = '') {
  const existing = openRecords().find((record) => record.id === id);
  const isCustom = Boolean(id) && (existing ? state.workspace.customRecords.some((r) => r.id === id) : true);
  const item = existing || { ...createRecord({ ageGroup: state.data.ageGroups[0].label }, currentActorLabel()), id: `custom-${Date.now()}` };

  els.drawerContent.innerHTML = `
    <header class="drawer-header"><div><span class="chip teal">${isCustom ? 'BẢN GHI CHUẨN HÓA' : 'DỮ LIỆU MỞ'}</span><h2>${isCustom ? 'Mục tiêu / nội dung / hoạt động' : 'Chỉnh sửa bản ghi'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header>
    <div class="drawer-body">
      <form id="record-form" class="plan-form" data-is-custom="${isCustom ? '1' : '0'}">
        <input type="hidden" name="id" value="${escapeHtml(item.id)}">
        ${isCustom ? '' : `<label class="field"><span>Tiêu đề</span><input class="input" name="title" value="${escapeHtml(item.title || '')}" required></label>`}
        <div class="form-grid">
          <label class="field"><span>Độ tuổi</span><input class="input" name="ageGroup" value="${escapeHtml(item.ageGroup || '')}" required></label>
          <label class="field"><span>${isCustom ? 'Lĩnh vực phát triển' : 'Loại dữ liệu'}</span><input class="input" name="${isCustom ? 'domain' : 'type'}" value="${escapeHtml((isCustom ? item.domain : item.type) || '')}"></label>
        </div>
        <label class="field"><span>Chủ đề</span><input class="input" name="topic" value="${escapeHtml(item.topic || '')}"></label>
        <label class="field"><span>Mục tiêu/yêu cầu cần đạt</span><textarea name="objective" required>${escapeHtml(item.objective || '')}</textarea></label>
        <label class="field"><span>Nội dung giáo dục</span><textarea name="content" class="tall">${escapeHtml(item.content || '')}</textarea></label>
        <label class="field"><span>Hoạt động gợi ý</span><textarea name="activity">${escapeHtml(item.activity || '')}</textarea></label>
        ${isCustom ? `
        <div class="form-grid">
          <label class="field"><span>Môi trường và học liệu</span><textarea name="materials">${escapeHtml(item.materials || '')}</textarea></label>
          <label class="field"><span>Phân hóa/hỗ trợ</span><textarea name="differentiation">${escapeHtml(item.differentiation || '')}</textarea></label>
        </div>
        <label class="field"><span>Biểu hiện quan sát được</span><textarea name="observableSigns">${escapeHtml(item.observableSigns || '')}</textarea></label>` : ''}
        <label class="field"><span>Minh chứng${isCustom ? '' : '/đánh giá'}</span><textarea name="evidence">${escapeHtml(item.evidence || '')}</textarea></label>
        <div class="form-grid">
          <label class="field"><span>${isCustom ? 'Nguồn PDF đối chiếu' : 'Trang nguồn'}</span><input class="input" name="${isCustom ? 'sourcePdf' : 'sourcePage'}" value="${escapeHtml((isCustom ? item.sourcePdf : item.sourcePage) || '')}" ${isCustom ? 'required placeholder="Tên hoặc mã tài liệu PDF"' : ''}></label>
          ${isCustom ? `<label class="field"><span>Trang nguồn</span><input class="input" name="sourcePage" value="${escapeHtml(item.sourcePage || '')}" required placeholder="vd: 2 hoặc 2-4"></label>` : `<label class="field"><span>Trạng thái</span><select class="select" name="status">${['Bản nháp','Trích xuất – cần rà soát','Đã rà soát','Đã phê duyệt'].map(v=>`<option ${item.status===v?'selected':''}>${v}</option>`).join('')}</select></label>`}
        </div>
        ${isCustom ? `<div class="notice">Trạng thái hiện tại: <b>${escapeHtml(item.status || RECORD_STATUS.DRAFT)}</b> — dùng nút bên dưới để chuyển bước, không sửa trực tiếp.</div>` : ''}
        <div id="record-form-errors" class="auth-error is-hidden"></div>
        <button class="primary-button" type="submit">Lưu bản ghi</button>
      </form>
      ${isCustom ? recordStatusActions(item, isCustom) : ''}
      ${isCustom ? recordHistoryList(item) : ''}
    </div>`;
  els.drawerBackdrop.classList.remove('is-hidden'); els.drawer.classList.add('is-open'); els.drawer.setAttribute('aria-hidden','false');
}

function currentActorLabel() {
  const user = auth.currentUser();
  return user ? `${user.fullName} (${auth.ROLE_LABELS[user.role] || user.role})` : 'người dùng';
}

function typeRouteConfig(route) {
  const configs = {
    objectives: { type: 'Mục tiêu/kế hoạch chủ đề', title: 'Mục tiêu và kế hoạch chủ đề', description: 'Tra cứu mối liên hệ giữa mục tiêu giáo dục, nội dung và hoạt động theo từng chủ đề.' },
    monthly: { type: 'Kế hoạch tháng', title: 'Kế hoạch giáo dục tháng', description: 'Duyệt các kế hoạch tháng hiện có trong bộ hồ sơ nguồn.' },
    weekly: { type: 'Kế hoạch/giáo án tuần', title: 'Kế hoạch và giáo án tuần', description: 'Tra cứu kế hoạch chăm sóc, giáo dục và nội dung hoạt động hằng tuần.' },
  };
  return configs[route] || null;
}

function renderLibrary(route = 'library') {
  const locked = typeRouteConfig(route);
  const selectedType = locked?.type || 'all';
  const documents = filterDocuments(state.data.documents, {
    query: state.query,
    ageGroup: state.ageGroup,
    collection: state.collection,
    documentType: selectedType,
  });
  const result = paginate(documents, state.page, 12);
  state.page = result.page;
  const ageOptions = ['all', ...state.data.ageGroups.map((item) => item.label)];
  const collections = unique(state.data.documents
    .filter((item) => state.ageGroup === 'all' || item.ageGroup === state.ageGroup)
    .filter((item) => selectedType === 'all' || item.documentType === selectedType)
    .map((item) => item.collection));
  const typeOptions = ['all', ...unique(state.data.documents.map((item) => item.documentType))];
  const progress = new Set(state.review.reviewed);
  const watch = new Set(state.review.watch);

  els.main.innerHTML = `
    ${pageHead(locked ? 'Kế hoạch giáo dục' : 'Thư viện số', locked?.title || 'Kho chương trình và kế hoạch', locked?.description || 'Tìm kiếm toàn văn trong 246 PDF theo độ tuổi, chủ đề, tháng hoặc loại hồ sơ.', '<button class="secondary-button" data-clear-filters>Xóa bộ lọc</button>')}
    <section class="toolbar">
      <label class="field"><span>Từ khóa</span><input id="library-query" class="input" type="search" value="${escapeHtml(state.query)}" placeholder="Nhập tên chủ đề, mục tiêu, hoạt động..."></label>
      <label class="field"><span>Độ tuổi</span><select id="age-filter" class="select">${ageOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.ageGroup === value ? 'selected' : ''}>${value === 'all' ? 'Tất cả độ tuổi' : escapeHtml(value)}</option>`).join('')}</select></label>
      <label class="field"><span>Chủ đề / tháng</span><select id="collection-filter" class="select"><option value="all">Tất cả chủ đề/tháng</option>${collections.map((value) => `<option value="${escapeHtml(value)}" ${state.collection === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      ${locked ? `<div class="result-count">${documents.length} tài liệu</div>` : `<label class="field"><span>Loại hồ sơ</span><select id="type-filter" class="select">${typeOptions.map((value) => `<option value="${escapeHtml(value)}" ${selectedType === value ? 'selected' : ''}>${value === 'all' ? 'Tất cả loại hồ sơ' : escapeHtml(value)}</option>`).join('')}</select></label>`}
    </section>
    <div class="result-count" style="justify-content:flex-start;padding:0 0 10px">Hiển thị ${result.items.length} trong ${documents.length} tài liệu</div>
    <section class="document-list">
      ${result.items.length ? result.items.map((document) => documentCard(document, progress.has(document.id), watch.has(document.id))).join('') : '<div class="empty-state"><strong>Không tìm thấy tài liệu phù hợp</strong>Hãy thay đổi từ khóa hoặc xóa bớt bộ lọc.</div>'}
    </section>
    ${paginationHtml(result.page, result.totalPages)}`;
}

function documentCard(document, reviewed, watching) {
  return `
    <article class="document-card">
      <div class="doc-mark">PDF</div>
      <div>
        <h3>${escapeHtml(document.title)}</h3>
        <p>${escapeHtml(document.preview)}</p>
        <div class="doc-meta">
          <span class="chip teal">${escapeHtml(document.ageGroup)}</span>
          <span class="chip">${escapeHtml(document.collection)}</span>
          <span class="chip">${document.pageCount} trang</span>
          ${document.issueIds.length ? `<span class="chip amber">${document.issueIds.length} cảnh báo</span>` : ''}
          ${reviewed ? '<span class="chip teal">Đã rà soát</span>' : ''}
        </div>
      </div>
      <div class="doc-actions">
        <button class="small-button ${watching ? 'is-on' : ''}" data-watch-doc="${document.id}" title="Đánh dấu cần theo dõi">☆</button>
        <button class="small-button" data-open-doc="${document.id}">Xem chi tiết</button>
      </div>
    </article>`;
}

function paginationHtml(page, totalPages) {
  if (totalPages <= 1) return '';
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let value = start; value <= end; value += 1) pages.push(value);
  return `<nav class="pagination" aria-label="Phân trang">
    <button class="page-button" data-page="${Math.max(1, page - 1)}" ${page === 1 ? 'disabled' : ''}>‹</button>
    ${pages.map((value) => `<button class="page-button ${value === page ? 'is-active' : ''}" data-page="${value}">${value}</button>`).join('')}
    <button class="page-button" data-page="${Math.min(totalPages, page + 1)}" ${page === totalPages ? 'disabled' : ''}>›</button>
  </nav>`;
}

function renderReview() {
  const resolved = new Set(state.review.resolvedIssues);
  const categories = unique(state.data.issues.map((item) => item.category));
  const visible = state.data.issues
    .filter((item) => state.issueCategory === 'all' || item.category === state.issueCategory)
    .filter((item) => state.showResolved || !resolved.has(item.id));
  const documents = new Map(state.data.documents.map((item) => [item.id, item]));
  const counts = countBy(state.data.issues.filter((item) => !resolved.has(item.id)), 'category');

  els.main.innerHTML = `
    ${pageHead('Kiểm soát dữ liệu', 'Nội dung cần rà soát', 'Cảnh báo giúp phát hiện điểm bất thường; ứng dụng không tự động kết luận sai và không thay đổi PDF nguồn.', `<button class="secondary-button" data-toggle-resolved>${state.showResolved ? 'Ẩn việc đã xác nhận' : 'Hiện việc đã xác nhận'}</button>`)}
    <div class="notice" style="margin-bottom:16px">Cần kiểm tra trực tiếp trên PDF và đối chiếu với hồ sơ chính thức trước khi sửa mốc thời gian, người thực hiện hoặc loại hồ sơ.</div>
    <section class="review-layout">
      <aside class="review-filters">
        <h3>Nhóm cảnh báo</h3>
        <button class="filter-button ${state.issueCategory === 'all' ? 'is-active' : ''}" data-issue-category="all"><span>Tất cả</span><b>${unresolvedIssues().length}</b></button>
        ${categories.map((category) => `<button class="filter-button ${state.issueCategory === category ? 'is-active' : ''}" data-issue-category="${escapeHtml(category)}"><span>${escapeHtml(category)}</span><b>${counts[category] || 0}</b></button>`).join('')}
      </aside>
      <div>
        ${visible.length ? visible.map((item) => {
          const document = documents.get(item.documentId);
          const isResolved = resolved.has(item.id);
          return `<article class="issue-card ${item.severity}">
            <header><h3>${escapeHtml(item.title)}</h3><span class="chip ${isResolved ? 'teal' : 'amber'}">${isResolved ? 'Đã xác nhận' : escapeHtml(item.category)}</span></header>
            <p>${escapeHtml(item.detail)}</p>
            <footer><span>${escapeHtml(document?.title || 'Không xác định tài liệu')}</span><div class="button-row"><button class="small-button" data-open-doc="${item.documentId}">Xem PDF</button><button class="small-button ${isResolved ? 'is-on' : ''}" data-toggle-issue="${item.id}">${isResolved ? 'Bỏ xác nhận' : 'Đã kiểm tra'}</button></div></footer>
          </article>`;
        }).join('') : '<div class="empty-state"><strong>Không còn cảnh báo trong nhóm này</strong>Có thể bật “Hiện việc đã xác nhận” để xem lịch sử.</div>'}
      </div>
    </section>`;
}

function renderReports() {
  const summary = state.data.summary;
  const maxAge = Math.max(...state.data.ageGroups.map((item) => item.documents));
  const typeCounts = summary.typeCounts;
  const maxType = Math.max(...Object.values(typeCounts));
  const reviewed = new Set(state.review.reviewed);

  els.main.innerHTML = `
    ${pageHead('Báo cáo', 'Thống kê kho chương trình', 'Số liệu được tính trực tiếp từ 246 tài liệu PDF đã lập chỉ mục.', '<button class="secondary-button" data-export-report>Xuất báo cáo JSON</button>')}
    <section class="report-grid">
      <article class="panel"><div class="panel-title-row"><div><h2>Tài liệu theo độ tuổi</h2><p class="panel-subtitle">So sánh số tệp và số trang.</p></div></div><div class="bar-list">${state.data.ageGroups.map((age) => `<div class="bar-item"><label>${escapeHtml(age.label)}</label><div class="bar"><span style="width:${Math.round(age.documents / maxAge * 100)}%"></span></div><b>${age.documents}</b></div>`).join('')}</div></article>
      <article class="panel"><div class="panel-title-row"><div><h2>Tài liệu theo loại hồ sơ</h2><p class="panel-subtitle">Phân loại từ tên và nội dung phần đầu văn bản.</p></div></div><div class="bar-list">${Object.entries(typeCounts).map(([type, count]) => `<div class="bar-item"><label>${escapeHtml(type)}</label><div class="bar"><span style="width:${Math.round(count / maxType * 100)}%"></span></div><b>${count}</b></div>`).join('')}</div></article>
      <article class="panel" style="grid-column:1/-1"><div class="panel-title-row"><div><h2>Tổng hợp theo nhóm tuổi</h2><p class="panel-subtitle">Cơ sở để phân công rà soát và hoàn thiện dữ liệu.</p></div></div><table class="report-table"><thead><tr><th>Độ tuổi</th><th>Tài liệu</th><th>Trang</th><th>Chủ đề/tháng</th><th>Mục tiêu/chủ đề</th><th>Kế hoạch tháng</th><th>Kế hoạch tuần</th><th>Đã rà soát</th></tr></thead><tbody>${state.data.ageGroups.map((age) => `<tr><td><strong>${escapeHtml(age.label)}</strong></td><td>${age.documents}</td><td>${formatNumber(age.pages)}</td><td>${age.collections}</td><td>${age.objectives}</td><td>${age.monthlyPlans}</td><td>${age.weeklyPlans}</td><td>${state.data.documents.filter((item) => item.ageGroup === age.label && reviewed.has(item.id)).length}</td></tr>`).join('')}</tbody></table></article>
    </section>`;
}

function renderBackup() {
  const progress = reviewSummary(state.data.documents, state.review);
  els.main.innerHTML = `
    ${pageHead('Quản trị', 'Dữ liệu và sao lưu', 'Lưu trạng thái rà soát, tài liệu cần theo dõi và ghi chú cá nhân; PDF nguồn không bị thay đổi.')}
    <div class="backup-grid">
      <article class="panel"><div class="panel-title-row"><div><h2>Xuất bản sao trạng thái</h2><p class="panel-subtitle">Dùng để chuyển sang máy khác hoặc khôi phục khi cần.</p></div></div><p>${progress.reviewed} tài liệu đã rà soát, ${progress.watch} tài liệu đang theo dõi và ${Object.keys(state.review.notes).length} ghi chú.</p><div class="button-row"><button class="primary-button" data-export-backup>Xuất tệp sao lưu</button><button class="secondary-button" data-import-backup>Nhập tệp sao lưu</button></div></article>
      <article class="panel"><div class="panel-title-row"><div><h2>Nguyên tắc bảo toàn dữ liệu</h2><p class="panel-subtitle">Mọi thao tác trong phiên bản này đều có thể khôi phục.</p></div></div><div class="notice">Ứng dụng không ghi đè 246 PDF nguồn. Trạng thái rà soát được lưu riêng trên máy và có thể xuất thành tệp JSON.</div><div class="button-row" style="margin-top:16px"><button class="danger-button" data-reset-review>Xóa trạng thái rà soát trên máy</button></div></article>
    </div>`;
}

function renderAbout() {
  els.main.innerHTML = `
    ${pageHead('Thông tin', 'Ứng dụng CTGDMN', 'Bản thử nghiệm ngoại tuyến được xây dựng từ bộ hồ sơ chương trình và kế hoạch giáo dục nhà trường.')}
    <article class="panel" style="max-width:800px"><div class="panel-title-row"><div><h2>Phiên bản 0.2.0</h2><p class="panel-subtitle">Kho dữ liệu mở và công cụ soạn kế hoạch 2026–2027.</p></div><span class="chip teal">Ngoại tuyến</span></div>
      <ul class="about-list">
        <li><span>Đơn vị</span><strong>${escapeHtml(state.data.meta.schoolName)}</strong></li>
        <li><span>Năm học</span><strong>${escapeHtml(state.data.meta.schoolYear)}</strong></li>
        <li><span>Nguồn dữ liệu</span><strong>${escapeHtml(state.data.meta.sourceName)}</strong></li>
        <li><span>Quy mô</span><strong>${state.data.summary.documents} PDF • ${formatNumber(state.data.summary.pages)} trang • ${state.data.ageGroups.length} nhóm độ tuổi</strong></li>
        <li><span>Nguyên tắc</span><strong>${escapeHtml(state.data.meta.sourcePolicy)}</strong></li>
      </ul>
      <div class="notice" style="margin-top:18px">PDF được bảo toàn làm nguồn đối chiếu. Dữ liệu làm việc và kế hoạch được lưu riêng, có thể chỉnh sửa và xuất JSON/CSV để tránh phụ thuộc vào ứng dụng.</div>
    </article>`;
}

// ---- Tài khoản & phân quyền (chỉ quản trị; quyền kiểm tra ở tầng IPC) ----

async function renderAccounts() {
  const user = auth.currentUser();
  els.main.innerHTML = `${pageHead('Quản trị hệ thống', 'Tài khoản & phân quyền', 'Tạo tài khoản, gán vai trò, khóa/mở khóa và đặt lại mật khẩu tạm thời.')}<div class="notice">Đang tải danh sách tài khoản...</div>`;
  try {
    const accounts = await auth.api.listAccounts();
    const roleOptions = Object.entries(auth.ROLE_LABELS).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
    els.main.innerHTML = `
      ${pageHead('Quản trị hệ thống', 'Tài khoản & phân quyền', 'Tạo tài khoản, gán vai trò, khóa/mở khóa và đặt lại mật khẩu tạm thời. Quyền được kiểm tra ở tầng dữ liệu, không chỉ trên giao diện này.', '<button class="ghost-button" data-open-guide="Quản trị hệ thống">▶ Xem hướng dẫn</button>')}
      <section class="planner-layout">
        <article class="panel">
          <div class="panel-title-row"><h2>Tạo tài khoản mới</h2></div>
          <form id="create-account-form" class="plan-form">
            <label class="field"><span>Họ và tên</span><input class="input" name="fullName" required></label>
            <div class="form-grid">
              <label class="field"><span>Tên đăng nhập</span><input class="input" name="username" required></label>
              <label class="field"><span>Vai trò</span><select class="select" name="role">${roleOptions}</select></label>
            </div>
            <div class="form-grid">
              <label class="field"><span>Tổ chuyên môn (nếu có)</span><input class="input" name="teamId" placeholder="vd: to1"></label>
              <label class="field"><span>Mật khẩu tạm thời (≥ 8 ký tự)</span><input class="input" name="temporaryPassword" minlength="8" required></label>
            </div>
            <button class="primary-button" type="submit">Tạo tài khoản</button>
            <div class="notice">Người dùng bắt buộc đổi mật khẩu sau lần đăng nhập đầu tiên.</div>
          </form>
        </article>
        <aside class="panel plan-list">
          <div class="panel-title-row"><div><h2>Danh sách tài khoản</h2><p class="panel-subtitle">${accounts.length} tài khoản</p></div></div>
          ${accounts.map((account) => `
            <article class="saved-plan" style="align-items:flex-start">
              <div style="flex:1">
                <strong>${escapeHtml(account.fullName)}</strong>
                <span>${escapeHtml(account.username)} • ${escapeHtml(auth.ROLE_LABELS[account.role] || account.role)}</span>
                <span class="chip ${account.active ? 'teal' : 'coral'}" style="margin-top:6px;display:inline-block">${account.active ? 'Đang hoạt động' : 'Đã khóa'}</span>
              </div>
              <div class="button-row" style="margin-top:8px">
                <button class="small-button" data-toggle-lock="${account.id}" data-locked="${account.active ? '0' : '1'}">${account.active ? 'Khóa' : 'Mở khóa'}</button>
                <button class="small-button" data-reset-account="${account.id}">Đặt lại mật khẩu</button>
              </div>
            </article>`).join('')}
        </aside>
      </section>`;
  } catch (error) {
    els.main.innerHTML = `${pageHead('Quản trị hệ thống', 'Tài khoản & phân quyền', '')}<div class="notice">${escapeHtml(error.message)}</div>`;
  }
}

// ---- Nhật ký hoạt động ------------------------------------------------------

async function renderActivityLogPage() {
  els.main.innerHTML = `${pageHead('Quản trị hệ thống', 'Nhật ký hoạt động', 'Ghi lại đăng nhập, thay đổi quyền, thao tác kế hoạch và xuất tệp. Không chứa mật khẩu.')}<div class="notice">Đang tải nhật ký...</div>`;
  try {
    const log = await auth.api.listActivityLog(300);
    els.main.innerHTML = `
      ${pageHead('Quản trị hệ thống', 'Nhật ký hoạt động', 'Ghi lại đăng nhập, thay đổi quyền, thao tác kế hoạch và xuất tệp. Không chứa mật khẩu.')}
      <section class="document-list">
        ${log.length ? log.map((entry) => `
          <article class="document-card">
            <div class="doc-mark ${entry.result === 'success' ? 'open' : ''}">${entry.result === 'success' ? 'OK' : 'LỖI'}</div>
            <div>
              <h3>${escapeHtml(entry.action)}</h3>
              <p>${escapeHtml(entry.target || '')} ${entry.version ? `• phiên bản ${escapeHtml(entry.version)}` : ''}</p>
              <div class="doc-meta"><span class="chip">${escapeHtml(new Date(entry.created_at).toLocaleString('vi-VN'))}</span><span class="chip teal">${escapeHtml(entry.actor_id || 'hệ thống')}</span></div>
            </div>
          </article>`).join('') : '<div class="empty-state">Chưa có nhật ký.</div>'}
      </section>`;
  } catch (error) {
    els.main.innerHTML = `${pageHead('Quản trị hệ thống', 'Nhật ký hoạt động', '')}<div class="notice">${escapeHtml(error.message)}</div>`;
  }
}

// ---- Trung tâm video hướng dẫn ------------------------------------------------

function videoSourceButton(video) {
  if (video.sourceType === 'online') {
    return `<button class="small-button" data-open-online-video="${escapeHtml(video.sourceValue)}">Mở video</button>`;
  }
  return `<button class="small-button" data-play-offline-video="${escapeHtml(video.sourceValue)}">Phát video</button>`;
}

async function renderVideos() {
  const user = auth.currentUser();
  els.main.innerHTML = `${pageHead('Hướng dẫn sử dụng', 'Trung tâm video hướng dẫn', 'Video theo nhóm chức năng, phù hợp với vai trò của bạn.')}<div class="notice">Đang tải danh mục video...</div>`;
  try {
    const videos = await auth.api.listVideosForMe();
    const isOnline = navigator.onLine;
    const categories = ['all', ...auth.VIDEO_CATEGORIES];
    const visible = videos.filter((v) => state.videoCategory === 'all' || v.category === state.videoCategory);
    const isAdmin = user.role === 'admin';

    els.main.innerHTML = `
      ${pageHead('Hướng dẫn sử dụng', 'Trung tâm video hướng dẫn', 'Video theo nhóm chức năng, phù hợp với vai trò của bạn.', isAdmin ? '<button class="secondary-button" data-manage-videos>Quản lý video</button>' : '')}
      <div class="notice">${isOnline ? 'Trạng thái mạng: Trực tuyến — có thể mở video trực tuyến.' : 'Trạng thái mạng: Ngoại tuyến — chỉ phát được video đã tải sẵn trong máy.'}</div>
      <section class="toolbar">
        ${categories.map((cat) => `<button class="filter-button ${state.videoCategory === cat ? 'is-active' : ''}" data-video-category="${escapeHtml(cat)}">${cat === 'all' ? 'Tất cả' : escapeHtml(cat)}</button>`).join('')}
      </section>
      <section class="document-list">
        ${visible.length ? visible.map((video) => `
          <article class="document-card">
            <div class="doc-mark ${video.sourceType === 'online' ? '' : 'open'}">${video.sourceType === 'online' ? 'WEB' : 'MP4'}</div>
            <div>
              <h3>${escapeHtml(video.title)}</h3>
              <p>${escapeHtml(video.description || '')}</p>
              <div class="doc-meta"><span class="chip teal">${escapeHtml(video.category)}</span></div>
            </div>
            <div class="doc-actions">${video.sourceType === 'online' && !isOnline ? '<span class="chip amber">Cần kết nối Internet</span>' : videoSourceButton(video)}</div>
          </article>`).join('') : '<div class="empty-state">Chưa có video trong nhóm này.</div>'}
      </section>
      <div id="offline-video-player" class="panel is-hidden" style="margin-top:16px"></div>
      ${isAdmin ? await renderVideoAdminPanel() : ''}`;
  } catch (error) {
    els.main.innerHTML = `${pageHead('Hướng dẫn sử dụng', 'Trung tâm video hướng dẫn', '')}<div class="notice">${escapeHtml(error.message)}</div>`;
  }
}

async function renderVideoAdminPanel() {
  const all = await auth.api.listAllVideos();
  const categoryOptions = auth.VIDEO_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  return `
    <article class="panel" id="video-admin-panel" style="margin-top:20px">
      <div class="panel-title-row"><h2>Quản lý danh mục video (chỉ quản trị)</h2></div>
      <form id="add-video-form" class="plan-form">
        <label class="field"><span>Tiêu đề</span><input class="input" name="title" required></label>
        <label class="field"><span>Mô tả</span><textarea name="description"></textarea></label>
        <div class="form-grid">
          <label class="field"><span>Nhóm nội dung</span><select class="select" name="category">${categoryOptions}</select></label>
          <label class="field"><span>Loại nguồn</span><select class="select" name="sourceType" id="video-source-type"><option value="online">Trực tuyến (HTTPS)</option><option value="offline">Ngoại tuyến (MP4 trong máy)</option></select></label>
        </div>
        <label class="field" id="video-url-field"><span>URL HTTPS</span><input class="input" name="sourceValue" placeholder="https://..."></label>
        <div class="button-row" id="video-offline-pick-row" style="display:none"><button type="button" class="secondary-button" data-pick-offline-video>Chọn tệp MP4...</button><span id="offline-video-picked"></span></div>
        <button class="primary-button" type="submit">Thêm video</button>
      </form>
      <div class="document-list" style="margin-top:16px">
        ${all.map((video) => `
          <article class="document-card">
            <div class="doc-mark ${video.enabled ? '' : 'open'}">${video.enabled ? 'BẬT' : 'TẮT'}</div>
            <div><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.category)} · ${video.sourceType === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}</p></div>
            <div class="doc-actions">
              <button class="small-button" data-toggle-video-enabled="${video.id}" data-enabled="${video.enabled ? '0' : '1'}">${video.enabled ? 'Tắt' : 'Bật'}</button>
              <button class="small-button" data-delete-video="${video.id}">Xóa</button>
            </div>
          </article>`).join('') || '<div class="empty-state">Chưa có video nào.</div>'}
      </div>
    </article>`;
}

// ---- Quy trình kế hoạch (phân quyền theo vai trò, lưu bằng SQLite) --------

function planStatusChip(status) {
  const label = auth.PLAN_STATUS_LABELS[status] || status;
  const cls = status === 'approved' ? 'teal' : status === 'revising' ? 'coral' : 'amber';
  return `<span class="chip ${cls}">${escapeHtml(label)}</span>`;
}

async function renderWorkflowPlans() {
  const user = auth.currentUser();
  els.main.innerHTML = `${pageHead('Quy trình kế hoạch', 'Soạn – nhận xét – phê duyệt', 'Kế hoạch được lưu trong cơ sở dữ liệu có phân quyền, không phải localStorage.')}<div class="notice">Đang tải...</div>`;
  try {
    const plans = await auth.api.listPlans();
    const selected = plans.find((p) => p.id === state.workflowPlanId) || plans[0] || null;
    // Bản gốc chỉ chọn hiển thị mặc định plan đầu tiên nhưng không đồng bộ
    // state.workflowPlanId, khiến các nút hành động (nhận xét/gửi/duyệt...) gọi
    // API với id rỗng khi người dùng chưa bấm chọn kế hoạch trong danh sách.
    state.workflowPlanId = selected?.id || '';
    let comments = [];
    let history = [];
    if (selected) {
      comments = await auth.api.listComments(selected.id);
      history = await auth.api.getPlanHistory(selected.id);
    }
    const canCreate = user.role === 'teacher';
    const canEdit = selected && selected.ownerId === user.id && ['draft', 'revising'].includes(selected.status);
    const canSubmit = canEdit;
    const canComment = selected && ['principal', 'vice_principal', 'team_lead'].includes(user.role);
    const canPropose = selected && ['lead_commented', 'academic_reviewed'].includes(selected.status) && ['vice_principal', 'team_lead'].includes(user.role);
    const canApprove = selected && selected.status === 'submitted_for_approval' && user.role === 'principal' && selected.ownerId !== user.id;
    const canReturn = selected && canComment;

    els.main.innerHTML = `
      ${pageHead('Quy trình kế hoạch', 'Soạn – nhận xét – phê duyệt', 'Bản nháp → Gửi tổ trưởng → Nhận xét → Chỉnh sửa → Gửi chuyên môn → Rà soát → Trình phê duyệt → Đã phê duyệt.', `<div class="button-row"><button class="ghost-button" data-open-guide="Nhận xét và phê duyệt">▶ Xem hướng dẫn</button>${canCreate ? '<button class="primary-button" data-create-workflow-plan>Tạo kế hoạch mới</button>' : ''}</div>`)}
      <section class="planner-layout">
        <article class="panel">
          ${selected ? `
            <div class="panel-title-row"><div><h2>${escapeHtml(selected.title)}</h2><p class="panel-subtitle">Phiên bản ${selected.version}</p></div>${planStatusChip(selected.status)}</div>
            <label class="field"><span>Nội dung kế hoạch</span><textarea id="workflow-plan-content" class="tall" ${canEdit ? '' : 'disabled'}>${escapeHtml(selected.content?.text || '')}</textarea></label>
            <div class="button-row">
              ${canEdit ? '<button class="secondary-button" data-save-workflow-plan>Lưu nháp</button>' : ''}
              ${canSubmit ? '<button class="primary-button" data-submit-workflow-plan>Gửi rà soát</button>' : ''}
              ${canPropose ? '<button class="primary-button" data-propose-workflow-plan>Đề nghị chuyển bước tiếp theo</button>' : ''}
              ${canApprove ? '<button class="primary-button" data-approve-workflow-plan>Phê duyệt</button>' : ''}
              ${canReturn ? '<button class="secondary-button" data-return-workflow-plan>Trả lại yêu cầu chỉnh sửa</button>' : ''}
              ${selected.status === 'approved' && selected.ownerId === user.id ? '<button class="secondary-button" data-revise-workflow-plan>Sửa (tạo phiên bản mới)</button>' : ''}
            </div>
            <h3 style="margin-top:18px;font-size:13px">Nhận xét</h3>
            <div class="document-list">${comments.map((c) => `<article class="document-card"><div class="doc-mark open">GHI</div><div><p>${escapeHtml(c.content)}</p><div class="doc-meta"><span class="chip">${escapeHtml(new Date(c.created_at).toLocaleString('vi-VN'))}</span></div></div></article>`).join('') || '<div class="empty-state">Chưa có nhận xét.</div>'}</div>
            ${canComment ? `<label class="field" style="margin-top:12px"><span>Thêm nhận xét</span><textarea id="workflow-comment-input"></textarea></label><button class="secondary-button" data-add-workflow-comment>Gửi nhận xét</button>` : ''}
            <h3 style="margin-top:18px;font-size:13px">Lịch sử chuyển trạng thái</h3>
            <div class="document-list">${history.map((h) => `<article class="document-card"><div class="doc-mark">→</div><div><p>${escapeHtml(auth.PLAN_STATUS_LABELS[h.to_status] || h.to_status)}${h.note ? ` — ${escapeHtml(h.note)}` : ''}</p><div class="doc-meta"><span class="chip">${escapeHtml(new Date(h.created_at).toLocaleString('vi-VN'))}</span></div></div></article>`).join('')}</div>
          ` : '<div class="empty-state">Chưa có kế hoạch nào trong phạm vi của bạn.</div>'}
        </article>
        <aside class="panel plan-list">
          <div class="panel-title-row"><div><h2>Danh sách kế hoạch</h2><p class="panel-subtitle">${plans.length} kế hoạch trong phạm vi của bạn</p></div></div>
          ${plans.map((p) => `<button class="saved-plan" data-select-workflow-plan="${p.id}"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(auth.PLAN_STATUS_LABELS[p.status] || p.status)}</span></button>`).join('') || '<div class="empty-state">Không có kế hoạch.</div>'}
        </aside>
      </section>`;
  } catch (error) {
    els.main.innerHTML = `${pageHead('Quy trình kế hoạch', 'Soạn – nhận xét – phê duyệt', '')}<div class="notice">${escapeHtml(error.message)}</div>`;
  }
}

// ---- Ma trận chương trình -------------------------------------------------

function matrixWarningCard(icon, title, items, note, renderLabel) {
  return `
    <article class="panel">
      <div class="panel-title-row"><div><h2>${icon} ${escapeHtml(title)}</h2><p class="panel-subtitle">${escapeHtml(note)}</p></div><span class="chip ${items.length ? 'coral' : 'teal'}">${items.length}</span></div>
      <div class="document-list">${items.length ? items.slice(0, 8).map((entry) => renderLabel(entry)).join('') : '<div class="empty-state">Không có cảnh báo.</div>'}</div>
    </article>`;
}

function renderMatrix() {
  const records = standardizedRecords();
  const plans = standardizedPlans();
  const matrix = computeCoverageMatrix(records, plans);

  els.main.innerHTML = `
    ${pageHead('Xây dựng chương trình', 'Ma trận chương trình', 'Đối chiếu mục tiêu với kế hoạch theo tháng/chủ đề để phát hiện thiếu sót, trùng lặp hoặc quá tải.', '<button class="ghost-button" data-open-guide="Xây dựng chương trình">▶ Xem hướng dẫn</button>')}
    <section class="stats-grid">
      ${statCard('◎', 'TỔNG BẢN GHI CHUẨN HÓA', formatNumber(matrix.totalRecords), 'Mục tiêu/nội dung/hoạt động')}
      ${statCard('!', 'CHƯA PHÂN BỔ', formatNumber(matrix.unassignedCount), 'Chưa gắn vào kế hoạch nào')}
      ${statCard('⚠', 'PHÂN BỔ QUÁ NHIỀU', formatNumber(matrix.overAllocatedCount), 'Vượt ngưỡng dùng lại')}
      ${statCard('⧉', 'TRÙNG LẶP', formatNumber(matrix.duplicateCount), 'Cùng độ tuổi và mục tiêu')}
    </section>
    <article class="panel">
      <div class="panel-title-row"><h2>Mức bao phủ theo tháng/chủ đề</h2></div>
      <div class="bar-list">${matrix.coverageByMonth.length ? matrix.coverageByMonth.map((row) => `<div class="bar-item"><label>${escapeHtml(row.month)}</label><div class="bar"><span style="width:${Math.min(100, row.count * 10)}%"></span></div><b>${row.count}</b></div>`).join('') : '<div class="empty-state">Chưa có kế hoạch nào liên kết bản ghi.</div>'}</div>
    </article>
    <section class="dashboard-grid">
      ${matrixWarningCard('◎', 'Mục tiêu chưa phân bổ', matrix.unassigned, 'Nhấn để mở và gắn vào kế hoạch.', (r) => `<article class="document-card"><div class="doc-mark">${escapeHtml((r.ageGroup||'').slice(0,2))}</div><div><h3>${escapeHtml(r.objective || 'Chưa đặt tên')}</h3><p>${escapeHtml(r.topic || '')}</p></div><div class="doc-actions"><button class="small-button" data-open-standard-record="${escapeHtml(r.id)}">Mở</button></div></article>`)}
      ${matrixWarningCard('⚠', 'Phân bổ quá nhiều', matrix.overAllocated, 'Có thể đang lặp lại một mục tiêu quá nhiều lần.', (r) => `<article class="document-card"><div class="doc-mark open">${escapeHtml((r.ageGroup||'').slice(0,2))}</div><div><h3>${escapeHtml(r.objective || '')}</h3></div><div class="doc-actions"><button class="small-button" data-open-standard-record="${escapeHtml(r.id)}">Mở</button></div></article>`)}
      ${matrixWarningCard('!', 'Thiếu minh chứng đánh giá', matrix.missingEvidence, 'Đã dùng trong kế hoạch nhưng chưa có minh chứng.', (r) => `<article class="document-card"><div class="doc-mark">${escapeHtml((r.ageGroup||'').slice(0,2))}</div><div><h3>${escapeHtml(r.objective || '')}</h3></div><div class="doc-actions"><button class="small-button" data-open-standard-record="${escapeHtml(r.id)}">Mở</button></div></article>`)}
      ${matrixWarningCard('⧉', 'Nội dung trùng lặp', matrix.duplicates, 'Hai bản ghi có cùng độ tuổi và mục tiêu.', ([firstId]) => {
        const record = records.find((r) => r.id === firstId);
        return `<article class="document-card"><div class="doc-mark">${escapeHtml((record?.ageGroup||'').slice(0,2))}</div><div><h3>${escapeHtml(record?.objective || '')}</h3></div><div class="doc-actions"><button class="small-button" data-open-standard-record="${escapeHtml(firstId)}">Mở</button></div></article>`;
      })}
    </section>`;
}

// ---- AI và nguồn trực tuyến -------------------------------------------------

const AI_SERVICES = [
  { key: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com' },
  { key: 'gemini', label: 'Gemini', url: 'https://gemini.google.com' },
  { key: 'copilot', label: 'Microsoft Copilot', url: 'https://copilot.microsoft.com' },
];

const PII_PATTERNS = [
  { label: 'số điện thoại', regex: /(0|\+84)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/ },
  { label: 'email', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { label: 'ngày sinh', regex: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/ },
];

function detectPii(text) {
  return PII_PATTERNS.filter((p) => p.regex.test(text || '')).map((p) => p.label);
}

// Gọi máy chủ AI thật (kết nối trực tiếp, khác với luồng copy-paste thủ công
// phía trên). Token lấy từ phiên đăng nhập hiện tại, không lưu riêng.
let aiSuggestionController = null;

const ctgdmnAi = {
  async request(path, { method = 'GET', body, signal } = {}) {
    const token = auth.currentToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`/api/ctgdmn/ai${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Máy chủ AI trả về lỗi (${res.status}).`);
    return data;
  },
  getSettings() { return this.request('/settings'); },
  saveSettings(payload) { return this.request('/settings', { method: 'POST', body: payload }); },
  health() { return this.request('/health'); },
  suggest(payload, signal) { return this.request('/suggest', { method: 'POST', body: payload, signal }); },
};

const AI_STATUS_LABELS = {
  connected: 'Đã kết nối',
  not_connected: 'Chưa kết nối',
  invalid_key: 'Khóa không hợp lệ',
  quota_exceeded: 'Hết hạn mức',
  network_error: 'Lỗi mạng',
  error: 'Lỗi',
};

async function refreshAiHealth() {
  try {
    state.aiHealth = await ctgdmnAi.health();
  } catch (error) {
    state.aiHealth = { status: 'error', message: error.message };
  }
  renderAiTools();
}

function buildAiPrompt(record) {
  if (!record) return '';
  return [
    '[AI đề xuất – cần giáo viên rà soát trước khi sử dụng]',
    `Độ tuổi: ${record.ageGroup || ''}`,
    `Mục tiêu/yêu cầu cần đạt: ${record.objective || ''}`,
    `Nội dung hiện có: ${record.content || ''}`,
    `Hoạt động hiện có: ${record.activity || ''}`,
    '',
    'Hãy gợi ý thêm hoạt động phù hợp, KHÔNG đưa họ tên, ngày sinh, hình ảnh hoặc thông tin nhận dạng của trẻ vào câu trả lời.',
  ].join('\n');
}

function aiStatusChipClass(status) {
  if (status === 'connected') return 'teal';
  if (status === 'not_connected') return 'amber';
  return 'coral';
}

function renderAiConnectionCard() {
  const user = auth.currentUser();
  const isAdmin = user?.role === 'admin';
  const health = state.aiHealth;
  const settings = state.aiSettings;
  return `
    <article class="panel">
      <div class="panel-title-row"><div><h2>Kết nối AI trực tiếp</h2><p class="panel-subtitle">Máy chủ gọi thẳng tới nhà cung cấp AI đã cấu hình — khóa API không lưu trong trình duyệt.</p></div>
        ${health ? `<span class="chip ${aiStatusChipClass(health.status)}">${escapeHtml(AI_STATUS_LABELS[health.status] || health.status)}</span>` : ''}
      </div>
      ${health ? `<div class="notice">${escapeHtml(health.message || '')}</div>` : '<div class="notice">Đang kiểm tra kết nối...</div>'}
      <div class="button-row"><button class="secondary-button" type="button" data-check-ai-health>Kiểm tra kết nối</button>${isAdmin ? `<button class="secondary-button" type="button" data-toggle-ai-settings>${state.aiSettingsOpen ? 'Đóng cấu hình' : 'Cấu hình AI'}</button>` : ''}</div>
      ${isAdmin && state.aiSettingsOpen ? `
        <form id="ai-settings-form" class="plan-form" style="margin-top:12px">
          <div class="form-grid">
            <label class="field"><span>Nhà cung cấp AI</span><select class="select" name="provider">
              ${['gemini', 'openai', 'openai_compatible'].map((p) => `<option value="${p}" ${settings?.provider === p ? 'selected' : ''}>${p === 'gemini' ? 'Google Gemini' : p === 'openai' ? 'OpenAI' : 'Tương thích OpenAI API'}</option>`).join('')}
            </select></label>
            <label class="field"><span>Mô hình</span><input class="input" name="model" value="${escapeHtml(settings?.model || '')}" placeholder="vd: gemini-2.0-flash"></label>
          </div>
          <label class="field"><span>Địa chỉ API (chỉ dùng cho nhà cung cấp tương thích OpenAI)</span><input class="input" name="compatibleBaseUrl" value="${escapeHtml(settings?.compatibleBaseUrl || '')}"></label>
          <label class="field"><span>Khóa API ${settings?.keys?.gemini?.configured || settings?.keys?.openai?.configured ? `(hiện tại: ${escapeHtml(settings.keys.gemini.configured ? settings.keys.gemini.masked : settings.keys.openai.masked)})` : ''}</span><input class="input" type="password" name="apiKey" placeholder="Để trống nếu không đổi khóa hiện tại"></label>
          <div class="notice">Khóa API chỉ lưu phía máy chủ, không hiển thị lại toàn bộ và không được đưa lên GitHub.</div>
          <button class="primary-button" type="submit">Lưu cấu hình</button>
        </form>` : ''}
    </article>`;
}

function renderAiTools() {
  const records = standardizedRecords();
  const isOnline = navigator.onLine;
  const selectedId = state.aiRecordId || records[0]?.id || '';
  const selected = records.find((r) => r.id === selectedId) || null;
  const prompt = state.aiPromptDraft ?? buildAiPrompt(selected);
  const piiHits = detectPii(prompt);

  els.main.innerHTML = `
    ${pageHead('Hỗ trợ chuyên môn', 'AI và nguồn trực tuyến', 'Có hai cách dùng AI: (1) kết nối trực tiếp qua máy chủ — nhanh, cần rà soát trước khi dùng; (2) tạo prompt để tự sao chép sang ChatGPT/Gemini/Copilot nếu muốn kiểm soát thủ công hoàn toàn.')}
    ${renderAiConnectionCard()}
    <div class="notice">${isOnline ? 'Trạng thái mạng: Trực tuyến.' : 'Trạng thái mạng: Ngoại tuyến — các nút mở dịch vụ trực tuyến đã bị vô hiệu hóa, ứng dụng vẫn hoạt động bình thường.'}</div>
    <section class="toolbar">
      ${AI_SERVICES.map((service) => `<button class="secondary-button" data-open-ai-service="${service.url}" ${isOnline ? '' : 'disabled'}>${escapeHtml(service.label)} ↗</button>`).join('')}
    </section>
    <section class="planner-layout">
      <article class="panel">
        <div class="panel-title-row"><h2>Gợi ý nội dung / hoạt động</h2></div>
        <label class="field"><span>Chọn mục tiêu/bản ghi</span><select class="select" id="ai-record-select">${records.map((r) => `<option value="${escapeHtml(r.id)}" ${r.id === selectedId ? 'selected' : ''}>${escapeHtml(r.objective || r.id)}</option>`).join('') || '<option value="">Chưa có bản ghi chuẩn hóa</option>'}</select></label>
        <label class="field"><span>Bản xem trước prompt — có thể chỉnh sửa</span><textarea id="ai-prompt-preview" class="tall">${escapeHtml(prompt)}</textarea></label>
        ${piiHits.length ? `<div class="auth-error">Phát hiện khả năng chứa ${piiHits.join(', ')}. Vui lòng kiểm tra và xóa thông tin cá nhân trước khi sao chép hoặc gửi cho AI.</div>` : '<div class="notice">Chưa phát hiện số điện thoại, email hoặc ngày sinh trong nội dung.</div>'}
        <div class="button-row">
          <button class="primary-button" data-copy-ai-prompt type="button">Sao chép prompt (dùng thủ công)</button>
          <button class="primary-button" data-generate-ai-suggestion type="button" ${!selected || state.aiSuggestionBusy ? 'disabled' : ''}>${state.aiSuggestionBusy ? 'Đang tạo gợi ý...' : 'Tạo gợi ý bằng AI (kết nối trực tiếp)'}</button>
          ${state.aiSuggestionBusy ? '<button class="secondary-button" type="button" data-cancel-ai-suggestion>Hủy yêu cầu</button>' : ''}
        </div>
        ${state.aiSuggestion ? `<label class="field" style="margin-top:12px"><span>AI đề xuất – cần giáo viên rà soát trước khi sử dụng</span><textarea id="ai-suggestion-result" class="tall">${escapeHtml(state.aiSuggestion)}</textarea></label><div class="button-row"><button class="secondary-button" type="button" data-copy-ai-suggestion>Sao chép gợi ý</button></div>` : ''}
        <div class="notice">Luồng "Sao chép prompt" KHÔNG TỰ ĐỘNG GỬI dữ liệu cho AI. Với luồng "kết nối trực tiếp", chỉ mục tiêu/nội dung/hoạt động của bản ghi được gửi đi — không gửi họ tên, ngày sinh hay hình ảnh trẻ.</div>
      </article>
      <aside class="panel">
        <div class="panel-title-row"><h2>Lưu ý bắt buộc</h2></div>
        <ul class="about-list">
          <li><span>Nguồn dữ liệu</span><strong>Chỉ dùng bản ghi đã chuẩn hóa, có nguồn PDF/trang rõ ràng.</strong></li>
          <li><span>Nội dung AI tạo ra</span><strong>Phải gắn nhãn “AI đề xuất – cần giáo viên rà soát”.</strong></li>
          <li><span>Phê duyệt</span><strong>Không được dùng để tự động phê duyệt kế hoạch.</strong></li>
        </ul>
      </aside>
    </section>`;
}

function render() {
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === state.route));
  if (state.route === 'dashboard') renderDashboard();
  else if (state.route === 'open-data') renderOpenData();
  else if (state.route === 'planner') renderPlanner();
  else if (['library', 'objectives', 'monthly', 'weekly'].includes(state.route)) renderLibrary(state.route);
  else if (state.route === 'review') renderReview();
  else if (state.route === 'reports') renderReports();
  else if (state.route === 'backup') renderBackup();
  else if (state.route === 'accounts') renderAccounts();
  else if (state.route === 'activity-log') renderActivityLogPage();
  else if (state.route === 'videos') renderVideos();
  else if (state.route === 'workflow-plans') renderWorkflowPlans();
  else if (state.route === 'matrix') renderMatrix();
  else if (state.route === 'ai-tools') { renderAiTools(); if (!state.aiHealth) refreshAiHealth(); }
  else renderAbout();
  updateIssueBadge();
  els.main.scrollTop = 0;
}

function setRoute(route, options = {}) {
  state.route = route;
  state.page = 1;
  if (!options.keepFilters) {
    state.collection = 'all';
    if (!['library', 'objectives', 'monthly', 'weekly'].includes(route)) state.ageGroup = 'all';
  }
  render();
}

function findDocument(id) {
  return state.data.documents.find((item) => item.id === id);
}

function toggleList(key, id) {
  const current = new Set(state.review[key]);
  if (current.has(id)) current.delete(id); else current.add(id);
  state.review[key] = [...current];
  saveReviewState();
}

function openDrawer(documentId) {
  const document = findDocument(documentId);
  if (!document) return;
  const reviewed = new Set(state.review.reviewed).has(document.id);
  const watching = new Set(state.review.watch).has(document.id);
  const relatedIssues = state.data.issues.filter((item) => document.issueIds.includes(item.id));
  const note = state.review.notes[document.id] || '';
  els.drawerContent.innerHTML = `
    <header class="drawer-header"><div><span class="chip teal">${escapeHtml(document.ageGroup)}</span><h2>${escapeHtml(document.title)}</h2></div><button class="drawer-close" data-close-drawer aria-label="Đóng">×</button></header>
    <div class="drawer-body">
      <div class="drawer-metadata">
        <div class="metadata-item"><span>Loại hồ sơ</span><strong>${escapeHtml(document.documentType)}</strong></div>
        <div class="metadata-item"><span>Chủ đề / tháng</span><strong>${escapeHtml(document.collection)}</strong></div>
        <div class="metadata-item"><span>Số trang</span><strong>${document.pageCount} trang</strong></div>
        <div class="metadata-item"><span>Cảnh báo</span><strong>${document.issueIds.length} nội dung</strong></div>
      </div>
      <div class="source-policy">${escapeHtml(state.data.meta.sourcePolicy)}</div>
      <div class="drawer-actions">
        <button class="primary-button" data-open-original="${document.id}">Mở PDF gốc</button>
        <button class="secondary-button ${reviewed ? 'is-on' : ''}" data-review-doc="${document.id}">${reviewed ? '✓ Đã rà soát' : 'Đánh dấu đã rà soát'}</button>
        <button class="secondary-button ${watching ? 'is-on' : ''}" data-watch-doc="${document.id}">${watching ? '★ Đang theo dõi' : '☆ Cần theo dõi'}</button>
      </div>
      ${relatedIssues.length ? `<div class="drawer-issues">${relatedIssues.map((item) => `<div class="drawer-issue"><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.detail)}</div>`).join('')}</div>` : ''}
      <label class="note-field"><span>Ghi chú rà soát</span><textarea id="document-note" placeholder="Ghi nội dung cần điều chỉnh, người phụ trách hoặc kết quả đối chiếu...">${escapeHtml(note)}</textarea></label>
      <div class="button-row" style="margin:8px 0 18px"><button class="secondary-button" data-save-note="${document.id}">Lưu ghi chú</button></div>
      <h3 style="font-size:13px">Nội dung trích xuất</h3>
      <div class="text-preview">${escapeHtml(document.fullText)}</div>
    </div>`;
  els.drawerBackdrop.classList.remove('is-hidden');
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => els.drawerBackdrop.classList.add('is-hidden'), 180);
}

async function openOriginal(documentId) {
  const document = findDocument(documentId);
  if (!document) return;
  if (window.ctgdmnDesktop?.openDocument) {
    const result = await window.ctgdmnDesktop.openDocument(document.relativePdfPath);
    if (!result.ok) showToast(`Không mở được PDF: ${result.error}`);
    return;
  }
  const encoded = document.relativePdfPath.split('/').map(encodeURIComponent).join('/');
  window.open(`../program-documents/${encoded}`, '_blank', 'noopener');
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, value, type = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\ufeff', value], { type });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function exportOpenCsv() {
  const fields = ['id','title','ageGroup','type','topic','objective','content','activity','evidence','sourceDocumentId','sourcePage','status'];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [fields.join(','), ...openRecords().map(row => fields.map(key => quote(row[key])).join(','))].join('\r\n');
  downloadText('du-lieu-mo-ctgdmn-2026-2027.csv', csv, 'text/csv;charset=utf-8');
  showToast('Đã xuất kho dữ liệu mở dạng CSV.');
}

function exportBackup() {
  downloadJson(`sao-luu-${safeFilename(state.data.meta.schoolName)}-${new Date().toISOString().slice(0,10)}.json`, {
    format: 'ctgdmn-review-backup', version: 1, school: state.data.meta.schoolName, schoolYear: state.data.meta.schoolYear, exportedAt: new Date().toISOString(), review: state.review,
  });
  showToast('Đã tạo tệp sao lưu trạng thái rà soát.');
}

async function loadData() {
  if (window.ctgdmnDesktop?.getProgramIndex) return window.ctgdmnDesktop.getProgramIndex();
  const response = await fetch('./data/program-index.json');
  if (!response.ok) throw new Error(`Không nạp được dữ liệu (${response.status}).`);
  return response.json();
}

function bindEvents() {
  els.nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-route]');
    if (button) setRoute(button.dataset.route);
  });
  els.main.addEventListener('click', (event) => {
    const route = event.target.closest('[data-route-jump]');
    if (route) return setRoute(route.dataset.routeJump);
    const age = event.target.closest('[data-age-open]');
    if (age) { state.ageGroup = age.dataset.ageOpen; return setRoute('library', { keepFilters: true }); }
    const open = event.target.closest('[data-open-doc]');
    if (open) return openDrawer(open.dataset.openDoc);
    const watch = event.target.closest('[data-watch-doc]');
    if (watch) { toggleList('watch', watch.dataset.watchDoc); render(); return; }
    const page = event.target.closest('[data-page]');
    if (page && !page.disabled) { state.page = Number(page.dataset.page); render(); return; }
    const clear = event.target.closest('[data-clear-filters]');
    if (clear) { state.query = ''; state.ageGroup = 'all'; state.collection = 'all'; state.page = 1; els.globalSearch.value = ''; render(); return; }
    const category = event.target.closest('[data-issue-category]');
    if (category) { state.issueCategory = category.dataset.issueCategory; render(); return; }
    const toggleIssue = event.target.closest('[data-toggle-issue]');
    if (toggleIssue) { toggleList('resolvedIssues', toggleIssue.dataset.toggleIssue); render(); return; }
    if (event.target.closest('[data-toggle-resolved]')) { state.showResolved = !state.showResolved; render(); return; }
    if (event.target.closest('[data-export-backup]')) return exportBackup();
    if (event.target.closest('[data-new-record]')) return openRecordEditor();
    const editRecord = event.target.closest('[data-edit-record]');
    if (editRecord) return openRecordEditor(editRecord.dataset.editRecord);
    const useRecord = event.target.closest('[data-use-record]');
    if (useRecord) {
      const record = openRecords().find(item => item.id === useRecord.dataset.useRecord);
      state.workspace.plans.unshift({ id: `plan-${Date.now()}`, title: `Kế hoạch từ ${record.title}`, level: 'Tuần', ageGroup: record.ageGroup, schoolYear: '2026–2027', objectives: record.objective, activities: record.activity || record.content.slice(0, 5000), assessment: record.evidence, sourceRecordIds: [record.id] });
      saveWorkspace(); state.route = 'planner'; return renderPlanner(state.workspace.plans[0].id);
    }
    const editPlan = event.target.closest('[data-edit-plan]');
    if (editPlan) return renderPlanner(editPlan.dataset.editPlan);
    if (event.target.closest('[data-import-open]')) return els.openDataImport.click();
    if (event.target.closest('[data-export-csv]')) return exportOpenCsv();
    if (event.target.closest('[data-export-plans]')) {
      downloadJson('ke-hoach-ctgdmn-2026-2027.json', { format:'ctgdmn-open-plans', version:1, schoolYear:'2026–2027', plans:state.workspace.plans });
      return showToast('Đã xuất kế hoạch dạng JSON mở.');
    }
    if (event.target.closest('[data-import-backup]')) return els.backupImport.click();
    if (event.target.closest('[data-reset-review]')) {
      if (window.confirm('Xóa toàn bộ trạng thái rà soát, theo dõi và ghi chú đang lưu trên máy? PDF nguồn không bị ảnh hưởng.')) {
        state.review = defaultReviewState(); saveReviewState(); render(); showToast('Đã xóa trạng thái rà soát trên máy.');
      }
      return;
    }
    if (event.target.closest('[data-export-report]')) {
      downloadJson(`bao-cao-ctgdmn-${new Date().toISOString().slice(0,10)}.json`, { meta: state.data.meta, summary: state.data.summary, ageGroups: state.data.ageGroups, review: reviewSummary(state.data.documents, state.review) });
      showToast('Đã xuất báo cáo thống kê.');
    }
    const guide = event.target.closest('[data-open-guide]');
    if (guide) return openGuideCategory(guide.dataset.openGuide);

    // Tài khoản & phân quyền
    const toggleLock = event.target.closest('[data-toggle-lock]');
    if (toggleLock) {
      auth.api.setAccountLocked(toggleLock.dataset.toggleLock, toggleLock.dataset.locked === '1')
        .then(() => { showToast('Đã cập nhật trạng thái tài khoản.'); renderAccounts(); })
        .catch((error) => showToast(error.message));
      return;
    }
    const resetAccount = event.target.closest('[data-reset-account]');
    if (resetAccount) {
      const temp = window.prompt('Nhập mật khẩu tạm thời mới (tối thiểu 8 ký tự):');
      if (!temp || temp.length < 8) return;
      auth.api.adminResetPassword(resetAccount.dataset.resetAccount, temp)
        .then(() => showToast('Đã đặt lại mật khẩu tạm thời. Người dùng phải đổi mật khẩu khi đăng nhập lại.'))
        .catch((error) => showToast(error.message));
      return;
    }

    // Trung tâm video hướng dẫn
    const videoCategory = event.target.closest('[data-video-category]');
    if (videoCategory) { state.videoCategory = videoCategory.dataset.videoCategory; renderVideos(); return; }
    const openOnlineVideo = event.target.closest('[data-open-online-video]');
    if (openOnlineVideo) {
      auth.api.openOnlineVideo(openOnlineVideo.dataset.openOnlineVideo).catch((error) => showToast(error.message));
      return;
    }
    const playOffline = event.target.closest('[data-play-offline-video]');
    if (playOffline) {
      auth.api.getOfflineVideoUrl(playOffline.dataset.playOfflineVideo).then((url) => {
        const player = document.querySelector('#offline-video-player');
        player.classList.remove('is-hidden');
        player.innerHTML = `<video controls preload="none" style="width:100%;max-height:480px" src="${url}"></video>`;
        player.scrollIntoView({ behavior: 'smooth' });
      }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-manage-videos]')) {
      document.querySelector('#video-admin-panel')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const pickOffline = event.target.closest('[data-pick-offline-video]');
    if (pickOffline) {
      auth.api.pickOfflineVideoFile().then((result) => {
        if (!result.ok) return;
        pickOffline.dataset.storedName = result.storedName;
        document.querySelector('#offline-video-picked').textContent = result.originalName;
      }).catch((error) => showToast(error.message));
      return;
    }
    const toggleVideoEnabled = event.target.closest('[data-toggle-video-enabled]');
    if (toggleVideoEnabled) {
      auth.api.updateVideo(toggleVideoEnabled.dataset.toggleVideoEnabled, { enabled: toggleVideoEnabled.dataset.enabled === '1' })
        .then(() => renderVideos()).catch((error) => showToast(error.message));
      return;
    }
    const deleteVideo = event.target.closest('[data-delete-video]');
    if (deleteVideo) {
      if (!window.confirm('Xóa video này khỏi danh mục?')) return;
      auth.api.deleteVideo(deleteVideo.dataset.deleteVideo).then(() => renderVideos()).catch((error) => showToast(error.message));
      return;
    }

    // Quy trình kế hoạch
    if (event.target.closest('[data-create-workflow-plan]')) {
      const title = window.prompt('Tên kế hoạch mới:');
      if (!title) return;
      auth.api.createPlan({ title, content: { text: '' } })
        .then((plan) => { state.workflowPlanId = plan.id; renderWorkflowPlans(); })
        .catch((error) => showToast(error.message));
      return;
    }
    const selectPlan = event.target.closest('[data-select-workflow-plan]');
    if (selectPlan) { state.workflowPlanId = selectPlan.dataset.selectWorkflowPlan; renderWorkflowPlans(); return; }
    if (event.target.closest('[data-save-workflow-plan]')) {
      const text = document.querySelector('#workflow-plan-content').value;
      auth.api.updatePlanContent(state.workflowPlanId, { text })
        .then(() => showToast('Đã lưu bản nháp.')).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-submit-workflow-plan]')) {
      auth.api.submitPlan(state.workflowPlanId).then(() => { showToast('Đã gửi rà soát.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-propose-workflow-plan]')) {
      auth.api.proposeNextStage(state.workflowPlanId).then(() => { showToast('Đã đề nghị chuyển bước tiếp theo.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-approve-workflow-plan]')) {
      auth.api.approvePlan(state.workflowPlanId).then(() => { showToast('Đã phê duyệt kế hoạch.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-return-workflow-plan]')) {
      const note = window.prompt('Ghi chú yêu cầu chỉnh sửa (không bắt buộc):') || '';
      auth.api.returnPlan(state.workflowPlanId, note).then(() => { showToast('Đã trả lại để chỉnh sửa.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-revise-workflow-plan]')) {
      auth.api.reviseApprovedPlan(state.workflowPlanId).then(() => { showToast('Đã tạo phiên bản mới để chỉnh sửa.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }
    if (event.target.closest('[data-add-workflow-comment]')) {
      const content = document.querySelector('#workflow-comment-input').value.trim();
      if (!content) return;
      auth.api.commentPlan(state.workflowPlanId, content).then(() => { showToast('Đã gửi nhận xét.'); renderWorkflowPlans(); }).catch((error) => showToast(error.message));
      return;
    }

    // Ma trận chương trình
    const openStandard = event.target.closest('[data-open-standard-record]');
    if (openStandard) { openStandardizedRecordFromCard(openStandard.dataset.openStandardRecord); return; }

    // AI và nguồn trực tuyến
    const openAiService = event.target.closest('[data-open-ai-service]');
    if (openAiService) {
      if (!navigator.onLine) { showToast('Cần kết nối Internet để mở dịch vụ trực tuyến.'); return; }
      const url = openAiService.dataset.openAiService;
      if (window.ctgdmnDesktop?.openOnlineVideo) {
        // Dùng lại kênh mở-bằng-trình-duyệt-mặc-định đã có (kiểm tra HTTPS ở tầng chính) cho các liên kết AI.
        auth.api.openOnlineVideo(url).catch(() => window.open(url, '_blank', 'noopener'));
      } else {
        window.open(url, '_blank', 'noopener');
      }
      return;
    }
    if (event.target.closest('[data-copy-ai-prompt]')) {
      const text = document.querySelector('#ai-prompt-preview').value;
      navigator.clipboard.writeText(text).then(() => showToast('Đã sao chép prompt vào bộ nhớ tạm.')).catch(() => showToast('Không thể sao chép tự động, hãy chọn và sao chép thủ công.'));
      return;
    }
    if (event.target.closest('[data-check-ai-health]')) { refreshAiHealth(); return; }
    if (event.target.closest('[data-toggle-ai-settings]')) {
      state.aiSettingsOpen = !state.aiSettingsOpen;
      if (state.aiSettingsOpen && !state.aiSettings) {
        ctgdmnAi.getSettings().then((s) => { state.aiSettings = s; renderAiTools(); }).catch((error) => showToast(error.message));
      }
      renderAiTools();
      return;
    }
    if (event.target.closest('[data-copy-ai-suggestion]')) {
      const text = document.querySelector('#ai-suggestion-result')?.value || '';
      navigator.clipboard.writeText(text).then(() => showToast('Đã sao chép gợi ý vào bộ nhớ tạm.')).catch(() => showToast('Không thể sao chép tự động, hãy chọn và sao chép thủ công.'));
      return;
    }
    if (event.target.closest('[data-cancel-ai-suggestion]')) {
      aiSuggestionController?.abort();
      return;
    }
    if (event.target.closest('[data-generate-ai-suggestion]')) {
      const records = standardizedRecords();
      const selectedId = state.aiRecordId || records[0]?.id || '';
      const selected = records.find((r) => r.id === selectedId);
      if (!selected) { showToast('Chưa có bản ghi chuẩn hóa để tạo gợi ý.'); return; }
      state.aiSuggestionBusy = true;
      state.aiSuggestion = null;
      renderAiTools();
      aiSuggestionController = new AbortController();
      ctgdmnAi.suggest({
        recordId: selected.id, ageGroup: selected.ageGroup, objective: selected.objective,
        content: selected.content, activity: selected.activity,
      }, aiSuggestionController.signal)
        .then((res) => { state.aiSuggestion = res.suggestion; })
        .catch((error) => { if (error.name !== 'AbortError') showToast(error.message); })
        .finally(() => { state.aiSuggestionBusy = false; aiSuggestionController = null; renderAiTools(); });
      return;
    }
    if (event.target.closest('[data-create-program]')) {
      const title = window.prompt('Tên chương trình/kế hoạch năm học:', 'Chương trình giáo dục nhà trường 2026–2027');
      if (!title) return;
      const plan = { id: `plan-${Date.now()}`, title, level: 'Năm', ageGroup: state.data.ageGroups[0].label, schoolYear: '2026–2027', status: RECORD_STATUS.DRAFT, linkedRecordIds: [], history: [{ fromStatus: null, toStatus: RECORD_STATUS.DRAFT, actor: currentActorLabel(), note: 'Tạo chương trình năm học', at: new Date().toISOString() }] };
      state.workspace.plans.unshift(plan);
      saveWorkspace();
      setRoute('planner');
      renderPlanner(plan.id);
      showToast('Đã tạo khung chương trình năm học 2026–2027.');
      return;
    }
  });
  els.main.addEventListener('input', (event) => {
    if (event.target.id === 'library-query') { state.query = event.target.value; state.page = 1; window.clearTimeout(bindEvents.queryTimer); bindEvents.queryTimer = window.setTimeout(render, 180); }
    if (event.target.id === 'open-query') { state.query = event.target.value; window.clearTimeout(bindEvents.openTimer); bindEvents.openTimer = window.setTimeout(renderOpenData, 180); }
    if (event.target.id === 'ai-prompt-preview') { state.aiPromptDraft = event.target.value; }
  });
  els.main.addEventListener('submit', (event) => {
    if (event.target.id === 'plan-form') {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
      data.id ||= `plan-${Date.now()}`; data.updatedAt = new Date().toISOString();
      const index = state.workspace.plans.findIndex(item => item.id === data.id);
      if (index >= 0) state.workspace.plans[index] = { ...state.workspace.plans[index], ...data }; else state.workspace.plans.unshift(data);
      saveWorkspace(); renderPlanner(data.id); showToast('Đã lưu kế hoạch 2026–2027.');
      return;
    }
    if (event.target.id === 'create-account-form') {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      auth.api.createAccount(data)
        .then(() => { showToast('Đã tạo tài khoản mới.'); renderAccounts(); })
        .catch((error) => showToast(error.message));
      return;
    }
    if (event.target.id === 'ai-settings-form') {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      if (!data.apiKey) delete data.apiKey;
      ctgdmnAi.saveSettings(data)
        .then(() => { showToast('Đã lưu cấu hình AI.'); state.aiSettings = null; state.aiHealth = null; renderAiTools(); refreshAiHealth(); })
        .catch((error) => showToast(error.message));
      return;
    }
    if (event.target.id === 'add-video-form') {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      if (data.sourceType === 'offline') {
        const storedName = form.querySelector('[data-pick-offline-video]')?.dataset.storedName;
        if (!storedName) { showToast('Hãy chọn tệp MP4 trước khi thêm video.'); return; }
        data.sourceValue = storedName;
      }
      auth.api.addVideo(data)
        .then(() => { showToast('Đã thêm video vào danh mục.'); renderVideos(); })
        .catch((error) => showToast(error.message));
    }
  });
  els.main.addEventListener('change', (event) => {
    if (event.target.id === 'age-filter') { state.ageGroup = event.target.value; state.collection = 'all'; state.page = 1; render(); }
    if (event.target.id === 'collection-filter') { state.collection = event.target.value; state.page = 1; render(); }
    if (event.target.id === 'type-filter') {
      const type = event.target.value;
      if (type === 'all') setRoute('library', { keepFilters: true });
      else if (type === 'Mục tiêu/kế hoạch chủ đề') setRoute('objectives', { keepFilters: true });
      else if (type === 'Kế hoạch tháng') setRoute('monthly', { keepFilters: true });
      else if (type === 'Kế hoạch/giáo án tuần') setRoute('weekly', { keepFilters: true });
    }
    if (event.target.id === 'video-source-type') {
      const isOffline = event.target.value === 'offline';
      document.querySelector('#video-url-field').classList.toggle('is-hidden', isOffline);
      document.querySelector('#video-offline-pick-row').style.display = isOffline ? 'flex' : 'none';
    }
    if (event.target.id === 'ai-record-select') {
      state.aiRecordId = event.target.value;
      state.aiPromptDraft = null;
      renderAiTools();
    }
  });
  els.drawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-drawer]')) return closeDrawer();
    const original = event.target.closest('[data-open-original]');
    if (original) return openOriginal(original.dataset.openOriginal);
    const review = event.target.closest('[data-review-doc]');
    if (review) { toggleList('reviewed', review.dataset.reviewDoc); openDrawer(review.dataset.reviewDoc); return; }
    const watch = event.target.closest('[data-watch-doc]');
    if (watch) { toggleList('watch', watch.dataset.watchDoc); openDrawer(watch.dataset.watchDoc); return; }
    const note = event.target.closest('[data-save-note]');
    if (note) { state.review.notes[note.dataset.saveNote] = document.querySelector('#document-note').value.trim(); saveReviewState(); showToast('Đã lưu ghi chú rà soát.'); }
    const transition = event.target.closest('[data-record-transition]');
    if (transition) {
      const recordId = transition.dataset.recordId;
      const index = state.workspace.customRecords.findIndex((item) => item.id === recordId);
      if (index < 0) return;
      try {
        state.workspace.customRecords[index] = transitionRecord(state.workspace.customRecords[index], transition.dataset.recordTransition, currentActorLabel());
        saveWorkspace();
        openRecordEditor(recordId);
        showToast('Đã cập nhật trạng thái rà soát.');
      } catch (error) { showToast(error.message); }
    }
  });
  els.drawer.addEventListener('submit', (event) => {
    if (event.target.id !== 'record-form') return;
    event.preventDefault();
    const form = event.target;
    const isCustom = form.dataset.isCustom === '1';
    const data = Object.fromEntries(new FormData(form));
    data.updatedAt = new Date().toISOString();

    if (isCustom) {
      const existingIndex = state.workspace.customRecords.findIndex((item) => item.id === data.id);
      const existing = existingIndex >= 0 ? state.workspace.customRecords[existingIndex] : null;
      const wasApproved = existing?.status === RECORD_STATUS.APPROVED;
      const merged = { ...(existing || createRecord({}, currentActorLabel())), ...data, id: data.id };
      const validation = validateRecord(merged);
      if (!validation.valid) {
        const box = form.querySelector('#record-form-errors');
        box.textContent = validation.errors.join(' ');
        box.classList.remove('is-hidden');
        return;
      }
      const finalRecord = wasApproved ? bumpVersionAfterApprovedEdit(merged, currentActorLabel()) : merged;
      if (existingIndex >= 0) state.workspace.customRecords[existingIndex] = finalRecord;
      else state.workspace.customRecords.unshift(finalRecord);
    } else {
      state.workspace.edits[data.id] = data;
    }
    saveWorkspace(); closeDrawer(); renderOpenData(); showToast(isCustom ? 'Đã lưu bản ghi chuẩn hóa.' : 'Đã lưu bản ghi dữ liệu mở.');
  });
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  els.globalSearch.addEventListener('input', () => {
    state.query = els.globalSearch.value; state.page = 1;
    window.clearTimeout(bindEvents.globalTimer);
    bindEvents.globalTimer = window.setTimeout(() => setRoute('library', { keepFilters: true }), 200);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.globalSearch.focus(); }
    if (event.key === 'Escape') closeDrawer();
  });
  document.querySelector('#quick-add').addEventListener('click', () => { setRoute('library'); showToast('Chọn một tài liệu để rà soát hoặc ghi chú.'); });
  els.logoutButton.addEventListener('click', async () => {
    await auth.logout();
    window.location.reload();
  });
  els.backupImport.addEventListener('change', async () => {
    const file = els.backupImport.files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.format !== 'ctgdmn-review-backup' || !payload.review) throw new Error('Tệp không đúng định dạng sao lưu CTGDMN.');
      state.review = { ...defaultReviewState(), ...payload.review }; saveReviewState(); render(); showToast('Đã khôi phục trạng thái rà soát.');
    } catch (error) { showToast(error.message || 'Không thể nhập tệp sao lưu.'); }
    els.backupImport.value = '';
  });
  els.openDataImport.addEventListener('change', async () => {
    const file = els.openDataImport.files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text()); const records = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(records)) throw new Error('Tệp cần có mảng records hoặc là một mảng JSON.');
      records.forEach((item, index) => state.workspace.customRecords.push({ ...item, id: item.id || `import-${Date.now()}-${index}`, status: item.status || 'Bản nháp' }));
      saveWorkspace(); renderOpenData(); showToast(`Đã nhập ${records.length} bản ghi.`);
    } catch (error) { showToast(error.message || 'Không thể nhập dữ liệu mở.'); }
    els.openDataImport.value = '';
  });
}

async function init() {
  try {
    const user = await runAuthGate();
    applyRoleVisibility(user);

    state.data = await loadData();
    state.data.meta.schoolYear = '2026–2027';
    document.querySelector('#school-name').textContent = state.data.meta.schoolName;
    document.querySelector('#school-year').textContent = state.data.meta.schoolYear;
    els.authSchoolName.textContent = state.data.meta.schoolName;

    // Di chuyển kế hoạch cũ trong localStorage sang cơ sở dữ liệu có phân
    // quyền — chỉ chạy một lần (repository tự bỏ qua nếu đã di chuyển).
    if (state.workspace.plans?.length) {
      try {
        const result = await auth.api.migrateLegacyLocalStorage({ plans: state.workspace.plans });
        if (result.migrated > 0) showToast(`Đã di chuyển ${result.migrated} kế hoạch cũ vào hệ thống có phân quyền.`);
      } catch { /* người dùng không có quyền sao lưu/khôi phục (không phải admin) — bỏ qua */ }
    }

    bindEvents();
    render();
    els.loading.classList.add('is-hidden');
    els.authScreen.classList.add('is-hidden');
    els.app.classList.remove('is-hidden');
  } catch (error) {
    els.loading.innerHTML = `<strong>Không thể khởi động ứng dụng</strong><small>${escapeHtml(error.message)}</small>`;
  }
}

init();
