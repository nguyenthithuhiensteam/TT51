import crypto from "node:crypto";
import { db, newId } from "../db.js";

export type Role = "giao_vien" | "to_truong" | "can_bo_quan_ly";

const AUTH_SECRET = process.env.AUTH_SECRET || "doi-khoa-bi-mat-nay-khi-trien-khai";

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function createUser(fullName: string, username: string, password: string, role: Role) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const id = newId("usr");
  db.prepare(
    `INSERT INTO users (id, full_name, username, password_hash, password_salt, role) VALUES (?,?,?,?,?,?)`
  ).run(id, fullName, username, hash, salt, role);
  return id;
}

export function verifyLogin(username: string, password: string) {
  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as
    | { id: string; full_name: string; username: string; password_hash: string; password_salt: string; role: Role }
    | undefined;
  if (!user) return null;
  const computed = hashPassword(password, user.password_salt);
  if (computed !== user.password_hash) return null;
  return { id: user.id, fullName: user.full_name, username: user.username, role: user.role };
}

export function issueToken(payload: { id: string; username: string; role: Role }) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): { id: string; username: string; role: Role } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    return { id: parsed.id, username: parsed.username, role: parsed.role };
  } catch {
    return null;
  }
}

export function ensureSeedUsers() {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c;
  if (count > 0) return;
  createUser("Giáo viên demo", "giaovien", "123456", "giao_vien");
  createUser("Tổ trưởng demo", "totruong", "123456", "to_truong");
  createUser("Quản lý demo", "quanly", "123456", "can_bo_quan_ly");
}
