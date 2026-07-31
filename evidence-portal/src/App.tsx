import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider, BOOTSTRAP_ADMIN_EMAIL } from "./firebase";
import { createPendingUser, watchPortalUser } from "./lib/data";
import type { PortalUser } from "./types";
import { Button, RoleBadge } from "./components/ui";
import { EvidencePage } from "./pages/EvidencePage";
import { ApprovalPage } from "./pages/ApprovalPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { CriteriaAdminPage } from "./pages/CriteriaAdminPage";

type Tab = "evidence" | "approval" | "users" | "criteria";

export function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [portalUser, setPortalUser] = useState<PortalUser | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("evidence");

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  useEffect(() => {
    if (!firebaseUser) {
      setPortalUser(firebaseUser === null ? null : undefined);
      return;
    }
    let created = false;
    const unsub = watchPortalUser(firebaseUser.uid, async (user) => {
      if (user) {
        setPortalUser(user);
        return;
      }
      if (created) return;
      created = true;
      const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAIL && firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL;
      await createPendingUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? "",
        displayName: firebaseUser.displayName ?? firebaseUser.email ?? "Chưa rõ tên",
        photoURL: firebaseUser.photoURL,
        role: isBootstrapAdmin ? "admin" : "pending",
      });
    });
    return unsub;
  }, [firebaseUser]);

  if (firebaseUser === undefined || (firebaseUser && portalUser === undefined)) {
    return <CenteredMessage>Đang tải...</CenteredMessage>;
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  if (!portalUser || portalUser.role === "pending") {
    return <PendingScreen email={firebaseUser.email ?? ""} />;
  }

  const visibleTabs: [Tab, string][] = [["evidence", "Minh chứng của tôi"]];
  if (portalUser.role === "approver" || portalUser.role === "admin") {
    visibleTabs.push(["approval", "Duyệt minh chứng"]);
  }
  if (portalUser.role === "admin") {
    visibleTabs.push(["users", "Quản lý tài khoản"]);
    visibleTabs.push(["criteria", "Quản lý tiêu chí"]);
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between bg-navy px-6 py-3 text-white">
        <div>
          <h1 className="text-lg font-semibold">Cổng minh chứng kiểm định — MN360</h1>
          <p className="text-xs text-white/60">Trường Mầm non Tràng Đà</p>
        </div>
        <div className="flex items-center gap-3">
          <RoleBadge role={portalUser.role} />
          <span className="text-sm">{portalUser.displayName}</span>
          <Button variant="secondary" onClick={() => signOut(auth)}>
            Đăng xuất
          </Button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-navy/10 bg-white px-6">
        {visibleTabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (tab === key ? "border-b-2 border-brand text-brand" : "text-navy/50 hover:text-navy")
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-5xl p-6">
        {tab === "evidence" && <EvidencePage currentUser={portalUser} />}
        {tab === "approval" && <ApprovalPage currentUser={portalUser} />}
        {tab === "users" && <AdminUsersPage currentUser={portalUser} />}
        {tab === "criteria" && <CriteriaAdminPage />}
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-cream text-navy/60">{children}</div>;
}

function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-card">
        <h1 className="mb-1 text-xl font-bold text-navy">Cổng minh chứng kiểm định</h1>
        <p className="mb-6 text-sm text-navy/60">MN360 — Trường Mầm non Tràng Đà</p>
        <Button
          className="w-full justify-center"
          onClick={() =>
            signInWithPopup(auth, googleProvider).catch((e) => setError(e.message as string))
          }
        >
          Đăng nhập bằng Google
        </Button>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

function PendingScreen({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-card">
        <h1 className="mb-2 text-lg font-bold text-navy">Tài khoản đang chờ duyệt</h1>
        <p className="mb-1 text-sm text-navy/70">
          Tài khoản <span className="font-medium">{email}</span> đã được ghi nhận, đang chờ quản trị viên duyệt và
          gán quyền truy cập.
        </p>
        <p className="mb-6 text-xs text-navy/50">Liên hệ hiệu trưởng/quản trị hệ thống để được duyệt sớm hơn.</p>
        <Button variant="secondary" onClick={() => signOut(auth)}>
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}
