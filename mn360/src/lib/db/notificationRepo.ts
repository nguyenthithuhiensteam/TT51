import { dbExecute, dbSelect } from "./client";

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  level: "info" | "warning" | "danger";
  is_read: number;
  created_at: string;
}

export async function listNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  return dbSelect<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const rows = await dbSelect<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0",
    [userId],
  );
  return rows[0]?.n ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await dbExecute("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await dbExecute("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [
    userId,
  ]);
}
