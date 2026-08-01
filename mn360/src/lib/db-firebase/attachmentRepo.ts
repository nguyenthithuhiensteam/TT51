// TỰ ĐỘNG SINH — phân hệ "attachmentRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "attachmentRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function pickAndAttachFile(..._args: unknown[]): Promise<never> {
  return notImplemented("pickAndAttachFile");
}
