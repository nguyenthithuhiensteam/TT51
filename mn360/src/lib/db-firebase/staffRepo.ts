// TỰ ĐỘNG SINH — phân hệ "staffRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "staffRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listStaff(..._args: unknown[]): Promise<never> {
  return notImplemented("listStaff");
}

export async function getStaffById(..._args: unknown[]): Promise<never> {
  return notImplemented("getStaffById");
}

export async function getStaffByUserId(..._args: unknown[]): Promise<never> {
  return notImplemented("getStaffByUserId");
}

export async function createStaff(..._args: unknown[]): Promise<never> {
  return notImplemented("createStaff");
}

export async function listStaffAssignments(..._args: unknown[]): Promise<never> {
  return notImplemented("listStaffAssignments");
}

export async function addStaffAssignment(..._args: unknown[]): Promise<never> {
  return notImplemented("addStaffAssignment");
}

export async function listStaffLeaves(..._args: unknown[]): Promise<never> {
  return notImplemented("listStaffLeaves");
}

export async function requestStaffLeave(..._args: unknown[]): Promise<never> {
  return notImplemented("requestStaffLeave");
}

export async function decideStaffLeave(..._args: unknown[]): Promise<never> {
  return notImplemented("decideStaffLeave");
}

export async function listStaffEvaluations(..._args: unknown[]): Promise<never> {
  return notImplemented("listStaffEvaluations");
}

export async function upsertStaffEvaluation(..._args: unknown[]): Promise<never> {
  return notImplemented("upsertStaffEvaluation");
}

export async function finalizeStaffEvaluation(..._args: unknown[]): Promise<never> {
  return notImplemented("finalizeStaffEvaluation");
}
