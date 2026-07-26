import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { aiApi, annualPlansApi, objectivesApi } from "../../api/resources";
import { ApiError } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import AiFieldToolbar from "../../components/AiFieldToolbar";
import ObjectivePicker from "../../components/ObjectivePicker";
import VersionHistoryPanel from "../../components/VersionHistoryPanel";
import ExportBar from "../../components/ExportBar";
import StatusWorkflowBar from "../../components/StatusWorkflowBar";
import PlanQualityChecks from "../../components/PlanQualityChecks";
import { AGE_GROUPS, DOMAIN_LABELS, DOMAIN_VALUES, type AnnualPlanContent, type Domain, type PlanStatus } from "../../types";

const EMPTY: AnnualPlanContent = {
  schoolName: "",
  schoolYear: "",
  classGroup: "",
  ageGroup: "5-6",
  teacherNames: [],
  childCount: 0,
  classCharacteristics: "",
  program: "Chương trình Giáo dục mầm non",
  advantages: "",
  difficulties: "",
  domainGoals: { the_chat: [], tinh_cam_ky_nang_xa_hoi: [], ngon_ngu: [], nhan_thuc: [], tham_my: [] },
  educationContent: "",
  themesOverview: [],
  eventsAndIntegration: "",
  parentCoordination: "",
  facilityConditions: "",
  monitoringAdjustment: "",
};

const INTEGRATION_OPTIONS = ["STEAM", "SEL - Giáo dục cảm xúc xã hội", "Giáo dục công dân số", "Kỹ năng sống", "Bảo vệ môi trường", "Giáo dục địa phương"];

export default function AnnualPlanEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { value: content, setValue: setContent, replaceWithoutHistory, undo, canUndo } = useHistory<AnnualPlanContent>(EMPTY);
  const [status, setStatus] = useState<PlanStatus>("nhap");
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genController, setGenController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (isNew) return;
    annualPlansApi.get(id!).then((p) => {
      replaceWithoutHistory(p.content);
      setStatus(p.status);
      setVersion(p.version);
      setLoading(false);
    });
  }, [id]);

  function update<K extends keyof AnnualPlanContent>(key: K, value: AnnualPlanContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  async function generateWithAi() {
    if (!content.schoolName || !content.schoolYear || !content.classGroup) {
      alert("Vui lòng nhập Tên trường, Năm học và Lớp trước khi tạo bằng AI.");
      return;
    }
    if (generating) return;
    setGenerating(true);
    setError("");
    setWarnings([]);
    const controller = new AbortController();
    setGenController(controller);
    try {
      const res = await aiApi.generate<AnnualPlanContent>(
        {
          planType: "annual",
          ageGroup: content.ageGroup,
          inputData: {
            schoolName: content.schoolName,
            schoolYear: content.schoolYear,
            classGroup: content.classGroup,
            ageGroup: content.ageGroup,
            teacherNames: content.teacherNames,
            childCount: content.childCount,
            classCharacteristics: content.classCharacteristics,
            advantages: content.advantages,
            difficulties: content.difficulties,
            program: content.program,
            teacherNotes: notes,
          },
          integrations,
        },
        controller.signal
      );
      setContent(() => ({ ...res.content, schoolName: content.schoolName, schoolYear: content.schoolYear, classGroup: content.classGroup, ageGroup: content.ageGroup, teacherNames: content.teacherNames, childCount: content.childCount }));
      setWarnings(res.warnings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo nội dung bằng AI.");
    } finally {
      setGenerating(false);
      setGenController(null);
    }
  }

  async function save(confirm = false) {
    setSaving(true);
    setError("");
    setSaveMsg("");
    try {
      if (isNew) {
        const res = await annualPlansApi.create({ content });
        navigate(`/annual-plans/${res.id}`, { replace: true });
        setSaveMsg("Đã lưu kế hoạch (bản nháp).");
      } else {
        const res = await annualPlansApi.update(id!, content, { confirm });
        setStatus(res.status);
        setVersion(res.version);
        setWarnings(res.warnings);
        setSaveMsg("Đã lưu thay đổi.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "approved_edit_requires_confirm") {
        if (confirm2(err.message)) return save(true);
        return;
      }
      setError(err instanceof ApiError ? [err.message, ...(err.issues || [])].join(" ") : "Không thể lưu kế hoạch.");
    } finally {
      setSaving(false);
    }
  }
  function confirm2(msg: string) {
    return window.confirm(msg);
  }

  function addDomainGoal(domain: Domain) {
    update("domainGoals", { ...content.domainGoals, [domain]: [...content.domainGoals[domain], { objectiveId: "", note: "" }] });
  }
  function updateDomainGoal(domain: Domain, idx: number, patch: Partial<{ objectiveId: string; note: string }>) {
    const arr = content.domainGoals[domain].map((g, i) => (i === idx ? { ...g, ...patch } : g));
    update("domainGoals", { ...content.domainGoals, [domain]: arr });
  }
  function removeDomainGoal(domain: Domain, idx: number) {
    update("domainGoals", { ...content.domainGoals, [domain]: content.domainGoals[domain].filter((_, i) => i !== idx) });
  }

  function addTheme() {
    update("themesOverview", [...content.themesOverview, { monthOrTime: "", themeName: "", weeksCount: 1, focusObjectiveIds: [], mainContent: "", events: "", note: "" }]);
  }
  function updateTheme(idx: number, patch: Partial<AnnualPlanContent["themesOverview"][number]>) {
    update("themesOverview", content.themesOverview.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeTheme(idx: number) {
    update("themesOverview", content.themesOverview.filter((_, i) => i !== idx));
  }

  async function computeUnused(): Promise<string[]> {
    const bank = await objectivesApi.list({ ageGroup: content.ageGroup });
    const used = new Set<string>();
    (Object.keys(content.domainGoals) as Domain[]).forEach((d) => content.domainGoals[d].forEach((g) => g.objectiveId && used.add(g.objectiveId)));
    const unused = bank.filter((o) => !used.has(o.id));
    return unused.length ? [`Có ${unused.length} mục tiêu trong ngân hàng (độ tuổi ${content.ageGroup}) chưa được phân bổ: ${unused.map((o) => o.code).join(", ")}`] : [];
  }
  function computeDuplicates(): string[] {
    const counts = new Map<string, number>();
    content.themesOverview.forEach((t) => t.focusObjectiveIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    const dup = Array.from(counts.entries()).filter(([, c]) => c > 3);
    return dup.length ? [`Một số mục tiêu xuất hiện lặp lại nhiều lần trong các chủ đề (>3 lần): ${dup.map(([id, c]) => `${id} (${c} lần)`).join(", ")}`] : [];
  }

  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{isNew ? "Tạo kế hoạch giáo dục năm" : `Kế hoạch giáo dục năm ${content.schoolYear}`}</h2>
        <div className="spacer" />
        {!isNew && <StatusWorkflowBar api={annualPlansApi} planId={id!} status={status} onChanged={setStatus} />}
      </div>
      {error && <div className="banner error">{error}</div>}
      {warnings.map((w, i) => <div key={i} className="banner warn">{w}</div>)}
      {saveMsg && <div className="banner success">{saveMsg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>I. Thông tin chung</h3>
        <div className="row">
          <div className="field"><label>Tên trường</label><input value={content.schoolName} onChange={(e) => update("schoolName", e.target.value)} /></div>
          <div className="field"><label>Năm học</label><input value={content.schoolYear} onChange={(e) => update("schoolYear", e.target.value)} placeholder="2025-2026" /></div>
          <div className="field"><label>Lớp</label><input value={content.classGroup} onChange={(e) => update("classGroup", e.target.value)} placeholder="5-6 tuổi A" /></div>
          <div className="field">
            <label>Độ tuổi</label>
            <select value={content.ageGroup} onChange={(e) => update("ageGroup", e.target.value as any)}>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a} tuổi</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Giáo viên thực hiện (cách nhau bởi dấu phẩy)</label><input value={content.teacherNames.join(", ")} onChange={(e) => update("teacherNames", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
          <div className="field" style={{ maxWidth: 140 }}><label>Số lượng trẻ</label><input type="number" value={content.childCount} onChange={(e) => update("childCount", Number(e.target.value))} /></div>
          <div className="field"><label>Chương trình áp dụng</label><input value={content.program} onChange={(e) => update("program", e.target.value)} /></div>
        </div>
        <div className="field"><label>Đặc điểm tình hình nhóm/lớp</label><textarea value={content.classCharacteristics} onChange={(e) => update("classCharacteristics", e.target.value)} /></div>
        <div className="row">
          <div className="field"><label>Thuận lợi</label><textarea value={content.advantages} onChange={(e) => update("advantages", e.target.value)} /></div>
          <div className="field"><label>Khó khăn</label><textarea value={content.difficulties} onChange={(e) => update("difficulties", e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Định hướng tích hợp</label>
          <div className="row">
            {INTEGRATION_OPTIONS.map((opt) => (
              <label key={opt} style={{ fontWeight: 400, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={integrations.includes(opt)} onChange={(e) => setIntegrations(e.target.checked ? [...integrations, opt] : integrations.filter((i) => i !== opt))} />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div className="field"><label>Ghi chú riêng của giáo viên (dùng khi tạo bằng AI)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="toolbar">
          <button className="primary" disabled={generating} onClick={generateWithAi}>{generating ? "Đang tạo nội dung..." : "Tạo kế hoạch bằng AI"}</button>
          {generating && <button onClick={() => genController?.abort()}>Hủy yêu cầu</button>}
          <button disabled={!canUndo} onClick={undo}>Hoàn tác</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>IV. Mục tiêu và yêu cầu cần đạt theo lĩnh vực</h3>
        {DOMAIN_VALUES.map((domain) => (
          <div key={domain} style={{ marginBottom: 14 }}>
            <strong>{DOMAIN_LABELS[domain]}</strong>
            <table className="grid" style={{ marginTop: 6 }}>
              <thead><tr><th style={{ width: "40%" }}>Mục tiêu</th><th>Ghi chú</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {content.domainGoals[domain].map((g, idx) => (
                  <tr key={idx}>
                    <td><ObjectivePicker ageGroup={content.ageGroup} domain={domain} value={g.objectiveId} onChange={(v) => updateDomainGoal(domain, idx, { objectiveId: v })} /></td>
                    <td><input value={g.note || ""} onChange={(e) => updateDomainGoal(domain, idx, { note: e.target.value })} /></td>
                    <td><button className="link-btn" onClick={() => removeDomainGoal(domain, idx)}>Xóa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => addDomainGoal(domain)} style={{ marginTop: 4 }}>+ Thêm mục tiêu</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>V. Nội dung giáo dục</h3>
        <textarea value={content.educationContent} onChange={(e) => update("educationContent", e.target.value)} style={{ minHeight: 100 }} />
        <AiFieldToolbar planType="annual" ageGroup={content.ageGroup} sectionPath="educationContent" value={content.educationContent} fullPlanContext={content} onApply={(v) => update("educationContent", v)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>VI. Dự kiến chủ đề/tháng</h3>
        <table className="grid">
          <thead><tr><th>Tháng/thời gian</th><th>Chủ đề</th><th>Số tuần</th><th>Mục tiêu trọng tâm</th><th>Nội dung chính</th><th>Sự kiện</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {content.themesOverview.map((t, idx) => (
              <tr key={idx}>
                <td><input value={t.monthOrTime} onChange={(e) => updateTheme(idx, { monthOrTime: e.target.value })} /></td>
                <td><input value={t.themeName} onChange={(e) => updateTheme(idx, { themeName: e.target.value })} /></td>
                <td style={{ width: 60 }}><input type="number" value={t.weeksCount} onChange={(e) => updateTheme(idx, { weeksCount: Number(e.target.value) })} /></td>
                <td>
                  <select multiple value={t.focusObjectiveIds} onChange={(e) => updateTheme(idx, { focusObjectiveIds: Array.from(e.target.selectedOptions).map((o) => o.value) })} style={{ minHeight: 60 }}>
                    <ObjectiveOptions ageGroup={content.ageGroup} />
                  </select>
                </td>
                <td><textarea value={t.mainContent} onChange={(e) => updateTheme(idx, { mainContent: e.target.value })} /></td>
                <td><textarea value={t.events} onChange={(e) => updateTheme(idx, { events: e.target.value })} /></td>
                <td><input value={t.note} onChange={(e) => updateTheme(idx, { note: e.target.value })} /></td>
                <td><button className="link-btn" onClick={() => removeTheme(idx)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addTheme} style={{ marginTop: 4 }}>+ Thêm chủ đề</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>VII-X. Tích hợp, phối hợp, điều kiện, theo dõi & điều chỉnh</h3>
        <div className="field"><label>Định hướng tích hợp và sự kiện</label><textarea value={content.eventsAndIntegration} onChange={(e) => update("eventsAndIntegration", e.target.value)} /><AiFieldToolbar planType="annual" ageGroup={content.ageGroup} sectionPath="eventsAndIntegration" value={content.eventsAndIntegration} fullPlanContext={content} onApply={(v) => update("eventsAndIntegration", v)} /></div>
        <div className="field"><label>Phối hợp với cha mẹ trẻ và cộng đồng</label><textarea value={content.parentCoordination} onChange={(e) => update("parentCoordination", e.target.value)} /><AiFieldToolbar planType="annual" ageGroup={content.ageGroup} sectionPath="parentCoordination" value={content.parentCoordination} fullPlanContext={content} onApply={(v) => update("parentCoordination", v)} /></div>
        <div className="field"><label>Điều kiện thực hiện</label><textarea value={content.facilityConditions} onChange={(e) => update("facilityConditions", e.target.value)} /></div>
        <div className="field"><label>Theo dõi, đánh giá và điều chỉnh</label><textarea value={content.monitoringAdjustment} onChange={(e) => update("monitoringAdjustment", e.target.value)} /></div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kiểm tra chất lượng kế hoạch</h3>
        <PlanQualityChecks planType="annual" content={content} computeDuplicates={computeDuplicates} computeUnused={computeUnused} />
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="primary" disabled={saving} onClick={() => save(false)}>{saving ? "Đang lưu..." : "Lưu kế hoạch"}</button>
          {!isNew && <VersionHistoryPanel api={annualPlansApi} planId={id!} onRestored={() => window.location.reload()} />}
        </div>
        {!isNew && (
          <div style={{ marginTop: 10 }}>
            <ExportBar docxUrl={annualPlansApi.exportDocxUrl(id!)} pdfUrl={annualPlansApi.exportPdfUrl(id!)} />
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectiveOptions({ ageGroup }: { ageGroup: string }) {
  const [items, setItems] = useState<{ id: string; code: string; statement: string }[]>([]);
  useEffect(() => { objectivesApi.list({ ageGroup }).then(setItems); }, [ageGroup]);
  return (
    <>
      {items.map((o) => (
        <option key={o.id} value={o.id}>{o.code} - {o.statement.slice(0, 40)}</option>
      ))}
    </>
  );
}
