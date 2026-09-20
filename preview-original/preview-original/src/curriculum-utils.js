export const DATA_STATUSES = ['Bản nháp', 'Cần rà soát', 'Đã rà soát', 'Đã phê duyệt'];
export const PLAN_LEVELS = ['Năm', 'Tháng', 'Chủ đề', 'Tuần', 'Ngày/hoạt động'];
export const REVIEW_STATUSES = ['Bản nháp', 'Gửi rà soát', 'Yêu cầu chỉnh sửa', 'Đã rà soát', 'Đã phê duyệt'];
export const PROGRAM_STEPS = [
  'Căn cứ và phạm vi', 'Bối cảnh nhà trường', 'Mục tiêu/yêu cầu cần đạt',
  'Phân bổ mục tiêu theo năm và tháng', 'Chủ đề, nội dung và hoạt động',
  'Môi trường, học liệu và phân hóa', 'Minh chứng, đánh giá và điều chỉnh',
  'Kiểm tra, trình duyệt và xuất bản',
];

export const DATA_FIELDS = [
  'id', 'ageGroup', 'developmentArea', 'topic', 'objective', 'content', 'activity',
  'environmentMaterials', 'differentiation', 'observableBehavior', 'evidence',
  'sourcePdf', 'sourcePage', 'status', 'createdBy', 'reviewedBy', 'updatedAt', 'version',
];

const text = (value) => String(value ?? '').trim();
const unique = (values) => [...new Set(values.map(text).filter(Boolean))];

export function normalizeDataUnit(unit = {}) {
  const item = {};
  for (const field of DATA_FIELDS) item[field] = text(unit[field]);
  item.id ||= `unit-${Date.now()}`;
  item.status = DATA_STATUSES.includes(item.status) ? item.status : 'Bản nháp';
  item.version = Math.max(1, Number(unit.version) || 1);
  item.updatedAt ||= new Date().toISOString();
  return item;
}

export function validateDataUnit(unit) {
  const item = normalizeDataUnit(unit);
  const errors = [];
  const warnings = [];
  if (!item.id) errors.push('Cần có ID duy nhất.');
  if (!item.ageGroup) errors.push('Cần chọn độ tuổi.');
  if (!item.objective && !item.content && !item.activity) errors.push('Cần có mục tiêu, nội dung hoặc hoạt động.');
  if (!item.sourcePdf) warnings.push('Thiếu nguồn PDF.');
  if (!item.sourcePage) warnings.push('Thiếu trang nguồn.');
  return { valid: errors.length === 0, errors, warnings, unit: item };
}

export function normalizePlan(plan = {}) {
  const normalized = {
    id: text(plan.id) || `plan-${Date.now()}`,
    title: text(plan.title), level: PLAN_LEVELS.includes(plan.level) ? plan.level : 'Tuần',
    ageGroup: text(plan.ageGroup), period: text(plan.period), objectives: text(plan.objectives),
    content: text(plan.content), activities: text(plan.activities), materials: text(plan.materials),
    differentiation: text(plan.differentiation), evidence: text(plan.evidence),
    assessment: text(plan.assessment), adjustments: text(plan.adjustments),
    status: REVIEW_STATUSES.includes(plan.status) ? plan.status : 'Bản nháp',
    version: Math.max(1, Number(plan.version) || 1), updatedAt: text(plan.updatedAt) || new Date().toISOString(),
    linkedUnitIds: unique(Array.isArray(plan.linkedUnitIds) ? plan.linkedUnitIds : []),
    linkedSources: Array.isArray(plan.linkedSources) ? plan.linkedSources.map((source) => ({
      unitId: text(source.unitId), sourcePdf: text(source.sourcePdf), sourcePage: text(source.sourcePage),
    })).filter((source) => source.unitId) : [],
    history: Array.isArray(plan.history) ? plan.history.map((entry) => ({ ...entry })) : [],
  };
  return normalized;
}

function append(current, label, value) {
  const clean = text(value);
  if (!clean) return current;
  const block = `[${label}]\n${clean}`;
  return current.includes(block) ? current : [current, block].filter(Boolean).join('\n\n');
}

export function linkUnitsToPlan(plan, units = []) {
  const result = normalizePlan(plan);
  const linked = new Set(result.linkedUnitIds);
  for (const raw of units) {
    const unit = normalizeDataUnit(raw);
    if (linked.has(unit.id)) continue;
    result.objectives = append(result.objectives, unit.id, unit.objective);
    result.content = append(result.content, unit.id, unit.content);
    result.activities = append(result.activities, unit.id, unit.activity);
    result.materials = append(result.materials, unit.id, unit.environmentMaterials);
    result.differentiation = append(result.differentiation, unit.id, unit.differentiation);
    result.evidence = append(result.evidence, unit.id, unit.evidence);
    result.linkedUnitIds.push(unit.id);
    result.linkedSources.push({ unitId: unit.id, sourcePdf: unit.sourcePdf, sourcePage: unit.sourcePage });
    linked.add(unit.id);
  }
  return result;
}

export function analyzeMatrix(units = [], allocations = [], plans = []) {
  const goals = units.map(normalizeDataUnit).filter((unit) => unit.objective);
  const counts = new Map(goals.map((goal) => [goal.id, 0]));
  allocations.forEach((allocation) => {
    const id = text(allocation.unitId);
    if (counts.has(id)) counts.set(id, counts.get(id) + 1);
  });
  const unallocated = goals.filter((goal) => !counts.get(goal.id)).map((goal) => goal.id);
  const overallocated = goals.filter((goal) => counts.get(goal.id) > 3).map((goal) => goal.id);
  const duplicateObjectives = [];
  const seen = new Map();
  goals.forEach((goal) => {
    const key = goal.objective.toLocaleLowerCase('vi').replace(/\s+/g, ' ');
    if (seen.has(key)) duplicateObjectives.push([seen.get(key), goal.id]); else seen.set(key, goal.id);
  });
  const missingEvidence = goals.filter((goal) => !goal.evidence).map((goal) => goal.id);
  const activitiesWithoutGoals = units.map(normalizeDataUnit).filter((unit) => unit.activity && !unit.objective).map((unit) => unit.id);
  const monthCounts = {};
  allocations.forEach((allocation) => { const month = text(allocation.month) || 'Chưa xác định'; monthCounts[month] = (monthCounts[month] || 0) + 1; });
  const weeklyMismatch = plans.map(normalizePlan).filter((plan) => plan.level === 'Tuần' && !plan.linkedUnitIds.length).map((plan) => plan.id);
  return {
    totalGoals: goals.length, allocatedGoals: goals.length - unallocated.length,
    coveragePercent: goals.length ? Math.round((goals.length - unallocated.length) / goals.length * 100) : 0,
    unallocated, overallocated, duplicateObjectives, missingEvidence, activitiesWithoutGoals,
    weeklyMismatch, monthCounts,
  };
}

const transitions = {
  'Bản nháp': ['Gửi rà soát'], 'Gửi rà soát': ['Yêu cầu chỉnh sửa', 'Đã rà soát'],
  'Yêu cầu chỉnh sửa': ['Gửi rà soát'], 'Đã rà soát': ['Yêu cầu chỉnh sửa', 'Đã phê duyệt'],
  'Đã phê duyệt': [],
};

export function availableTransitions(status) {
  return transitions[status] || [];
}

export function transitionPlan(plan, nextStatus, actor, comment = '', at = new Date().toISOString()) {
  const result = normalizePlan(plan);
  if (!availableTransitions(result.status).includes(nextStatus)) throw new Error(`Không thể chuyển từ ${result.status} sang ${nextStatus}.`);
  if (!text(actor)) throw new Error('Cần ghi người thực hiện.');
  result.history.push({ from: result.status, to: nextStatus, actor: text(actor), comment: text(comment), at, version: result.version });
  result.status = nextStatus;
  result.updatedAt = at;
  return result;
}

export function reviseApprovedPlan(plan, changes = {}, actor = '', at = new Date().toISOString()) {
  const current = normalizePlan(plan);
  const result = normalizePlan({ ...current, ...changes });
  if (current.status === 'Đã phê duyệt') {
    result.version = current.version + 1;
    result.status = 'Gửi rà soát';
    result.history.push({ from: 'Đã phê duyệt', to: 'Gửi rà soát', actor: text(actor) || 'Người chỉnh sửa', comment: 'Tạo phiên bản mới sau khi sửa kế hoạch đã phê duyệt.', at, version: result.version });
  }
  result.updatedAt = at;
  return result;
}

export function createWorkspace(seed = {}) {
  return {
    formatVersion: 2,
    dataUnits: Array.isArray(seed.dataUnits) ? seed.dataUnits.map(normalizeDataUnit) : [],
    plans: Array.isArray(seed.plans) ? seed.plans.map(normalizePlan) : [],
    allocations: Array.isArray(seed.allocations) ? seed.allocations.map((item) => ({ ...item })) : [],
    program: { currentStep: 0, steps: {}, ...(seed.program || {}) },
    linkConfig: Array.isArray(seed.linkConfig) ? seed.linkConfig.map((item) => ({ ...item })) : [],
  };
}

export function createBackup(workspace, review = {}, exportedAt = new Date().toISOString()) {
  return { format: 'ctgdmn-curriculum-backup', formatVersion: 2, exportedAt, workspace: createWorkspace(workspace), review: { ...review } };
}

export function parseBackup(payload) {
  if (payload?.format !== 'ctgdmn-curriculum-backup' || Number(payload.formatVersion) !== 2 || !payload.workspace) {
    throw new Error('Tệp sao lưu chương trình không hợp lệ hoặc không đúng phiên bản.');
  }
  return { workspace: createWorkspace(payload.workspace), review: { ...(payload.review || {}) } };
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
export function unitsToCsv(units = []) {
  return [DATA_FIELDS.map(csvCell).join(','), ...units.map((unit) => {
    const normalized = normalizeDataUnit(unit); return DATA_FIELDS.map((field) => csvCell(normalized[field])).join(',');
  })].join('\r\n');
}

export function parseUnitsCsv(csv) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const input = String(csv || '').replace(/^\ufeff/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted && char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() || [];
  if (DATA_FIELDS.some((field) => !headers.includes(field))) throw new Error('Tệp CSV thiếu các cột dữ liệu bắt buộc.');
  return rows.map((values) => normalizeDataUnit(Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))));
}
