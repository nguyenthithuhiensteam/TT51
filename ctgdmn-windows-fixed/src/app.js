import { countBy, filterDocuments, normalizeText, paginate, reviewSummary, safeFilename } from './data-utils.js';
import { EXCEL_FIELDS, createImportBatch, createSourceBatch, mapExcelRows, undoLastImport } from './import-utils.js';
import { REVIEW_TYPES, SIGNATURE_ROLES, STAFF_ROLES, addProfessionalReview, buildTechnicalBackup, canApprovePlan, createPublicationSnapshot, deactivateClass, deactivateStaff, defaultSchoolProfile, migrateWorkspace, resolveProfessionalReview, restoreTechnicalBackup, savePlanWithVersion, staffHasHistory, upsertClass, upsertStaff, validateLocalImage, validateSchool } from './organization-utils.js';

const els = {
  app: document.querySelector('#app'),
  loading: document.querySelector('#loading'),
  main: document.querySelector('#main-content'),
  nav: document.querySelector('.sidebar'),
  globalSearch: document.querySelector('#global-search'),
  issueBadge: document.querySelector('#issue-badge'),
  drawer: document.querySelector('#document-drawer'),
  drawerContent: document.querySelector('#drawer-content'),
  drawerBackdrop: document.querySelector('#drawer-backdrop'),
  toast: document.querySelector('#toast'),
  backupImport: document.querySelector('#backup-import'),
};

const defaultReviewState = () => ({ reviewed: [], watch: [], notes: {}, resolvedIssues: [] });
const ROLE_LABELS = { system_admin:'Quản trị hệ thống', principal:'Hiệu trưởng/người phê duyệt', vice_principal:'Phó hiệu trưởng phụ trách chuyên môn', team_lead:'Tổ trưởng chuyên môn', teacher:'Giáo viên', viewer:'Người xem' };
let persistQueue = Promise.resolve();
const state = {
  data: null,
  route: 'work-center',
  query: '',
  ageGroup: 'all',
  collection: 'all',
  page: 1,
  issueCategory: 'all',
  showResolved: false,
  review: loadReviewState(),
  workspace: loadWorkspace(),
  pendingImport: null,
  settingsTab: 'school',
  pendingImageData: '',
  showPendingReviewsOnly: false,
  originalSchoolProfile: null,
  publicBranding: { schoolName:'Trường Mầm non Số', schoolYear:'2026–2027' },
  currentUser: null,
  systemConfig: { repositoryMode:'local', serverUrl:'', idleMinutes:30 },
  videos: [],
  online: navigator.onLine,
  contextVideoKey: '',
  users: [],
  auditLog: [],
  aiConfig: { provider:'', model:'', baseUrl:'', timeoutMs:60000, retries:1, keyMode:'none', maskedKey:'', consentAccepted:false, lastTest:null },
  aiBusy: false,
  aiRequestId: '',
  pendingAIResult: null,
  templates: { templates: [], defaultByType: {} },
  draftPlanSeed: null,
  children: [],
  selectedChildId: '',
  childAssessments: [],
  objectives: [],
  frameworkLibraryTab: 'TT51',
};

const DEVELOPMENT_DOMAINS = [
  'Giáo dục phát triển thể chất',
  'Giáo dục phát triển tình cảm và kỹ năng xã hội',
  'Giáo dục phát triển ngôn ngữ',
  'Giáo dục phát triển nhận thức',
  'Giáo dục phát triển thẩm mỹ',
];
// Nhóm nhà trẻ (18-36 tháng) dùng khung 4 lĩnh vực (gộp TCXH và thẩm mỹ), khác mẫu giáo.
const NHA_TRE_DOMAINS = [
  'Giáo dục phát triển thể chất',
  'Giáo dục phát triển nhận thức',
  'Giáo dục phát triển ngôn ngữ',
  'Giáo dục phát triển tình cảm, kỹ năng xã hội và thẩm mỹ',
];
const MAU_GIAO_LON_EXTRA_DOMAIN = 'Giáo dục phát triển tiếp cận với việc học';
function isMauGiaoLonAgeGroup(ageGroup = '') { return /5.{0,2}6.*tuổi/i.test(String(ageGroup)); }
function domainsForAgeGroup(ageGroup = '') {
  if (/tháng/i.test(ageGroup)) return NHA_TRE_DOMAINS;
  if (isMauGiaoLonAgeGroup(ageGroup)) return [...DEVELOPMENT_DOMAINS, MAU_GIAO_LON_EXTRA_DOMAIN];
  return DEVELOPMENT_DOMAINS;
}
// Lịch lĩnh vực cố định theo thứ trong tuần — cố định theo 1 trong 3 mẫu đã khảo sát, chọn theo độ tuổi của lớp (không cho tùy chỉnh).
const WEEKDAY_DOMAIN_SCHEDULES = {
  nhaTre: [['Thứ hai', 'Thể chất'], ['Thứ ba', 'Nhận thức'], ['Thứ tư', 'TCXH-TM (âm nhạc)'], ['Thứ năm', 'Ngôn ngữ'], ['Thứ sáu', 'TCXH-TM (tạo hình)']],
  mgBe: [['Thứ hai', 'Văn học'], ['Thứ ba', 'Toán'], ['Thứ tư', 'Thể dục'], ['Thứ năm', 'KPKH/KPXH'], ['Thứ sáu', 'Âm nhạc/Tạo hình/STEAM']],
  mgLon: [['Thứ hai', 'KPKH/KPXH'], ['Thứ ba', 'Thơ/Truyện/LQCC'], ['Thứ tư', 'Toán'], ['Thứ năm', 'Thể dục'], ['Thứ sáu', 'Âm nhạc/Tạo hình/STEAM']],
};
function weekdayScheduleForAgeGroup(ageGroup = '') {
  if (/tháng/i.test(ageGroup)) return WEEKDAY_DOMAIN_SCHEDULES.nhaTre;
  if (/^3/.test(String(ageGroup).trim())) return WEEKDAY_DOMAIN_SCHEDULES.mgBe;
  return WEEKDAY_DOMAIN_SCHEDULES.mgLon;
}
function weekdayScheduleNoticeText(ageGroup = '') {
  const schedule = weekdayScheduleForAgeGroup(ageGroup).map(([day, domain]) => `${day} — ${domain}`).join(' · ');
  return `Lịch lĩnh vực cố định theo thứ cho ${escapeHtml(ageGroup || 'độ tuổi đã chọn')}: ${schedule}. Mỗi dòng bên dưới: Nội dung hoạt động | Thứ hai | Thứ ba | Thứ tư | Thứ năm | Thứ sáu.`;
}
function domainMatches(objectiveDomain = '', lessonDomainText = '') {
  const normalize = (value) => String(value || '').toLowerCase().replace(/^giáo dục\s+/, '').trim();
  const a = normalize(objectiveDomain);
  const b = normalize(lessonDomainText);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}
function selectedObjectiveCodesFromPlan(plan = {}) {
  return plan.lessonObjectiveCodes && plan.lessonObjectiveCodes.length ? plan.lessonObjectiveCodes : (plan.lessonObjectiveCode ? [plan.lessonObjectiveCode] : []);
}
function renderObjectiveSummary(codes = []) {
  if (!codes.length) return '<span class="empty-inline">Chưa chọn mục tiêu nào.</span>';
  return codes.map((code) => { const obj = state.objectives.find((o) => o.code === code); return `<span class="chip teal" title="${escapeHtml(obj?.description || '')}">${escapeHtml(code)}</span>`; }).join(' ');
}
function objectiveHiddenInputs(codes = []) {
  return codes.map((code) => `<input type="hidden" name="lessonObjectiveCodes" value="${escapeHtml(code)}">`).join('');
}
const OBJECTIVE_STOPWORDS = new Set(['và','là','của','cho','ở','trong','với','để','một','các','những','theo','từ','bài','hoạt','động','học','giờ','trẻ','giáo','viên','được','có','khi','làm','này','đây','kia','hôm','tuần','tháng','năm','hoặc','về','đến','sau','trước','cùng','ngày','cuộc','việc','như','thế','bằng','mọi','tất','cả','toàn','phần','rất','gì','ai','sao','sáng','chiều','tối','buổi','chủ','đề']);
function lessonTextNormalize(value = '') {
  return String(value).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}
function lessonKeywordSet(title = '') {
  const rawTokens = lessonTextNormalize(title).split(/\s+/).filter(Boolean);
  const words = [...new Set(rawTokens.filter((word) => word.length >= 3 && !OBJECTIVE_STOPWORDS.has(word)))];
  const bigrams = [];
  for (let i = 0; i < rawTokens.length - 1; i += 1) {
    const a = rawTokens[i];
    const b = rawTokens[i + 1];
    if (a.length >= 2 && b.length >= 2 && !OBJECTIVE_STOPWORDS.has(a) && !OBJECTIVE_STOPWORDS.has(b)) bigrams.push(`${a} ${b}`);
  }
  return { words, bigrams: [...new Set(bigrams)] };
}
function objectiveMatchType(objective, { words, bigrams }) {
  const normalized = lessonTextNormalize(objective.description || '');
  if (bigrams.some((bigram) => normalized.includes(bigram))) return 'bigram';
  if (!words.length) return null;
  const tokens = normalized.split(/\s+/);
  return words.some((word) => tokens.includes(word)) ? 'word' : null;
}
function computeQuickSuggestions(ageGroup = '', lessonTitle = '', lessonDomain = '', limit = 8) {
  if (!ageGroup) return [];
  const allItems = state.objectives.filter((o) => o.ageGroup === ageGroup);
  const keywords = lessonKeywordSet(lessonTitle);
  const bigramMatches = allItems.filter((o) => objectiveMatchType(o, keywords) === 'bigram');
  const wordMatches = allItems.filter((o) => objectiveMatchType(o, keywords) === 'word');
  const domainOnly = allItems.filter((o) => domainMatches(o.domain, lessonDomain));
  const seen = new Set();
  const result = [];
  for (const list of [bigramMatches, wordMatches, domainOnly]) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      if (result.length >= limit) return result;
    }
  }
  return result;
}
function renderInlineSuggestions(plan = {}) {
  const ageGroup = plan.ageGroup || '';
  if (!ageGroup) return '<p class="empty-inline">Chọn Lớp trước để xem gợi ý mục tiêu.</p>';
  const selected = new Set(selectedObjectiveCodesFromPlan(plan));
  const items = computeQuickSuggestions(ageGroup, plan.lessonTitle || '', plan.lessonDomain || '');
  if (!items.length) return '<p class="empty-inline">Chưa có gợi ý — điền "Tên bài/hoạt động" hoặc "Lĩnh vực" ở trên, hoặc bấm "Xem tất cả mục tiêu" bên dưới.</p>';
  return items.map((o) => `<label class="objective-picker-item"><span class="objective-picker-text">${o.scope === 'system' ? '<span class="chip teal">Chung</span> ' : ''}<b>${escapeHtml(o.code)}</b> — ${escapeHtml((o.description || '').slice(0, 120))}</span><input type="checkbox" value="${escapeHtml(o.code)}" ${selected.has(o.code) ? 'checked' : ''}></label>`).join('');
}
function readPlanFormSnapshot() {
  const form = document.querySelector('#plan-form');
  if (!form) return null;
  const formData = new FormData(form);
  return {
    ageGroup: formData.get('ageGroup') || '',
    lessonTitle: formData.get('lessonTitle') || '',
    lessonDomain: formData.get('lessonDomain') || '',
    lessonObjectiveCodes: formData.getAll('lessonObjectiveCodes'),
  };
}
function refreshInlineSuggestions() {
  const box = document.querySelector('#lesson-objectives-suggest');
  const snapshot = readPlanFormSnapshot();
  if (!box || !snapshot) return;
  box.innerHTML = renderInlineSuggestions(snapshot);
}
function toggleQuickSuggestion(code, checked) {
  const hidden = document.querySelector('#lesson-objectives-hidden');
  const summaryEl = document.querySelector('#lesson-objectives-summary');
  if (!hidden || !summaryEl) return;
  const current = new Set(Array.from(hidden.querySelectorAll('input[name="lessonObjectiveCodes"]')).map((el) => el.value));
  if (checked) current.add(code); else current.delete(code);
  const codes = [...current];
  hidden.innerHTML = objectiveHiddenInputs(codes);
  summaryEl.innerHTML = renderObjectiveSummary(codes);
}
function openObjectivePicker() {
  const form = document.querySelector('#plan-form');
  if (!form) return;
  const formData = new FormData(form);
  const ageGroup = formData.get('ageGroup') || '';
  const lessonDomain = formData.get('lessonDomain') || '';
  const lessonTitle = formData.get('lessonTitle') || '';
  const selected = new Set(formData.getAll('lessonObjectiveCodes'));
  const keywords = lessonKeywordSet(lessonTitle);
  const allItems = state.objectives.filter((o) => o.ageGroup === ageGroup);
  const bigramMatches = allItems.filter((o) => objectiveMatchType(o, keywords) === 'bigram');
  const wordMatches = allItems.filter((o) => objectiveMatchType(o, keywords) === 'word');
  const lessonMatches = bigramMatches.length ? bigramMatches : wordMatches;
  const lessonMatchIds = new Set(lessonMatches.map((o) => o.id));
  const items = allItems.filter((o) => !lessonMatchIds.has(o.id));
  const row = (o, index) => `<label class="objective-picker-item"><span class="objective-picker-index">${index + 1}</span><span class="objective-picker-text">${o.scope === 'system' ? '<span class="chip teal">Chung</span> ' : ''}<b>${escapeHtml(o.code)}</b> — ${escapeHtml(o.description || '')}</span><input type="checkbox" value="${escapeHtml(o.code)}" ${selected.has(o.code) ? 'checked' : ''}></label>`;
  const groups = domainsForAgeGroup(ageGroup).map((domain) => ({ domain, items: items.filter((o) => o.domain === domain) })).filter((g) => g.items.length);
  const lessonSection = lessonMatches.length ? `<section class="objective-picker-group is-suggested"><h4>Gợi ý theo tên bài học <span class="chip teal">Gợi ý</span></h4>${lessonMatches.map((o, index) => row(o, index)).join('')}</section>` : '';
  const domainSections = groups.map((g) => {
    const suggested = domainMatches(g.domain, lessonDomain);
    return `<section class="objective-picker-group${suggested ? ' is-suggested' : ''}"><h4>${escapeHtml(g.domain)}${suggested ? ' <span class="chip teal">Gợi ý</span>' : ''}</h4>${g.items.map((o, index) => row(o, index)).join('')}</section>`;
  }).join('');
  const body = (lessonSection || domainSections) ? `${lessonSection}${domainSections}` : `<div class="empty-state">Ngân hàng mục tiêu chưa có dữ liệu cho ${escapeHtml(ageGroup || 'độ tuổi này')}.</div>`;
  const introText = lessonMatches.length
    ? `Đã tìm thấy ${lessonMatches.length} mục tiêu khớp với tên bài học ở mục "Gợi ý theo tên bài học". Mục tiêu cùng lĩnh vực với ô "Lĩnh vực" cũng được đánh dấu Gợi ý. Có thể chọn nhiều mục tiêu.`
    : `Điền "Tên bài/hoạt động" trước khi mở mục này để thấy gợi ý mục tiêu khớp theo tên bài học. Mục tiêu cùng lĩnh vực với ô "Lĩnh vực" được đánh dấu Gợi ý. Có thể chọn nhiều mục tiêu.`;
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">NGÂN HÀNG MỤC TIÊU</span><h2>Chọn mục tiêu (MT) cho giáo án</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><p class="drawer-intro">${introText}</p><div id="objective-picker-body" class="objective-picker-dialog">${body}</div><div class="objective-picker-footer button-row"><button type="button" class="primary-button" data-save-objective-picker>Lưu</button><button type="button" class="secondary-button" data-close-drawer>Thoát</button></div></div>`);
}
const ASSESSMENT_LEVELS = ['Đạt', 'Chưa đạt', 'Cần hỗ trợ thêm'];

function syncPublicBranding(profile = {}) {
  const schoolName = String(profile.schoolName || profile.name || '').trim() || 'Trường Mầm non Số';
  const schoolYear = String(profile.schoolYear || '').trim() || '2026–2027';
  state.publicBranding = { schoolName, schoolYear };
  document.title = schoolName && schoolName !== 'Trường Mầm non Số' ? `${schoolName} · Trường Mầm non Số` : 'Trường Mầm non Số';
}

function loadWorkspace() {
  const defaults = { edits: {}, customRecords: [], plans: [], sourceDocuments: [], importHistory: [], importLog: [] };
  try {
    const stored = JSON.parse(localStorage.getItem('ctgdmn-open-workspace-v1'));
    return { ...defaults, ...(stored || {}) };
  } catch { return defaults; }
}

function saveWorkspace(action = 'data.update', targetType = 'workspace', targetId = 'main') {
  if (!state.currentUser || !window.ctgdmnDesktop?.saveRepositoryState) return;
  const payload={workspace:state.workspace,review:state.review,action,targetType,targetId};
  persistQueue=persistQueue.then(()=>window.ctgdmnDesktop.saveRepositoryState(payload)).catch((error)=>showToast(error.message||'Không thể lưu dữ liệu vào SQLite.'));
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
  saveWorkspace('review.update','review','main');
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

function renderDashboard() {
  const summary = state.data.summary;
  const progress = reviewSummary(state.data.documents, state.review);
  const issues = unresolvedIssues();
  const issueCounts = countBy(issues, 'category');
  const ageCards = state.data.ageGroups.map((age) => `
    <button class="age-card" data-age-open="${escapeHtml(age.label)}">
      <strong>${escapeHtml(age.label)}</strong>
      <b>${age.documents}</b>
      <span>${formatNumber(age.pages)} trang • ${age.collections} chủ đề/tháng</span>
    </button>`).join('');
  const issueRows = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, count]) => `
      <div class="issue-summary-item">
        <i class="issue-dot"></i><div><strong>${escapeHtml(category)}</strong><span>Cần người có trách nhiệm kiểm tra</span></div><b>${count}</b>
      </div>`).join('');

  els.main.innerHTML = `
    ${pageHead('Tổng quan', 'Kho dữ liệu mở và kế hoạch giáo dục', 'PDF được giữ làm nguồn đối chiếu; dữ liệu làm việc có thể chỉnh sửa, tái sử dụng và xuất ra định dạng mở.', '<button class="primary-button" data-route-jump="planner">Soạn giáo án mới</button>')}
    <section class="stats-grid">
      ${statCard('▤', 'TÀI LIỆU ĐÃ LẬP CHỈ MỤC', formatNumber(summary.documents), 'Đủ 5 nhóm độ tuổi')}
      ${statCard('▧', 'TỔNG SỐ TRANG', formatNumber(summary.pages), 'Có thể tìm kiếm toàn văn')}
      ${statCard('◫', 'CHỦ ĐỀ / THÁNG', formatNumber(summary.collections), 'Theo cấu trúc hồ sơ gốc')}
      ${statCard('!', 'NỘI DUNG CẦN RÀ SOÁT', formatNumber(issues.length), 'Không tự động sửa dữ liệu nguồn')}
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-title-row"><div><h2>Tiến độ rà soát hồ sơ</h2><p class="panel-subtitle">Đánh dấu sau khi đã đối chiếu với PDF gốc.</p></div><b class="metric-highlight">${progress.percent}%</b></div>
        <div class="progress-track"><span style="width:${progress.percent}%"></span></div>
        <div class="progress-meta"><span>${progress.reviewed}/${progress.total} tài liệu đã rà soát</span><span>${progress.watch} tài liệu đang theo dõi</span></div>
        <div class="age-cards">${ageCards}</div>
      </article>
      <article class="panel">
        <div class="panel-title-row"><div><h2>Việc cần kiểm tra</h2><p class="panel-subtitle">Cảnh báo được phát hiện từ nội dung nguồn.</p></div><span class="chip coral">${issues.length} việc</span></div>
        <div class="issue-list">${issueRows || '<div class="empty-state"><strong>Đã xử lý hết</strong>Không còn cảnh báo chưa xác nhận.</div>'}</div>
        <button class="ghost-button" data-route-jump="review">Mở danh sách kiểm tra →</button>
      </article>
      <article class="panel">
        <div class="panel-title-row"><div><h2>Cấu trúc dữ liệu theo độ tuổi</h2><p class="panel-subtitle">Số lượng tài liệu của từng nhóm lớp.</p></div><button class="secondary-button" data-route-jump="reports">Xem báo cáo</button></div>
        <div class="bar-list">
          ${state.data.ageGroups.map((age) => `<div class="bar-item"><label>${escapeHtml(age.label)}</label><div class="bar"><span style="width:${Math.round(age.documents / 54 * 100)}%"></span></div><b>${age.documents}</b></div>`).join('')}
        </div>
      </article>
      <article class="panel">
        <div class="panel-title-row"><div><h2>Thao tác nhanh</h2><p class="panel-subtitle">Các công việc sử dụng thường xuyên.</p></div></div>
        <div class="quick-actions">
          <button class="quick-action" data-route-jump="objectives"><i>◎</i><strong>Mục tiêu/chủ đề</strong></button>
          <button class="quick-action" data-route-jump="weekly"><i>▣</i><strong>Kế hoạch tuần</strong></button>
          <button class="quick-action" data-route-jump="review"><i>!</i><strong>Kiểm tra dữ liệu</strong></button>
          <button class="quick-action" data-route-jump="backup"><i>▱</i><strong>Sao lưu rà soát</strong></button>
        </div>
      </article>
    </section>`;
}

function renderWorkCenter() {
  const summary = state.data.summary;
  const issues = unresolvedIssues();
  const plans = state.workspace.plans || [];
  const records = openRecords();
  const drafts = plans.filter((plan) => !plan.status || ['Bản nháp', 'Yêu cầu chỉnh sửa'].includes(plan.status));
  const unallocated = records.filter((record) => record.objective && !record.allocatedMonth).length;
  const pendingReview = plans.filter((plan) => ['Gửi rà soát', 'Cần rà soát', 'Đã rà soát'].includes(plan.status)).length;
  const missingEvidence = plans.filter((plan) => !(plan.assessment || '').trim()).length;
  const nearDue = plans.filter((plan) => (plan.period || '').trim()).length;
  const tasks = [
    { icon: '✎', title: 'Tiếp tục kế hoạch đang soạn', count: drafts.length, note: drafts.length ? 'Mở kế hoạch đã lưu gần nhất' : 'Chưa có kế hoạch đang soạn', route: 'planner' },
    { icon: '◎', title: 'Mục tiêu chưa phân bổ', count: unallocated, note: 'Kiểm tra mục tiêu trong dữ liệu làm việc', route: 'open-data' },
    { icon: '✓', title: 'Kế hoạch chờ rà soát', count: pendingReview, note: 'Mở hàng đợi rà soát – phê duyệt', route: 'approval' },
    { icon: '◉', title: 'Kế hoạch thiếu minh chứng', count: missingEvidence, note: 'Bổ sung đánh giá và điều chỉnh', route: 'evaluation' },
    { icon: '!', title: 'Cảnh báo dữ liệu chưa xử lý', count: issues.length, note: 'Đối chiếu với PDF nguồn', route: 'approval' },
    { icon: '□', title: 'Công việc gần đến hạn', count: nearDue, note: 'Kiểm tra thời gian trong kế hoạch', route: 'planner' },
  ];

  els.main.innerHTML = `
    ${pageHead('Năm học 2026–2027', 'Trung tâm công việc', 'Theo dõi việc cần làm và tiếp tục đúng bước trong quá trình xây dựng chương trình giáo dục nhà trường.', '<button class="primary-button" data-route-jump="planner">Xây dựng kế hoạch năm học 2026–2027</button>')}
    <section class="work-task-grid">
      ${tasks.map((task) => `<button class="work-task-card" data-route-jump="${task.route}"><i>${task.icon}</i><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.note)}</small></span><b>${task.count}</b></button>`).join('')}
    </section>
    <details class="panel document-summary">
      <summary><span><strong>Thống kê tài liệu nguồn</strong><small>Thông tin phụ về 246 PDF, có thể thu gọn</small></span><i>⌄</i></summary>
      <section class="stats-grid compact-stats">
        ${statCard('▤', 'TÀI LIỆU PDF', formatNumber(summary.documents), 'Đủ 5 nhóm độ tuổi')}
        ${statCard('▧', 'TỔNG SỐ TRANG', formatNumber(summary.pages), 'Có thể tìm kiếm toàn văn')}
        ${statCard('◫', 'CHỦ ĐỀ / THÁNG', formatNumber(summary.collections), 'Theo hồ sơ gốc')}
        ${statCard('!', 'CẢNH BÁO NGUỒN', formatNumber(issues.length), 'Cần người phụ trách kiểm tra')}
      </section>
      <div class="button-row"><button class="secondary-button" data-route-jump="library">Mở kho PDF nguồn</button><button class="ghost-button" data-route-jump="reports">Xem báo cáo</button></div>
    </details>`;
}

function programThemes() {
  const groups = new Map();
  for (const doc of state.data.documents) {
    const key = `${doc.ageGroup}\u0000${doc.collection}`;
    if (!groups.has(key)) groups.set(key, { ageGroup: doc.ageGroup, collection: doc.collection, documents: 0, types: new Set(), objectiveDocId: '' });
    const entry = groups.get(key);
    entry.documents += 1;
    entry.types.add(doc.documentType);
    if (!entry.objectiveDocId && doc.documentType === 'Mục tiêu/kế hoạch chủ đề') entry.objectiveDocId = doc.id;
  }
  return [...groups.values()].sort((a, b) => a.ageGroup.localeCompare(b.ageGroup, 'vi') || a.collection.localeCompare(b.collection, 'vi'));
}

function openThemePicker() {
  const form = document.querySelector('#plan-form');
  const currentAge = form?.elements.ageGroup?.value || 'all';
  const themes = programThemes().filter((theme) => currentAge === 'all' || theme.ageGroup === currentAge);
  els.drawerContent.innerHTML = `<header class="drawer-header"><div><span class="chip teal">NGÂN HÀNG CHỦ ĐỀ</span><h2>Chọn chủ đề</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><div class="document-list">${themes.map((theme) => `<article class="document-card"><div class="doc-mark">${escapeHtml(theme.ageGroup)}</div><div><h3>${escapeHtml(theme.collection)}</h3><p>${theme.documents} tài liệu nguồn</p></div><div class="doc-actions"><button class="small-button" data-apply-theme="${escapeHtml(theme.ageGroup)}|||${escapeHtml(theme.collection)}">Dùng chủ đề này</button></div></article>`).join('') || '<div class="empty-state">Không có chủ đề phù hợp với độ tuổi đã chọn.</div>'}</div></div>`;
  els.drawerBackdrop.classList.remove('is-hidden'); els.drawer.classList.add('is-open'); els.drawer.setAttribute('aria-hidden', 'false');
}

function themeToPlanSeed(ageGroup, collection) {
  const docs = state.data.documents.filter((doc) => doc.ageGroup === ageGroup && doc.collection === collection);
  const hasWeekly = docs.some((doc) => /tuần/i.test(doc.documentType || ''));
  const hasMonthly = docs.some((doc) => /tháng|chủ đề/i.test(doc.documentType || ''));
  const level = hasWeekly && !hasMonthly ? 'Tuần' : 'Chủ đề';
  return { ageGroup, level, title: collection, weeklyTheme: level === 'Tuần' ? collection : '', schoolYear: schoolProfile().schoolYear };
}

function openChildEditor() {
  els.drawerContent.innerHTML = `<header class="drawer-header"><div><span class="chip teal">HỒ SƠ TRẺ</span><h2>Thêm hồ sơ trẻ</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="child-form" class="plan-form">
    <label class="field"><span>Họ và tên *</span><input class="input" name="fullName" required></label>
    <div class="form-grid"><label class="field"><span>Mã số học sinh</span><input class="input" name="studentCode"></label><label class="field"><span>Năm sinh</span><input class="input" name="birthYear" placeholder="Ví dụ: 2021"></label></div>
    <label class="field"><span>Lớp/nhóm</span><input class="input" name="classLabel" placeholder="Tự đặt tên lớp của riêng cô, ví dụ: Lớp 4 tuổi A"></label>
    <div class="notice">Chỉ chính cô nhìn thấy hồ sơ này; dữ liệu không được gửi cho AI hay chia sẻ với tài khoản khác.</div>
    <button class="primary-button" type="submit">Lưu hồ sơ</button>
  </form></div>`;
  els.drawerBackdrop.classList.remove('is-hidden'); els.drawer.classList.add('is-open'); els.drawer.setAttribute('aria-hidden', 'false');
}

function renderEvaluation() {
  const children = state.children;
  const selected = children.find((child) => child.id === state.selectedChildId) || null;
  const assessments = state.childAssessments;
  els.main.innerHTML = `${pageHead('Theo dõi thực hiện', 'Đánh giá và điều chỉnh', 'Ghi nhận biểu hiện quan sát, minh chứng và điều chỉnh cho từng trẻ theo 5 lĩnh vực phát triển. Hồ sơ chỉ hiển thị với chính giáo viên đã tạo, không chia sẻ với tài khoản khác và không được gửi cho AI.', '<button class="primary-button" data-add-child>Thêm hồ sơ trẻ</button>')}
    <section class="planner-layout">
      <div>${selected ? `<article class="panel">
          <div class="panel-title-row"><div><h2>${escapeHtml(selected.fullName)}</h2><p class="panel-subtitle">${escapeHtml(selected.studentCode || 'Chưa có mã số')}${selected.classLabel ? ` • ${escapeHtml(selected.classLabel)}` : ''}</p></div><button class="secondary-button" data-deactivate-child="${selected.id}">Ngừng theo dõi</button></div>
          <form id="assessment-form" class="plan-form">
            <input type="hidden" name="childId" value="${selected.id}">
            <div class="form-grid"><label class="field"><span>Lĩnh vực phát triển *</span><select class="select" required name="domain">${DEVELOPMENT_DOMAINS.map((domain) => `<option>${escapeHtml(domain)}</option>`).join('')}</select></label><label class="field"><span>Mức độ *</span><select class="select" required name="level">${ASSESSMENT_LEVELS.map((level) => `<option>${escapeHtml(level)}</option>`).join('')}</select></label></div>
            <label class="field"><span>Giai đoạn/thời điểm</span><input class="input" name="period" placeholder="Ví dụ: Cuối chủ đề Gia đình, tháng 10/2026"></label>
            <label class="field"><span>Kế hoạch liên quan</span><select class="select" name="planId"><option value="">— Không liên kết —</option>${state.workspace.plans.map((plan) => `<option value="${plan.id}">${escapeHtml(plan.title)}</option>`).join('')}</select></label>
            <label class="field"><span>Biểu hiện quan sát được</span><textarea name="observation" placeholder="Không nhập thông tin sức khỏe, khuyết tật hoặc dữ liệu nhạy cảm khác của trẻ."></textarea></label>
            <label class="field"><span>Minh chứng</span><textarea name="evidence"></textarea></label>
            <label class="field"><span>Điều chỉnh đề xuất</span><textarea name="adjustment"></textarea></label>
            <div class="button-row"><button class="primary-button" type="submit">Lưu đánh giá</button></div>
          </form>
        </article>
        <article class="panel">
          <div class="panel-title-row"><div><h2>Lịch sử đánh giá</h2><p class="panel-subtitle">${assessments.length} bản ghi</p></div></div>
          <div class="review-timeline">${assessments.map((item) => `<article><i></i><header><strong>${escapeHtml(item.domain)}</strong><span class="chip ${item.level === 'Đạt' ? 'teal' : item.level === 'Chưa đạt' ? 'amber' : ''}">${escapeHtml(item.level)}</span></header><small>${escapeHtml(item.period || '')}${item.period ? ' • ' : ''}${new Date(item.createdAt).toLocaleString('vi-VN')}</small><p>${escapeHtml(item.observation || '')}</p>${item.evidence ? `<div class="review-response"><b>Minh chứng:</b> ${escapeHtml(item.evidence)}</div>` : ''}${item.adjustment ? `<div class="review-response"><b>Điều chỉnh:</b> ${escapeHtml(item.adjustment)}</div>` : ''}<button class="small-button" data-delete-assessment="${item.id}">Xóa bản ghi</button></article>`).join('') || '<div class="empty-state">Chưa có đánh giá nào cho trẻ này.</div>'}</div>
        </article>` : '<div class="empty-state">Chọn một trẻ ở danh sách bên phải hoặc thêm hồ sơ mới để bắt đầu ghi nhận đánh giá.</div>'}
      </div>
      <aside class="panel plan-list">
        <div class="panel-title-row"><div><h2>Danh sách trẻ</h2><p class="panel-subtitle">${children.length} hồ sơ đang theo dõi</p></div></div>
        ${children.map((child) => `<button class="saved-plan ${child.id === state.selectedChildId ? 'is-active' : ''}" data-select-child="${child.id}"><strong>${escapeHtml(child.fullName)}</strong><span>${escapeHtml(child.studentCode || 'Chưa có mã số')}${child.classLabel ? ` • ${escapeHtml(child.classLabel)}` : ''}</span></button>`).join('') || '<div class="empty-state">Chưa có hồ sơ trẻ.</div>'}
      </aside>
    </section>`;
}

function renderTemporaryRoute(route) {
  const configs = {
    approval: { eyebrow: 'Quy trình chuyên môn', title: 'Rà soát – phê duyệt', description: 'Theo dõi hồ sơ chờ rà soát, yêu cầu chỉnh sửa và lịch sử phê duyệt.', icon: '✓', action: '<button class="primary-button" data-route-jump="review">Mở cảnh báo dữ liệu nguồn</button>', note: `${unresolvedIssues().length} cảnh báo PDF nguồn chưa được xác nhận xử lý.` },
    'online-resources': { eyebrow: 'Kết nối có kiểm soát', title: 'AI và nguồn trực tuyến', description: 'Khu vực chuẩn bị liên kết HTTPS và công cụ hỗ trợ; ứng dụng vẫn hoạt động hoàn toàn ngoại tuyến.', icon: '⌁', action: '', note: 'Không tự động gửi dữ liệu và không đưa thông tin cá nhân của trẻ lên dịch vụ công cộng.' },
    settings: { eyebrow: 'Quản trị', title: 'Cài đặt', description: 'Cấu hình năm học, đơn vị, nguyên tắc dữ liệu và các tùy chọn ứng dụng.', icon: '○', action: '<button class="secondary-button" data-route-jump="backup">Mở dữ liệu và sao lưu</button>', note: 'Dữ liệu người dùng tiếp tục được lưu bằng các khóa localStorage hiện có.' },
  };
  const config = configs[route];
  els.main.innerHTML = `${pageHead(config.eyebrow, config.title, config.description)}
    <section class="panel route-placeholder"><i>${config.icon}</i><h2>${escapeHtml(config.title)}</h2><p>${escapeHtml(config.note)}</p>${config.action}<div class="notice">Màn hình đã sẵn sàng cho các bước triển khai tiếp theo và không thay thế hoặc xóa chức năng đang hoạt động.</div></section>`;
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

function schoolProfile() { return state.workspace.schoolProfile || defaultSchoolProfile(state.data?.meta); }
function staffName(id, fallback = '') { return state.workspace.staff.find((item) => item.id === id)?.name || fallback; }
function className(id, fallback = '') { return state.workspace.classes.find((item) => item.id === id)?.name || fallback; }
function activeStaff(role = '') { return state.workspace.staff.filter((item) => item.active !== false && (!role || item.roles.includes(role))); }
function hasRole(role){return (state.currentUser?.roles||[]).includes(role);}

function settingsTabs() {
  const tabs=[['school','Thông tin nhà trường'],['classes','Danh mục lớp'],['staff','Giáo viên và cán bộ'],['signatures','Chữ ký và người ký'],['templates','Mẫu văn bản'],['ai','Kết nối GenAI']];if(hasRole('system_admin'))tabs.push(['accounts','Tài khoản và hệ thống']);
  return `<nav class="settings-tabs">${tabs.map(([key,label]) => `<button data-settings-tab="${key}" class="${state.settingsTab===key?'is-active':''}">${label}</button>`).join('')}</nav>`;
}

function renderSchoolSettings() {
  const school = schoolProfile();
  return `<form id="school-form" class="panel plan-form settings-form">
    <div class="panel-title-row"><div><h2>Thông tin nhà trường</h2><p class="panel-subtitle">Thông tin này được dùng thống nhất trên giao diện, kế hoạch, Word và Excel.</p></div>${school.logoData ? `<img class="school-logo-preview" src="${school.logoData}" alt="Logo nhà trường">` : ''}</div>
    <div class="form-grid"><label class="field"><span>Tên trường *</span><input class="input" name="name" required value="${escapeHtml(school.name)}"></label><label class="field"><span>Đơn vị chủ quản</span><input class="input" name="governingBody" value="${escapeHtml(school.governingBody)}"></label></div>
    <label class="field"><span>Địa chỉ</span><input class="input" name="address" value="${escapeHtml(school.address)}"></label>
    <div class="form-grid"><label class="field"><span>Điện thoại</span><input class="input" name="phone" value="${escapeHtml(school.phone)}"></label><label class="field"><span>Email</span><input class="input" type="email" name="email" value="${escapeHtml(school.email)}"></label></div>
    <div class="form-grid"><label class="field"><span>Mã trường</span><input class="input" name="schoolCode" value="${escapeHtml(school.schoolCode)}"></label><label class="field"><span>Năm học mặc định *</span><input class="input" required name="schoolYear" value="${escapeHtml(school.schoolYear)}"></label></div>
    <div class="form-grid"><label class="field"><span>Hiệu trưởng</span><input class="input" name="principal" value="${escapeHtml(school.principal)}"></label><label class="field"><span>Phó hiệu trưởng/phụ trách chuyên môn</span><input class="input" name="vicePrincipal" value="${escapeHtml(school.vicePrincipal)}"></label></div>
    <div class="form-grid"><label class="field"><span>Địa danh dùng khi ký</span><input class="input" name="signingPlace" value="${escapeHtml(school.signingPlace)}"></label><label class="field"><span>Logo PNG/JPG (tối đa 2 MB, 2400 px)</span><input class="input" id="school-logo-file" type="file" accept="image/png,image/jpeg"></label></div>
    <div class="button-row"><button class="primary-button" type="submit">Lưu thông tin</button><button class="secondary-button" type="button" data-reset-school>Khôi phục thông tin mặc định</button></div>
  </form>`;
}

function renderClassSettings() {
  const rows = state.workspace.classes;
  return `<section class="panel"><div class="panel-title-row"><div><h2>Danh mục lớp</h2><p class="panel-subtitle">Lớp đã có kế hoạch chỉ được chuyển sang trạng thái ngừng sử dụng.</p></div><div class="button-row"><button class="secondary-button" data-directory-template="classes">Tệp Excel mẫu</button><button class="secondary-button" data-directory-import="classes">Nhập Excel</button><button class="secondary-button" data-directory-export="classes">Xuất Excel</button><button class="primary-button" data-add-class>Thêm lớp</button></div></div>
    <div class="table-scroll"><table class="directory-table"><thead><tr><th>ID</th><th>Tên lớp</th><th>Độ tuổi</th><th>Năm học</th><th>Số trẻ</th><th>Giáo viên</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map((item)=>`<tr><td>${escapeHtml(item.id)}</td><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.ageGroup)}</td><td>${escapeHtml(item.schoolYear)}</td><td>${item.childCount}</td><td>${escapeHtml(staffName(item.leadTeacherId,'—'))}</td><td><span class="chip ${item.active?'teal':''}">${item.active?'Đang sử dụng':'Ngừng sử dụng'}</span></td><td><div class="button-row"><button class="small-button" data-edit-class="${item.id}">Sửa</button>${item.active?`<button class="small-button" data-deactivate-class="${item.id}">Ngừng dùng</button>`:''}</div></td></tr>`).join('') || '<tr><td colspan="8">Chưa có lớp. Có thể thêm thủ công hoặc nhập từ Excel.</td></tr>'}</tbody></table></div></section>`;
}

function renderStaffSettings() {
  const rows = state.workspace.staff;
  return `<section class="panel"><div class="panel-title-row"><div><h2>Giáo viên và cán bộ</h2><p class="panel-subtitle">Nhân sự có lịch sử không bị xóa; chỉ chuyển sang ngừng sử dụng.</p></div><div class="button-row"><button class="secondary-button" data-directory-template="staff">Tệp Excel mẫu</button><button class="secondary-button" data-directory-import="staff">Nhập Excel</button><button class="secondary-button" data-directory-export="staff">Xuất Excel</button><button class="primary-button" data-add-staff>Thêm nhân sự</button></div></div>
    <div class="directory-grid">${rows.map((item)=>`<article><header><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.title)} • ${escapeHtml(item.team||'Chưa chọn tổ')}</small></div><span class="chip ${item.active?'teal':''}">${item.active?'Đang công tác':'Ngừng sử dụng'}</span></header><p>${item.roles.map((role)=>`<span class="chip">${escapeHtml(role)}</span>`).join(' ')}</p><footer><button class="small-button" data-edit-staff="${item.id}">Sửa</button>${item.active?`<button class="small-button" data-deactivate-staff="${item.id}">Ngừng dùng</button>`:''}</footer></article>`).join('') || '<div class="empty-state">Chưa có nhân sự chuyên môn.</div>'}</div></section>`;
}

function renderSignatureSettings() {
  return `<section class="panel"><div class="panel-title-row"><div><h2>Chữ ký và người ký</h2><p class="panel-subtitle">Ảnh được lưu cục bộ và chỉ chèn khi người dùng chủ động xác nhận.</p></div><div class="button-row"><button class="ghost-button" data-guide-context="signatures">Xem hướng dẫn</button><button class="primary-button" data-add-signature>Thêm cấu hình</button></div></div>
    <div class="legal-warning"><strong>Ảnh chữ ký trong ứng dụng không phải chữ ký số và không tự tạo giá trị pháp lý.</strong></div>
    <div class="signature-grid">${state.workspace.signatures.map((item)=>`<article><div class="signature-preview">${item.imageData?`<img src="${item.imageData}" alt="Ảnh chữ ký">`:'<span>Khoảng trống ký tay</span>'}</div><strong>${escapeHtml(staffName(item.staffId,item.name))}</strong><small>${escapeHtml(item.displayTitle||item.role)}</small><div class="doc-meta"><span class="chip ${item.enabled?'teal':''}">${item.enabled?'Đang bật':'Đang tắt'}</span></div><div class="button-row"><button class="small-button" data-edit-signature="${item.id}">Sửa</button>${item.imageData?`<button class="small-button" data-remove-signature-image="${item.id}">Xóa ảnh</button>`:''}</div></article>`).join('') || '<div class="empty-state">Chưa có cấu hình chữ ký.</div>'}</div></section>`;
}

function renderAccountSettings(){return `<section class="panel"><div class="panel-title-row"><div><h2>Yêu cầu cấp tài khoản chờ duyệt</h2><p class="panel-subtitle">Người mới tự gửi yêu cầu ở màn hình đăng nhập; bạn duyệt hoặc từ chối tại đây.</p></div></div><div class="table-scroll"><table class="directory-table"><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Chức vụ</th><th>Tổ/Lớp</th><th>Thời gian gửi</th><th></th></tr></thead><tbody>${(state.accountRequests||[]).map((r)=>`<tr><td>${escapeHtml(r.fullName)}</td><td>${escapeHtml(r.username)}</td><td>${escapeHtml(r.title||'—')}</td><td>${escapeHtml(r.team||'—')}</td><td>${new Date(r.createdAt).toLocaleString('vi-VN')}</td><td><div class="button-row"><button class="small-button" data-approve-request="${r.id}">Duyệt</button><button class="small-button" data-reject-request="${r.id}">Từ chối</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty-state">Không có yêu cầu nào đang chờ.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-title-row"><div><h2>Tài khoản và phân quyền</h2><p class="panel-subtitle">Mật khẩu được băm bằng scrypt và không bao giờ hiển thị hoặc ghi vào nhật ký.</p></div><div class="button-row"><button class="secondary-button" data-import-users>Nhập tài khoản Excel</button><button class="primary-button" data-add-user>Tạo tài khoản</button></div></div><div class="table-scroll"><table class="directory-table"><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Phạm vi</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.users.map((user)=>`<tr><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.fullName)}</td><td>${user.roles.map((role)=>`<span class="chip">${escapeHtml(ROLE_LABELS[role]||role)}</span>`).join(' ')}</td><td>${escapeHtml(user.team||'Toàn trường/lớp được gán')}</td><td><span class="chip ${user.active?'teal':'amber'}">${user.active?'Hoạt động':'Đã khóa'}</span></td><td><div class="button-row"><button class="small-button" data-reset-user-password="${user.id}">Đặt lại mật khẩu</button><button class="small-button" data-lock-user="${user.id}" data-locked="${user.active?'true':'false'}">${user.active?'Khóa':'Mở khóa'}</button></div></td></tr>`).join('')}</tbody></table></div></section><section class="panel system-config"><h2>Chế độ lưu trữ</h2><form id="system-config-form" class="plan-form"><label class="field"><span>Chế độ vận hành</span><select class="select" name="repositoryMode"><option value="local" ${state.systemConfig.repositoryMode!=='lan'?'selected':''}>Một máy — SQLite cục bộ</option><option value="lan" ${state.systemConfig.repositoryMode==='lan'?'selected':''}>Mạng nội bộ nhà trường</option></select></label><label class="field"><span>Địa chỉ máy chủ LAN</span><input class="input" name="serverUrl" value="${escapeHtml(state.systemConfig.serverUrl||'')}" placeholder="http://192.168.1.10:8787"></label><label class="field"><span>Tự đăng xuất sau (phút)</span><input class="input" type="number" min="5" max="480" name="idleMinutes" value="${state.systemConfig.idleMinutes||30}"></label><div class="connection-state ${state.systemConfig.repositoryMode==='lan'?'offline':'online'}">${state.systemConfig.repositoryMode==='lan'?'Chưa kết nối máy chủ LAN — ứng dụng sẽ không ghi âm thầm khi chưa có máy chủ.':'SQLite cục bộ đang hoạt động'}</div><button class="primary-button">Lưu cấu hình</button></form></section><section class="panel"><div class="panel-title-row"><div><h2>Nhật ký hoạt động</h2><p class="panel-subtitle">Chỉ quản trị được xem; không chứa mật khẩu.</p></div><button class="secondary-button" data-refresh-audit>Làm mới</button></div><div class="log-list">${state.auditLog.slice(0,100).map((row)=>`<div><strong>${escapeHtml(row.action)}</strong><span>${new Date(row.created_at).toLocaleString('vi-VN')} • ${escapeHtml(row.target_type||'')}</span><b>${escapeHtml(row.result)}</b></div>`).join('')||'<div class="empty-state">Chưa nạp nhật ký.</div>'}</div></section>`;}

function aiStatusLabel() {
  if (!state.online) return ['Ngoại tuyến - vẫn có thể soạn và xuất kế hoạch', 'offline'];
  if (!state.aiConfig.provider) return ['Có mạng - chưa cấu hình GenAI', 'offline'];
  const status=state.aiConfig.lastTest?.status;
  const labels={ready:'GenAI đã sẵn sàng',invalid_key:'Khóa API không hợp lệ',quota:'Không đủ hạn mức sử dụng',model_unavailable:'Mô hình không tồn tại hoặc chưa được cấp quyền',unavailable:'Dịch vụ GenAI tạm thời không phản hồi',timeout:'Yêu cầu bị hết thời gian chờ'};
  return [labels[status]||'Đã cấu hình - chưa kiểm tra kết nối',status==='ready'?'online':'offline'];
}

function renderAISettings() {
  const config=state.aiConfig;
  const [label,kind]=aiStatusLabel();
  return `<section class="panel ai-settings"><div class="panel-title-row"><div><h2>Kết nối GenAI cục bộ</h2><p class="panel-subtitle">Khóa chỉ được dùng trong tiến trình chính Electron và được mã hóa bằng kho bảo mật Windows khi lưu trên máy.</p></div><span class="connection-state ${kind}">${escapeHtml(label)}</span></div>
    <form id="ai-config-form" class="plan-form">
      <div class="form-grid"><label class="field"><span>Nhà cung cấp</span><select class="select" name="provider" required><option value="">- Chọn nhà cung cấp -</option>${[['gemini','Google Gemini'],['openai','OpenAI'],['claude','Claude'],['compatible','Tương thích OpenAI']].map(([value,text])=>`<option value="${value}" ${config.provider===value?'selected':''}>${text}</option>`).join('')}</select></label><label class="field"><span>Tên mô hình</span><input class="input" required name="model" value="${escapeHtml(config.model||'')}" placeholder="Ví dụ: gpt-5.6-luna"></label></div>
      <label class="field"><span>Địa chỉ API</span><input class="input" name="baseUrl" value="${escapeHtml(config.baseUrl||'')}" placeholder="Để trống để dùng địa chỉ mặc định của nhà cung cấp"></label>
      <label class="field"><span>Khóa API ${config.maskedKey?`đang lưu: ${escapeHtml(config.maskedKey)}`:''}</span><input class="input" type="password" name="apiKey" autocomplete="new-password" placeholder="${config.maskedKey?'Để trống để giữ khóa hiện tại':'Nhập khóa API'}"></label>
      <div class="form-grid"><label class="field"><span>Thời gian chờ (mili giây)</span><input class="input" type="number" min="5000" max="180000" name="timeoutMs" value="${config.timeoutMs||60000}"></label><label class="field"><span>Số lần thử lại</span><input class="input" type="number" min="0" max="3" name="retries" value="${config.retries||0}"></label></div>
      <fieldset class="checkbox-group"><legend>Cách dùng khóa</legend><label><input type="radio" name="keyMode" value="session" ${config.keyMode==='session'?'checked':''}> Chỉ dùng trong phiên làm việc hiện tại</label><label><input type="radio" name="keyMode" value="machine" ${config.keyMode!=='session'?'checked':''}> Lưu an toàn trên máy này bằng Windows DPAPI</label></fieldset>
      <div class="privacy-warning"><strong>Dữ liệu được gửi khi dùng AI</strong><p>Chỉ gửi độ tuổi, chủ đề, thời gian, mục tiêu, nội dung, điều kiện lớp và yêu cầu soạn. Không gửi danh sách trẻ, sức khỏe, ngày sinh, địa chỉ, số điện thoại hay toàn bộ cơ sở dữ liệu.</p></div>
      <label><input type="checkbox" name="consentAccepted" ${config.consentAccepted?'checked':''}> Tôi hiểu nội dung cần thiết của kế hoạch sẽ được gửi đến nhà cung cấp GenAI đã chọn và không nhập dữ liệu nhạy cảm của trẻ.</label>
      <div class="button-row"><button class="primary-button" type="submit">Lưu cấu hình AI</button><button class="secondary-button" type="button" data-test-ai>Kiểm tra kết nối</button><button class="ghost-button" type="button" data-clear-ai>Xóa cấu hình AI</button></div>
    </form>
  </section>`;
}

function renderAIWorkspace() {
  const [label,kind]=aiStatusLabel();
  const pending=state.workspace.pendingAIRequests||[];
  els.main.innerHTML=`${pageHead('Kết nối có kiểm soát','AI và nguồn trực tuyến','GenAI chỉ hỗ trợ tạo, rà soát và điều chỉnh bản nháp. Chức năng ngoại tuyến không bị khóa.','<button class="primary-button" data-open-ai-settings>Mở cài đặt AI</button>')}
    <section class="panel assistant-card"><div class="assistant-mark">AI</div><div><span class="eyebrow">TRỢ LÝ CHUYÊN MÔN</span><h2>Cô giáo mầm non</h2><p class="panel-subtitle">Mở trợ lý ChatGPT dành cho giáo viên mầm non trong trình duyệt. Có thể cần đăng nhập ChatGPT.</p><div class="privacy-inline">Không nhập tên trẻ, hồ sơ sức khỏe, ngày sinh, địa chỉ, số điện thoại hoặc dữ liệu cá nhân khác.</div></div><button class="primary-button" data-open-trusted-resource="preschool-teacher-assistant" ${state.online?'':'disabled'}>${state.online?'Mở trợ lý AI':'Cần kết nối Internet'}</button></section>
    <section class="panel"><div class="panel-title-row"><div><h2>Trạng thái</h2><p class="panel-subtitle">${escapeHtml(state.aiConfig.provider?`${state.aiConfig.provider} - ${state.aiConfig.model}`:'Chưa chọn nhà cung cấp')}</p></div><span class="connection-state ${kind}">${escapeHtml(label)}</span></div><div class="button-row"><button class="secondary-button" data-test-ai>Kiểm tra lại</button><button class="ghost-button" data-route-jump="planner">Làm việc ngoại tuyến</button></div></section>
    <section class="panel"><div class="panel-title-row"><div><h2>Yêu cầu AI đang chờ</h2><p class="panel-subtitle">Ứng dụng không tự gửi khi có mạng. Mỗi yêu cầu phải được người dùng mở và xác nhận.</p></div></div>${pending.map((item)=>`<article class="pending-ai"><div><strong>${escapeHtml(item.title||'Yêu cầu soạn kế hoạch')}</strong><small>${new Date(item.createdAt).toLocaleString('vi-VN')}</small></div><div class="button-row"><button class="small-button" data-open-pending-ai="${item.id}">Xem và soạn tiếp</button><button class="small-button" data-delete-pending-ai="${item.id}">Xóa</button></div></article>`).join('')||'<div class="empty-state">Không có yêu cầu AI đang chờ.</div>'}</section>`;
}

function renderTemplateSettings() {
  const labels={annual:'Kế hoạch giáo dục năm',theme:'Kế hoạch chủ đề/tháng',weekly:'Kế hoạch giáo dục tuần',lesson:'Giáo án/hoạt động ngày'};
  return `<section class="panel"><div class="panel-title-row"><div><h2>Quản lý mẫu Word/PDF cục bộ</h2><p class="panel-subtitle">Bốn mẫu chuẩn tạo bảng động. Mẫu DOCX nhập thêm có thể dùng các biến dữ liệu và {{PLAN_TABLE}} trên một dòng riêng.</p></div><div class="button-row"><button class="secondary-button" data-backup-templates>Sao lưu mẫu</button><button class="secondary-button" data-restore-templates>Khôi phục mẫu</button><button class="primary-button" data-import-template>Nhập mẫu DOCX</button></div></div>
    <div class="notice">Biến hỗ trợ: {{SCHOOL_NAME}}, {{SCHOOL_YEAR}}, {{PLAN_TITLE}}, {{PLAN_PERIOD}}, {{PLAN_CLASS}}, {{PLAN_AUTHOR}}, {{PLAN_OBJECTIVES}}, {{PLAN_ACTIVITIES}}, {{PLAN_MATERIALS}}, {{PLAN_ASSESSMENT}} và {{PLAN_TABLE}}.</div>
    <div class="template-list">${Object.entries(labels).map(([type,label])=>{const items=state.templates.templates.filter((item)=>item.type===type);const selected=state.templates.defaultByType[type]||`builtin-${type}`;return `<article><h3>${label}</h3><label class="field"><span>Mẫu mặc định</span><select class="select" data-default-template="${type}">${items.map((item)=>`<option value="${item.id}" ${selected===item.id?'selected':''}>${escapeHtml(item.name)}${item.builtIn?' (tích hợp)':''}</option>`).join('')}</select></label><small>${items.filter((item)=>!item.builtIn).length} mẫu tùy chỉnh trên máy</small></article>`;}).join('')}</div>
  </section>`;
}

function renderSettings() {
  const content = state.settingsTab === 'school' ? renderSchoolSettings() : state.settingsTab === 'classes' ? renderClassSettings() : state.settingsTab === 'staff' ? renderStaffSettings() : state.settingsTab==='signatures'?renderSignatureSettings():state.settingsTab==='templates'?renderTemplateSettings():state.settingsTab==='ai'?renderAISettings():renderAccountSettings();
  els.main.innerHTML = `${pageHead('Quản trị cục bộ','Cài đặt','Quản lý hồ sơ nhà trường, lớp, nhân sự và cấu hình chữ ký dùng trong kế hoạch.')}${settingsTabs()}${content}`;
}

function openClassEditor(classId = '') {
  const item = state.workspace.classes.find((entry)=>entry.id===classId) || {id:'',schoolYear:schoolProfile().schoolYear,active:true,collaboratingTeacherIds:[]};
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">DANH MỤC LỚP</span><h2>${classId?'Sửa lớp':'Thêm lớp'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="class-form" class="plan-form"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><label class="field"><span>Tên lớp *</span><input class="input" required name="name" value="${escapeHtml(item.name||'')}"></label><div class="form-grid"><label class="field"><span>Nhóm độ tuổi *</span><input class="input" required name="ageGroup" value="${escapeHtml(item.ageGroup||'')}"></label><label class="field"><span>Năm học *</span><input class="input" required name="schoolYear" value="${escapeHtml(item.schoolYear)}"></label></div><div class="form-grid"><label class="field"><span>Điểm trường</span><input class="input" name="campus" value="${escapeHtml(item.campus||'')}"></label><label class="field"><span>Số lượng trẻ</span><input class="input" type="number" min="0" name="childCount" value="${item.childCount||0}"></label></div><label class="field"><span>Giáo viên phụ trách</span><select class="select" name="leadTeacherId"><option value="">— Chưa chọn —</option>${activeStaff().map((person)=>`<option value="${person.id}" ${item.leadTeacherId===person.id?'selected':''}>${escapeHtml(person.name)}</option>`).join('')}</select></label><label class="field"><span>Ghi chú</span><textarea name="notes">${escapeHtml(item.notes||'')}</textarea></label><button class="primary-button">Lưu lớp</button></form></div>`);
}

function openStaffEditor(staffId = '') {
  const item = state.workspace.staff.find((entry)=>entry.id===staffId) || {id:'',roles:['Người soạn'],active:true,classIds:[]};
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">NHÂN SỰ</span><h2>${staffId?'Sửa nhân sự':'Thêm nhân sự'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="staff-form" class="plan-form"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><label class="field"><span>Họ và tên *</span><input class="input" required name="name" value="${escapeHtml(item.name||'')}"></label><div class="form-grid"><label class="field"><span>Chức vụ *</span><input class="input" required name="title" value="${escapeHtml(item.title||'')}"></label><label class="field"><span>Tổ chuyên môn</span><input class="input" name="team" value="${escapeHtml(item.team||'')}"></label></div><fieldset class="checkbox-group"><legend>Vai trò trong ứng dụng *</legend>${STAFF_ROLES.map((role)=>`<label><input type="checkbox" name="roles" value="${role}" ${item.roles.includes(role)?'checked':''}> ${role}</label>`).join('')}</fieldset><label class="field"><span>Thông tin liên hệ (tùy chọn)</span><input class="input" name="contact" value="${escapeHtml(item.contact||'')}"></label><button class="primary-button">Lưu nhân sự</button></form></div>`);
}

function openSignatureEditor(signatureId = '') {
  const item = state.workspace.signatures.find((entry)=>entry.id===signatureId) || {id:'',role:SIGNATURE_ROLES[0],enabled:true,displayWidth:120}; state.pendingImageData = item.imageData || '';
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">CHỮ KÝ CỤC BỘ</span><h2>${signatureId?'Sửa cấu hình':'Thêm cấu hình chữ ký'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="signature-form" class="plan-form"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><label class="field"><span>Người ký *</span><select class="select" required name="staffId"><option value="">— Chọn cán bộ —</option>${state.workspace.staff.map((person)=>`<option value="${person.id}" ${item.staffId===person.id?'selected':''}>${escapeHtml(person.name)} — ${escapeHtml(person.title)}</option>`).join('')}</select></label><label class="field"><span>Vai trò ký</span><select class="select" name="role">${SIGNATURE_ROLES.map((role)=>`<option ${item.role===role?'selected':''}>${role}</option>`).join('')}</select></label><label class="field"><span>Dòng chức danh hiển thị</span><input class="input" name="displayTitle" value="${escapeHtml(item.displayTitle||'')}"></label><div id="signature-image-preview" class="signature-preview large">${item.imageData?`<img src="${item.imageData}">`:'<span>Chưa chọn ảnh — sẽ để khoảng trống ký tay</span>'}</div><label class="field"><span>Ảnh PNG/JPG nền trong suốt (tối đa 2 MB, 2400 px)</span><input class="input" id="signature-image-file" type="file" accept="image/png,image/jpeg"></label><label class="field"><span>Độ rộng hiển thị (80–180 px)</span><input class="input" type="range" min="80" max="180" name="displayWidth" value="${item.displayWidth||120}"></label><label><input type="checkbox" name="enabled" ${item.enabled?'checked':''}> Bật cấu hình này</label><div class="legal-warning">Ảnh chữ ký không phải chữ ký số và không tự tạo giá trị pháp lý.</div><button class="primary-button">Lưu cấu hình</button></form></div>`);
}

function openUserEditor(){openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">TÀI KHOẢN SQLITE</span><h2>Tạo tài khoản người dùng</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="user-form" class="plan-form"><label class="field"><span>Tên đăng nhập *</span><input class="input" required name="username" autocomplete="off"></label><label class="field"><span>Họ và tên *</span><input class="input" required name="fullName"></label><label class="field"><span>Liên kết nhân sự</span><select class="select" name="staffId"><option value="">— Không liên kết —</option>${state.workspace.staff.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)} — ${escapeHtml(item.title)}</option>`).join('')}</select></label><div class="form-grid"><label class="field"><span>Chức vụ</span><input class="input" name="title"></label><label class="field"><span>Tổ chuyên môn/phạm vi tổ</span><input class="input" name="team"></label></div><fieldset class="checkbox-group"><legend>Vai trò *</legend>${Object.entries(ROLE_LABELS).map(([role,label])=>`<label><input type="checkbox" name="roles" value="${role}"> ${label}</label>`).join('')}</fieldset><label class="field"><span>Lớp phụ trách</span><select class="select multi-select" multiple name="classIds">${state.workspace.classes.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="field"><span>Mật khẩu tạm thời *</span><input class="input" type="password" minlength="8" required name="password" autocomplete="new-password"></label><div class="notice">Người dùng bắt buộc đổi mật khẩu sau lần đăng nhập đầu. Mật khẩu không được ghi vào nhật ký.</div><button class="primary-button">Tạo tài khoản</button></form></div>`);}
function openResetPassword(userId){const user=state.users.find((item)=>item.id===userId);openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">ĐẶT LẠI MẬT KHẨU</span><h2>${escapeHtml(user?.fullName||'Tài khoản')}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="reset-password-form" class="plan-form"><input type="hidden" name="userId" value="${userId}"><label class="field"><span>Mật khẩu tạm thời mới *</span><input class="input" type="password" minlength="8" required name="tempPassword" autocomplete="new-password"></label><div class="notice">Tài khoản sẽ phải đổi mật khẩu ở lần đăng nhập tiếp theo.</div><button class="primary-button">Xác nhận đặt lại</button></form></div>`);}
async function importAccountExcel(){try{const result=await window.ctgdmnDesktop.chooseImportFiles('excel');if(result.canceled)return;const sheet=result.files[0]?.preview?.sheets?.find((item)=>item.name==='Tài khoản nhập')||result.files[0]?.preview?.sheets?.[0];const [headers,...rows]=sheet?.rows||[];const required=['Họ và tên','Tên đăng nhập','Mật khẩu tạm thời','Vai trò','Trường/Phạm vi','Chức vụ'];const missing=required.filter((name)=>!headers.includes(name));if(missing.length)throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}.`);const col=(name)=>headers.indexOf(name);const accounts=rows.filter((row)=>String(row[col('Họ và tên')]||'').trim()).map((row)=>({fullName:row[col('Họ và tên')],username:row[col('Tên đăng nhập')],password:row[col('Mật khẩu tạm thời')],roles:String(row[col('Vai trò')]||'').split(';').map((role)=>role.trim()).filter(Boolean),team:row[col('Trường/Phạm vi')],title:row[col('Chức vụ')]}));if(!accounts.length)throw new Error('Không có tài khoản nào để nhập.');if(!window.confirm(`Tạo ${accounts.length} tài khoản từ Excel? Tài khoản trùng tên đăng nhập sẽ được bỏ qua.`))return;const imported=await window.ctgdmnDesktop.importUsers(accounts);state.users=await window.ctgdmnDesktop.listUsers();state.auditLog=await window.ctgdmnDesktop.getAuditLog(200);renderSettings();showToast(`Đã tạo ${imported.created}; bỏ qua ${imported.skipped}; lỗi ${imported.errors.length}.`);}catch(error){showToast(error.message||'Không thể nhập tài khoản từ Excel.');}}

const VIDEO_CATEGORIES=['Bắt đầu sử dụng','Quản lý dữ liệu','Xây dựng chương trình','Xây dựng kế hoạch','Nhận xét và phê duyệt','Xuất Word/Excel','AI và an toàn dữ liệu','Quản trị hệ thống'];
function renderVideos(){const visible=state.videos.filter((item)=>item.enabled||hasRole('system_admin'));const guideLibrary=`<section class="video-section guide-library"><div class="section-heading"><div><span class="eyebrow">TÀI LIỆU NGOẠI TUYẾN</span><h2>Tài liệu hướng dẫn sử dụng</h2><p>Mở trực tiếp bản PDF để đọc hoặc bản Word để chỉnh sửa và in.</p></div><span class="chip teal">Đi kèm ứng dụng</span></div><div class="guide-grid"><article class="guide-card"><div class="guide-icon pdf">PDF</div><div><h3>Hướng dẫn sử dụng Trường Mầm non Số 0.6.0</h3><p>Bản trình bày hoàn chỉnh, phù hợp để đọc và in.</p><small>PDF · 11 trang</small></div><button class="primary-button" data-open-guide="pdf">Mở bản PDF</button></article><article class="guide-card"><div class="guide-icon word">W</div><div><h3>Hướng dẫn sử dụng Trường Mầm non Số 0.6.0</h3><p>Bản Word có thể chỉnh sửa theo nhu cầu nhà trường.</p><small>DOCX · Có thể chỉnh sửa</small></div><button class="secondary-button" data-open-guide="docx">Mở bản Word</button></article></div></section>`;const videoSections=VIDEO_CATEGORIES.map((category)=>{const videos=visible.filter((item)=>item.category===category);return videos.length?`<section class="video-section"><h2>${category}</h2><div class="video-grid">${videos.map((video)=>`<article class="video-card"><div class="video-thumbnail">${video.thumbnail?`<img src="${escapeHtml(video.thumbnail)}" alt="">`:'<span>▶</span>'}</div><div><span class="chip ${video.source_type==='offline'?'teal':''}">${video.source_type==='offline'?'Ngoại tuyến':'Trực tuyến'}</span><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.description||'')}</p><small>${escapeHtml(video.duration||'Chưa cập nhật thời lượng')}</small></div><footer><button class="primary-button" data-play-video="${video.id}" ${video.source_type==='online'&&!state.online?'disabled':''}>${video.source_type==='online'&&!state.online?'Cần kết nối Internet':video.source_type==='offline'?'Phát video':'Mở video'}</button>${video.canManage?`<button class="small-button" data-edit-video="${video.id}">Sửa</button><button class="small-button" data-delete-video="${video.id}">Xóa</button>`:''}</footer></article>`).join('')}</div></section>`:'';}).join('');els.main.innerHTML=`${pageHead('Học liệu nội bộ','Video hướng dẫn',`Video trực tuyến, ngoại tuyến và tài liệu hướng dẫn theo vai trò. ${state.online?'Đang trực tuyến':'Đang ngoại tuyến'}.`,hasRole('system_admin')?'<div class="button-row"><button class="secondary-button" data-import-video-excel>Nhập Excel</button><button class="secondary-button" data-export-video-excel>Xuất Excel</button><button class="primary-button" data-add-video>Thêm video</button></div>':'')}${guideLibrary}${videoSections||'<div class="empty-state"><strong>Chưa có video phù hợp</strong>Quản trị có thể thêm video trực tuyến hoặc MP4 ngoại tuyến.</div>'}`;}
async function openGuide(format){try{const result=await window.ctgdmnDesktop.openGuide(format);if(!result.ok)showToast(`Không mở được tài liệu: ${result.error}`);}catch(error){showToast(error.message||'Không thể mở tài liệu hướng dẫn.');}}
function openVideoEditor(videoId=''){const item=state.videos.find((video)=>video.id===videoId)||{id:'',category:VIDEO_CATEGORIES[0],source_type:'online',enabled:true,audience:[],sort_order:0};openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">QUẢN LÝ VIDEO</span><h2>${videoId?'Sửa video':'Thêm video hướng dẫn'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="video-form" class="plan-form"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><label class="field"><span>Tiêu đề *</span><input class="input" required name="title" value="${escapeHtml(item.title||'')}"></label><label class="field"><span>Mô tả</span><textarea name="description">${escapeHtml(item.description||'')}</textarea></label><div class="form-grid"><label class="field"><span>Nhóm nội dung</span><select class="select" name="category">${VIDEO_CATEGORIES.map((category)=>`<option ${item.category===category?'selected':''}>${category}</option>`).join('')}</select></label><label class="field"><span>Loại nguồn</span><select class="select" name="sourceType"><option value="online" ${item.source_type==='online'?'selected':''}>Trực tuyến HTTPS</option><option value="offline" ${item.source_type==='offline'?'selected':''}>MP4 ngoại tuyến</option></select></label></div><label class="field"><span>URL HTTPS (video trực tuyến)</span><input class="input" name="url" value="${escapeHtml(item.url||'')}" placeholder="https://www.youtube.com/..."></label><div class="form-grid"><label class="field"><span>Thời lượng</span><input class="input" name="duration" value="${escapeHtml(item.duration||'')}"></label><label class="field"><span>Thứ tự</span><input class="input" type="number" name="sortOrder" value="${item.sort_order||0}"></label></div><label class="field"><span>Khóa hướng dẫn theo ngữ cảnh</span><select class="select" name="contextKey"><option value="">— Không gắn —</option>${[['open-data','Nhập Word/Excel'],['planner','Xây dựng kế hoạch'],['approval','Quy trình phê duyệt'],['signatures','Cấu hình chữ ký']].map(([key,label])=>`<option value="${key}" ${item.context_key===key?'selected':''}>${label}</option>`).join('')}</select></label><fieldset class="checkbox-group"><legend>Đối tượng được xem (để trống = tất cả)</legend>${Object.entries(ROLE_LABELS).map(([role,label])=>`<label><input type="checkbox" name="audience" value="${role}" ${(item.audience||[]).includes(role)?'checked':''}> ${label}</label>`).join('')}</fieldset><label><input type="checkbox" name="enabled" ${item.enabled!==0?'checked':''}> Đang bật</label><button class="primary-button">${item.source_type==='offline'?'Lưu thông tin':'Lưu video trực tuyến'}</button>${!videoId?'<button class="secondary-button" type="button" data-import-offline-video>Chọn và sao chép MP4 từ máy</button>':''}</form></div>`);}
async function playVideo(videoId){const video=state.videos.find((item)=>item.id===videoId);if(!video)return;if(video.source_type==='online'){if(!state.online)return showToast('Cần kết nối Internet để mở video này.');try{await window.ctgdmnDesktop.openOnlineVideo(videoId);}catch(error){showToast(error.message);}return;}try{const url=await window.ctgdmnDesktop.getOfflineVideoUrl(videoId);openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">VIDEO NGOẠI TUYẾN</span><h2>${escapeHtml(video.title)}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><video class="offline-player" controls preload="metadata" src="${url}"></video><p>${escapeHtml(video.description||'')}</p></div>`);}catch(error){showToast(error.message);}}
function openContextGuide(key){const video=state.videos.find((item)=>item.context_key===key&&item.enabled);if(!video){state.route='videos';renderVideos();return showToast('Chưa có video hướng dẫn cho chức năng này.');}playVideo(video.id);}

async function readLocalImage(file, cropWhitespace = false) {
  const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Không thể đọc ảnh.')); reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload=()=>resolve(element); element.onerror=()=>reject(new Error('Ảnh không hợp lệ.')); element.src=data; });
  validateLocalImage({type:file.type,size:file.size,width:image.naturalWidth,height:image.naturalHeight});
  if (!cropWhitespace) return data;
  const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const context=canvas.getContext('2d'); context.drawImage(image,0,0); const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,top=canvas.height,right=0,bottom=0;
  for(let y=0;y<canvas.height;y+=1) for(let x=0;x<canvas.width;x+=1){const p=(y*canvas.width+x)*4; if(pixels[p+3]>12 && (pixels[p]<246||pixels[p+1]<246||pixels[p+2]<246)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(right<=left||bottom<=top) return data;
  const output=document.createElement('canvas'); output.width=right-left+1; output.height=bottom-top+1; output.getContext('2d').drawImage(canvas,left,top,output.width,output.height,0,0,output.width,output.height); return output.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',0.92);
}

function openReviewEditor(planId) {
  const plan=state.workspace.plans.find((item)=>item.id===planId); if(!plan)return;
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">NHẬN XÉT CHUYÊN MÔN</span><h2>Thêm nhận xét phiên bản ${plan.version||1}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><div class="notice">Nhận xét sau khi lưu không thể sửa hoặc xóa. Nếu cần thay đổi, hãy tạo nhận xét bổ sung.</div><form id="review-form" class="plan-form"><input type="hidden" name="planId" value="${plan.id}"><input type="hidden" name="planVersion" value="${plan.version||1}"><label class="field"><span>Người nhận xét *</span><select class="select" required name="reviewerId"><option value="">— Chọn người nhận xét —</option>${activeStaff().filter((item)=>item.roles.includes('Người nhận xét')||item.roles.includes('Tổ trưởng chuyên môn')||item.roles.includes('Người duyệt')).map((item)=>`<option value="${item.id}">${escapeHtml(item.name)} — ${escapeHtml(item.title)}</option>`).join('')}</select></label><label class="field"><span>Phân loại</span><select class="select" name="type">${REVIEW_TYPES.map((type)=>`<option>${type}</option>`).join('')}</select></label><label class="field"><span>Nội dung nhận xét *</span><textarea required name="content"></textarea></label><button class="primary-button">Ghi nhận nhận xét</button></form></div>`);
}

function openResolveReview(reviewId) {
  const review=state.workspace.professionalReviews.find((item)=>item.id===reviewId); if(!review)return;
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">PHẢN HỒI</span><h2>Ghi nhận xử lý nhận xét</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><div class="notice">Nội dung nhận xét gốc được giữ nguyên.</div><blockquote class="review-quote">${escapeHtml(review.content)}</blockquote><form id="resolve-review-form" class="plan-form"><input type="hidden" name="reviewId" value="${review.id}"><input type="hidden" name="planId" value="${review.planId}"><label class="field"><span>Phản hồi của giáo viên *</span><textarea required name="response"></textarea></label><button class="primary-button">Xác nhận đã xử lý</button></form></div>`);
}

function openWordExportPreview(plan) {
  const signatures=state.workspace.signatures.filter((item)=>item.enabled);
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">XEM TRƯỚC NGƯỜI KÝ</span><h2>Xuất Word: ${escapeHtml(plan.title)}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><div class="legal-warning">Ảnh chữ ký trong ứng dụng không phải chữ ký số và không tự tạo giá trị pháp lý. Không có chữ ký nào được chèn nếu bạn chưa xác nhận tại đây.</div><form id="word-export-form" class="plan-form"><input type="hidden" name="planId" value="${escapeHtml(plan.id||'')}"><fieldset class="checkbox-group"><legend>Chọn người ký</legend>${signatures.map((item)=>`<label><input type="checkbox" name="signatureIds" value="${item.id}"> ${escapeHtml(item.displayTitle||item.role)} — ${escapeHtml(staffName(item.staffId,item.name))}</label>`).join('')||'<p>Chưa có cấu hình chữ ký. Có thể chọn vai trò ký tay bên dưới.</p>'}</fieldset><fieldset class="checkbox-group"><legend>Thêm vị trí ký tay</legend>${SIGNATURE_ROLES.map((role)=>`<label><input type="checkbox" name="handRoles" value="${role}"> ${role}</label>`).join('')}</fieldset><fieldset class="checkbox-group"><legend>Cách hiển thị cấu hình đã chọn</legend><label><input type="radio" name="signatureMode" value="hand"> Chỉ để khoảng trống ký tay</label><label><input type="radio" name="signatureMode" value="name" checked> Hiển thị họ tên, không chèn ảnh</label><label><input type="radio" name="signatureMode" value="image"> Chèn ảnh chữ ký và họ tên</label></fieldset><label><input type="checkbox" name="includeReviews"> Đưa nhận xét chuyên môn vào bản Word</label><button class="primary-button">Xác nhận và chọn nơi lưu Word</button></form></div>`);
}

async function saveDirectoryExcel(kind, template=false) {
  if(!window.ctgdmnDesktop?.saveDirectoryExcel)return showToast('Chức năng này cần chạy trong Electron.');
  const label=kind==='classes'?'lop':kind==='videos'?'video':'giao-vien'; const rows=kind==='classes'?state.workspace.classes:kind==='videos'?state.videos:state.workspace.staff;
  const result=await window.ctgdmnDesktop.saveDirectoryExcel(`${template?'mau-nhap':'danh-muc'}-${label}.xlsx`,kind,rows,template,schoolProfile()); if(result.ok)showToast(template?'Đã tạo tệp Excel mẫu.':'Đã xuất danh mục Excel.');
}

async function importVideoExcel(){try{const result=await window.ctgdmnDesktop.chooseImportFiles('excel');if(result.canceled)return;const sheet=result.files[0]?.preview?.sheets?.[0];const [headers,...rows]=sheet?.rows||[];const col=(name)=>headers.indexOf(name);let success=0,errors=0;for(const row of rows){if(row.every((cell)=>!String(cell||'').trim()))continue;try{const sourceType=String(row[col('Loại nguồn')]||'').toLowerCase().includes('ngoại')?'offline':'online';if(sourceType==='offline')throw new Error('MP4 phải được chọn trực tiếp từ máy.');await window.ctgdmnDesktop.saveVideo({id:row[col('ID')],title:row[col('Tiêu đề')],description:row[col('Mô tả')],category:row[col('Nhóm nội dung')],audience:String(row[col('Đối tượng')]||'').split(';').map(x=>x.trim()).filter(Boolean),sourceType,url:row[col('URL HTTPS')],duration:row[col('Thời lượng')],sortOrder:row[col('Thứ tự')],enabled:!String(row[col('Trạng thái')]||'').toLowerCase().includes('tắt'),contextKey:row[col('Khóa ngữ cảnh')]});success+=1;}catch{errors+=1;}}state.videos=await window.ctgdmnDesktop.listVideos();renderVideos();showToast(`Đã nhập ${success} video; ${errors} dòng lỗi.`);}catch(error){showToast(error.message||'Không thể nhập danh mục video.');}}

async function importDirectoryExcel(kind) {
  try { const result=await window.ctgdmnDesktop.chooseImportFiles('excel'); if(result.canceled)return; const sheet=result.files[0]?.preview?.sheets?.[0]; if(!sheet)throw new Error('Tệp Excel không có sheet dữ liệu.'); const [headers,...rows]=sheet.rows; const column=(name)=>headers.indexOf(name); let success=0,errors=0;
    for(const row of rows){if(row.every((cell)=>!String(cell||'').trim()))continue; try{if(kind==='classes')state.workspace.classes=upsertClass(state.workspace.classes,{id:row[column('ID lớp')],name:row[column('Tên lớp')],ageGroup:row[column('Nhóm độ tuổi')],schoolYear:row[column('Năm học')],campus:row[column('Điểm trường')],childCount:row[column('Số lượng trẻ')],leadTeacherId:row[column('ID giáo viên phụ trách')],collaboratingTeacherIds:String(row[column('ID giáo viên phối hợp')]||'').split(';').map(x=>x.trim()).filter(Boolean),active:!String(row[column('Trạng thái')]||'').toLowerCase().includes('ngừng'),notes:row[column('Ghi chú')]});else state.workspace.staff=upsertStaff(state.workspace.staff,{id:row[column('ID')],name:row[column('Họ và tên')],title:row[column('Chức vụ')],roles:String(row[column('Vai trò')]||'').split(';').map(x=>x.trim()).filter(Boolean),classIds:String(row[column('ID lớp phụ trách')]||'').split(';').map(x=>x.trim()).filter(Boolean),team:row[column('Tổ chuyên môn')],active:!String(row[column('Trạng thái')]||'').toLowerCase().includes('ngừng'),contact:row[column('Liên hệ')]});success+=1;}catch{errors+=1;}}
    saveWorkspace();renderSettings();showToast(`Đã nhập ${success} dòng; ${errors} dòng lỗi.`);
  }catch(error){showToast(error.message||'Không thể nhập danh mục Excel.');}
}

function openDrawerPanel(content) {
  els.drawerContent.innerHTML = content;
  els.drawerBackdrop.classList.remove('is-hidden');
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function privacyNotice(warnings = []) {
  return `<div class="privacy-warning"><strong>Kiểm tra dữ liệu cá nhân trước khi lưu</strong><p>Không nhập họ tên, ngày sinh, sức khỏe, hình ảnh, hoàn cảnh gia đình hoặc thông tin nhận dạng của trẻ nếu không cần thiết.</p>${warnings.length ? `<ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<small>Chưa phát hiện mẫu số điện thoại, email hoặc ngày sinh trong phần xem trước.</small>'}</div>`;
}

function openImportMenu() {
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">NHẬP DỮ LIỆU</span><h2>Thêm dữ liệu từ máy</h2></div><button class="drawer-close" data-close-drawer>×</button></header>
    <div class="drawer-body"><p class="drawer-intro">Chọn nguồn dữ liệu. Ứng dụng luôn hiển thị bản xem trước và chỉ lưu sau khi bạn xác nhận.</p>
      <div class="import-source-grid">
        <button data-choose-import="word"><b>W</b><span><strong>Nhập từ Word</strong><small>Tệp .docx, đoạn văn và bảng</small></span></button>
        <button data-choose-import="excel"><b>X</b><span><strong>Nhập từ Excel</strong><small>Tệp .xlsx/.xls, chọn sheet và ánh xạ cột</small></span></button>
        <button data-choose-import="pdf"><b>P</b><span><strong>Thêm PDF nguồn</strong><small>Sao chép an toàn, không sửa 246 PDF gốc</small></span></button>
        <button data-manual-record><b>+</b><span><strong>Nhập thủ công</strong><small>Tạo một bản ghi dữ liệu mở</small></span></button>
      </div>${privacyNotice()}</div>`);
}

async function chooseImport(kind) {
  if (!window.ctgdmnDesktop?.chooseImportFiles) return showToast('Chức năng này cần chạy trong ứng dụng Electron.');
  try {
    els.drawerContent.innerHTML = '<div class="drawer-body"><div class="empty-state"><strong>Đang đọc và kiểm tra tệp…</strong>Vui lòng chờ, dữ liệu chỉ được xử lý trên máy này.</div></div>';
    const result = await window.ctgdmnDesktop.chooseImportFiles(kind);
    if (result.canceled) return openImportMenu();
    state.pendingImport = { ...result, fileIndex: 0, sheetIndex: 0 };
    renderImportPreview();
  } catch (error) { showToast(error.message || 'Không thể đọc tệp đã chọn.'); }
}

function wordPreview(pending) {
  const warnings = pending.files.flatMap((file) => file.preview.privacyWarnings || []);
  return `<form id="word-import-form" class="plan-form">
    <div class="selected-files">${pending.files.map((file) => `<div><strong>${escapeHtml(file.name)}</strong><span>${formatFileSize(file.size)}</span></div>`).join('')}</div>
    <div class="import-preview"><strong>Bản xem trước</strong>${pending.files.map((file) => `<article><h3>${escapeHtml(file.preview.headings?.[0]?.text || file.name)}</h3><p>${escapeHtml((file.preview.text || '').slice(0, 1800))}</p>${file.preview.tables?.length ? `<small>${file.preview.tables.length} bảng được phát hiện</small>` : ''}</article>`).join('')}</div>
    <div class="form-grid"><label class="field"><span>Độ tuổi</span><input class="input" required name="ageGroup"></label><label class="field"><span>Loại dữ liệu</span><input class="input" name="type" value="Tài liệu Word nhập vào"></label></div>
    <label class="field"><span>Chủ đề</span><input class="input" name="topic"></label>
    <label class="field"><span>Mục tiêu/yêu cầu cần đạt</span><textarea name="objective"></textarea></label>
    <label class="field"><span>Nội dung bổ sung hoặc ghi chú</span><textarea name="content"></textarea></label>
    <div class="form-grid"><label class="field"><span>Hoạt động</span><textarea name="activity"></textarea></label><label class="field"><span>Minh chứng</span><textarea name="evidence"></textarea></label></div>
    ${privacyNotice(warnings)}<div class="button-row"><button class="primary-button" type="submit">Xác nhận nhập ${pending.files.length} tệp</button><button class="secondary-button" type="button" data-close-drawer>Hủy</button></div>
  </form>`;
}

function excelPreview(pending) {
  const file = pending.files[pending.fileIndex] || pending.files[0];
  const sheet = file.preview.sheets[pending.sheetIndex] || file.preview.sheets[0];
  const headers = sheet.headers || [];
  const autoMatch = (field, label) => headers.find((header) => normalizeText(header) === normalizeText(label) || normalizeText(header) === normalizeText(field)) || '';
  return `<form id="excel-import-form" class="plan-form">
    <div class="selected-files"><div><strong>${escapeHtml(file.name)}</strong><span>${formatFileSize(file.size)} • ${sheet.rowCount} dòng</span></div></div>
    ${pending.files.length > 1 ? `<label class="field"><span>Tệp đang xem trước (${pending.files.length} tệp sẽ được xử lý)</span><select class="select" id="import-excel-file">${pending.files.map((item, index) => `<option value="${index}" ${index === pending.fileIndex ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>Trang tính</span><select class="select" id="import-sheet">${file.preview.sheets.map((item, index) => `<option value="${index}" ${index === pending.sheetIndex ? 'selected' : ''}>${escapeHtml(item.name)} (${item.rowCount} dòng)</option>`).join('')}</select></label>
    <div class="table-scroll import-table"><table><tbody>${sheet.preview.slice(0, 21).map((row, rowIndex) => `<tr>${row.map((cell) => `<${rowIndex ? 'td' : 'th'}>${escapeHtml(cell)}</${rowIndex ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>Ánh xạ cột</h3><div class="mapping-grid">${EXCEL_FIELDS.map(([field, label]) => `<label class="field"><span>${escapeHtml(label)}</span><select class="select" name="map-${field}"><option value="">— Không dùng —</option>${headers.map((header) => `<option ${autoMatch(field, label) === header ? 'selected' : ''}>${escapeHtml(header)}</option>`).join('')}</select></label>`).join('')}</div>
    ${privacyNotice(file.preview.privacyWarnings || [])}<div class="button-row"><button class="primary-button" type="submit">Kiểm tra và nhập dữ liệu</button><button class="secondary-button" type="button" data-close-drawer>Hủy</button></div>
  </form>`;
}

function pdfPreview(pending) {
  return `<form id="pdf-import-form" class="plan-form"><div class="selected-files">${pending.files.map((file) => `<div><strong>${escapeHtml(file.name)}</strong><span>${formatFileSize(file.size)}</span></div>`).join('')}</div>
    <div class="notice">Các tệp sẽ được sao chép vào kho nguồn bổ sung của người dùng với tên tương thích Windows. 246 PDF đi kèm ứng dụng không bị ghi đè hoặc xóa.</div>
    <label class="field"><span>Người thực hiện</span><input class="input" name="actor" placeholder="Họ tên hoặc vai trò người nhập"></label>
    ${privacyNotice()}<div class="button-row"><button class="primary-button" type="submit">Xác nhận thêm PDF nguồn</button><button class="secondary-button" type="button" data-close-drawer>Hủy</button></div></form>`;
}

function renderImportPreview() {
  const pending = state.pendingImport;
  if (!pending?.files?.length) return openImportMenu();
  const title = pending.kind === 'word' ? 'Xem trước tài liệu Word' : pending.kind === 'excel' ? 'Xem trước bảng Excel' : 'Xác nhận PDF nguồn';
  const body = pending.kind === 'word' ? wordPreview(pending) : pending.kind === 'excel' ? excelPreview(pending) : pdfPreview(pending);
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">CHƯA LƯU</span><h2>${title}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body">${body}</div>`);
}

function excelExportPayload() {
  const records = openRecords().map((record) => ({ ID: record.id, 'Độ tuổi': record.ageGroup, 'Lĩnh vực': record.developmentArea || '', 'Chủ đề': record.topic, 'Mục tiêu/yêu cầu cần đạt': record.objective, 'Nội dung': record.content, 'Hoạt động': record.activity, 'Học liệu': record.materials || '', 'Phân hóa': record.differentiation || '', 'Minh chứng': record.evidence, 'Nguồn PDF': record.sourcePdf || record.sourceDocumentId || '', 'Trang nguồn': record.sourcePage, 'Trạng thái': record.status }));
  return {
    school: schoolProfile(),
    records,
    matrix: records.filter((row) => row['Mục tiêu/yêu cầu cần đạt']).map((row) => ({ ID: row.ID, 'Độ tuổi': row['Độ tuổi'], 'Chủ đề': row['Chủ đề'], 'Mục tiêu': row['Mục tiêu/yêu cầu cần đạt'] })),
    plans: (state.workspace.plans || []).map((plan) => ({ ID: plan.id, 'Tên kế hoạch': plan.title, 'Cấp': plan.level, 'Độ tuổi': plan.ageGroup, 'Năm học': plan.schoolYear, 'Thời gian': plan.period, 'Trạng thái': plan.status || 'Bản nháp' })),
    reviewProgress: state.data.ageGroups.map((age) => ({ 'Độ tuổi': age.label, 'Tổng PDF': age.documents, 'Đã rà soát': state.data.documents.filter((doc) => doc.ageGroup === age.label && state.review.reviewed.includes(doc.id)).length })),
    issues: unresolvedIssues().map((issue) => ({ ID: issue.id, 'Nhóm': issue.category, 'Tiêu đề': issue.title, 'Chi tiết': issue.detail, 'Tài liệu': issue.documentId })),
  };
}

async function exportExcelWorkbook() {
  if (!window.ctgdmnDesktop?.saveExcel) return showToast('Chức năng xuất Excel cần chạy trong Electron.');
  try {
    const result = await window.ctgdmnDesktop.saveExcel(`du-lieu-ctgdmn-${new Date().toISOString().slice(0, 10)}.xlsx`, excelExportPayload());
    if (result.ok) showToast('Đã xuất sổ Excel chuyên môn.');
  } catch (error) { showToast(error.message || 'Không thể xuất Excel.'); }
}

async function exportPlanWord(plan) {
  if (!window.ctgdmnDesktop?.saveWord) return showToast('Chức năng xuất Word cần chạy trong Electron.');
  if (!plan?.title) return showToast('Hãy lưu hoặc đặt tên kế hoạch trước khi xuất Word.');
  try {
    const school=schoolProfile();
    const enriched={...plan,className:className(plan.classId,plan.ageGroup),author:staffName(plan.authorTeacherId,plan.author),schoolId:school.id};
    const result = await window.ctgdmnDesktop.saveWord(`${safeFilename(plan.title)}.docx`, 'plan', enriched, school);
    if (result.ok) showToast('Đã xuất kế hoạch Word.');
  } catch (error) { showToast(error.message || 'Không thể xuất Word.'); }
}

function combineAssessment(data={}) {
  const parts=[];
  if((data.observation||'').trim())parts.push(`Biểu hiện quan sát được:\n${data.observation.trim()}`);
  if((data.evidence||'').trim())parts.push(`Minh chứng:\n${data.evidence.trim()}`);
  if((data.adjustment||'').trim())parts.push(`Điều chỉnh sau đánh giá:\n${data.adjustment.trim()}`);
  return parts.join('\n\n');
}

function combineLessonActivities(data={}) {
  if(data.lessonType==='STEAM/Dự án'){
    const steps=[['1. Đặt vấn đề','steamProblem'],['2. Khám phá','steamExplore'],['3. Thiết kế','steamDesign'],['4. Chế tạo','steamMake'],['5. Thử nghiệm/Cải tiến','steamTest'],['6. Chia sẻ','steamShare']];
    const teacherActivities=steps.filter(([,key])=>(data[key]||'').trim()).map(([label,key])=>`${label}:\n${data[key].trim()}`).join('\n\n');
    return {teacherActivities,childActivities:''};
  }
  const parts=[['Hoạt động 1 — Gây hứng thú','activity1'],['Hoạt động 2 — Nội dung chính','activity2'],['Hoạt động 3 — Kết thúc','activity3']];
  const teacherActivities=parts.filter(([,key])=>(data[`${key}Teacher`]||'').trim()).map(([label,key])=>`${label}:\n${data[`${key}Teacher`].trim()}`).join('\n\n');
  const childActivities=parts.filter(([,key])=>(data[`${key}Child`]||'').trim()).map(([label,key])=>`${label}:\n${data[`${key}Child`].trim()}`).join('\n\n');
  return {teacherActivities,childActivities};
}

function currentPlanFromForm() {
  const form=document.querySelector('#plan-form');
  if(!form)return null;
  const formData=new FormData(form);
  const data={...Object.fromEntries(formData),collaboratingTeacherIds:formData.getAll('collaboratingTeacherIds'),lessonObjectiveCodes:formData.getAll('lessonObjectiveCodes')};
  data.assessment=combineAssessment(data);
  if(data.level==='Ngày/hoạt động')Object.assign(data,combineLessonActivities(data));
  return data;
}

function aiPlanType(level='') {
  if(String(level).includes('Năm'))return'annual';
  if(String(level).includes('Tháng')||String(level).includes('Chủ đề'))return'theme';
  if(String(level).includes('Tuần'))return'weekly';
  return'lesson';
}

function rowsToEditorFields(level,rows=[]) {
  const type=aiPlanType(level);
  if(type==='annual')return{annualRows:rows.map((item)=>[item.period,item.theme,item.objective,item.content,item.activity].join(' | ')).join('\n')};
  if(type==='weekly')return{weeklyRows:rows.map((item)=>[item.activity||item.category,item.monday,item.tuesday,item.wednesday,item.thursday,item.friday].join(' | ')).join('\n')};
  if(type==='lesson'){const first=rows[0]||{};return{activity2Teacher:first.teacherActivity||first.activity||'',activity2Child:first.childActivity||''};}
  const fields={themePhysical:[],themeSocial:[],themeLanguage:[],themeCognitive:[],themeAesthetic:[]};
  const domains=['Giáo dục phát triển thể chất','Giáo dục phát triển tình cảm và kỹ năng xã hội','Giáo dục phát triển ngôn ngữ','Giáo dục phát triển nhận thức','Giáo dục phát triển thẩm mỹ'];
  rows.forEach((item)=>{const index=Math.max(0,domains.indexOf(item.category));Object.keys(fields)[index].push([item.objective,item.content,item.activity].join(' | '));});
  return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.join('\n')]));
}

function openAIResultPreview(payload,action) {
  state.pendingAIResult={...payload,action};
  const result=payload.result;
  openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">BẢN NHÁP AI - CHƯA LƯU</span><h2>${action==='validate'?'Kết quả rà soát':'Đề xuất kế hoạch'}</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body">
    <div class="privacy-warning"><strong>Dữ liệu đã gửi</strong><p>${escapeHtml(Object.keys(payload.sentData||{}).join(', '))}. Không gửi danh sách hoặc thông tin nhận dạng của trẻ.</p></div>
    <section class="ai-draft-preview"><h3>${escapeHtml(result.title)}</h3><h4>Mục tiêu</h4><p>${escapeHtml(result.objectives)}</p><h4>Nội dung và hoạt động</h4><p>${escapeHtml(result.activities)}</p><h4>Đánh giá/rà soát</h4><p>${escapeHtml(result.assessment)}</p><small>${result.templateRows.length} dòng biểu mẫu động</small></section>
    <div class="button-row"><button class="primary-button" data-apply-ai-result>Áp dụng vào bản đang soạn</button><button class="secondary-button" data-close-drawer>Giữ nguyên bản hiện tại</button></div>
  </div>`);
}

function applyAIResult() {
  const payload=state.pendingAIResult;
  const form=document.querySelector('#plan-form');
  if(!payload||!form)return;
  const result=payload.result;
  const values={title:result.title,context:result.context,objectives:result.objectives,activities:result.activities,materials:result.materials,differentiation:result.differentiation,evidence:result.assessment,family:result.family,...rowsToEditorFields(form.elements.level.value,result.templateRows)};
  Object.entries(values).forEach(([name,value])=>{const field=form.elements[name];if(field)field.value=value||'';});
  state.pendingAIResult=null;
  closeDrawer();
  showToast('Đã áp dụng bản nháp AI. Hãy rà soát rồi lưu phiên bản.');
}

function savePendingAIRequest(plan,action) {
  const item={id:`ai-pending-${Date.now()}`,title:plan.title||'Yêu cầu soạn kế hoạch',action,plan,createdAt:new Date().toISOString()};
  state.workspace.pendingAIRequests=[...(state.workspace.pendingAIRequests||[]),item];
  saveWorkspace('ai.pending_save','ai_request',item.id);
  closeDrawer();
  showToast('Đã lưu yêu cầu. Ứng dụng sẽ không tự gửi khi có mạng.');
}

async function runPlanAI(action,plan=currentPlanFromForm()) {
  if(!plan)return;
  if(!state.online){
    openDrawerPanel(`<header class="drawer-header"><div><span class="chip amber">NGOẠI TUYẾN</span><h2>Chức năng GenAI đang tạm dừng</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><p>Máy tính hiện chưa kết nối Internet. Cô vẫn có thể tiếp tục soạn, chỉnh sửa, lưu và xuất kế hoạch. Chức năng hỗ trợ GenAI sẽ hoạt động khi có kết nối mạng.</p><div class="button-row"><button class="primary-button" data-close-drawer>Tiếp tục soạn thủ công</button><button class="secondary-button" data-save-pending-ai="${action}">Lưu yêu cầu để thực hiện khi có mạng</button><button class="secondary-button" data-test-ai>Kiểm tra lại kết nối</button></div></div>`);
    state.pendingAIPlan=plan;
    return;
  }
  if(!state.aiConfig.provider){state.route='online-resources';renderAIWorkspace();showToast('Hãy cấu hình nhà cung cấp GenAI trước.');return;}
  state.aiBusy=true;state.aiRequestId=crypto.randomUUID();document.querySelectorAll('[data-plan-ai]').forEach((button)=>{button.disabled=true;});showToast('Đang tạo bản nháp AI...');
  try{const payload=await window.ctgdmnDesktop.runAI(action,plan,state.aiRequestId);openAIResultPreview(payload,action);}
  catch(error){showToast(error.message||'Không thể xử lý yêu cầu AI.');}
  finally{state.aiBusy=false;state.aiRequestId='';document.querySelectorAll('[data-plan-ai]').forEach((button)=>{button.disabled=false;});}
}

async function exportPlanPdf(plan) {
  if(!window.ctgdmnDesktop?.savePdf)return showToast('Chức năng xuất PDF cần chạy trong Electron.');
  if(!plan?.title)return showToast('Hãy đặt tên kế hoạch trước khi xuất PDF.');
  try{
    const school=schoolProfile();
    const enriched={...plan,className:className(plan.classId,plan.ageGroup),author:staffName(plan.authorTeacherId,plan.author),schoolId:school.id};
    const result=await window.ctgdmnDesktop.savePdf(`${safeFilename(plan.title)}.pdf`,enriched,school);
    if(result.ok)showToast('Đã xuất kế hoạch PDF hoàn toàn trên máy.');
  }catch(error){showToast(error.message||'Không thể xuất PDF.');}
}

async function exportReviewWord() {
  if (!window.ctgdmnDesktop?.saveWord) return showToast('Chức năng xuất Word cần chạy trong Electron.');
  const progress = reviewSummary(state.data.documents, state.review);
  const issues = unresolvedIssues();
  const payload = {
    title: 'Báo cáo rà soát dữ liệu Trường Mầm non Số 2026–2027',
    period: new Date().toLocaleDateString('vi-VN'),
    summary: `Kho nguồn gồm ${state.data.summary.documents} PDF; các tài liệu nguồn được bảo toàn.`,
    progress: `Đã rà soát ${progress.reviewed}/${progress.total} tài liệu (${progress.percent}%).`,
    issues: [...issues.map((item, index) => `${index + 1}. ${item.title}: ${item.detail}`), ...state.workspace.professionalReviews.map((item)=>`Nhận xét kế hoạch ${item.planId}, phiên bản ${item.planVersion} — ${item.reviewerNameSnapshot}: ${item.content}${item.resolved?' (đã xử lý)':' (chưa xử lý)'}`)].join('\n') || 'Không còn cảnh báo chưa xử lý.',
    conclusion: 'Cần tiếp tục đối chiếu PDF và xác nhận chuyên môn trước khi phê duyệt.',
  };
  try {
    const result = await window.ctgdmnDesktop.saveWord(`bao-cao-ra-soat-${new Date().toISOString().slice(0, 10)}.docx`, 'review', payload, schoolProfile());
    if (result.ok) showToast('Đã xuất báo cáo rà soát Word.');
  } catch (error) { showToast(error.message || 'Không thể xuất báo cáo Word.'); }
}

function renderOpenData() {
  const records = openRecords();
  const q = normalizeText(state.query);
  const visible = records.filter((item) => !q || normalizeText(`${item.title} ${item.ageGroup} ${item.topic} ${item.objective} ${item.content}`).includes(q)).slice(0, 30);
  els.main.innerHTML = `
    ${pageHead('Dữ liệu làm việc', 'Kho dữ liệu mở', 'Nhập có kiểm soát từ Word/Excel, chỉnh sửa bản ghi và xuất sổ Excel. PDF chỉ là nguồn đối chiếu.', `<div class="button-row"><button class="ghost-button" data-guide-context="open-data">Xem hướng dẫn</button><button class="secondary-button" data-export-excel>Xuất Excel</button>${state.workspace.importHistory.length ? '<button class="secondary-button" data-undo-import>Hoàn tác lần nhập</button>' : ''}<button class="primary-button" data-add-data>Thêm dữ liệu</button></div>`)}
    <div class="notice">Mọi bản sửa được lưu riêng trên máy. Trường “Nguồn” giúp truy ngược về PDF gốc; ứng dụng không ghi đè tài liệu nguồn.</div>
    <section class="toolbar"><label class="field" style="flex:1"><span>Tìm trong dữ liệu mở</span><input id="open-query" class="input" value="${escapeHtml(state.query)}" placeholder="Mục tiêu, nội dung, hoạt động..."></label><div class="result-count">${records.length} bản ghi</div></section>
    <section class="document-list">${visible.map((item) => `<article class="document-card"><div class="doc-mark open">DATA</div><div><h3>${escapeHtml(item.title || 'Bản ghi chưa đặt tên')}</h3><p>${escapeHtml((item.objective || item.content || '').slice(0, 240))}</p><div class="doc-meta"><span class="chip teal">${escapeHtml(item.ageGroup || 'Chưa chọn tuổi')}</span><span class="chip">${escapeHtml(item.type || 'Dữ liệu mở')}</span><span class="chip amber">${escapeHtml(item.status || 'Bản nháp')}</span>${item.sourcePdf ? `<span class="chip">Nguồn: ${escapeHtml(item.sourcePdf)}</span>` : ''}</div></div><div class="doc-actions"><button class="small-button" data-edit-record="${escapeHtml(item.id)}">Chỉnh sửa</button><button class="small-button" data-use-record="${escapeHtml(item.id)}">Dùng soạn kế hoạch</button></div></article>`).join('')}</section>`;
}

function planTemplate(plan = {}) {
  const classes = state.workspace.classes.filter((item)=>item.active!==false || item.id===plan.classId);
  const people = state.workspace.staff.filter((item)=>item.active!==false || [plan.authorTeacherId,plan.approverId,...(plan.collaboratingTeacherIds||[])].includes(item.id));
  const locked=plan.id&&!['draft','changes_requested'].includes(plan.workflowStatus||'draft');
  return `<form id="plan-form" class="plan-form">
    ${locked?'<div class="legal-warning">Phiên bản đang gửi rà soát đã bị khóa. Người nhận xét chỉ có thể thêm nhận xét, không thay nội dung giáo viên.</div>':''}
    <input type="hidden" name="id" value="${escapeHtml(plan.id || '')}">
    <div class="form-grid"><label class="field"><span>Tên kế hoạch</span><input class="input" required name="title" value="${escapeHtml(plan.title || '')}" placeholder="Kế hoạch giáo dục..."></label><label class="field"><span>&nbsp;</span><button type="button" class="ghost-button" data-pick-theme>Chọn chủ đề từ ngân hàng</button></label></div>
    <div class="form-grid"><label class="field"><span>Lớp *</span><select class="select" required name="classId"><option value="">— Chọn từ danh mục lớp —</option>${classes.map((item)=>`<option value="${item.id}" ${plan.classId===item.id?'selected':''}>${escapeHtml(item.name)} — ${escapeHtml(item.ageGroup)}</option>`).join('')}</select></label><label class="field"><span>Người soạn *</span><select class="select" required name="authorTeacherId"><option value="">— Chọn từ danh mục nhân sự —</option>${people.filter((item)=>item.roles.includes('Người soạn')||item.id===plan.authorTeacherId).map((item)=>`<option value="${item.id}" ${plan.authorTeacherId===item.id?'selected':''}>${escapeHtml(item.name)} — ${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <label class="field"><span>Giáo viên phối hợp</span><select class="select multi-select" multiple name="collaboratingTeacherIds">${people.map((item)=>`<option value="${item.id}" ${(plan.collaboratingTeacherIds||[]).includes(item.id)?'selected':''}>${escapeHtml(item.name)} — ${escapeHtml(item.title)}</option>`).join('')}</select></label>
    <div class="form-grid"><label class="field"><span>Cấp kế hoạch</span><select class="select" name="level">${['Năm','Tháng','Chủ đề','Tuần','Ngày/hoạt động'].map(v=>`<option ${plan.level===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Độ tuổi</span><select class="select" name="ageGroup">${state.data.ageGroups.map(a=>`<option ${plan.ageGroup===a.label?'selected':''}>${escapeHtml(a.label)}</option>`).join('')}</select></label><label class="field"><span>Năm học</span><input class="input" name="schoolYear" value="${escapeHtml(plan.schoolYear || schoolProfile().schoolYear)}"></label><label class="field"><span>Thời gian</span><input class="input" name="period" value="${escapeHtml(plan.period || '')}" placeholder="Tháng/tuần/từ ngày..."></label></div>
    <label class="field"><span>Mẫu văn bản khi xuất</span><select class="select" name="templateId"><option value="">- Dùng mẫu mặc định theo loại kế hoạch -</option>${state.templates.templates.map((item)=>`<option value="${item.id}" ${plan.templateId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Căn cứ và đặc điểm tình hình</span><textarea name="context">${escapeHtml(plan.context || '')}</textarea></label>
    <label class="field"><span>Mục tiêu / yêu cầu cần đạt</span><textarea name="objectives">${escapeHtml(plan.objectives || '')}</textarea></label>
    <label class="field"><span>Nội dung và hoạt động</span><textarea name="activities">${escapeHtml(plan.activities || '')}</textarea></label>
    <div class="form-grid"><label class="field"><span>Môi trường và học liệu</span><textarea name="materials">${escapeHtml(plan.materials || '')}</textarea></label><label class="field"><span>Phân hóa/hỗ trợ</span><textarea name="differentiation">${escapeHtml(plan.differentiation || '')}</textarea></label></div>
    <div class="form-grid"><label class="field"><span>Biểu hiện quan sát được</span><textarea name="observation">${escapeHtml(plan.observation || '')}</textarea></label><label class="field"><span>Minh chứng</span><textarea name="evidence">${escapeHtml(plan.evidence || plan.assessment || '')}</textarea></label></div>
    <label class="field"><span>Điều chỉnh sau đánh giá</span><textarea name="adjustment">${escapeHtml(plan.adjustment || '')}</textarea></label>
    <label class="field"><span>Phối hợp cha mẹ trẻ</span><textarea name="family">${escapeHtml(plan.family || '')}</textarea></label>
    <label class="field"><span>Điều kiện lớp học dùng để đề xuất hoạt động</span><textarea name="classConditions" placeholder="Không nhập họ tên, sức khỏe hoặc dữ liệu nhận dạng của trẻ.">${escapeHtml(plan.classConditions||'')}</textarea></label>
    <details class="template-editor" ${!plan.level||plan.level==='Năm'?'open':''}><summary>Mẫu kế hoạch giáo dục năm</summary><div class="notice">Mỗi dòng: Thời gian | Chủ đề | Mục tiêu | Nội dung | Hoạt động. Bảng xuất sẽ tự thêm dòng và lặp tiêu đề khi sang trang.</div><label class="field"><span>Các giai đoạn trong năm</span><textarea class="tall" name="annualRows" placeholder="Tháng 9 | Trường mầm non | ... | ... | ...">${escapeHtml(plan.annualRows||'')}</textarea></label></details>
    <details class="template-editor" ${['Tháng','Chủ đề'].includes(plan.level)?'open':''}><summary>Mẫu kế hoạch chủ đề/tháng</summary><div class="notice">Mỗi dòng: Mục tiêu | Nội dung | Hoạt động. File xuất dùng A4 ngang, 4 cột theo mẫu PDF.</div>
      <label class="field"><span>Phát triển thể chất</span><textarea name="themePhysical">${escapeHtml(plan.themePhysical||'')}</textarea></label>
      <label class="field"><span>Tình cảm và kỹ năng xã hội</span><textarea name="themeSocial">${escapeHtml(plan.themeSocial||'')}</textarea></label>
      <label class="field"><span>Phát triển ngôn ngữ</span><textarea name="themeLanguage">${escapeHtml(plan.themeLanguage||'')}</textarea></label>
      <label class="field"><span>Phát triển nhận thức</span><textarea name="themeCognitive">${escapeHtml(plan.themeCognitive||'')}</textarea></label>
      <label class="field"><span>Phát triển thẩm mỹ</span><textarea name="themeAesthetic">${escapeHtml(plan.themeAesthetic||'')}</textarea></label>
      <label class="field"><span>Rèn nền nếp và phối hợp cha mẹ trẻ</span><textarea name="themeFamilyWeeks" placeholder="Tuần 1 | Nội dung phối hợp...">${escapeHtml(plan.themeFamilyWeeks||'')}</textarea></label>
    </details>
    <details class="template-editor" ${plan.level==='Tuần'?'open':''}><summary>Mẫu kế hoạch giáo dục tuần</summary>
      <div class="form-grid"><label class="field"><span>Số tuần</span><input class="input" name="weekNumber" value="${escapeHtml(plan.weekNumber||'')}"></label><label class="field"><span>Chủ đề nhánh</span><input class="input" name="weeklyTheme" value="${escapeHtml(plan.weeklyTheme||'')}"></label></div>
      <label class="field"><span>Đón trẻ</span><textarea name="weeklyWelcome">${escapeHtml(plan.weeklyWelcome||'')}</textarea></label>
      <div class="form-grid"><label class="field"><span>Trò chuyện</span><textarea name="weeklyCircleTime">${escapeHtml(plan.weeklyCircleTime||'')}</textarea></label><label class="field"><span>Thể dục sáng</span><textarea name="weeklyMorningExercise">${escapeHtml(plan.weeklyMorningExercise||'')}</textarea></label></div>
      <div id="weekday-schedule-notice" class="notice">${weekdayScheduleNoticeText(plan.ageGroup)}</div>
      <label class="field"><span>Hoạt động học</span><textarea class="tall" name="weeklyRows" placeholder="Hoạt động học | ... | ... | ... | ... | ...">${escapeHtml(plan.weeklyRows||'')}</textarea></label>
      <label class="field"><span>Hoạt động góc (5 góc cố định: Phân vai – Học tập – Xây dựng – Nghệ thuật – Thiên nhiên)</span><textarea name="weeklyCornerActivities">${escapeHtml(plan.weeklyCornerActivities||'')}</textarea></label>
      <label class="field"><span>Hoạt động ngoài trời</span><textarea name="weeklyOutdoorActivities">${escapeHtml(plan.weeklyOutdoorActivities||'')}</textarea></label>
      <div class="form-grid"><label class="field"><span>Vệ sinh, ăn, ngủ</span><textarea name="weeklyMealSleep">${escapeHtml(plan.weeklyMealSleep||'')}</textarea></label><label class="field"><span>Hoạt động chiều</span><textarea name="weeklyAfternoon">${escapeHtml(plan.weeklyAfternoon||'')}</textarea></label></div>
      <label class="field"><span>Ghi chú và điều chỉnh trong tuần</span><textarea name="weeklyNotes">${escapeHtml(plan.weeklyNotes||'')}</textarea></label>
    </details>
    <details class="template-editor" ${plan.level==='Ngày/hoạt động'?'open':''}><summary>Mẫu giáo án/hoạt động giáo dục ngày</summary>
      <div class="form-grid"><label class="field"><span>Lĩnh vực</span><input class="input" name="lessonDomain" value="${escapeHtml(plan.lessonDomain||'')}"></label><label class="field"><span>Tên bài/hoạt động</span><input class="input" name="lessonTitle" value="${escapeHtml(plan.lessonTitle||'')}"></label></div>
      <div class="form-grid"><label class="field"><span>Loại giáo án</span><select class="select" name="lessonType">${['Hoạt động thông thường','STEAM/Dự án'].map((v)=>`<option ${(plan.lessonType||'Hoạt động thông thường')===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Khung chương trình</span><select class="select" name="framework"><option value="" ${!plan.framework?'selected':''}>— Chưa gắn —</option><option value="TT51" ${plan.framework==='TT51'?'selected':''}>Thông tư 51/2020/TT-BGDĐT (chuẩn)</option><option value="TT388" ${plan.framework==='TT388'?'selected':''}>Chuyên đề 388 (lấy trẻ làm trung tâm)</option></select></label></div>
      <div class="field"><span>Liên kết mục tiêu (MT) từ ngân hàng</span><div id="lesson-objectives-summary" class="objective-summary">${renderObjectiveSummary(selectedObjectiveCodesFromPlan(plan))}</div><div id="lesson-objectives-hidden">${objectiveHiddenInputs(selectedObjectiveCodesFromPlan(plan))}</div><small>Gợi ý tự động theo Lớp, Lĩnh vực và Tên bài/hoạt động — tích chọn ngay bên dưới:</small><div id="lesson-objectives-suggest" class="objective-inline-suggest">${renderInlineSuggestions(plan)}</div><button type="button" class="ghost-button" data-open-objective-picker>Xem tất cả mục tiêu</button></div>
      <label class="field"><span>I. Mục đích - yêu cầu</span><textarea name="lessonObjectives">${escapeHtml(plan.lessonObjectives||'')}</textarea></label>
      <label class="field"><span>II. Chuẩn bị</span><textarea name="lessonPreparation">${escapeHtml(plan.lessonPreparation||'')}</textarea></label>
      <div id="lesson-normal-activities" class="${(plan.lessonType||'Hoạt động thông thường')==='STEAM/Dự án'?'is-hidden':''}">
        <h4>III. Cách tiến hành</h4>
        <div class="form-grid"><label class="field"><span>Hoạt động 1 — Gây hứng thú (Cô)</span><textarea name="activity1Teacher">${escapeHtml(plan.activity1Teacher||'')}</textarea></label><label class="field"><span>Hoạt động 1 — Gây hứng thú (Trẻ)</span><textarea name="activity1Child">${escapeHtml(plan.activity1Child||'')}</textarea></label></div>
        <div class="form-grid"><label class="field"><span>Hoạt động 2 — Nội dung chính (Cô)</span><textarea class="tall" name="activity2Teacher">${escapeHtml(plan.activity2Teacher||'')}</textarea></label><label class="field"><span>Hoạt động 2 — Nội dung chính (Trẻ)</span><textarea class="tall" name="activity2Child">${escapeHtml(plan.activity2Child||'')}</textarea></label></div>
        <div class="form-grid"><label class="field"><span>Hoạt động 3 — Kết thúc (Cô)</span><textarea name="activity3Teacher">${escapeHtml(plan.activity3Teacher||'')}</textarea></label><label class="field"><span>Hoạt động 3 — Kết thúc (Trẻ)</span><textarea name="activity3Child">${escapeHtml(plan.activity3Child||'')}</textarea></label></div>
      </div>
      <div id="lesson-steam-activities" class="${(plan.lessonType||'Hoạt động thông thường')==='STEAM/Dự án'?'':'is-hidden'}">
        <h4>III. Quy trình STEAM</h4>
        <label class="field"><span>1. Đặt vấn đề</span><textarea name="steamProblem">${escapeHtml(plan.steamProblem||'')}</textarea></label>
        <label class="field"><span>2. Khám phá</span><textarea name="steamExplore">${escapeHtml(plan.steamExplore||'')}</textarea></label>
        <label class="field"><span>3. Thiết kế</span><textarea name="steamDesign">${escapeHtml(plan.steamDesign||'')}</textarea></label>
        <label class="field"><span>4. Chế tạo</span><textarea name="steamMake">${escapeHtml(plan.steamMake||'')}</textarea></label>
        <label class="field"><span>5. Thử nghiệm/Cải tiến</span><textarea name="steamTest">${escapeHtml(plan.steamTest||'')}</textarea></label>
        <label class="field"><span>6. Chia sẻ</span><textarea name="steamShare">${escapeHtml(plan.steamShare||'')}</textarea></label>
      </div>
      <label class="field"><span>Đánh giá cuối ngày</span><textarea name="dailyEvaluation">${escapeHtml(plan.dailyEvaluation||'')}</textarea></label>
    </details>
    <div class="form-grid"><label class="field"><span>Người duyệt</span><select class="select" name="approverId"><option value="">— Chưa chọn —</option>${people.filter((item)=>item.roles.includes('Người duyệt')||item.id===plan.approverId).map((item)=>`<option value="${item.id}" ${plan.approverId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="field"><span>Trạng thái kế hoạch</span><select class="select" name="status">${['Bản nháp','Cần rà soát','Đã rà soát','Đã phê duyệt'].map((value)=>`<option ${plan.status===value?'selected':''}>${value}</option>`).join('')}</select></label></div>
    <div class="button-row"><button class="primary-button" type="submit" ${locked?'disabled':''}>Lưu phiên bản</button><button class="secondary-button" type="button" data-plan-ai="generate" ${locked||state.aiBusy?'disabled':''}>AI tạo bản nháp</button><button class="secondary-button" type="button" data-plan-ai="validate" ${state.aiBusy?'disabled':''}>AI rà soát</button><button class="secondary-button" type="button" data-export-plan-word>Xuất Word</button><button class="secondary-button" type="button" data-export-plan-pdf>Xuất PDF</button></div>
  </form>`;
}

function workflowActions(plan={}){if(!plan.id)return'';const status=plan.workflowStatus||'draft';const own=plan.authorTeacherId===state.currentUser?.staffId;const buttons=[];if(hasRole('teacher')&&own&&status==='draft')buttons.push(['sent_team','Gửi tổ trưởng']);if(hasRole('teacher')&&own&&status==='changes_requested')buttons.push(['draft','Mở phiên bản chỉnh sửa']);if(hasRole('team_lead')&&status==='sent_team')buttons.push(['changes_requested','Yêu cầu chỉnh sửa'],['sent_professional','Gửi chuyên môn']);if(hasRole('vice_principal')&&status==='sent_professional')buttons.push(['submitted_approval','Trình phê duyệt']);if(hasRole('principal')&&status==='submitted_approval')buttons.push(['changes_requested','Trả lại chỉnh sửa'],['approved','Phê duyệt']);return `<section class="panel workflow-panel"><div><span class="chip teal">${escapeHtml(status)}</span><strong>Quy trình kế hoạch • phiên bản ${plan.version||1}</strong></div><div class="button-row">${buttons.map(([to,label])=>`<button class="${to==='approved'?'primary-button':'secondary-button'}" data-transition-plan="${plan.id}" data-to-status="${to}">${label}</button>`).join('')||'<small>Không có thao tác chuyển trạng thái phù hợp với vai trò hiện tại.</small>'}</div></section>`;}

function renderPlanner(editId = '') {
  let plan = state.workspace.plans.find((item) => item.id === editId) || {};
  if (!editId && state.draftPlanSeed) { plan = { ...state.draftPlanSeed }; state.draftPlanSeed = null; }
  const reviews = state.workspace.professionalReviews.filter((item)=>item.planId===plan.id && (!state.showPendingReviewsOnly || !item.resolved)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  els.main.innerHTML = `${pageHead('Công cụ chuyên môn', 'Xây dựng kế hoạch 2026–2027', 'Soạn theo cấu trúc mở; có thể tiếp tục chỉnh sửa, sao lưu và chuyển sang máy khác.','<button class="ghost-button" data-guide-context="planner">Xem hướng dẫn</button>')}${workflowActions(plan)}
    <section class="planner-layout"><div><article class="panel">${planTemplate(plan)}</article>${plan.id?`<article class="panel professional-reviews"><div class="panel-title-row"><div><h2>Nhận xét chuyên môn</h2><p class="panel-subtitle">Dòng thời gian bất biến theo từng phiên bản kế hoạch.</p></div><div class="button-row"><button class="secondary-button" data-filter-reviews>${state.showPendingReviewsOnly?'Hiện tất cả':'Chỉ chưa xử lý'}</button><button class="primary-button" data-add-review="${plan.id}">Thêm nhận xét</button></div></div><div class="review-timeline">${reviews.map((item)=>`<article class="${item.resolved?'is-resolved':''}"><i></i><header><strong>${escapeHtml(item.reviewerNameSnapshot||staffName(item.reviewerId))}</strong><span class="chip ${item.type==='Yêu cầu chỉnh sửa'?'amber':'teal'}">${escapeHtml(item.type)}</span></header><small>${escapeHtml(item.reviewerRoleSnapshot)} • Phiên bản ${item.planVersion} • ${new Date(item.createdAt).toLocaleString('vi-VN')}</small><p>${escapeHtml(item.content)}</p>${item.resolved?`<div class="review-response"><b>Đã xử lý:</b> ${escapeHtml(item.response)}</div>`:`<button class="small-button" data-resolve-review="${item.id}">Ghi nhận đã xử lý</button>`}</article>`).join('')||'<div class="empty-state">Chưa có nhận xét chuyên môn.</div>'}</div></article>`:''}</div><aside class="panel plan-list"><div class="panel-title-row"><div><h2>Kế hoạch đã lưu</h2><p class="panel-subtitle">${state.workspace.plans.length} kế hoạch trên máy</p></div></div>${state.workspace.plans.map(p=>`<button class="saved-plan" data-edit-plan="${p.id}"><strong>${escapeHtml(p.title)}</strong><span>Phiên bản ${p.version||1} • ${escapeHtml(className(p.classId,p.ageGroup))} • ${escapeHtml(p.schoolYear)}</span></button>`).join('') || '<div class="empty-state">Chưa có kế hoạch.</div>'}</aside></section>`;
}

function frameworkLibraryLessons(framework) {
  return (state.workspace.plans || []).filter((p) => p.level === 'Ngày/hoạt động' && p.framework === framework);
}
function frameworkLibraryCard(plan, framework) {
  const highlightLabel = framework === 'TT51' ? 'Mục đích - yêu cầu' : 'Trọng tâm năng lực';
  const highlight = String(plan.lessonObjectives || '').split('\n').find((line) => line.trim()) || '';
  const evalText = String(plan.dailyEvaluation || '').split('\n').find((line) => line.trim()) || '';
  const otherLabel = framework === 'TT51' ? 'Chuyên đề 388' : 'Thông tư 51';
  return `<article class="document-card framework-card ${framework === 'TT51' ? 'is-tt51' : 'is-tt388'}">
    <div class="doc-mark">${escapeHtml(plan.ageGroup || '')}</div>
    <div>
      <div class="chip-row">
        <span class="chip ${framework === 'TT51' ? '' : 'teal'}">${framework === 'TT51' ? 'TT 51/2020' : 'Chuyên đề 388'}</span>
        ${plan.lessonDomain ? `<span class="chip amber">${escapeHtml(plan.lessonDomain)}</span>` : ''}
        <span class="chip">${escapeHtml(className(plan.classId, plan.ageGroup))}</span>
      </div>
      <h3>${escapeHtml(plan.lessonTitle || plan.title || 'Chưa đặt tên')}</h3>
      ${highlight ? `<p class="panel-subtitle"><strong>${highlightLabel}:</strong> ${escapeHtml(highlight.slice(0, 140))}</p>` : ''}
      ${evalText ? `<p class="panel-subtitle"><strong>Đánh giá cuối ngày:</strong> ${escapeHtml(evalText.slice(0, 140))}</p>` : ''}
    </div>
    <div class="doc-actions">
      <button class="small-button" data-edit-plan="${plan.id}">Xem chi tiết</button>
      <button class="small-button" data-library-export-word="${plan.id}">Word</button>
      <button class="small-button" data-library-export-pdf="${plan.id}">PDF</button>
      <button class="small-button" data-convert-framework="${plan.id}">Đổi sang ${escapeHtml(otherLabel)}</button>
    </div>
  </article>`;
}
function renderFrameworkLibrary() {
  const tab = state.frameworkLibraryTab || 'TT51';
  const q = normalizeText(state.query);
  const lessons = frameworkLibraryLessons(tab).filter((p) => !q || normalizeText(`${p.lessonTitle || p.title || ''} ${p.lessonDomain || ''}`).includes(q));
  const bannerTT51 = `<div class="framework-banner is-tt51">
    <span class="chip">Mục 1 · Chuẩn chương trình GDMN quốc gia</span>
    <h2>Soạn bài theo Thông tư 51/2020/TT-BGDĐT</h2>
    <p>Cấu trúc bài dạy chuẩn mực theo 5 lĩnh vực phát triển, bám sát bộ chuẩn kiến thức – kỹ năng – thái độ theo từng lứa tuổi Nhà trẻ và Mẫu giáo.</p>
    <div class="framework-pillars">
      <div><b>I. Mục đích - Yêu cầu</b><span>Kiến thức • Kỹ năng • Thái độ</span></div>
      <div><b>II. Chuẩn bị</b><span>Đồ dùng cô • Đồ dùng trẻ • Môi trường</span></div>
      <div><b>III. Cách tiến hành</b><span>Ổn định • Trọng tâm • Kết thúc</span></div>
      <div><b>IV. Đánh giá trẻ</b><span>Tỷ lệ đạt • Trẻ cần rèn luyện thêm</span></div>
    </div>
  </div>`;
  const bannerTT388 = `<div class="framework-banner is-tt388">
    <span class="chip teal">Mục 2 · Chương trình GDMN thí điểm (Quyết định 388/QĐ-BGDĐT)</span>
    <h2>Soạn bài theo Quyết định 388/QĐ-BGDĐT</h2>
    <p>Thiết kế bài dạy theo 4 phẩm chất cốt lõi (Yêu thương, Tôn trọng, Trung thực, Trách nhiệm) và 5 năng lực nền tảng (Giao tiếp, Hợp tác, Thích ứng, Tự lực, Giải quyết vấn đề). Trẻ học qua trải nghiệm thực tế; cô đóng vai trò gợi mở, tổ chức môi trường mở.</p>
    <div class="framework-pillars is-five">
      <div><b>B1: Khởi động</b><span>Tình huống có vấn đề</span></div>
      <div><b>B2: Khám phá – Trải nghiệm</b><span>Trẻ tự thử nghiệm</span></div>
      <div><b>B3: Chia sẻ – Thảo luận</b><span>Chuẩn hóa sau trải nghiệm</span></div>
      <div><b>B4: Thực hành – Vận dụng</b><span>Tình huống mới/mở rộng</span></div>
      <div><b>B5: Đánh giá – Điều chỉnh</b><span>Tự đánh giá &amp; tiến bộ</span></div>
    </div>
  </div>`;
  els.main.innerHTML = `${pageHead('Khung chương trình', 'Thư viện giáo án theo Thông tư 51 / Chuyên đề 388', 'Phân loại giáo án "Ngày/hoạt động" đã soạn theo 2 khung chương trình để tra cứu, xuất file và chuyển đổi khi cần. Gắn khung chương trình cho giáo án ngay trong ô "Khung chương trình" của Xây dựng kế hoạch.')}
    <div class="framework-tabs">
      <button class="framework-tab ${tab === 'TT51' ? 'is-active' : ''}" data-framework-tab="TT51">Mục 1 · Thông tư 51</button>
      <button class="framework-tab ${tab === 'TT388' ? 'is-active' : ''}" data-framework-tab="TT388">Mục 2 · Chuyên đề 388</button>
    </div>
    ${tab === 'TT51' ? bannerTT51 : bannerTT388}
    <div class="toolbar"><label class="field"><span>Tìm kiếm</span><input class="input" id="framework-library-query" placeholder="Tìm theo tên bài, lĩnh vực..." value="${escapeHtml(state.query || '')}"></label><div class="result-count">${lessons.length} giáo án</div><button class="primary-button" data-new-framework-lesson="${tab}">Soạn bài mới chuẩn ${tab === 'TT51' ? 'TT51' : '388'}</button></div>
    <div class="document-list">${lessons.map((p) => frameworkLibraryCard(p, tab)).join('') || `<div class="empty-state">Chưa có giáo án nào gắn khung ${tab === 'TT51' ? 'Thông tư 51' : 'Chuyên đề 388'}. Mở một giáo án "Ngày/hoạt động" trong Xây dựng kế hoạch và chọn khung chương trình, hoặc bấm "Soạn bài mới" ở trên.</div>`}</div>`;
}

function openRecordEditor(id = '') {
  const item = openRecords().find((record) => record.id === id) || { id: `custom-${Date.now()}`, status: 'Bản nháp', ageGroup: state.data.ageGroups[0].label };
  els.drawerContent.innerHTML = `<header class="drawer-header"><div><span class="chip teal">DỮ LIỆU MỞ</span><h2>Chỉnh sửa bản ghi</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="record-form" class="plan-form"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><label class="field"><span>Tiêu đề</span><input class="input" name="title" value="${escapeHtml(item.title || '')}" required></label><div class="form-grid"><label class="field"><span>Độ tuổi</span><input class="input" name="ageGroup" value="${escapeHtml(item.ageGroup || '')}"></label><label class="field"><span>Loại dữ liệu</span><input class="input" name="type" value="${escapeHtml(item.type || '')}"></label></div><label class="field"><span>Chủ đề</span><input class="input" name="topic" value="${escapeHtml(item.topic || '')}"></label><label class="field"><span>Mục tiêu/yêu cầu cần đạt</span><textarea name="objective">${escapeHtml(item.objective || '')}</textarea></label><label class="field"><span>Nội dung</span><textarea name="content" class="tall">${escapeHtml(item.content || '')}</textarea></label><label class="field"><span>Hoạt động gợi ý</span><textarea name="activity">${escapeHtml(item.activity || '')}</textarea></label><label class="field"><span>Minh chứng/đánh giá</span><textarea name="evidence">${escapeHtml(item.evidence || '')}</textarea></label><div class="form-grid"><label class="field"><span>Trang nguồn</span><input class="input" name="sourcePage" value="${escapeHtml(item.sourcePage || '')}"></label><label class="field"><span>Trạng thái</span><select class="select" name="status">${['Bản nháp','Trích xuất – cần rà soát','Đã rà soát','Đã phê duyệt'].map(v=>`<option ${item.status===v?'selected':''}>${v}</option>`).join('')}</select></label></div><button class="primary-button" type="submit">Lưu bản ghi</button></form></div>`;
  els.drawerBackdrop.classList.remove('is-hidden'); els.drawer.classList.add('is-open'); els.drawer.setAttribute('aria-hidden','false');
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
    ${pageHead('Kiểm soát dữ liệu', 'Nội dung cần rà soát', 'Cảnh báo giúp phát hiện điểm bất thường; ứng dụng không tự động kết luận sai và không thay đổi PDF nguồn.', `<div class="button-row"><button class="ghost-button" data-guide-context="approval">Xem hướng dẫn</button><button class="secondary-button" data-export-review-word>Xuất báo cáo Word</button><button class="secondary-button" data-toggle-resolved>${state.showResolved ? 'Ẩn việc đã xác nhận' : 'Hiện việc đã xác nhận'}</button></div>`)}
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
    ${pageHead('Báo cáo', 'Thống kê kho chương trình', 'Số liệu được tính trực tiếp từ 246 tài liệu PDF đã lập chỉ mục.', '<button class="primary-button" data-export-excel>Xuất báo cáo Excel</button>')}
    <section class="report-grid">
      <article class="panel"><div class="panel-title-row"><div><h2>Tài liệu theo độ tuổi</h2><p class="panel-subtitle">So sánh số tệp và số trang.</p></div></div><div class="bar-list">${state.data.ageGroups.map((age) => `<div class="bar-item"><label>${escapeHtml(age.label)}</label><div class="bar"><span style="width:${Math.round(age.documents / maxAge * 100)}%"></span></div><b>${age.documents}</b></div>`).join('')}</div></article>
      <article class="panel"><div class="panel-title-row"><div><h2>Tài liệu theo loại hồ sơ</h2><p class="panel-subtitle">Phân loại từ tên và nội dung phần đầu văn bản.</p></div></div><div class="bar-list">${Object.entries(typeCounts).map(([type, count]) => `<div class="bar-item"><label>${escapeHtml(type)}</label><div class="bar"><span style="width:${Math.round(count / maxType * 100)}%"></span></div><b>${count}</b></div>`).join('')}</div></article>
      <article class="panel" style="grid-column:1/-1"><div class="panel-title-row"><div><h2>Tổng hợp theo nhóm tuổi</h2><p class="panel-subtitle">Cơ sở để phân công rà soát và hoàn thiện dữ liệu.</p></div></div><table class="report-table"><thead><tr><th>Độ tuổi</th><th>Tài liệu</th><th>Trang</th><th>Chủ đề/tháng</th><th>Mục tiêu/chủ đề</th><th>Kế hoạch tháng</th><th>Kế hoạch tuần</th><th>Đã rà soát</th></tr></thead><tbody>${state.data.ageGroups.map((age) => `<tr><td><strong>${escapeHtml(age.label)}</strong></td><td>${age.documents}</td><td>${formatNumber(age.pages)}</td><td>${age.collections}</td><td>${age.objectives}</td><td>${age.monthlyPlans}</td><td>${age.weeklyPlans}</td><td>${state.data.documents.filter((item) => item.ageGroup === age.label && reviewed.has(item.id)).length}</td></tr>`).join('')}</tbody></table></article>
    </section>`;
}

function renderBackup() {
  const progress = reviewSummary(state.data.documents, state.review);
  const logs = [...(state.workspace.importLog || [])].reverse().slice(0, 10);
  els.main.innerHTML = `
    ${pageHead('Quản trị', 'Dữ liệu và sao lưu', 'Lưu trạng thái rà soát, tài liệu cần theo dõi và ghi chú cá nhân; PDF nguồn không bị thay đổi.')}
    <div class="backup-grid">
      <article class="panel"><div class="panel-title-row"><div><h2>Tạo bản sao lưu kỹ thuật đầy đủ</h2><p class="panel-subtitle">Bao gồm hồ sơ trường, lớp, nhân sự, kế hoạch, nhận xét, cấu hình chữ ký và trạng thái rà soát.</p></div></div><p>${progress.reviewed} tài liệu đã rà soát, ${state.workspace.classes.length} lớp và ${state.workspace.staff.length} nhân sự đang lưu cục bộ.</p><div class="button-row"><button class="primary-button" data-export-backup>Tạo bản sao lưu</button><button class="secondary-button" data-import-backup>Khôi phục bản sao lưu</button></div></article>
      <article class="panel"><div class="panel-title-row"><div><h2>Nguyên tắc bảo toàn dữ liệu</h2><p class="panel-subtitle">Mọi thao tác trong phiên bản này đều có thể khôi phục.</p></div></div><div class="notice">Ứng dụng không ghi đè 246 PDF nguồn. Trạng thái rà soát được lưu riêng trên máy và có thể xuất thành tệp JSON.</div><div class="button-row" style="margin-top:16px"><button class="danger-button" data-reset-review>Xóa trạng thái rà soát trên máy</button></div></article>
    </div>
    <article class="panel import-log"><div class="panel-title-row"><div><h2>Nhật ký nhập dữ liệu</h2><p class="panel-subtitle">Lịch sử kỹ thuật lưu trên máy, không thay đổi PDF nguồn.</p></div><span class="chip">${state.workspace.importLog.length} lần</span></div>
      ${logs.length ? `<div class="log-list">${logs.map((item) => `<div><strong>${escapeHtml(item.filename || item.kind)}</strong><span>${escapeHtml(item.kind)} • ${item.recordCount} mục • ${new Date(item.importedAt).toLocaleString('vi-VN')}</span><b>${escapeHtml(item.result)}</b></div>`).join('')}</div>` : '<div class="empty-state">Chưa có lần nhập dữ liệu nào.</div>'}
    </article>`;
}

function renderAbout() {
  els.main.innerHTML = `
    ${pageHead('Thông tin', 'Ứng dụng Trường Mầm non Số', 'Bản thử nghiệm ngoại tuyến được xây dựng từ bộ hồ sơ chương trình và kế hoạch giáo dục nhà trường.')}
    <article class="panel" style="max-width:800px"><div class="panel-title-row"><div><h2>Phiên bản 0.2.0</h2><p class="panel-subtitle">Kho dữ liệu mở và công cụ soạn kế hoạch 2026–2027.</p></div><span class="chip teal">Ngoại tuyến</span></div>
      <ul class="about-list">
        <li><span>Đơn vị</span><strong>${escapeHtml(state.data.meta.schoolName)}</strong></li>
        <li><span>Năm học</span><strong>${escapeHtml(state.data.meta.schoolYear)}</strong></li>
        <li><span>Nguồn dữ liệu</span><strong>${escapeHtml(state.data.meta.sourceName)}</strong></li>
        <li><span>Quy mô</span><strong>${state.data.summary.documents} PDF • ${formatNumber(state.data.summary.pages)} trang • ${state.data.ageGroups.length} nhóm độ tuổi</strong></li>
        <li><span>Nguyên tắc</span><strong>${escapeHtml(state.data.meta.sourcePolicy)}</strong></li>
      </ul>
      <div class="notice" style="margin-top:18px">PDF được bảo toàn làm nguồn đối chiếu. Dữ liệu làm việc và kế hoạch được lưu riêng, có thể chỉnh sửa và xuất thành tệp Word hoặc Excel hợp lệ.</div>
    </article>`;
}

function render() {
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === state.route));
  if (state.route === 'work-center') renderWorkCenter();
  else if (state.route === 'settings') renderSettings();
  else if (state.route === 'videos') renderVideos();
  else if (state.route === 'online-resources') renderAIWorkspace();
  else if (state.route === 'evaluation') renderEvaluation();
  else if (state.route === 'approval') renderTemporaryRoute(state.route);
  else if (state.route === 'dashboard') renderDashboard();
  else if (state.route === 'open-data') renderOpenData();
  else if (state.route === 'planner') renderPlanner();
  else if (state.route === 'framework-library') renderFrameworkLibrary();
  else if (['library', 'objectives', 'monthly', 'weekly'].includes(state.route)) renderLibrary(state.route);
  else if (state.route === 'review') renderReview();
  else if (state.route === 'reports') renderReports();
  else if (state.route === 'backup') renderBackup();
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

async function exportBackup() {
  try{const payload=await window.ctgdmnDesktop.createDatabaseBackup();downloadJson(`sao-luu-sqlite-${safeFilename(schoolProfile().name)}-${new Date().toISOString().slice(0,10)}.json`,payload);showToast('Đã tạo bản sao lưu SQLite đầy đủ.');}catch(error){showToast(error.message||'Bạn không có quyền sao lưu.');}
}

async function loadData() {
  if (window.ctgdmnDesktop?.getProgramIndex) return window.ctgdmnDesktop.getProgramIndex();
  const response = await fetch('./data/program-index.json');
  if (!response.ok) throw new Error(`Không nạp được dữ liệu (${response.status}).`);
  return response.json();
}

function authScreen(kind, message = '') {
  const school=state.publicBranding.schoolName;const setup=kind==='setup';const request=kind==='request';syncPublicBranding(state.publicBranding);
  const eyebrow=setup?'THIẾT LẬP LẦN ĐẦU':request?'YÊU CẦU CẤP TÀI KHOẢN':'ĐĂNG NHẬP NỘI BỘ';
  const intro=setup?'Tạo tài khoản quản trị đầu tiên. Ứng dụng không có tài khoản hoặc mật khẩu mặc định.':request?'Điền thông tin bên dưới — quản trị viên của trường sẽ xem và phê duyệt trước khi bạn đăng nhập được.':'Dữ liệu được lưu cục bộ trong SQLite trên máy này.';
  const formId=setup?'first-admin-form':request?'account-request-form':'login-form';
  els.loading.className='loading-screen auth-screen';
  els.loading.innerHTML=`<section class="auth-card"><img src="../assets/icon.png" alt="Logo DNA Hiền"><p class="eyebrow">${eyebrow}</p><h1>${escapeHtml(school)}</h1><p>${intro}</p>${message?`<div class="auth-error">${escapeHtml(message)}</div>`:''}<form id="${formId}" class="plan-form">${(setup||request)?'<label class="field"><span>Họ và tên *</span><input class="input" required name="fullName" autocomplete="name"></label>':''}<label class="field"><span>Tên đăng nhập *</span><input class="input" required name="username" autocomplete="username"></label><label class="field"><span>Mật khẩu *</span><div class="password-field"><input class="input" required minlength="8" name="password" type="password" autocomplete="${(setup||request)?'new-password':'current-password'}"><button type="button" data-toggle-password>Hiện</button></div></label>${(setup||request)?'<label class="field"><span>Nhập lại mật khẩu *</span><input class="input" required minlength="8" name="confirmPassword" type="password" autocomplete="new-password"></label>':''}${request?'<label class="field"><span>Chức vụ</span><input class="input" name="title" placeholder="Ví dụ: Giáo viên"></label><label class="field"><span>Tổ chuyên môn/Lớp phụ trách</span><input class="input" name="team"></label>':''}<button class="primary-button" type="submit">${setup?'Tạo quản trị đầu tiên':request?'Gửi yêu cầu':'Đăng nhập'}</button></form>${!setup&&!request?'<button type="button" class="ghost-button" data-request-account>Chưa có tài khoản? Yêu cầu cấp tài khoản</button>':''}${request?'<button type="button" class="ghost-button" data-back-to-login>Quay lại đăng nhập</button>':''}<small>Trường Mầm non Số phiên bản 0.6.0 • Hoạt động không cần Internet</small></section>`;
  els.loading.querySelector('[data-toggle-password]')?.addEventListener('click',(event)=>{const input=els.loading.querySelector('input[name=password]');input.type=input.type==='password'?'text':'password';event.currentTarget.textContent=input.type==='password'?'Hiện':'Ẩn';});
  els.loading.querySelector('[data-request-account]')?.addEventListener('click',()=>authScreen('request'));
  els.loading.querySelector('[data-back-to-login]')?.addEventListener('click',()=>authScreen('login'));
  els.loading.querySelector('form').addEventListener('submit',async(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));try{
    if(setup){if(data.password!==data.confirmPassword)throw new Error('Mật khẩu nhập lại không khớp.');await window.ctgdmnDesktop.setupFirstAdmin({username:data.username,fullName:data.fullName,password:data.password});return authScreen('login','Đã tạo tài khoản quản trị. Hãy đăng nhập.');}
    if(request){if(data.password!==data.confirmPassword)throw new Error('Mật khẩu nhập lại không khớp.');await window.ctgdmnDesktop.requestAccount({fullName:data.fullName,username:data.username,password:data.password,title:data.title,team:data.team});return authScreen('login','Đã gửi yêu cầu cấp tài khoản. Vui lòng chờ quản trị viên phê duyệt rồi đăng nhập lại.');}
    const user=await window.ctgdmnDesktop.login(data.username,data.password);state.currentUser=user;if(user.mustChangePassword)return forcePasswordChange();await startAuthenticated();
  }catch(error){authScreen(kind,error.message||'Không thể đăng nhập.');}});
}

function forcePasswordChange(message='') {
  els.loading.className='loading-screen auth-screen';els.loading.innerHTML=`<section class="auth-card"><p class="eyebrow">BẢO MẬT TÀI KHOẢN</p><h1>Đổi mật khẩu lần đầu</h1><p>Đây là mật khẩu tạm thời. Bạn phải đổi mật khẩu trước khi sử dụng ứng dụng.</p>${message?`<div class="auth-error">${escapeHtml(message)}</div>`:''}<form id="force-password-form" class="plan-form"><label class="field"><span>Mật khẩu hiện tại</span><input class="input" type="password" required name="currentPassword"></label><label class="field"><span>Mật khẩu mới</span><input class="input" type="password" minlength="8" required name="newPassword"></label><label class="field"><span>Nhập lại mật khẩu mới</span><input class="input" type="password" minlength="8" required name="confirmPassword"></label><button class="primary-button">Đổi mật khẩu và tiếp tục</button></form></section>`;els.loading.querySelector('form').addEventListener('submit',async(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));try{if(data.newPassword!==data.confirmPassword)throw new Error('Mật khẩu nhập lại không khớp.');await window.ctgdmnDesktop.changePassword(data.currentPassword,data.newPassword);state.currentUser.mustChangePassword=false;await startAuthenticated();}catch(error){forcePasswordChange(error.message);}});
}

async function startAuthenticated() {
  const legacy={workspace:state.workspace,review:state.review};await window.ctgdmnDesktop.bootstrapRepository(legacy);const stored=await window.ctgdmnDesktop.getRepositoryState();state.workspace=migrateWorkspace(stored.workspace,state.data.meta);state.workspace.pendingAIRequests=state.workspace.pendingAIRequests||[];state.review={...defaultReviewState(),...(stored.review||{})};state.systemConfig=stored.systemConfig||state.systemConfig;[state.aiConfig,state.templates]=await Promise.all([window.ctgdmnDesktop.getAIConfig(),window.ctgdmnDesktop.listTemplates()]);state.originalSchoolProfile=defaultSchoolProfile(state.data.meta);state.data.meta.schoolName=schoolProfile().name;state.data.meta.schoolYear=schoolProfile().schoolYear;syncPublicBranding(schoolProfile());state.videos=await window.ctgdmnDesktop.listVideos();localStorage.removeItem('ctgdmn-open-workspace-v1');localStorage.removeItem('ctgdmn-review-v1');document.querySelector('#school-name').textContent=schoolProfile().name;document.querySelector('#school-year').textContent=schoolProfile().schoolYear;document.querySelector('#profile-name').textContent=state.currentUser.fullName;document.querySelector('#profile-role').textContent=(state.currentUser.roles||[]).map((role)=>ROLE_LABELS[role]||role).join(', ');document.querySelector('#profile-avatar').textContent=(state.currentUser.fullName||'U').trim().charAt(0).toUpperCase();applyRoleVisibility();if(!bindEvents.bound){bindEvents();bindEvents.bound=true;}render();els.loading.classList.add('is-hidden');els.app.classList.remove('is-hidden');if(hasRole('system_admin'))saveWorkspace('migration.confirmed','workspace','main');
}

function applyRoleVisibility(){const roles=state.currentUser?.roles||[];const allowed={settings:roles.includes('system_admin'),backup:roles.includes('system_admin'),reports:roles.some((role)=>['principal','vice_principal'].includes(role)),approval:roles.some((role)=>['principal','vice_principal','team_lead'].includes(role)),evaluation:!roles.includes('viewer')};for(const [route,visible]of Object.entries(allowed)){const button=document.querySelector(`[data-route="${route}"]`);if(button)button.hidden=!visible;}}

function bindEvents() {
  els.nav.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-route]');
    if (!button) return;
    const route = button.dataset.route;
    if (route === 'evaluation') { try { state.children = await window.ctgdmnDesktop.listChildren(); state.selectedChildId = ''; state.childAssessments = []; } catch (error) { showToast(error.message); } }
    if (route === 'planner') { try { state.objectives = await window.ctgdmnDesktop.listObjectives(); } catch (error) { showToast(error.message); } }
    setRoute(route);
  });
  els.main.addEventListener('click', async (event) => {
    const route = event.target.closest('[data-route-jump]');
    if (route) return setRoute(route.dataset.routeJump);
    const trustedResource=event.target.closest('[data-open-trusted-resource]');if(trustedResource){try{await window.ctgdmnDesktop.openTrustedResource(trustedResource.dataset.openTrustedResource);}catch(error){showToast(error.message||'Không thể mở trợ lý AI.');}return;}
    if(event.target.closest('[data-open-ai-settings]')){state.settingsTab='ai';state.route='settings';renderSettings();return;}
    if(event.target.closest('[data-test-ai]')){try{showToast('Đang kiểm tra kết nối thực tế đến nhà cung cấp...');const result=await window.ctgdmnDesktop.testAIConnection();state.aiConfig=await window.ctgdmnDesktop.getAIConfig();if(state.route==='settings')renderSettings();else renderAIWorkspace();showToast(result.ok?'GenAI đã sẵn sàng.':result.message||'Không thể kết nối GenAI.');}catch(error){showToast(error.message);}return;}
    if(event.target.closest('[data-clear-ai]')){if(window.confirm('Xóa cấu hình và khóa API đã lưu trên máy này?')){await window.ctgdmnDesktop.clearAIConfig();state.aiConfig=await window.ctgdmnDesktop.getAIConfig();renderSettings();showToast('Đã xóa cấu hình AI.');}return;}
    if(event.target.closest('[data-import-template]')){openDrawerPanel(`<header class="drawer-header"><div><span class="chip teal">MẪU DOCX TÙY CHỈNH</span><h2>Nhập mẫu văn bản</h2></div><button class="drawer-close" data-close-drawer>×</button></header><div class="drawer-body"><form id="template-import-form" class="plan-form"><label class="field"><span>Tên mẫu</span><input class="input" name="name" placeholder="Ví dụ: Mẫu kế hoạch tuần của trường"></label><label class="field"><span>Nhóm mẫu</span><select class="select" name="type"><option value="annual">Kế hoạch giáo dục năm</option><option value="theme">Kế hoạch chủ đề/tháng</option><option value="weekly">Kế hoạch giáo dục tuần</option><option value="lesson">Giáo án/hoạt động ngày</option></select></label><div class="notice">Tệp DOCX cần có {{PLAN_TABLE}} trên một dòng riêng. Sau khi bấm tiếp tục, ứng dụng mới mở hộp chọn tệp.</div><button class="primary-button">Tiếp tục chọn DOCX</button></form></div>`);return;}
    if(event.target.closest('[data-backup-templates]')){const result=await window.ctgdmnDesktop.backupTemplates();if(result.ok)showToast('Đã sao lưu toàn bộ mẫu văn bản.');return;}
    if(event.target.closest('[data-restore-templates]')){if(window.confirm('Khôi phục mẫu từ bản sao lưu? Các mẫu trùng mã có thể được cập nhật.')){const result=await window.ctgdmnDesktop.restoreTemplates();if(!result.canceled){state.templates={templates:result.templates,defaultByType:result.defaultByType};renderSettings();showToast('Đã khôi phục mẫu văn bản.');}}return;}
    const pendingOpen=event.target.closest('[data-open-pending-ai]');if(pendingOpen){const item=(state.workspace.pendingAIRequests||[]).find((entry)=>entry.id===pendingOpen.dataset.openPendingAi);if(item){state.workspace.pendingAIRequests=state.workspace.pendingAIRequests.filter((entry)=>entry.id!==item.id);saveWorkspace('ai.pending_open','ai_request',item.id);state.route='planner';renderPlanner();Object.entries(item.plan||{}).forEach(([key,value])=>{const field=document.querySelector(`#plan-form [name="${key}"]`);if(field&&!Array.isArray(value))field.value=value||'';});showToast('Đã mở yêu cầu đang chờ. Bấm AI tạo bản nháp khi cô đồng ý gửi.');}return;}
    const pendingDelete=event.target.closest('[data-delete-pending-ai]');if(pendingDelete){state.workspace.pendingAIRequests=state.workspace.pendingAIRequests.filter((entry)=>entry.id!==pendingDelete.dataset.deletePendingAi);saveWorkspace('ai.pending_delete','ai_request',pendingDelete.dataset.deletePendingAi);renderAIWorkspace();return;}
    const guide=event.target.closest('[data-guide-context]');if(guide)return openContextGuide(guide.dataset.guideContext);
    const transition=event.target.closest('[data-transition-plan]');if(transition){try{await window.ctgdmnDesktop.transitionPlan(transition.dataset.transitionPlan,transition.dataset.toStatus);const stored=await window.ctgdmnDesktop.getRepositoryState();state.workspace=migrateWorkspace(stored.workspace,state.data.meta);renderPlanner(transition.dataset.transitionPlan);showToast('Đã chuyển trạng thái và lưu lịch sử.');}catch(error){showToast(error.message);}return;}
    const age = event.target.closest('[data-age-open]');
    if (age) { state.ageGroup = age.dataset.ageOpen; return setRoute('library', { keepFilters: true }); }
    const viewThemeDocs = event.target.closest('[data-view-theme-docs]');
    if (viewThemeDocs) { const [ageGroup, collection] = viewThemeDocs.dataset.viewThemeDocs.split('|||'); state.ageGroup = ageGroup; state.collection = collection; state.query = ''; return setRoute('library', { keepFilters: true }); }
    const useTheme = event.target.closest('[data-use-theme]');
    if (useTheme) { const [ageGroup, collection] = useTheme.dataset.useTheme.split('|||'); state.draftPlanSeed = themeToPlanSeed(ageGroup, collection); showToast('Đã điền sẵn chủ đề vào kế hoạch mới.'); return setRoute('planner'); }
    if (event.target.closest('[data-add-child]')) return openChildEditor();
    if (event.target.closest('[data-pick-theme]')) return openThemePicker();
    if (event.target.closest('[data-open-objective-picker]')) return openObjectivePicker();
    const selectChild = event.target.closest('[data-select-child]');
    if (selectChild) { try { state.selectedChildId = selectChild.dataset.selectChild; state.childAssessments = await window.ctgdmnDesktop.listChildAssessments(state.selectedChildId); renderEvaluation(); } catch (error) { showToast(error.message); } return; }
    const deactivateChild = event.target.closest('[data-deactivate-child]');
    if (deactivateChild) { if (window.confirm('Ngừng theo dõi hồ sơ trẻ này? Các đánh giá đã ghi nhận vẫn được giữ lại.')) { try { await window.ctgdmnDesktop.deactivateChild(deactivateChild.dataset.deactivateChild); state.children = await window.ctgdmnDesktop.listChildren(); state.selectedChildId = ''; state.childAssessments = []; renderEvaluation(); showToast('Đã ngừng theo dõi hồ sơ trẻ.'); } catch (error) { showToast(error.message); } } return; }
    const deleteAssessment = event.target.closest('[data-delete-assessment]');
    if (deleteAssessment) { if (window.confirm('Xóa bản ghi đánh giá này?')) { try { await window.ctgdmnDesktop.deleteChildAssessment(deleteAssessment.dataset.deleteAssessment); state.childAssessments = await window.ctgdmnDesktop.listChildAssessments(state.selectedChildId); renderEvaluation(); showToast('Đã xóa bản ghi đánh giá.'); } catch (error) { showToast(error.message); } } return; }
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
    if (event.target.closest('[data-add-data]')) return openImportMenu();
    if (event.target.closest('[data-export-excel]')) return exportExcelWorkbook();
    if (event.target.closest('[data-export-review-word]')) return exportReviewWord();
    const settingsTab=event.target.closest('[data-settings-tab]'); if(settingsTab){state.settingsTab=settingsTab.dataset.settingsTab;if(state.settingsTab==='accounts'){try{[state.users,state.auditLog,state.accountRequests]=await Promise.all([window.ctgdmnDesktop.listUsers(),window.ctgdmnDesktop.getAuditLog(200),window.ctgdmnDesktop.listAccountRequests()]);}catch(error){showToast(error.message);}}renderSettings();return;}
    const approveRequest=event.target.closest('[data-approve-request]');if(approveRequest){if(window.confirm('Duyệt yêu cầu này và tạo tài khoản Giáo viên?')){try{await window.ctgdmnDesktop.approveAccountRequest(approveRequest.dataset.approveRequest);[state.users,state.accountRequests]=await Promise.all([window.ctgdmnDesktop.listUsers(),window.ctgdmnDesktop.listAccountRequests()]);renderSettings();showToast('Đã duyệt và tạo tài khoản.');}catch(error){showToast(error.message);}}return;}
    const rejectRequest=event.target.closest('[data-reject-request]');if(rejectRequest){const reason=window.prompt('Lý do từ chối (không bắt buộc):');if(reason===null)return;try{await window.ctgdmnDesktop.rejectAccountRequest(rejectRequest.dataset.rejectRequest,reason);state.accountRequests=await window.ctgdmnDesktop.listAccountRequests();renderSettings();showToast('Đã từ chối yêu cầu.');}catch(error){showToast(error.message);}return;}
    if(event.target.closest('[data-import-users]'))return importAccountExcel();if(event.target.closest('[data-add-user]'))return openUserEditor();const resetUser=event.target.closest('[data-reset-user-password]');if(resetUser)return openResetPassword(resetUser.dataset.resetUserPassword);const lockUser=event.target.closest('[data-lock-user]');if(lockUser){if(window.confirm(`${lockUser.dataset.locked==='true'?'Khóa':'Mở khóa'} tài khoản này?`)){try{await window.ctgdmnDesktop.lockUser(lockUser.dataset.lockUser,lockUser.dataset.locked==='true');state.users=await window.ctgdmnDesktop.listUsers();renderSettings();}catch(error){showToast(error.message);}}return;}if(event.target.closest('[data-refresh-audit]')){try{state.auditLog=await window.ctgdmnDesktop.getAuditLog(200);renderSettings();}catch(error){showToast(error.message);}return;}
    const guideButton=event.target.closest('[data-open-guide]');if(guideButton)return openGuide(guideButton.dataset.openGuide);
    if(event.target.closest('[data-add-video]'))return openVideoEditor();const editVideo=event.target.closest('[data-edit-video]');if(editVideo)return openVideoEditor(editVideo.dataset.editVideo);const play=event.target.closest('[data-play-video]');if(play)return playVideo(play.dataset.playVideo);const deleteVideo=event.target.closest('[data-delete-video]');if(deleteVideo){if(window.confirm('Xóa video khỏi kho học liệu cục bộ? Thao tác này không thể hoàn tác.')){try{await window.ctgdmnDesktop.deleteVideo(deleteVideo.dataset.deleteVideo);state.videos=await window.ctgdmnDesktop.listVideos();renderVideos();}catch(error){showToast(error.message);}}return;}
    if(event.target.closest('[data-export-video-excel]'))return saveDirectoryExcel('videos',false);if(event.target.closest('[data-import-video-excel]'))return importVideoExcel();
    if(event.target.closest('[data-reset-school]')){if(window.confirm('Khôi phục thông tin nhà trường mặc định?')){state.workspace.schoolProfile={...state.originalSchoolProfile};syncPublicBranding(state.workspace.schoolProfile);saveWorkspace();state.data.meta.schoolName=state.workspace.schoolProfile.name;document.querySelector('#school-name').textContent=state.workspace.schoolProfile.name;renderSettings();showToast('Đã khôi phục thông tin mặc định.');}return;}
    if(event.target.closest('[data-add-class]'))return openClassEditor(); const editClass=event.target.closest('[data-edit-class]');if(editClass)return openClassEditor(editClass.dataset.editClass);
    const deactivateClassButton=event.target.closest('[data-deactivate-class]');if(deactivateClassButton){if(window.confirm('Ngừng sử dụng lớp này? Các kế hoạch cũ vẫn được giữ nguyên.')){state.workspace.classes=deactivateClass(state.workspace.classes,deactivateClassButton.dataset.deactivateClass);saveWorkspace();renderSettings();}return;}
    if(event.target.closest('[data-add-staff]'))return openStaffEditor(); const editStaff=event.target.closest('[data-edit-staff]');if(editStaff)return openStaffEditor(editStaff.dataset.editStaff);
    const deactivateStaffButton=event.target.closest('[data-deactivate-staff]');if(deactivateStaffButton){const personId=deactivateStaffButton.dataset.deactivateStaff;if(window.confirm(`${staffHasHistory(state.workspace,personId)?'Nhân sự này đã có lịch sử kế hoạch và sẽ không bị xóa. ':''}Chuyển sang ngừng sử dụng?`)){state.workspace.staff=deactivateStaff(state.workspace.staff,personId);saveWorkspace();renderSettings();}return;}
    if(event.target.closest('[data-add-signature]'))return openSignatureEditor();const editSignature=event.target.closest('[data-edit-signature]');if(editSignature)return openSignatureEditor(editSignature.dataset.editSignature);
    const removeSignature=event.target.closest('[data-remove-signature-image]');if(removeSignature){if(window.confirm('Xóa ảnh chữ ký đã lưu cục bộ? Cấu hình người ký vẫn được giữ lại.')){state.workspace.signatures=state.workspace.signatures.map((item)=>item.id===removeSignature.dataset.removeSignatureImage?{...item,imageData:'',updatedAt:new Date().toISOString()}:item);saveWorkspace();renderSettings();}return;}
    const directoryTemplate=event.target.closest('[data-directory-template]');if(directoryTemplate)return saveDirectoryExcel(directoryTemplate.dataset.directoryTemplate,true);const directoryExport=event.target.closest('[data-directory-export]');if(directoryExport)return saveDirectoryExcel(directoryExport.dataset.directoryExport,false);const directoryImport=event.target.closest('[data-directory-import]');if(directoryImport)return importDirectoryExcel(directoryImport.dataset.directoryImport);
    const addReview=event.target.closest('[data-add-review]');if(addReview)return openReviewEditor(addReview.dataset.addReview);const resolveReview=event.target.closest('[data-resolve-review]');if(resolveReview)return openResolveReview(resolveReview.dataset.resolveReview);if(event.target.closest('[data-filter-reviews]')){state.showPendingReviewsOnly=!state.showPendingReviewsOnly;return renderPlanner(document.querySelector('#plan-form input[name=id]')?.value);}
    if (event.target.closest('[data-undo-import]')) {
      const result = undoLastImport(state.workspace);
      if (!result.undone) return showToast('Không có lần nhập nào để hoàn tác.');
      if (!window.confirm(`Hoàn tác lần nhập “${result.undone.filename || result.undone.kind}”?`)) return;
      if (result.undone.kind === 'pdf' && result.undone.sourceIds?.length && window.ctgdmnDesktop?.undoPdfImport) {
        const paths = state.workspace.sourceDocuments.filter((source) => result.undone.sourceIds.includes(source.id)).map((source) => source.relativePath);
        await window.ctgdmnDesktop.undoPdfImport(paths);
      }
      state.workspace = result.workspace; saveWorkspace(); renderOpenData(); showToast('Đã hoàn tác lần nhập gần nhất.'); return;
    }
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
    const frameworkTab = event.target.closest('[data-framework-tab]');
    if (frameworkTab) { state.frameworkLibraryTab = frameworkTab.dataset.frameworkTab; state.query = ''; return renderFrameworkLibrary(); }
    const newFrameworkLesson = event.target.closest('[data-new-framework-lesson]');
    if (newFrameworkLesson) { state.draftPlanSeed = { level: 'Ngày/hoạt động', framework: newFrameworkLesson.dataset.newFrameworkLesson, schoolYear: schoolProfile().schoolYear }; showToast('Đã điền sẵn khung chương trình vào giáo án mới.'); return setRoute('planner'); }
    const libraryExportWord = event.target.closest('[data-library-export-word]');
    if (libraryExportWord) { const plan = state.workspace.plans.find((item) => item.id === libraryExportWord.dataset.libraryExportWord); if (plan) openWordExportPreview(plan); return; }
    const libraryExportPdf = event.target.closest('[data-library-export-pdf]');
    if (libraryExportPdf) { const plan = state.workspace.plans.find((item) => item.id === libraryExportPdf.dataset.libraryExportPdf); if (plan) exportPlanPdf(plan); return; }
    const convertFramework = event.target.closest('[data-convert-framework]');
    if (convertFramework) {
      const source = state.workspace.plans.find((item) => item.id === convertFramework.dataset.convertFramework);
      if (source) {
        const otherFramework = source.framework === 'TT51' ? 'TT388' : 'TT51';
        const copy = { ...source, id: `plan-${Date.now()}`, framework: otherFramework, version: 1, workflowStatus: 'draft', title: `${source.title} (bản ${otherFramework === 'TT51' ? 'TT51' : '388'})` };
        state.workspace.plans.unshift(copy);
        saveWorkspace();
        showToast(`Đã tạo bản sao gắn khung ${otherFramework === 'TT51' ? 'Thông tư 51' : 'Chuyên đề 388'}. Nội dung giữ nguyên như bản gốc — hãy rà soát và điều chỉnh lại theo cấu trúc khung mới.`);
        renderFrameworkLibrary();
      }
      return;
    }
    const planAI=event.target.closest('[data-plan-ai]');if(planAI)return runPlanAI(planAI.dataset.planAi);
    if (event.target.closest('[data-export-plan-word]')) {
      const form = document.querySelector('#plan-form');
      const formData=form?new FormData(form):null;const draft=formData?{...Object.fromEntries(formData),collaboratingTeacherIds:formData.getAll('collaboratingTeacherIds')}:null;
      return openWordExportPreview(draft);
    }
    if(event.target.closest('[data-export-plan-pdf]'))return exportPlanPdf(currentPlanFromForm());
    if (event.target.closest('[data-import-backup]')) return els.backupImport.click();
    if (event.target.closest('[data-reset-review]')) {
      if (window.confirm('Xóa toàn bộ trạng thái rà soát, theo dõi và ghi chú đang lưu trên máy? PDF nguồn không bị ảnh hưởng.')) {
        state.review = defaultReviewState(); saveReviewState(); render(); showToast('Đã xóa trạng thái rà soát trên máy.');
      }
      return;
    }
  });
  els.main.addEventListener('input', (event) => {
    if (event.target.getAttribute('id') === 'library-query') { state.query = event.target.value; state.page = 1; window.clearTimeout(bindEvents.queryTimer); bindEvents.queryTimer = window.setTimeout(render, 180); }
    if (event.target.getAttribute('id') === 'open-query') { state.query = event.target.value; window.clearTimeout(bindEvents.openTimer); bindEvents.openTimer = window.setTimeout(renderOpenData, 180); }
    if ((event.target.name === 'lessonTitle' || event.target.name === 'lessonDomain') && event.target.closest('#plan-form')) { window.clearTimeout(bindEvents.lessonSuggestTimer); bindEvents.lessonSuggestTimer = window.setTimeout(refreshInlineSuggestions, 300); }
    if (event.target.getAttribute('id') === 'framework-library-query') { state.query = event.target.value; window.clearTimeout(bindEvents.frameworkLibraryTimer); bindEvents.frameworkLibraryTimer = window.setTimeout(renderFrameworkLibrary, 180); }
  });
  els.main.addEventListener('submit', async (event) => {
    event.preventDefault();
    if(event.target.getAttribute('id')==='ai-config-form'){try{const formData=new FormData(event.target);const data={...Object.fromEntries(formData),consentAccepted:formData.has('consentAccepted')};state.aiConfig=await window.ctgdmnDesktop.saveAIConfig(data);renderSettings();showToast('Đã lưu cấu hình AI an toàn trên máy.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='system-config-form'){try{const data=Object.fromEntries(new FormData(event.target));data.idleMinutes=Math.max(5,Math.min(480,Number(data.idleMinutes)||30));if(data.repositoryMode==='lan'&&!/^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(data.serverUrl||''))throw new Error('Địa chỉ máy chủ phải là địa chỉ HTTP(S) trong mạng nội bộ.');await window.ctgdmnDesktop.updateSystemConfig(data);state.systemConfig=data;renderSettings();showToast(data.repositoryMode==='lan'?'Đã lưu cấu hình LAN; ghi dữ liệu bị khóa cho tới khi có máy chủ.':'Đã chuyển sang SQLite cục bộ.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='school-form'){const data={...schoolProfile(),...Object.fromEntries(new FormData(event.target)),logoData:state.pendingImageData||schoolProfile().logoData,userEdited:true,updatedAt:new Date().toISOString()};const errors=validateSchool(data);if(errors.length)return showToast(errors[0]);state.workspace.schoolProfile=data;state.pendingImageData='';state.data.meta.schoolName=data.name;state.data.meta.schoolYear=data.schoolYear;syncPublicBranding(data);document.querySelector('#school-name').textContent=data.name;document.querySelector('#school-year').textContent=data.schoolYear;saveWorkspace();renderSettings();showToast('Đã cập nhật thông tin nhà trường.');return;}
    if(event.target.getAttribute('id')==='assessment-form'){try{const data=Object.fromEntries(new FormData(event.target));await window.ctgdmnDesktop.upsertChildAssessment(data);state.childAssessments=await window.ctgdmnDesktop.listChildAssessments(data.childId);renderEvaluation();showToast('Đã lưu đánh giá.');}catch(error){showToast(error.message);}return;}
    if (event.target.getAttribute('id') !== 'plan-form') return;
    const formData=new FormData(event.target);const data={...Object.fromEntries(formData),collaboratingTeacherIds:formData.getAll('collaboratingTeacherIds'),lessonObjectiveCodes:formData.getAll('lessonObjectiveCodes')};data.assessment=combineAssessment(data);if(data.level==='Ngày/hoạt động')Object.assign(data,combineLessonActivities(data));data.id||=`plan-${Date.now()}`;data.schoolId=schoolProfile().id;data.workflowStatus=data.workflowStatus||state.workspace.plans.find((item)=>item.id===data.id)?.workflowStatus||'draft';data.reviewerIds=state.workspace.professionalReviews.filter((item)=>item.planId===data.id).map((item)=>item.reviewerId);
    if(data.status==='Đã phê duyệt'&&!canApprovePlan(data.id,state.workspace.professionalReviews))return showToast('Không thể phê duyệt: còn yêu cầu chỉnh sửa chưa xử lý.');
    const result=savePlanWithVersion(state.workspace,data);const saved=result.saved;delete result.saved;state.workspace=result;saveWorkspace();renderPlanner(saved.id);showToast(`Đã lưu phiên bản ${saved.version} của kế hoạch.`);
  });
  els.main.addEventListener('change', async (event) => {
    const defaultTemplate = event.target.closest('[data-default-template]');
    if (defaultTemplate) {
      try {
        state.templates = await window.ctgdmnDesktop.setDefaultTemplate(defaultTemplate.dataset.defaultTemplate, defaultTemplate.value);
        renderSettings();
        showToast('Đã chọn mẫu mặc định cho nhóm kế hoạch.');
      } catch (error) {
        showToast(error.message);
      }
      return;
    }
    if(event.target.getAttribute('id')==='school-logo-file'&&event.target.files?.[0]){readLocalImage(event.target.files[0]).then((data)=>{state.pendingImageData=data;showToast('Đã kiểm tra logo; bấm Lưu thông tin để ghi nhận.');}).catch((error)=>showToast(error.message));}
    if (event.target.getAttribute('id') === 'age-filter') { state.ageGroup = event.target.value; state.collection = 'all'; state.page = 1; render(); }
    if (event.target.getAttribute('id') === 'collection-filter') { state.collection = event.target.value; state.page = 1; render(); }
    if (event.target.name === 'lessonType' && event.target.closest('#plan-form')) { const isSteam = event.target.value === 'STEAM/Dự án'; document.querySelector('#lesson-normal-activities')?.classList.toggle('is-hidden', isSteam); document.querySelector('#lesson-steam-activities')?.classList.toggle('is-hidden', !isSteam); }
    if (event.target.name === 'ageGroup' && event.target.closest('#plan-form')) { const notice = document.querySelector('#weekday-schedule-notice'); if (notice) notice.innerHTML = weekdayScheduleNoticeText(event.target.value); refreshInlineSuggestions(); }
    if (event.target.name === 'lessonDomain' && event.target.closest('#plan-form')) refreshInlineSuggestions();
    if (event.target.closest('#lesson-objectives-suggest') && event.target.type === 'checkbox') toggleQuickSuggestion(event.target.value, event.target.checked);
    if (event.target.getAttribute('id') === 'type-filter') {
      const type = event.target.value;
      if (type === 'all') setRoute('library', { keepFilters: true });
      else if (type === 'Mục tiêu/kế hoạch chủ đề') setRoute('objectives', { keepFilters: true });
      else if (type === 'Kế hoạch tháng') setRoute('monthly', { keepFilters: true });
      else if (type === 'Kế hoạch/giáo án tuần') setRoute('weekly', { keepFilters: true });
    }
  });
  els.drawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-drawer]')) return closeDrawer();
    if (event.target.closest('[data-save-objective-picker]')) {
      const codes = Array.from(document.querySelectorAll('#objective-picker-body input[type="checkbox"]:checked')).map((el) => el.value);
      const hidden = document.querySelector('#lesson-objectives-hidden');
      if (hidden) hidden.innerHTML = objectiveHiddenInputs(codes);
      const summary = document.querySelector('#lesson-objectives-summary');
      if (summary) summary.innerHTML = renderObjectiveSummary(codes);
      closeDrawer();
      return;
    }
    if(event.target.closest('[data-apply-ai-result]'))return applyAIResult();
    const applyTheme=event.target.closest('[data-apply-theme]');
    if(applyTheme){
      const [ageGroup,collection]=applyTheme.dataset.applyTheme.split('|||');
      const form=document.querySelector('#plan-form');
      if(form){
        if(form.elements.title)form.elements.title.value=collection;
        if(form.elements.ageGroup&&!form.elements.ageGroup.value)form.elements.ageGroup.value=ageGroup;
        if(form.elements.level?.value==='Tuần'&&form.elements.weeklyTheme)form.elements.weeklyTheme.value=collection;
      }
      closeDrawer();
      showToast('Đã điền tên chủ đề vào kế hoạch.');
      return;
    }
    const savePending=event.target.closest('[data-save-pending-ai]');if(savePending)return savePendingAIRequest(state.pendingAIPlan||currentPlanFromForm()||{},savePending.dataset.savePendingAi);
    if(event.target.closest('[data-test-ai]')){window.ctgdmnDesktop.testAIConnection().then(async(result)=>{state.aiConfig=await window.ctgdmnDesktop.getAIConfig();showToast(result.ok?'GenAI đã sẵn sàng.':result.message||'Chưa kết nối được GenAI.');}).catch((error)=>showToast(error.message));return;}
    const importChoice = event.target.closest('[data-choose-import]');
    if (importChoice) return chooseImport(importChoice.dataset.chooseImport);
    if (event.target.closest('[data-manual-record]')) return openRecordEditor();
    if(event.target.closest('[data-import-offline-video]')){const form=document.querySelector('#video-form');const formData=new FormData(form);const metadata={...Object.fromEntries(formData),audience:formData.getAll('audience')};window.ctgdmnDesktop.importOfflineVideo(metadata).then(async(result)=>{if(!result.canceled){state.videos=await window.ctgdmnDesktop.listVideos();closeDrawer();renderVideos();showToast('Đã sao chép MP4 vào kho học liệu cục bộ.');}}).catch((error)=>showToast(error.message));return;}
    const original = event.target.closest('[data-open-original]');
    if (original) return openOriginal(original.dataset.openOriginal);
    const review = event.target.closest('[data-review-doc]');
    if (review) { toggleList('reviewed', review.dataset.reviewDoc); openDrawer(review.dataset.reviewDoc); return; }
    const watch = event.target.closest('[data-watch-doc]');
    if (watch) { toggleList('watch', watch.dataset.watchDoc); openDrawer(watch.dataset.watchDoc); return; }
    const note = event.target.closest('[data-save-note]');
    if (note) { state.review.notes[note.dataset.saveNote] = document.querySelector('#document-note').value.trim(); saveReviewState(); showToast('Đã lưu ghi chú rà soát.'); }
  });
  els.drawer.addEventListener('change', (event) => {
    if (event.target.getAttribute('id') === 'import-excel-file') { state.pendingImport.fileIndex = Number(event.target.value); state.pendingImport.sheetIndex = 0; renderImportPreview(); }
    if (event.target.getAttribute('id') === 'import-sheet') { state.pendingImport.sheetIndex = Number(event.target.value); renderImportPreview(); }
    if(event.target.getAttribute('id')==='signature-image-file'&&event.target.files?.[0]){readLocalImage(event.target.files[0],true).then((data)=>{state.pendingImageData=data;document.querySelector('#signature-image-preview').innerHTML=`<img src="${data}" alt="Bản xem trước chữ ký">`;showToast('Đã cắt vùng trắng và tạo bản xem trước.');}).catch((error)=>showToast(error.message));}
  });
  els.drawer.addEventListener('submit', async (event) => {
    event.preventDefault();
    if(event.target.getAttribute('id')==='template-import-form'){try{const data=Object.fromEntries(new FormData(event.target));const result=await window.ctgdmnDesktop.importTemplate(data);if(!result.canceled){state.templates=await window.ctgdmnDesktop.listTemplates();closeDrawer();renderSettings();showToast('Đã nhập mẫu DOCX tùy chỉnh và kiểm tra biến {{PLAN_TABLE}}.');}}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='user-form'){try{const formData=new FormData(event.target);const data={...Object.fromEntries(formData),roles:formData.getAll('roles'),classIds:formData.getAll('classIds'),mustChangePassword:true};if(!data.roles.length)return showToast('Cần chọn ít nhất một vai trò.');await window.ctgdmnDesktop.createUser(data);state.users=await window.ctgdmnDesktop.listUsers();closeDrawer();renderSettings();showToast('Đã tạo tài khoản; người dùng phải đổi mật khẩu lần đầu.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='reset-password-form'){try{const data=Object.fromEntries(new FormData(event.target));await window.ctgdmnDesktop.resetUserPassword(data.userId,data.tempPassword);closeDrawer();showToast('Đã đặt mật khẩu tạm thời; không ghi mật khẩu vào nhật ký.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='video-form'){try{const formData=new FormData(event.target);const data={...Object.fromEntries(formData),audience:formData.getAll('audience'),enabled:formData.has('enabled')};if(data.sourceType==='offline'&&!data.id)return showToast('Hãy dùng nút “Chọn và sao chép MP4 từ máy”.');await window.ctgdmnDesktop.saveVideo(data);state.videos=await window.ctgdmnDesktop.listVideos();closeDrawer();renderVideos();showToast('Đã lưu danh mục video.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='class-form'){try{const data=Object.fromEntries(new FormData(event.target));state.workspace.classes=upsertClass(state.workspace.classes,data);saveWorkspace();closeDrawer();renderSettings();showToast('Đã lưu lớp.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='staff-form'){try{const formData=new FormData(event.target);const data={...Object.fromEntries(formData),roles:formData.getAll('roles')};state.workspace.staff=upsertStaff(state.workspace.staff,data);saveWorkspace();closeDrawer();renderSettings();showToast('Đã lưu nhân sự.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='child-form'){try{const data=Object.fromEntries(new FormData(event.target));await window.ctgdmnDesktop.upsertChild(data);state.children=await window.ctgdmnDesktop.listChildren();closeDrawer();renderEvaluation();showToast('Đã lưu hồ sơ trẻ.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='signature-form'){const formData=new FormData(event.target);const data={...Object.fromEntries(formData),enabled:formData.has('enabled'),imageData:state.pendingImageData,updatedAt:new Date().toISOString()};data.id||=`signature-${Date.now()}`;const person=state.workspace.staff.find((item)=>item.id===data.staffId);if(!person)return showToast('Cần chọn người ký.');data.name=person.name;const index=state.workspace.signatures.findIndex((item)=>item.id===data.id);if(index>=0)state.workspace.signatures[index]={...state.workspace.signatures[index],...data};else state.workspace.signatures.push(data);state.pendingImageData='';saveWorkspace();closeDrawer();renderSettings();showToast('Đã lưu cấu hình chữ ký cục bộ.');return;}
    if(event.target.getAttribute('id')==='review-form'){try{const data=Object.fromEntries(new FormData(event.target));const person=state.workspace.staff.find((item)=>item.id===data.reviewerId);data.reviewerNameSnapshot=person?.name;data.reviewerRoleSnapshot=person?.title;state.workspace.professionalReviews=addProfessionalReview(state.workspace.professionalReviews,data);saveWorkspace();closeDrawer();renderPlanner(data.planId);showToast('Đã ghi nhận nhận xét; nội dung gốc sẽ được giữ nguyên.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='resolve-review-form'){try{const data=Object.fromEntries(new FormData(event.target));state.workspace.professionalReviews=resolveProfessionalReview(state.workspace.professionalReviews,data.reviewId,data.response);saveWorkspace();closeDrawer();renderPlanner(data.planId);showToast('Đã ghi nhận phản hồi xử lý.');}catch(error){showToast(error.message);}return;}
    if(event.target.getAttribute('id')==='word-export-form'){const formData=new FormData(event.target);const planId=formData.get('planId');const stored=state.workspace.plans.find((item)=>item.id===planId);const form=document.querySelector('#plan-form');const currentData=form?new FormData(form):null;const plan=stored||{...Object.fromEntries(currentData||[]),collaboratingTeacherIds:currentData?.getAll('collaboratingTeacherIds')||[]};const signatureIds=formData.getAll('signatureIds');const mode=formData.get('signatureMode');const configured=signatureIds.map((id)=>state.workspace.signatures.find((item)=>item.id===id)).filter(Boolean).map((item)=>({role:item.role,displayTitle:item.displayTitle||item.role,name:staffName(item.staffId,item.name),staffId:item.staffId,mode,imageData:mode==='image'?item.imageData:'',width:Number(item.displayWidth)||120,height:55}));const hands=formData.getAll('handRoles').map((role)=>({role,displayTitle:role,name:'',mode:'hand'}));const signers=[...configured,...hands];const exportPlan={...plan,signers,signatureConfigurationIds:signatureIds,className:className(plan.classId,plan.ageGroup),author:staffName(plan.authorTeacherId,plan.author)};if(formData.has('includeReviews'))exportPlan.assessment=`${exportPlan.assessment||''}\n\nNHẬN XÉT CHUYÊN MÔN\n${state.workspace.professionalReviews.filter((item)=>item.planId===plan.id).map((item)=>`${item.reviewerNameSnapshot}: ${item.content}${item.resolved?` — Phản hồi: ${item.response}`:''}`).join('\n')}`;const snapshot=createPublicationSnapshot(state.workspace,plan,configured.map((item)=>item.staffId));state.workspace.publicationSnapshots.push({planId:plan.id,planVersion:plan.version||1,...snapshot});state.workspace.signatureLog.push({id:`signature-log-${Date.now()}`,planId:plan.id,planVersion:plan.version||1,selectedByTeacherId:plan.authorTeacherId||'',signatureIds,mode,createdAt:new Date().toISOString()});if(stored){stored.signatureConfigurationIds=signatureIds;stored.lastPublicationSnapshot=snapshot;}saveWorkspace();await exportPlanWord(exportPlan);closeDrawer();return;}
    if (event.target.getAttribute('id') === 'word-import-form') {
      const values = Object.fromEntries(new FormData(event.target));
      const records = state.pendingImport.files.map((file) => ({ title: file.preview.headings?.[0]?.text || file.name.replace(/\.docx$/i, ''), ageGroup: values.ageGroup, type: values.type, topic: values.topic, objective: values.objective, content: values.content || file.preview.text, activity: values.activity, evidence: values.evidence, sourcePdf: file.name, sourcePage: '', status: 'Mới nhập – cần rà soát' }));
      state.workspace = createImportBatch(state.workspace, records, { filename: state.pendingImport.files.map((file) => file.name).join(', '), kind: 'word' });
      saveWorkspace(); state.pendingImport = null; closeDrawer(); renderOpenData(); showToast(`Đã nhập ${records.length} bản ghi từ Word.`); return;
    }
    if (event.target.getAttribute('id') === 'excel-import-form') {
      const values = Object.fromEntries(new FormData(event.target));
      const mapping = Object.fromEntries(EXCEL_FIELDS.map(([field]) => [field, values[`map-${field}`] || '']));
      const existingIds = openRecords().map((record) => record.id);
      const combined = { accepted: [], rejected: [], skipped: [] };
      for (const file of state.pendingImport.files) {
        const sheet = file.preview.sheets[Math.min(state.pendingImport.sheetIndex, file.preview.sheets.length - 1)];
        const result = mapExcelRows(sheet.rows, mapping, [...existingIds, ...combined.accepted.map((record) => record.id)]);
        combined.accepted.push(...result.accepted.map((record) => ({ ...record, sourcePdf: record.sourcePdf || file.name })));
        combined.rejected.push(...result.rejected.map((item) => ({ ...item, filename: file.name })));
        combined.skipped.push(...result.skipped.map((item) => ({ ...item, filename: file.name })));
      }
      if (combined.accepted.length > 100 && !window.confirm(`Sắp nhập ${combined.accepted.length} bản ghi. Tiếp tục?`)) return;
      if (!combined.accepted.length) return showToast(`Không có dòng hợp lệ; ${combined.rejected.length} dòng lỗi.`);
      const records = combined.accepted.map((record) => ({ ...record, title: record.topic || record.objective.slice(0, 80) || record.id, type: 'Dữ liệu nhập từ Excel' }));
      state.workspace = createImportBatch(state.workspace, records, { filename: state.pendingImport.files.map((file) => file.name).join(', '), kind: 'excel', result: `${records.length} thành công; ${combined.rejected.length} lỗi; ${combined.skipped.length} bỏ qua` });
      saveWorkspace(); state.pendingImport = null; closeDrawer(); renderOpenData(); showToast(`Đã nhập ${records.length} dòng; bỏ qua ${combined.rejected.length + combined.skipped.length} dòng.`); return;
    }
    if (event.target.getAttribute('id') === 'pdf-import-form') {
      try {
        const values = Object.fromEntries(new FormData(event.target));
        const sources = await window.ctgdmnDesktop.commitPdfImport(state.pendingImport.files.map((file) => file.token), values.actor);
        state.workspace = createSourceBatch(state.workspace, sources, { filename: sources.map((source) => source.filename).join(', ') });
        saveWorkspace(); state.pendingImport = null; closeDrawer(); renderOpenData(); showToast(`Đã thêm ${sources.length} PDF nguồn; hãy tạo bản ghi để liên kết nội dung.`);
      } catch (error) { showToast(error.message || 'Không thể thêm PDF nguồn.'); }
      return;
    }
    if (event.target.getAttribute('id') !== 'record-form') return;
    const data = Object.fromEntries(new FormData(event.target)); data.updatedAt = new Date().toISOString();
    if (data.id.startsWith('custom-')) {
      const index = state.workspace.customRecords.findIndex(item => item.id === data.id);
      if (index >= 0) state.workspace.customRecords[index] = data; else state.workspace.customRecords.unshift(data);
    } else state.workspace.edits[data.id] = data;
    saveWorkspace(); closeDrawer(); renderOpenData(); showToast('Đã lưu bản ghi dữ liệu mở.');
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
  document.querySelector('#logout-button').addEventListener('click',async()=>{await window.ctgdmnDesktop.logout();state.currentUser=null;els.app.classList.add('is-hidden');els.loading.classList.remove('is-hidden');authScreen('login');});
  window.addEventListener('online',()=>{state.online=true;if(state.route==='videos')renderVideos();if(state.route==='online-resources')renderAIWorkspace();});window.addEventListener('offline',()=>{state.online=false;if(state.route==='videos')renderVideos();if(state.route==='online-resources')renderAIWorkspace();});
  els.backupImport.addEventListener('change', async () => {
    const file = els.backupImport.files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if(!window.confirm('Khôi phục bản sao lưu sẽ thay thế dữ liệu SQLite hiện tại. Tiếp tục?'))throw new Error('Đã hủy khôi phục.');await window.ctgdmnDesktop.restoreDatabaseBackup(payload);const restored=await window.ctgdmnDesktop.getRepositoryState();state.workspace=migrateWorkspace(restored.workspace,state.data.meta);state.review={...defaultReviewState(),...restored.review};state.systemConfig=restored.systemConfig;state.data.meta.schoolName=schoolProfile().name;state.data.meta.schoolYear=schoolProfile().schoolYear;document.querySelector('#school-name').textContent=schoolProfile().name;document.querySelector('#school-year').textContent=schoolProfile().schoolYear;render();showToast('Đã khôi phục đầy đủ cơ sở dữ liệu SQLite.');
    } catch (error) { showToast(error.message || 'Không thể nhập tệp sao lưu.'); }
    els.backupImport.value = '';
  });
}

async function init() {
  try {
    const [data,branding] = await Promise.all([loadData(),window.ctgdmnDesktop.getPublicBranding()]);
    state.data = data;
    syncPublicBranding(branding);
    const auth=await window.ctgdmnDesktop.getAuthStatus();authScreen(auth.hasUsers?'login':'setup');
  } catch (error) {
    els.loading.innerHTML = `<strong>Không thể khởi động ứng dụng</strong><small>${escapeHtml(error.message)}</small>`;
  }
}

init();
