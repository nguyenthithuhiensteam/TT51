// TỰ ĐỘNG SINH — phân hệ "healthRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "healthRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function getHealthRecord(..._args: unknown[]): Promise<never> {
  return notImplemented("getHealthRecord");
}

export async function upsertHealthRecord(..._args: unknown[]): Promise<never> {
  return notImplemented("upsertHealthRecord");
}

export async function listGrowthMeasurements(..._args: unknown[]): Promise<never> {
  return notImplemented("listGrowthMeasurements");
}

export async function addGrowthMeasurement(..._args: unknown[]): Promise<never> {
  return notImplemented("addGrowthMeasurement");
}

export async function getGrowthAssessments(..._args: unknown[]): Promise<never> {
  return notImplemented("getGrowthAssessments");
}

export async function getGrowthSummary(..._args: unknown[]): Promise<never> {
  return notImplemented("getGrowthSummary");
}

export async function listVaccinations(..._args: unknown[]): Promise<never> {
  return notImplemented("listVaccinations");
}

export async function addVaccination(..._args: unknown[]): Promise<never> {
  return notImplemented("addVaccination");
}

export async function listPhysicalExamRounds(..._args: unknown[]): Promise<never> {
  return notImplemented("listPhysicalExamRounds");
}

export async function getPhysicalExamGrid(..._args: unknown[]): Promise<never> {
  return notImplemented("getPhysicalExamGrid");
}

export async function upsertPhysicalExam(..._args: unknown[]): Promise<never> {
  return notImplemented("upsertPhysicalExam");
}

export async function listIncidents(..._args: unknown[]): Promise<never> {
  return notImplemented("listIncidents");
}

export async function createIncident(..._args: unknown[]): Promise<never> {
  return notImplemented("createIncident");
}

export async function listSafetyInspections(..._args: unknown[]): Promise<never> {
  return notImplemented("listSafetyInspections");
}

export async function createSafetyInspection(..._args: unknown[]): Promise<never> {
  return notImplemented("createSafetyInspection");
}

export async function changeSafetyInspectionStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeSafetyInspectionStatus");
}
