// TỰ ĐỘNG SINH — phân hệ "accreditationRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "accreditationRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listStandards(..._args: unknown[]): Promise<never> {
  return notImplemented("listStandards");
}

export async function createStandard(..._args: unknown[]): Promise<never> {
  return notImplemented("createStandard");
}

export async function listCriteria(..._args: unknown[]): Promise<never> {
  return notImplemented("listCriteria");
}

export async function getCriteriaById(..._args: unknown[]): Promise<never> {
  return notImplemented("getCriteriaById");
}

export async function createCriteria(..._args: unknown[]): Promise<never> {
  return notImplemented("createCriteria");
}

export async function updateCriteriaSelfAssessment(..._args: unknown[]): Promise<never> {
  return notImplemented("updateCriteriaSelfAssessment");
}

export async function changeCriteriaStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeCriteriaStatus");
}

export async function listCriteriaAssignments(..._args: unknown[]): Promise<never> {
  return notImplemented("listCriteriaAssignments");
}

export async function assignCriteria(..._args: unknown[]): Promise<never> {
  return notImplemented("assignCriteria");
}

export async function listEvidenceFiles(..._args: unknown[]): Promise<never> {
  return notImplemented("listEvidenceFiles");
}

export async function createEvidence(..._args: unknown[]): Promise<never> {
  return notImplemented("createEvidence");
}

export async function listEvidenceForCriteria(..._args: unknown[]): Promise<never> {
  return notImplemented("listEvidenceForCriteria");
}

export async function linkEvidenceToCriteria(..._args: unknown[]): Promise<never> {
  return notImplemented("linkEvidenceToCriteria");
}
