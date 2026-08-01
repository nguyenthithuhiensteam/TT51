// TỰ ĐỘNG SINH — phân hệ "financeRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "financeRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listFeeItems(..._args: unknown[]): Promise<never> {
  return notImplemented("listFeeItems");
}

export async function createFeeItem(..._args: unknown[]): Promise<never> {
  return notImplemented("createFeeItem");
}

export async function listRevenues(..._args: unknown[]): Promise<never> {
  return notImplemented("listRevenues");
}

export async function createRevenue(..._args: unknown[]): Promise<never> {
  return notImplemented("createRevenue");
}

export async function transitionRevenue(..._args: unknown[]): Promise<never> {
  return notImplemented("transitionRevenue");
}

export async function listExpenses(..._args: unknown[]): Promise<never> {
  return notImplemented("listExpenses");
}

export async function createExpense(..._args: unknown[]): Promise<never> {
  return notImplemented("createExpense");
}

export async function transitionExpense(..._args: unknown[]): Promise<never> {
  return notImplemented("transitionExpense");
}

export async function listAssets(..._args: unknown[]): Promise<never> {
  return notImplemented("listAssets");
}

export async function createAsset(..._args: unknown[]): Promise<never> {
  return notImplemented("createAsset");
}

export async function changeAssetStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeAssetStatus");
}

export async function listAssetStatusHistory(..._args: unknown[]): Promise<never> {
  return notImplemented("listAssetStatusHistory");
}
