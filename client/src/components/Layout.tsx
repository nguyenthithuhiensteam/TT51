import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../types";

const NAV = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/annual-plans", label: "Kế hoạch giáo dục năm" },
  { to: "/theme-plans", label: "Kế hoạch chủ đề/tháng" },
  { to: "/weekly-plans", label: "Kế hoạch giáo dục tuần" },
  { to: "/objectives", label: "Ngân hàng mục tiêu" },
  { to: "/ai-settings", label: "Cài đặt AI" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Chương trình<br />Giáo dục Mầm non</h1>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="user-box">
            <div>{user.fullName}</div>
            <div className="muted" style={{ color: "#9dc3ac" }}>{ROLE_LABELS[user.role]}</div>
            <button
              className="ghost"
              style={{ color: "#cfe8db", marginTop: 8, padding: 0 }}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Đăng xuất
            </button>
          </div>
        )}
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
