import { useEffect, useState } from "react";
import { objectivesApi } from "../api/resources";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AGE_GROUPS, DOMAIN_LABELS, DOMAIN_VALUES, type CurriculumObjective, type Domain } from "../types";

export default function ObjectiveBankPage() {
  const { user } = useAuth();
  const canManage = user?.role === "to_truong" || user?.role === "can_bo_quan_ly";
  const [items, setItems] = useState<CurriculumObjective[]>([]);
  const [ageGroup, setAgeGroup] = useState("");
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({ code: "", ageGroup: "5-6", domain: "the_chat" as Domain, statement: "", sourceRef: "" });
  const [creating, setCreating] = useState(false);

  function load() {
    objectivesApi.list({ ageGroup, domain, search }).then(setItems).catch((e) => setError(e instanceof ApiError ? e.message : "Không thể tải dữ liệu."));
  }
  useEffect(load, [ageGroup, domain, search]);

  async function createObjective() {
    if (!form.code || !form.statement) return;
    setCreating(true);
    setError("");
    try {
      await objectivesApi.create(form);
      setForm({ ...form, code: "", statement: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm mục tiêu.");
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Vô hiệu hóa mục tiêu này? Các kế hoạch đã dùng vẫn giữ nguyên nhưng sẽ không thể chọn lại.")) return;
    await objectivesApi.remove(id);
    load();
  }

  return (
    <div>
      <h2>Ngân hàng mục tiêu chương trình</h2>
      <p className="muted">Đây là nguồn dữ liệu mã mục tiêu và yêu cầu cần đạt duy nhất mà AI và giáo viên được phép sử dụng khi xây dựng kế hoạch. Không mã mục tiêu nào được tự tạo ngoài danh sách này.</p>
      {error && <div className="banner error">{error}</div>}

      <div className="card">
        <div className="row">
          <div className="field">
            <label>Độ tuổi</label>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              <option value="">Tất cả</option>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a} tuổi</option>)}
            </select>
          </div>
          <div className="field">
            <label>Lĩnh vực</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">Tất cả</option>
              {DOMAIN_VALUES.map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tìm kiếm</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã hoặc nội dung..." />
          </div>
        </div>
        <table className="grid">
          <thead>
            <tr><th>Mã</th><th>Độ tuổi</th><th>Lĩnh vực</th><th>Yêu cầu cần đạt</th><th>Nguồn</th>{canManage && <th></th>}</tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.code}</strong></td>
                <td>{o.age_group}</td>
                <td>{DOMAIN_LABELS[o.domain]}</td>
                <td>{o.statement}</td>
                <td className="muted">{o.source_ref}</td>
                {canManage && <td><button className="link-btn" onClick={() => deactivate(o.id)}>Vô hiệu hóa</button></td>}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="muted">Chưa có mục tiêu nào phù hợp bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Thêm mục tiêu mới</h3>
          <p className="hint">Chỉ nhập mã mục tiêu và yêu cầu cần đạt đúng theo Chương trình Giáo dục mầm non hiện hành của nhà trường/Bộ GD&ĐT. Không tạo mã tùy ý.</p>
          <div className="row">
            <div className="field" style={{ maxWidth: 120 }}>
              <label>Mã mục tiêu</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VD: MT1" />
            </div>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>Độ tuổi</label>
              <select value={form.ageGroup} onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{a} tuổi</option>)}
              </select>
            </div>
            <div className="field">
              <label>Lĩnh vực</label>
              <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value as Domain })}>
                {DOMAIN_VALUES.map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Yêu cầu cần đạt</label>
            <textarea value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} />
          </div>
          <div className="field">
            <label>Nguồn trích dẫn (tùy chọn)</label>
            <input value={form.sourceRef} onChange={(e) => setForm({ ...form, sourceRef: e.target.value })} placeholder="VD: Chương trình GDMN - TT51/2020" />
          </div>
          <button className="primary" disabled={creating} onClick={createObjective}>{creating ? "Đang thêm..." : "Thêm mục tiêu"}</button>
        </div>
      )}
    </div>
  );
}
