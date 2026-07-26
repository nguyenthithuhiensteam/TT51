import type { Response } from "express";
import type { Role } from "../services/authService.js";

export class PlanConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanConflictError";
  }
}

export function assertEditAllowed(status: string, confirm: boolean) {
  if (status === "da_duyet" && !confirm) {
    throw new PlanConflictError(
      "Kế hoạch này đã được phê duyệt. Chỉnh sửa sẽ chuyển trạng thái về \"Cần điều chỉnh\" và lưu lại phiên bản đã duyệt trước đó để có thể khôi phục. Vui lòng xác nhận để tiếp tục."
    );
  }
}

const TRANSITIONS: Record<string, { allowedFrom: string[]; allowedRoles: Role[] }> = {
  cho_duyet: { allowedFrom: ["nhap", "can_dieu_chinh"], allowedRoles: ["giao_vien", "to_truong", "can_bo_quan_ly"] },
  da_duyet: { allowedFrom: ["cho_duyet"], allowedRoles: ["to_truong", "can_bo_quan_ly"] },
  can_dieu_chinh: { allowedFrom: ["cho_duyet", "da_duyet"], allowedRoles: ["to_truong", "can_bo_quan_ly"] },
  nhap: { allowedFrom: ["can_dieu_chinh", "nhap"], allowedRoles: ["giao_vien", "to_truong", "can_bo_quan_ly"] },
};

export function validateStatusTransition(from: string, to: string, role: Role): string | null {
  const rule = TRANSITIONS[to];
  if (!rule) return "Trạng thái không hợp lệ.";
  if (!rule.allowedFrom.includes(from)) return `Không thể chuyển trạng thái từ "${from}" sang "${to}".`;
  if (!rule.allowedRoles.includes(role)) return "Bạn không có quyền chuyển sang trạng thái này.";
  return null;
}

export function handlePlanError(err: unknown, res: Response) {
  if (err instanceof PlanConflictError) {
    return res.status(409).json({ error: err.message, code: "approved_edit_requires_confirm" });
  }
  throw err;
}
