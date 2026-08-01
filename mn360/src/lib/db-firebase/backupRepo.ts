// TỰ ĐỘNG SINH — phân hệ "backupRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "backupRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function runBackup(..._args: unknown[]): Promise<never> {
  return notImplemented("runBackup");
}

export async function runRestore(..._args: unknown[]): Promise<never> {
  return notImplemented("runRestore");
}

export async function listBackupFiles(..._args: unknown[]): Promise<never> {
  return notImplemented("listBackupFiles");
}

export async function listBackupHistory(..._args: unknown[]): Promise<never> {
  return notImplemented("listBackupHistory");
}

export async function getDataDir(..._args: unknown[]): Promise<never> {
  return notImplemented("getDataDir");
}

export async function setDataDir(..._args: unknown[]): Promise<never> {
  return notImplemented("setDataDir");
}
