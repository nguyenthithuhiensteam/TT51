import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { annualPlansApi } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import StatusBadge from "../../components/StatusBadge";
import { PLAN_STATUS_LABELS, type AnnualPlanRecord, type PlanStatus } from "../../types";
import { ApiError } from "../../api/client";

export default function AnnualPlanListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AnnualPlanRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const canDelete = user?.role === "to_truong" || user?.role === "can_bo_quan_ly";

  function load() {
    annualPlansApi.list({ search, status }).then(setItems as any);
  }
  useEffect(load, [search, status]);

  async function duplicate(id: string) {
    await annualPlansApi.duplicate(id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Xóa kế hoạch giáo dục năm này? Hành động không thể hoàn tác.")) return;
    setError("");
    try {
      await annualPlansApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa.");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Kế hoạch giáo dục năm</h2>
        <div className="spacer" />
        <button className="primary" onClick={() => navigate("/annual-plans/new")}>+ Tạo kế hoạch năm</button>
      </div>
      {error && <div className="banner error">{error}</div>}
      <div className="card">
        <div className="row">
          <div className="field"><label>Tìm kiếm</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lớp, mã kế hoạch..." /></div>
          <div className="field">
            <label>Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(PLAN_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <table className="grid list-table">
          <thead><tr><th>Năm học</th><th>Lớp</th><th>Độ tuổi</th><th>Trạng thái</th><th>Phiên bản</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/annual-plans/${p.id}`}>{p.schoolYear}</Link></td>
                <td>{p.classGroup}</td>
                <td>{p.ageGroup}</td>
                <td><StatusBadge status={p.status as PlanStatus} /></td>
                <td>{p.version}</td>
                <td className="muted">{p.updatedAt}</td>
                <td>
                  <button className="link-btn" onClick={() => duplicate(p.id)}>Nhân bản</button>{" "}
                  {canDelete && <button className="link-btn" style={{ color: "#a02f22" }} onClick={() => remove(p.id)}>Xóa</button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="muted">Chưa có kế hoạch nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
