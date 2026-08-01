// TỰ ĐỘNG SINH — phân hệ "documentRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "documentRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listDocuments(..._args: unknown[]): Promise<never> {
  return notImplemented("listDocuments");
}

export async function getDocumentById(..._args: unknown[]): Promise<never> {
  return notImplemented("getDocumentById");
}

export async function createDocument(..._args: unknown[]): Promise<never> {
  return notImplemented("createDocument");
}

export async function addDocumentVersion(..._args: unknown[]): Promise<never> {
  return notImplemented("addDocumentVersion");
}

export async function listDocumentVersions(..._args: unknown[]): Promise<never> {
  return notImplemented("listDocumentVersions");
}

export async function changeDocumentStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeDocumentStatus");
}

export async function archiveDocument(..._args: unknown[]): Promise<never> {
  return notImplemented("archiveDocument");
}

export async function listDocumentApprovals(..._args: unknown[]): Promise<never> {
  return notImplemented("listDocumentApprovals");
}

export async function linkDocumentToTask(..._args: unknown[]): Promise<never> {
  return notImplemented("linkDocumentToTask");
}

export async function countPendingApprovalDocuments(..._args: unknown[]): Promise<never> {
  return notImplemented("countPendingApprovalDocuments");
}
