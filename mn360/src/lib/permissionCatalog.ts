/** Danh mục đầy đủ các mã quyền trong hệ thống (khớp với src-tauri/src/db/sql/*.sql), dùng để
 * hiển thị bảng chọn quyền khi quản trị viên phê duyệt/phân quyền tài khoản trên bản web thật.
 * Không dùng cho bản desktop (đã có RBAC theo vai trò/roles ở đó). */
export interface PermissionCatalogGroup {
  group: string;
  codes: { code: string; label: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  edit: "Sửa",
  approve: "Duyệt",
  export: "Xuất",
  submit: "Nộp",
  publish: "Phát hành",
  backup: "Sao lưu",
  restore: "Khôi phục",
  ai_consult: "Tư vấn AI",
};

function group(name: string, module: string, actions: string[]): PermissionCatalogGroup {
  return {
    group: name,
    codes: actions.map((action) => ({
      code: `${module}.${action}`,
      label: ACTION_LABELS[action] ?? action,
    })),
  };
}

export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  group("Tổng quan", "dashboard", ["view"]),
  group("Công việc", "task", ["view", "create", "edit", "export", "submit", "approve"]),
  group("Trẻ em", "children", ["view", "create", "edit", "export", "approve"]),
  group("Đội ngũ", "staff", ["view", "create", "edit", "export", "approve"]),
  group("Chuyên môn", "curriculum", ["view", "create", "export", "submit", "approve"]),
  group("Nuôi dưỡng", "nutrition", ["view", "create", "edit", "export", "approve"]),
  group("Sức khỏe – An toàn", "health", ["view", "create", "edit", "export", "approve"]),
  group("Tài chính – Tài sản", "finance", ["view", "create", "edit", "export", "approve"]),
  group("Kiểm định", "accreditation", ["view", "create", "edit", "export", "approve"]),
  group("Văn phòng số", "document", ["view", "create", "submit", "publish", "export", "approve"]),
  group("Công tác Đảng", "party", ["view", "create", "edit", "export", "approve"]),
  group("Phụ huynh", "parent", ["view", "create", "ai_consult"]),
  group("Hệ thống", "system", ["view", "edit", "backup", "restore"]),
];

export const ALL_PERMISSION_CODES: string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.codes.map((c) => c.code),
);
