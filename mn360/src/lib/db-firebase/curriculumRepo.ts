// TỰ ĐỘNG SINH — phân hệ "curriculumRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "curriculumRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listEducationPlans(..._args: unknown[]): Promise<never> {
  return notImplemented("listEducationPlans");
}

export async function getEducationPlanById(..._args: unknown[]): Promise<never> {
  return notImplemented("getEducationPlanById");
}

export async function createEducationPlan(..._args: unknown[]): Promise<never> {
  return notImplemented("createEducationPlan");
}

export async function updateEducationPlanContent(..._args: unknown[]): Promise<never> {
  return notImplemented("updateEducationPlanContent");
}

export async function changeEducationPlanStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeEducationPlanStatus");
}

export async function listPlanApprovals(..._args: unknown[]): Promise<never> {
  return notImplemented("listPlanApprovals");
}

export async function listObservationsByChild(..._args: unknown[]): Promise<never> {
  return notImplemented("listObservationsByChild");
}

export async function addObservation(..._args: unknown[]): Promise<never> {
  return notImplemented("addObservation");
}

export async function listChildAssessments(..._args: unknown[]): Promise<never> {
  return notImplemented("listChildAssessments");
}

export async function addChildAssessment(..._args: unknown[]): Promise<never> {
  return notImplemented("addChildAssessment");
}
