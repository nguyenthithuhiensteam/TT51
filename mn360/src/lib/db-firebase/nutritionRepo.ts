// TỰ ĐỘNG SINH — phân hệ "nutritionRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "nutritionRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listDishes(..._args: unknown[]): Promise<never> {
  return notImplemented("listDishes");
}

export async function createDish(..._args: unknown[]): Promise<never> {
  return notImplemented("createDish");
}

export async function getMenuForClassDate(..._args: unknown[]): Promise<never> {
  return notImplemented("getMenuForClassDate");
}

export async function getMenuById(..._args: unknown[]): Promise<never> {
  return notImplemented("getMenuById");
}

export async function listMenus(..._args: unknown[]): Promise<never> {
  return notImplemented("listMenus");
}

export async function saveMenu(..._args: unknown[]): Promise<never> {
  return notImplemented("saveMenu");
}

export async function changeMenuStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeMenuStatus");
}

export async function getMealCountFromAttendance(..._args: unknown[]): Promise<never> {
  return notImplemented("getMealCountFromAttendance");
}

export async function checkAllergyWarnings(..._args: unknown[]): Promise<never> {
  return notImplemented("checkAllergyWarnings");
}

export async function listSuppliers(..._args: unknown[]): Promise<never> {
  return notImplemented("listSuppliers");
}

export async function createSupplier(..._args: unknown[]): Promise<never> {
  return notImplemented("createSupplier");
}

export async function listFoodDeliveries(..._args: unknown[]): Promise<never> {
  return notImplemented("listFoodDeliveries");
}

export async function createFoodDelivery(..._args: unknown[]): Promise<never> {
  return notImplemented("createFoodDelivery");
}

export async function listThreeStepInspections(..._args: unknown[]): Promise<never> {
  return notImplemented("listThreeStepInspections");
}

export async function recordThreeStepInspection(..._args: unknown[]): Promise<never> {
  return notImplemented("recordThreeStepInspection");
}
