import { Router } from "express";
import { issueToken, verifyLogin } from "../services/authService.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { db } from "../db.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
  }
  const user = verifyLogin(username, password);
  if (!user) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }
  const token = issueToken({ id: user.id, username: user.username, role: user.role });
  res.json({ token, user: { id: user.id, fullName: user.fullName, username: user.username, role: user.role } });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT id, full_name, username, role FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  res.json({ id: row.id, fullName: row.full_name, username: row.username, role: row.role });
});
