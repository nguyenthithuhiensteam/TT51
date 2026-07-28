import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LockScreen } from "./LockScreen";
import { useAuthStore } from "../../store/authStore";
import { useIdleLock } from "../../lib/utils/useIdleLock";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút không thao tác thì tự khóa

export function AppLayout() {
  const isLocked = useAuthStore((s) => s.isLocked);
  const lock = useAuthStore((s) => s.lock);
  const user = useAuthStore((s) => s.user);

  useIdleLock(IDLE_TIMEOUT_MS, lock, !!user && !isLocked);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onLock={lock} />
        <main className="flex-1 overflow-y-auto bg-cream p-6">
          <Outlet />
        </main>
      </div>
      {isLocked && <LockScreen />}
    </div>
  );
}
