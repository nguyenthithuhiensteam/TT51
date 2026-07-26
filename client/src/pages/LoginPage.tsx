import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#16362a" }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 340 }}>
        <h2>Chương trình Giáo dục Mầm non</h2>
        <p className="muted">Đăng nhập để tạo và quản lý kế hoạch giáo dục.</p>
        {error && <div className="banner error">{error}</div>}
        <div className="field">
          <label>Tên đăng nhập</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <p className="hint" style={{ marginTop: 12 }}>
          Tài khoản demo: giaovien / totruong / quanly - mật khẩu 123456
        </p>
      </form>
    </div>
  );
}
