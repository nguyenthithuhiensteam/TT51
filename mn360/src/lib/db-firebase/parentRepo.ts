// TỰ ĐỘNG SINH — phân hệ "parentRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "parentRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listMyChildren(..._args: unknown[]): Promise<never> {
  return notImplemented("listMyChildren");
}

export async function getMyChildAttendance(..._args: unknown[]): Promise<never> {
  return notImplemented("getMyChildAttendance");
}

export async function getTodayMenuForChild(..._args: unknown[]): Promise<never> {
  return notImplemented("getTodayMenuForChild");
}

export async function getMyChildRevenues(..._args: unknown[]): Promise<never> {
  return notImplemented("getMyChildRevenues");
}

export async function listMyLeaveRequests(..._args: unknown[]): Promise<never> {
  return notImplemented("listMyLeaveRequests");
}

export async function createLeaveRequest(..._args: unknown[]): Promise<never> {
  return notImplemented("createLeaveRequest");
}

export async function listMyMessages(..._args: unknown[]): Promise<never> {
  return notImplemented("listMyMessages");
}

export async function sendMessageAsParent(..._args: unknown[]): Promise<never> {
  return notImplemented("sendMessageAsParent");
}

export async function listMyAiConsultations(..._args: unknown[]): Promise<never> {
  return notImplemented("listMyAiConsultations");
}

export async function askAiParentingQuestion(..._args: unknown[]): Promise<never> {
  return notImplemented("askAiParentingQuestion");
}

export async function listAllAiConsultationsForReview(..._args: unknown[]): Promise<never> {
  return notImplemented("listAllAiConsultationsForReview");
}
