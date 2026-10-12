export const EXCEL_FIELDS = [
  ['id', 'ID'], ['ageGroup', 'Độ tuổi'], ['developmentArea', 'Lĩnh vực'], ['topic', 'Chủ đề'],
  ['objective', 'Mục tiêu/yêu cầu cần đạt'], ['content', 'Nội dung'], ['activity', 'Hoạt động'],
  ['materials', 'Học liệu'], ['differentiation', 'Phân hóa'], ['evidence', 'Minh chứng'],
  ['sourcePdf', 'Nguồn'], ['sourcePage', 'Trang nguồn'], ['status', 'Trạng thái'],
];

const text = (value) => String(value ?? '').trim();

export function validateMappedRecord(record = {}) {
  const errors = [];
  if (!text(record.id)) errors.push('Thiếu ID.');
  if (!text(record.ageGroup)) errors.push('Thiếu độ tuổi.');
  if (![record.objective, record.content, record.activity].some((value) => text(value))) errors.push('Thiếu mục tiêu, nội dung hoặc hoạt động.');
  return errors;
}

export function mapExcelRows(rows = [], mapping = {}, existingIds = []) {
  const [headers = [], ...dataRows] = rows;
  const indexes = Object.fromEntries(Object.entries(mapping).map(([field, header]) => [field, headers.indexOf(header)]));
  const known = new Set(existingIds.map(text));
  const accepted = [], rejected = [], skipped = [];
  dataRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.every((cell) => !text(cell))) { skipped.push({ row: rowIndex + 2, reason: 'Dòng trống.' }); return; }
    const record = {};
    for (const [field] of EXCEL_FIELDS) record[field] = indexes[field] >= 0 ? text(row[indexes[field]]) : '';
    record.status ||= 'Mới nhập – cần rà soát';
    const errors = validateMappedRecord(record);
    if (record.id && known.has(record.id)) errors.push('ID trùng.');
    if (errors.length) rejected.push({ row: rowIndex + 2, record, errors });
    else { known.add(record.id); accepted.push(record); }
  });
  return { accepted, rejected, skipped };
}

export function createImportBatch(workspace = {}, records = [], meta = {}, batchId = `import-${Date.now()}`) {
  const imported = records.map((record, index) => ({ ...record, id: text(record.id) || `${batchId}-${index + 1}`, status: record.status || 'Mới nhập – cần rà soát', _importBatchId: batchId }));
  const log = { batchId, filename: text(meta.filename), importedAt: meta.importedAt || new Date().toISOString(), kind: text(meta.kind), recordCount: imported.length, result: text(meta.result) || 'Thành công', recordIds: imported.map((record) => record.id), sourceIds: [] };
  return { ...workspace, customRecords: [...(workspace.customRecords || []), ...imported], importHistory: [...(workspace.importHistory || []), log], importLog: [...(workspace.importLog || []), log] };
}

export function createSourceBatch(workspace = {}, sources = [], meta = {}, batchId = `import-${Date.now()}`) {
  const tagged = sources.map((source) => ({ ...source, _importBatchId: batchId }));
  const log = { batchId, filename: text(meta.filename), importedAt: meta.importedAt || new Date().toISOString(), kind: 'pdf', recordCount: tagged.length, result: 'Đã thêm nguồn', recordIds: [], sourceIds: tagged.map((source) => source.id) };
  return { ...workspace, sourceDocuments: [...(workspace.sourceDocuments || []), ...tagged], importHistory: [...(workspace.importHistory || []), log], importLog: [...(workspace.importLog || []), log] };
}

export function undoLastImport(workspace = {}) {
  const history = [...(workspace.importHistory || [])];
  const latest = history.pop();
  if (!latest) return { workspace, undone: null };
  return { workspace: { ...workspace, customRecords: (workspace.customRecords || []).filter((record) => record._importBatchId !== latest.batchId), sourceDocuments: (workspace.sourceDocuments || []).filter((source) => source._importBatchId !== latest.batchId), importHistory: history }, undone: latest };
}
