import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, orderBy, query, where, updateDoc } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { DocumentRecord, DocumentType, RecordStatus } from "./types";
import type { PagedResult } from "./taskRepo";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

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

async function listAllDocuments(): Promise<DocumentWithCreator[]> {
  const snap = await getDocs(collection(db, COL.documents));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<DocumentWithCreator, "id">) }))
    .filter((d) => !d.deleted_at);
}

export async function listDocuments(params: DocumentListParams): Promise<PagedResult<DocumentWithCreator>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  let items = await listAllDocuments();

  if (params.docType && params.docType !== "all") items = items.filter((d) => d.doc_type === params.docType);
  if (params.status && params.status !== "all") items = items.filter((d) => d.status === params.status);
  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter((d) => d.title.toLowerCase().includes(s) || d.code.toLowerCase().includes(s));
  }
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export async function getDocumentById(id: string): Promise<DocumentWithCreator | null> {
  const snap = await getDoc(doc(db, COL.documents, id));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return { id: snap.id, ...(snap.data() as Omit<DocumentWithCreator, "id">) };
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
  const countSnap = await getCountFromServer(collection(db, COL.documents));
  const year = new Date().getFullYear();
  const code = `${DOC_TYPE_PREFIX[input.docType]}-${year}-${String(countSnap.data().count + 1).padStart(3, "0")}`;
  const ts = nowIso();

  const ref = await addDoc(collection(db, COL.documents), {
    code,
    school_year_id: input.schoolYearId,
    doc_type: input.docType,
    title: input.title,
    summary: input.summary ?? null,
    issuing_unit: input.issuingUnit ?? null,
    recipient: input.recipient ?? null,
    category: input.category ?? null,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: input.createdBy,
    created_by_name: await getUserName(input.createdBy),
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
  });

  await addDoc(collection(db, COL.documentVersions), {
    document_id: ref.id,
    version_no: 1,
    content_html: input.contentHtml ?? "",
    file_path: null,
    edited_by: input.createdBy,
    edited_by_name: await getUserName(input.createdBy),
    edited_at: ts,
    note: "Bản khởi tạo",
  });

  await logAudit({
    entityTable: "documents",
    entityId: ref.id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return ref.id;
}

export async function addDocumentVersion(documentId: string, contentHtml: string, editedBy: string, note: string | undefined, sessionId: string | null): Promise<void> {
  const versionsSnap = await getDocs(query(collection(db, COL.documentVersions), where("document_id", "==", documentId)));
  const maxV = Math.max(0, ...versionsSnap.docs.map((d) => d.data().version_no as number));
  const nextVersion = maxV + 1;
  await addDoc(collection(db, COL.documentVersions), {
    document_id: documentId,
    version_no: nextVersion,
    content_html: contentHtml,
    file_path: null,
    edited_by: editedBy,
    edited_by_name: await getUserName(editedBy),
    edited_at: nowIso(),
    note: note ?? null,
  });
  const docSnap = await getDoc(doc(db, COL.documents, documentId));
  await updateDoc(doc(db, COL.documents, documentId), {
    version: ((docSnap.data()?.version as number) ?? 1) + 1,
    updated_by: editedBy,
    updated_at: nowIso(),
  });
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
  const snap = await getDocs(query(collection(db, COL.documentVersions), where("document_id", "==", documentId), orderBy("version_no", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DocumentVersionRow, "id">) }));
}

export async function changeDocumentStatus(
  documentId: string,
  toStatus: RecordStatus,
  action: "submit" | "comment" | "approve" | "reject" | "sign" | "publish",
  approverId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const document = await getDocumentById(documentId);
  if (!document) throw new Error("Không tìm thấy văn bản");
  const fromStatus = document.status;

  await updateDoc(doc(db, COL.documents, documentId), { status: toStatus, version: document.version + 1, updated_by: approverId, updated_at: nowIso() });

  await addDoc(collection(db, COL.planApprovals), {
    plan_id: documentId,
    approver_id: approverId,
    approver_name: await getUserName(approverId),
    action,
    comment: comment ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    acted_at: nowIso(),
  });

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

export async function archiveDocument(documentId: string, userId: string, sessionId: string | null): Promise<void> {
  const document = await getDocumentById(documentId);
  if (!document) throw new Error("Không tìm thấy văn bản");
  await updateDoc(doc(db, COL.documents, documentId), { status: "archived" as RecordStatus, version: document.version + 1, updated_by: userId, updated_at: nowIso() });
  await logAudit({
    entityTable: "documents",
    entityId: documentId,
    action: "status_change:archived",
    beforeJson: { status: document.status },
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
  const snap = await getDocs(query(collection(db, COL.planApprovals), where("plan_id", "==", documentId), orderBy("acted_at", "asc")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      entity_id: data.plan_id,
      step_no: 1,
      approver_id: data.approver_id,
      approver_name: data.approver_name,
      action: data.action,
      comment: data.comment,
      from_status: data.from_status,
      to_status: data.to_status,
      acted_at: data.acted_at,
    };
  });
}

export async function linkDocumentToTask(taskId: string, documentId?: string, meetingId?: string): Promise<void> {
  await addDoc(collection(db, COL.documentTaskLinks), {
    document_id: documentId ?? null,
    meeting_id: meetingId ?? null,
    task_id: taskId,
  });
}

export async function countPendingApprovalDocuments(schoolYearId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, COL.documents), where("school_year_id", "==", schoolYearId), where("status", "==", "pending_approval")),
  );
  return snap.docs.filter((d) => !d.data().deleted_at).length;
}
