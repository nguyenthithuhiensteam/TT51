import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { DocumentRecord, DocumentType, RecordStatus } from "./types";
import type { PagedResult } from "./taskRepo";

export interface DocumentWithCreator extends DocumentRecord {
  created_by_name: string;
}

export interface DocumentListParams {
  search?: string;
  docType?: DocumentType | "all";
  status?: RecordStatus | "all";
  page?: number;
  pageSize?: number;
}

export async function listDocuments(
  params: DocumentListParams,
): Promise<PagedResult<DocumentWithCreator>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: string[] = ["d.deleted_at IS NULL"];
  const args: unknown[] = [];

  if (params.search) {
    where.push("(d.title LIKE ? OR d.code LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`);
  }
  if (params.docType && params.docType !== "all") {
    where.push("d.doc_type = ?");
    args.push(params.docType);
  }
  if (params.status && params.status !== "all") {
    where.push("d.status = ?");
    args.push(params.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) AS total FROM documents d ${whereSql}`,
    args,
  );
  const items = await dbSelect<DocumentWithCreator>(
    `SELECT d.*, u.full_name AS created_by_name FROM documents d
     JOIN users u ON u.id = d.created_by
     ${whereSql}
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize],
  );
  return { items, total: countRows[0]?.total ?? 0, page, pageSize };
}

export async function getDocumentById(id: string): Promise<DocumentWithCreator | null> {
  const rows = await dbSelect<DocumentWithCreator>(
    `SELECT d.*, u.full_name AS created_by_name FROM documents d
     JOIN users u ON u.id = d.created_by
     WHERE d.id = ? AND d.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function nextDocumentSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM documents", []);
  return (rows[0]?.n ?? 0) + 1;
}

const DOC_TYPE_PREFIX: Record<DocumentType, string> = {
  incoming: "DEN",
  outgoing: "DI",
  internal: "NB",
  draft: "DT",
};

export interface CreateDocumentInput {
  schoolYearId: string;
  docType: DocumentType;
  title: string;
  summary?: string;
  issuingUnit?: string;
  recipient?: string;
  category?: string;
  contentHtml?: string;
  createdBy: string;
  sessionId: string | null;
}

export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const id = newId();
  const seq = await nextDocumentSequence();
  const year = new Date().getFullYear();
  const code = `${DOC_TYPE_PREFIX[input.docType]}-${year}-${String(seq).padStart(3, "0")}`;
  const ts = nowIso();

  await dbExecute(
    `INSERT INTO documents (id, code, school_year_id, doc_type, title, summary, issuing_unit,
      recipient, category, status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
    [
      id,
      code,
      input.schoolYearId,
      input.docType,
      input.title,
      input.summary ?? null,
      input.issuingUnit ?? null,
      input.recipient ?? null,
      input.category ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );

  await dbExecute(
    `INSERT INTO document_versions (id, document_id, version_no, content_html, edited_by, edited_at, note)
     VALUES (?, ?, 1, ?, ?, ?, 'Bản khởi tạo')`,
    [newId(), id, input.contentHtml ?? "", input.createdBy, ts],
  );

  await logAudit({
    entityTable: "documents",
    entityId: id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return id;
}

export async function addDocumentVersion(
  documentId: string,
  contentHtml: string,
  editedBy: string,
  note: string | undefined,
  sessionId: string | null,
): Promise<void> {
  const rows = await dbSelect<{ max_v: number }>(
    "SELECT COALESCE(MAX(version_no), 0) AS max_v FROM document_versions WHERE document_id = ?",
    [documentId],
  );
  const nextVersion = (rows[0]?.max_v ?? 0) + 1;
  await dbExecute(
    `INSERT INTO document_versions (id, document_id, version_no, content_html, edited_by, edited_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), documentId, nextVersion, contentHtml, editedBy, nowIso(), note ?? null],
  );
  await dbExecute("UPDATE documents SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?", [
    editedBy,
    nowIso(),
    documentId,
  ]);
  await logAudit({
    entityTable: "documents",
    entityId: documentId,
    action: "new_version",
    afterJson: { version: nextVersion, note },
    userId: editedBy,
    sessionId,
  });
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  version_no: number;
  content_html: string | null;
  file_path: string | null;
  edited_by: string;
  edited_by_name: string;
  edited_at: string;
  note: string | null;
}

export async function listDocumentVersions(documentId: string): Promise<DocumentVersionRow[]> {
  return dbSelect<DocumentVersionRow>(
    `SELECT v.*, u.full_name AS edited_by_name FROM document_versions v
     JOIN users u ON u.id = v.edited_by
     WHERE v.document_id = ? ORDER BY v.version_no DESC`,
    [documentId],
  );
}

/**
 * Chuyển trạng thái văn bản theo quy trình: soạn thảo → gửi duyệt → góp ý → hoàn thiện
 * → ký → ban hành → lưu trữ. Luôn ghi vào approvals, không có bước nào tự động phê duyệt.
 */
export async function changeDocumentStatus(
  documentId: string,
  toStatus: RecordStatus,
  action: "submit" | "comment" | "approve" | "reject" | "sign" | "publish",
  approverId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error("Không tìm thấy văn bản");
  const fromStatus = doc.status;

  await dbExecute(
    "UPDATE documents SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, approverId, nowIso(), documentId],
  );

  await dbExecute(
    `INSERT INTO approvals (id, entity_table, entity_id, step_no, approver_id, action, comment,
      from_status, to_status, acted_at)
     VALUES (?, 'documents', ?, 1, ?, ?, ?, ?, ?, ?)`,
    [newId(), documentId, approverId, action, comment ?? null, fromStatus, toStatus, nowIso()],
  );

  await logAudit({
    entityTable: "documents",
    entityId: documentId,
    action: `status_change:${fromStatus}->${toStatus}`,
    beforeJson: { status: fromStatus },
    afterJson: { status: toStatus, comment },
    userId: approverId,
    sessionId,
  });
}

/** Lưu trữ văn bản đã ban hành — chỉ đổi trạng thái, không phải bước phê duyệt. */
export async function archiveDocument(
  documentId: string,
  userId: string,
  sessionId: string | null,
): Promise<void> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error("Không tìm thấy văn bản");
  await dbExecute(
    "UPDATE documents SET status = 'archived', version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [userId, nowIso(), documentId],
  );
  await logAudit({
    entityTable: "documents",
    entityId: documentId,
    action: "status_change:archived",
    beforeJson: { status: doc.status },
    afterJson: { status: "archived" },
    userId,
    sessionId,
  });
}

export interface DocumentApprovalRow {
  id: string;
  entity_id: string;
  step_no: number;
  approver_id: string;
  approver_name: string;
  action: string;
  comment: string | null;
  from_status: RecordStatus | null;
  to_status: RecordStatus | null;
  acted_at: string;
}

export async function listDocumentApprovals(documentId: string): Promise<DocumentApprovalRow[]> {
  return dbSelect<DocumentApprovalRow>(
    `SELECT a.*, u.full_name AS approver_name FROM approvals a
     JOIN users u ON u.id = a.approver_id
     WHERE a.entity_table = 'documents' AND a.entity_id = ?
     ORDER BY a.acted_at ASC`,
    [documentId],
  );
}

/** Chuyển một kết luận cuộc họp / nội dung chỉ đạo trong văn bản thành nhiệm vụ mới. */
export async function linkDocumentToTask(
  taskId: string,
  documentId?: string,
  meetingId?: string,
): Promise<void> {
  await dbExecute(
    "INSERT INTO document_task_links (id, document_id, meeting_id, task_id) VALUES (?, ?, ?, ?)",
    [newId(), documentId ?? null, meetingId ?? null, taskId],
  );
}

export async function countPendingApprovalDocuments(schoolYearId: string): Promise<number> {
  const rows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM documents
     WHERE school_year_id = ? AND deleted_at IS NULL AND status = 'pending_approval'`,
    [schoolYearId],
  );
  return rows[0]?.n ?? 0;
}
