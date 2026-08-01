// TỰ ĐỘNG SINH — phân hệ "childRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "childRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listClasses(..._args: unknown[]): Promise<never> {
  return notImplemented("listClasses");
}

export async function getClassById(..._args: unknown[]): Promise<never> {
  return notImplemented("getClassById");
}

export async function createClass(..._args: unknown[]): Promise<never> {
  return notImplemented("createClass");
}

export async function listChildren(..._args: unknown[]): Promise<never> {
  return notImplemented("listChildren");
}

export async function getChildById(..._args: unknown[]): Promise<never> {
  return notImplemented("getChildById");
}

export async function createChild(..._args: unknown[]): Promise<never> {
  return notImplemented("createChild");
}

export async function updateChild(..._args: unknown[]): Promise<never> {
  return notImplemented("updateChild");
}

export async function updateChildDemographics(..._args: unknown[]): Promise<never> {
  return notImplemented("updateChildDemographics");
}

export async function changeChildStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeChildStatus");
}

export async function listChildStatusHistory(..._args: unknown[]): Promise<never> {
  return notImplemented("listChildStatusHistory");
}

export async function listGuardiansOfChild(..._args: unknown[]): Promise<never> {
  return notImplemented("listGuardiansOfChild");
}

export async function addGuardianToChild(..._args: unknown[]): Promise<never> {
  return notImplemented("addGuardianToChild");
}

export async function getAttendanceForClassDate(..._args: unknown[]): Promise<never> {
  return notImplemented("getAttendanceForClassDate");
}

export async function recordAttendance(..._args: unknown[]): Promise<never> {
  return notImplemented("recordAttendance");
}

export async function getClassAttendanceStats(..._args: unknown[]): Promise<never> {
  return notImplemented("getClassAttendanceStats");
}

export async function getChildrenAttendanceSummary(..._args: unknown[]): Promise<never> {
  return notImplemented("getChildrenAttendanceSummary");
}

export async function getMonthlyAttendanceGrid(..._args: unknown[]): Promise<never> {
  return notImplemented("getMonthlyAttendanceGrid");
}

export async function getYearlyAttendanceSummary(..._args: unknown[]): Promise<never> {
  return notImplemented("getYearlyAttendanceSummary");
}

export async function getStudentCountByTimePoints(..._args: unknown[]): Promise<never> {
  return notImplemented("getStudentCountByTimePoints");
}

export async function listLeaveRequestsForChild(..._args: unknown[]): Promise<never> {
  return notImplemented("listLeaveRequestsForChild");
}

export async function decideLeaveRequest(..._args: unknown[]): Promise<never> {
  return notImplemented("decideLeaveRequest");
}

export async function listMessagesForChild(..._args: unknown[]): Promise<never> {
  return notImplemented("listMessagesForChild");
}

export async function replyAsTeacher(..._args: unknown[]): Promise<never> {
  return notImplemented("replyAsTeacher");
}
