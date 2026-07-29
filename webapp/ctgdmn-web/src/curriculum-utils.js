// Mô hình dữ liệu chuẩn hóa cho từng mục tiêu/nội dung/hoạt động (thay vì
// coi toàn văn một PDF là một bản ghi), ma trận phân bổ chương trình, và
// các hàm thuần cho quy trình rà soát – phê duyệt của Kho dữ liệu mở.
// Không phụ thuộc DOM để có thể kiểm thử bằng node --test.

export const RECORD_FIELDS = [
  'id', 'ageGroup', 'domain', 'topic', 'objective', 'content', 'activity',
  'materials', 'differentiation', 'observableSigns', 'evidence',
  'sourcePdf', 'sourcePage', 'status', 'createdBy', 'reviewedBy',
  'updatedAt', 'version',
];

export const RECORD_STATUS = Object.freeze({
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Đã gửi rà soát',
  NEEDS_REVISION: 'Yêu cầu chỉnh sửa',
  REVIEWED: 'Đã rà soát',
  APPROVED: 'Đã phê duyệt',
});

const STATUS_TRANSITIONS = {
  [RECORD_STATUS.DRAFT]: { submit: RECORD_STATUS.SUBMITTED },
  [RECORD_STATUS.SUBMITTED]: { request_revision: RECORD_STATUS.NEEDS_REVISION, review: RECORD_STATUS.REVIEWED },
  [RECORD_STATUS.NEEDS_REVISION]: { submit: RECORD_STATUS.SUBMITTED },
  [RECORD_STATUS.REVIEWED]: { approve: RECORD_STATUS.APPROVED, request_revision: RECORD_STATUS.NEEDS_REVISION },
  [RECORD_STATUS.APPROVED]: { revise: RECORD_STATUS.NEEDS_REVISION },
};

export function nextRecordStatus(current, transition) {
  const next = STATUS_TRANSITIONS[current]?.[transition];
  if (!next) throw new Error(`Không thể chuyển trạng thái từ "${current}" bằng thao tác "${transition}".`);
  return next;
}

/**
 * Áp dụng một chuyển trạng thái cho bản ghi, trả về bản ghi mới + mục
 * lịch sử mới. Nếu bản ghi đã "Đã phê duyệt" và bị sửa nội dung, phải gọi
 * bumpVersionAfterApprovedEdit() trước — hàm này chỉ xử lý chuyển trạng
 * thái theo yêu cầu, không tự suy luận việc sửa nội dung.
 */
export function transitionRecord(record, transition, actor, note = '') {
  const toStatus = nextRecordStatus(record.status, transition);
  const historyEntry = {
    fromStatus: record.status,
    toStatus,
    actor,
    note,
    at: new Date().toISOString(),
  };
  const history = [...(record.history || []), historyEntry];
  return { ...record, status: toStatus, history, updatedAt: historyEntry.at };
}

/**
 * Khi một bản ghi đã "Đã phê duyệt" bị chỉnh sửa nội dung, phải tăng
 * version và quay lại "Yêu cầu chỉnh sửa" — không được âm thầm giữ
 * nguyên trạng thái đã duyệt.
 */
export function bumpVersionAfterApprovedEdit(record, actor, note = 'Sửa sau khi đã phê duyệt') {
  if (record.status !== RECORD_STATUS.APPROVED) {
    throw new Error('Chỉ áp dụng khi bản ghi đang ở trạng thái Đã phê duyệt.');
  }
  const historyEntry = {
    fromStatus: record.status,
    toStatus: RECORD_STATUS.NEEDS_REVISION,
    actor,
    note,
    at: new Date().toISOString(),
  };
  return {
    ...record,
    status: RECORD_STATUS.NEEDS_REVISION,
    version: (record.version || 1) + 1,
    history: [...(record.history || []), historyEntry],
    updatedAt: historyEntry.at,
  };
}

export function createRecord(input, actor) {
  const now = new Date().toISOString();
  return {
    id: input.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ageGroup: input.ageGroup || '',
    domain: input.domain || '',
    topic: input.topic || '',
    objective: input.objective || '',
    content: input.content || '',
    activity: input.activity || '',
    materials: input.materials || '',
    differentiation: input.differentiation || '',
    observableSigns: input.observableSigns || '',
    evidence: input.evidence || '',
    sourcePdf: input.sourcePdf || '',
    sourcePage: input.sourcePage || '',
    status: RECORD_STATUS.DRAFT,
    createdBy: actor || '',
    reviewedBy: '',
    updatedAt: now,
    version: 1,
    history: [{ fromStatus: null, toStatus: RECORD_STATUS.DRAFT, actor, note: 'Tạo bản ghi', at: now }],
  };
}

export function validateRecord(record) {
  const errors = [];
  if (!record.objective?.trim()) errors.push('Thiếu mục tiêu/yêu cầu cần đạt.');
  if (!record.ageGroup?.trim()) errors.push('Thiếu độ tuổi.');
  if (!record.sourcePdf?.trim()) errors.push('Thiếu nguồn PDF đối chiếu.');
  if (!record.sourcePage?.trim()) errors.push('Thiếu trang nguồn.');
  return { valid: errors.length === 0, errors };
}

// ---- Liên kết kế hoạch với mục tiêu/nội dung/hoạt động ------------------

/**
 * Đưa một bản ghi vào kế hoạch mà vẫn giữ ID và nguồn — không sao chép
 * thuần văn bản. plan.linkedRecordIds là mảng ID; hàm này chỉ thêm liên
 * kết mới, không nhân bản nếu đã có.
 */
export function linkRecordToPlan(plan, recordId) {
  const linked = new Set(plan.linkedRecordIds || []);
  linked.add(recordId);
  return { ...plan, linkedRecordIds: [...linked] };
}

export function unlinkRecordFromPlan(plan, recordId) {
  const linked = (plan.linkedRecordIds || []).filter((id) => id !== recordId);
  return { ...plan, linkedRecordIds: linked };
}

export function resolveLinkedRecords(plan, allRecords) {
  const byId = new Map(allRecords.map((r) => [r.id, r]));
  return (plan.linkedRecordIds || []).map((id) => byId.get(id)).filter(Boolean);
}

// ---- Ma trận chương trình -------------------------------------------------

/**
 * Tính ma trận phân bổ mục tiêu theo tháng/chủ đề dựa trên các kế hoạch
 * đã liên kết bản ghi. months: danh sách nhãn tháng/chủ đề đang dùng.
 */
export function computeCoverageMatrix(records, plans, { minCoverage = 1, maxCoverage = 3 } = {}) {
  const allocation = new Map(); // recordId -> số lần được đưa vào kế hoạch (bất kỳ tháng nào)
  const byMonth = new Map(); // month -> Set(recordId)

  for (const plan of plans) {
    const month = plan.period || plan.title || 'Chưa gán tháng';
    if (!byMonth.has(month)) byMonth.set(month, new Set());
    for (const recordId of plan.linkedRecordIds || []) {
      allocation.set(recordId, (allocation.get(recordId) || 0) + 1);
      byMonth.get(month).add(recordId);
    }
  }

  const unassigned = records.filter((r) => !allocation.has(r.id));
  const overAllocated = records.filter((r) => (allocation.get(r.id) || 0) > maxCoverage);
  const missingEvidence = records.filter((r) => allocation.has(r.id) && !r.evidence?.trim());
  const withoutActivityLink = plans.filter((p) => !(p.linkedRecordIds || []).length);

  // Nội dung trùng lặp: cùng ageGroup + objective (chuẩn hóa khoảng trắng/hoa-thường) xuất hiện ở ≥ 2 bản ghi.
  const seen = new Map();
  const duplicates = [];
  for (const record of records) {
    const key = `${record.ageGroup}|${(record.objective || '').trim().toLowerCase()}`;
    if (!key.trim() || key === '|') continue;
    if (seen.has(key)) duplicates.push([seen.get(key), record.id]);
    else seen.set(key, record.id);
  }

  const coverageByMonth = [...byMonth.entries()].map(([month, ids]) => ({ month, count: ids.size }));

  return {
    totalRecords: records.length,
    unassigned,
    overAllocated,
    missingEvidence,
    withoutActivityLink,
    duplicates,
    coverageByMonth,
    unassignedCount: unassigned.length,
    overAllocatedCount: overAllocated.length,
    missingEvidenceCount: missingEvidence.length,
    duplicateCount: duplicates.length,
  };
}

// ---- Trung tâm công việc: tổng hợp việc cần làm --------------------------

export function buildWorkQueue({ records, plans, deadlineWithinDays = 7 }) {
  const now = Date.now();
  const inProgressPlans = plans.filter((p) => p.status !== 'Đã phê duyệt' && p.updatedAt);
  const pendingReview = plans.filter((p) => p.status === RECORD_STATUS.SUBMITTED);
  const missingEvidencePlans = plans.filter((p) =>
    (p.linkedRecordIds || []).some((id) => {
      const record = records.find((r) => r.id === id);
      return record && !record.evidence?.trim();
    })
  );
  const nearDeadline = plans.filter((p) => {
    if (!p.dueDate) return false;
    const diffDays = (new Date(p.dueDate).getTime() - now) / 86400000;
    return diffDays >= 0 && diffDays <= deadlineWithinDays;
  });
  const matrix = computeCoverageMatrix(records, plans);

  return {
    continueDrafting: inProgressPlans.slice(0, 5),
    unassignedObjectives: matrix.unassigned,
    pendingReview,
    missingEvidencePlans,
    nearDeadline,
    dataWarnings: matrix.duplicates.length + matrix.overAllocatedCount,
  };
}
