import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { annualPlansApi, themePlansApi } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import StatusBadge from "../../components/StatusBadge";
import { PLAN_STATUS_LABELS, type AnnualPlanRecord, type PlanStatus, type ThemePlanRecord } from "../../types";
import { ApiError } from "../../api/client";

export default function ThemePlanListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ThemePlanRecord[]>([]);
  const [annualPlans, setAnnualPlans] = useState<AnnualPlanRecord[]>([]);
  const [annualPlanId, setAnnualPlanId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const canDelete = user?.role === "to_truong" || user?.role === "can_bo_quan_ly";

  useEffect(() => { annualPlansApi.list().then(setAnnualPlans as any); }, []);
  function load() {
    themePlansApi.list({ annualPlanId, search, status }).then(setItems as any);
  }
  useEffect(load, [annualPlanId, search, status]);

  async function duplicate(id: string) {
    await themePlansApi.duplicate(id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Xóa kế hoạch chủ đề này? Hành động không thể hoàn tác.")) return;
    setError("");
    try {
      await themePlansApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa.");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Kế hoạch chủ đề/tháng</h2>
        <div className="spacer" />
        <button className="primary" disabled={annualPlans.length === 0} onClick={() => navigate("/theme-plans/new")}>+ Tạo kế hoạch chủ đề</button>
      </div>
      {annualPlans.length === 0 && <div className="banner warn">Cần tạo Kế hoạch giáo dục năm trước khi tạo kế hoạch chủ đề (kế hoạch chủ đề phải kế thừa dữ liệu từ kế hoạch năm).</div>}
      {error && <div className="banner error">{error}</div>}
      <div className="card">
        <div className="row">
          <div className="field">
            <label>Kế hoạch năm</label>
            <select value={annualPlanId} onChange={(e) => setAnnualPlanId(e.target.value)}>
              <option value="">Tất cả</option>
              {annualPlans.map((a) => <option key={a.id} value={a.id}>{a.schoolYear} - {a.classGroup}</option>)}
            </select>
          </div>
          <div className="field"><label>Tìm kiếm</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên chủ đề..." /></div>
          <div className="field">
            <label>Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(PLAN_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <table className="grid list-table">
          <thead><tr><th>Chủ đề</th><th>Trạng thái</th><th>Phiên bản</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/theme-plans/${p.id}`}>{p.themeName}</Link></td>
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
