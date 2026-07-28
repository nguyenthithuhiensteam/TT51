import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/dang-nhap" state={{ from: location }} replace />;
  if (user.must_change_password && location.pathname !== "/doi-mat-khau") {
    return <Navigate to="/doi-mat-khau" replace />;
  }
  return <>{children}</>;
}

/**
 * Chặn cả route lẫn dữ liệu theo quyền — người không có quyền không nhìn thấy nội dung,
 * đặc biệt quan trọng với phân hệ Công tác Đảng (party.view).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission)) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-card">
        <h2 className="text-lg font-semibold text-navy">Không có quyền truy cập</h2>
        <p className="mt-1 text-sm text-navy/60">
          Tài khoản của bạn không được phân quyền xem nội dung này.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
