import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, HelpCircle, Lock, Search, Wifi, WifiOff, ChevronDown, Menu } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { ROLE_LABELS } from "../../lib/db/types";
import { globalSearch, type SearchResult } from "../../lib/db/searchRepo";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "../../lib/db/notificationRepo";

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      globalSearch(query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={ref} className="relative w-full min-w-0 max-w-md flex-1">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/40"
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Tìm kiếm toàn hệ thống..."
        className="w-full rounded-xl border border-navy/10 bg-cream py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-navy/10 bg-white shadow-card">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => {
                navigate(r.link);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-navy/5"
            >
              <span className="font-medium text-navy">{r.title}</span>
              <span className="text-xs text-navy/50">
                {r.type === "task" ? "Công việc" : "Văn bản"} · {r.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsMenu() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useClickOutside(() => setOpen(false));

  const refresh = async () => {
    if (!user) return;
    setItems(await listNotifications(user.id));
    setUnread(await countUnreadNotifications(user.id));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        className="relative rounded-full p-2 text-navy/70 hover:bg-navy/5"
        aria-label="Thông báo"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-navy/10 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-navy/5 px-3 py-2">
            <span className="text-sm font-semibold text-navy">Thông báo</span>
            <button
              className="text-xs text-brand hover:underline"
              onClick={async () => {
                if (user) await markAllNotificationsRead(user.id);
                refresh();
              }}
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-4 text-sm text-navy/50">Không có thông báo</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={async () => {
                  await markNotificationRead(n.id);
                  refresh();
                }}
                className={`block w-full border-b border-navy/5 px-3 py-2 text-left text-sm last:border-none hover:bg-navy/5 ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <span className="block font-medium text-navy">{n.title}</span>
                <span className="block text-xs text-navy/60">{n.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useClickOutside(() => setOpen(false));

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-navy/5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-dark">
          {user.full_name.charAt(0)}
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-sm font-medium text-navy">{user.full_name}</div>
          <div className="text-xs text-navy/50">
            {roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
          </div>
        </div>
        <ChevronDown size={14} className="text-navy/40" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-navy/10 bg-white shadow-card">
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-navy/5"
            onClick={() => {
              navigate("/doi-mat-khau");
              setOpen(false);
            }}
          >
            Đổi mật khẩu
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
            onClick={() => {
              clearSession();
              navigate("/dang-nhap");
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onLock, onMenuClick }: { onLock: () => void; onMenuClick?: () => void }) {
  const school = useAppStore((s) => s.school);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const isOnline = useAppStore((s) => s.isOnline);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useClickOutside(() => setHelpOpen(false));

  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-navy/5 bg-white px-3 sm:gap-4 sm:px-5">
      <button
        onClick={onMenuClick}
        className="rounded-full p-2 text-navy/70 hover:bg-navy/5 md:hidden"
        aria-label="Mở menu"
      >
        <Menu size={20} />
      </button>
      <div className="hidden min-w-0 flex-col leading-tight lg:flex">
        <span className="truncate text-sm font-semibold text-navy">
          {school?.name ?? "MN360"}
        </span>
        <span className="text-xs text-navy/50">
          Năm học {schoolYear?.code ?? "chưa cấu hình"}
        </span>
      </div>
      <SearchBox />
      <div className="ml-auto flex items-center gap-1">
        <div
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            isOnline ? "bg-mint/10 text-mint" : "bg-navy/10 text-navy/60"
          }`}
          title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến — dữ liệu vẫn hoạt động bình thường"}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? "Trực tuyến" : "Ngoại tuyến"}
        </div>
        <NotificationsMenu />
        <div ref={helpRef} className="relative">
          <button
            onClick={() => setHelpOpen((v) => !v)}
            className="rounded-full p-2 text-navy/70 hover:bg-navy/5"
            aria-label="Trợ giúp"
          >
            <HelpCircle size={18} />
          </button>
          {helpOpen && (
            <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-navy/10 bg-white p-3 shadow-card text-sm text-navy/80">
              <p className="mb-1 font-semibold text-navy">Trợ giúp nhanh</p>
              <p>
                Xem tài liệu sử dụng trong thư mục <code>docs/</code> của dự án hoặc liên hệ quản
                trị kỹ thuật của trường để được hỗ trợ.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onLock}
          className="rounded-full p-2 text-navy/70 hover:bg-navy/5"
          aria-label="Khóa ứng dụng"
          title="Khóa ứng dụng"
        >
          <Lock size={18} />
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
