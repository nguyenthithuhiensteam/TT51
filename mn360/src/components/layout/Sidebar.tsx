import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  Baby,
  Users,
  GraduationCap,
  Utensils,
  HeartPulse,
  Wallet,
  BadgeCheck,
  Flag,
  UsersRound,
  Settings,
  DatabaseBackup,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/cong-viec", label: "Công việc", icon: ListChecks, permission: "task.view" },
  { to: "/van-phong-so", label: "Văn phòng số", icon: FileText, permission: "document.view" },
  { to: "/tre-em", label: "Trẻ em", icon: Baby, permission: "children.view" },
  { to: "/doi-ngu", label: "Đội ngũ", icon: Users, permission: "staff.view" },
  { to: "/chuyen-mon", label: "Chuyên môn", icon: GraduationCap, permission: "curriculum.view" },
  { to: "/nuoi-duong", label: "Nuôi dưỡng", icon: Utensils, permission: "nutrition.view" },
  {
    to: "/suc-khoe-an-toan",
    label: "Sức khỏe – An toàn",
    icon: HeartPulse,
    permission: "health.view",
  },
  {
    to: "/tai-chinh-tai-san",
    label: "Tài chính – Tài sản",
    icon: Wallet,
    permission: "finance.view",
  },
  { to: "/kiem-dinh", label: "Kiểm định", icon: BadgeCheck, permission: "accreditation.view" },
  { to: "/cong-tac-dang", label: "Công tác Đảng", icon: Flag, permission: "party.view" },
  { to: "/phu-huynh", label: "Phụ huynh", icon: UsersRound, permission: "parent.view" },
];

const SYSTEM_NAV: NavItem[] = [
  { to: "/cai-dat", label: "Cấu hình trường / năm học", icon: Settings, permission: "system.view" },
  { to: "/sao-luu", label: "Sao lưu / Khôi phục", icon: DatabaseBackup, permission: "system.backup" },
];

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const visible = items.filter((item) => hasPermission(item.permission));
  return (
    <>
      {visible.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand text-white"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            )
          }
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </>
  );
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-shrink-0 flex-col gap-1 overflow-y-auto bg-navy px-3 py-4 transition-transform duration-200 ease-in-out",
          "md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-bold text-white">
            M
          </div>
          <span className="text-lg font-bold text-white">MN360</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <NavList items={MAIN_NAV} onNavigate={onClose} />
        </nav>
        <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-3">
          <NavList items={SYSTEM_NAV} onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}
