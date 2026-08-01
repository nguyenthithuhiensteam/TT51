// TỰ ĐỘNG SINH — phân hệ "notificationRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "notificationRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listNotifications(..._args: unknown[]): Promise<never> {
  return notImplemented("listNotifications");
}

export async function countUnreadNotifications(..._args: unknown[]): Promise<never> {
  return notImplemented("countUnreadNotifications");
}

export async function markNotificationRead(..._args: unknown[]): Promise<never> {
  return notImplemented("markNotificationRead");
}

export async function markAllNotificationsRead(..._args: unknown[]): Promise<never> {
  return notImplemented("markAllNotificationsRead");
}
