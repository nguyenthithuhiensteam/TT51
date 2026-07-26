import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { themePlansApi, weeklyPlansApi } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import StatusBadge from "../../components/StatusBadge";
import { PLAN_STATUS_LABELS, type PlanStatus, type ThemePlanRecord, type WeeklyPlanRecord } from "../../types";
import { ApiError } from "../../api/client";

export default function WeeklyPlanListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WeeklyPlanRecord[]>([]);
  const [themePlans, setThemePlans] = useState<ThemePlanRecord[]>([]);
  const [themePlanId, setThemePlanId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const canDelete = user?.role === "to_truong" || user?.role === "can_bo_quan_ly";

  useEffect(() => { themePlansApi.list().then(setThemePlans as any); }, []);
  function load() {
    weeklyPlansApi.list({ themePlanId, search, status }).then(setItems as any);
  }
  useEffect(load, [themePlanId, search, status]);

  async function duplicate(id: string) {
    await weeklyPlansApi.duplicate(id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Xóa kế hoạch tuần này? Hành động không thể hoàn tác.")) return;
    setError("");
    try {
      await weeklyPlansApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa.");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Kế hoạch giáo dục tuần</h2>
        <div className="spacer" />
        <button className="primary" disabled={themePlans.length === 0} onClick={() => navigate("/weekly-plans/new")}>+ Tạo kế hoạch tuần</button>
      </div>
      {themePlans.length === 0 && <div className="banner warn">Cần tạo Kế hoạch chủ đề trước khi tạo kế hoạch tuần.</div>}
      {error && <div className="banner error">{error}</div>}
      <div className="card">
        <div className="row">
          <div className="field">
            <label>Kế hoạch chủ đề</label>
            <select value={themePlanId} onChange={(e) => setThemePlanId(e.target.value)}>
              <option value="">Tất cả</option>
              {themePlans.map((t) => <option key={t.id} value={t.id}>{t.themeName}</option>)}
            </select>
          </div>
          <div className="field"><label>Tìm kiếm</label><input value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="field">
            <label>Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(PLAN_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <table className="grid list-table">
          <thead><tr><th>Tuần</th><th>Trạng thái</th><th>Phiên bản</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/weekly-plans/${p.id}`}>{p.code}</Link></td>
                <td><StatusBadge status={p.status as PlanStatus} /></td>
                <td>{p.version}</td>
                <td className="muted">{p.updatedAt}</td>
                <td>
                  <button className="link-btn" onClick={() => duplicate(p.id)}>Nhân bản</button>{" "}
                  {canDelete && <button className="link-btn" style={{ color: "#a02f22" }} onClick={() => remove(p.id)}>Xóa</button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="muted">Chưa có kế hoạch nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
