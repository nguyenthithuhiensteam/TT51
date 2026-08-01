// TỰ ĐỘNG SINH — phân hệ "rationRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "rationRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function getDefaultMealFeeRate(..._args: unknown[]): Promise<never> {
  return notImplemented("getDefaultMealFeeRate");
}

export async function setDefaultMealFeeRate(..._args: unknown[]): Promise<never> {
  return notImplemented("setDefaultMealFeeRate");
}

export async function listFoods(..._args: unknown[]): Promise<never> {
  return notImplemented("listFoods");
}

export async function createFood(..._args: unknown[]): Promise<never> {
  return notImplemented("createFood");
}

export async function getNutritionNorms(..._args: unknown[]): Promise<never> {
  return notImplemented("getNutritionNorms");
}

export async function getDailyRation(..._args: unknown[]): Promise<never> {
  return notImplemented("getDailyRation");
}

export async function getOrCreateDailyRation(..._args: unknown[]): Promise<never> {
  return notImplemented("getOrCreateDailyRation");
}

export async function listRationItems(..._args: unknown[]): Promise<never> {
  return notImplemented("listRationItems");
}

export async function addRationItem(..._args: unknown[]): Promise<never> {
  return notImplemented("addRationItem");
}

export async function updateRationItem(..._args: unknown[]): Promise<never> {
  return notImplemented("updateRationItem");
}

export async function removeRationItem(..._args: unknown[]): Promise<never> {
  return notImplemented("removeRationItem");
}

export async function getHeadcountForGroup(..._args: unknown[]): Promise<never> {
  return notImplemented("getHeadcountForGroup");
}

export async function computeNutritionTotals(..._args: unknown[]): Promise<never> {
  return notImplemented("computeNutritionTotals");
}

export async function statusForNutrient(..._args: unknown[]): Promise<never> {
  return notImplemented("statusForNutrient");
}

export async function computeItemCost(..._args: unknown[]): Promise<never> {
  return notImplemented("computeItemCost");
}

export async function getWeeklyRationSummary(..._args: unknown[]): Promise<never> {
  return notImplemented("getWeeklyRationSummary");
}

export async function getCombinedDailyReport(..._args: unknown[]): Promise<never> {
  return notImplemented("getCombinedDailyReport");
}

export async function getPolicyChecklistState(..._args: unknown[]): Promise<never> {
  return notImplemented("getPolicyChecklistState");
}

export async function setPolicyChecklistItem(..._args: unknown[]): Promise<never> {
  return notImplemented("setPolicyChecklistItem");
}

export async function changeRationStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeRationStatus");
}
