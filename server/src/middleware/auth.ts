import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../services/authService.js";

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: Role };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập. Vui lòng đăng nhập lại." });
  }
  const token = header.slice("Bearer ".length);
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Bạn không có quyền thực hiện thao tác này. Chỉ tổ trưởng hoặc cán bộ quản lý mới được phê duyệt.",
      });
    }
    next();
  };
}
