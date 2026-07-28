import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function LockScreen() {
  const user = useAuthStore((s) => s.user);
  const unlock = useAuthStore((s) => s.unlock);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (!user) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const ok = await invoke<boolean>("verify_password", {
        password,
        hash: user!.password_hash,
      });
      if (ok) {
        unlock();
        setPassword("");
      } else {
        setError("Mật khẩu không đúng");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/95 backdrop-blur-sm">
      <form
        onSubmit={handleUnlock}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card"
      >
        <h2 className="mb-1 text-lg font-semibold text-navy">Ứng dụng đã khóa</h2>
        <p className="mb-4 text-sm text-navy/60">
          Xin chào {user.full_name}, nhập lại mật khẩu để tiếp tục làm việc.
        </p>
        <Input
          type="password"
          autoFocus
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={checking} className="flex-1">
            {checking ? "Đang kiểm tra..." : "Mở khóa"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              clearSession();
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </form>
    </div>
  );
}
