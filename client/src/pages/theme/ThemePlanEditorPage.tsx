import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { aiApi, annualPlansApi, themePlansApi } from "../../api/resources";
import { ApiError } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import AiFieldToolbar from "../../components/AiFieldToolbar";
import RestrictedObjectivePicker from "../../components/RestrictedObjectivePicker";
import VersionHistoryPanel from "../../components/VersionHistoryPanel";
import ExportBar from "../../components/ExportBar";
import StatusWorkflowBar from "../../components/StatusWorkflowBar";
import PlanQualityChecks from "../../components/PlanQualityChecks";
import { objectivesApi } from "../../api/resources";
import { AGE_GROUPS, DOMAIN_LABELS, DOMAIN_VALUES, WEEKDAYS, WEEKDAY_LABELS, type AnnualPlanContent, type AnnualPlanRecord, type DayLearningActivity, type Domain, type PlanStatus, type ThemePlanContent } from "../../types";

const EMPTY: ThemePlanContent = {
  themeName: "",
  branchTopics: [],
  startDate: "",
  endDate: "",
  weeksCount: 1,
  ageGroup: "5-6",
  classGroup: "",
  teacherNames: [],
  domains: { the_chat: [], tinh_cam_ky_nang_xa_hoi: [], ngon_ngu: [], nhan_thuc: [], tham_my: [] },
  routinesAndHabits: "",
  parentCoordination: [],
  weeklyLearningActivities: [],
  principalComment: "",
};

export default function ThemePlanEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { value: content, setValue: setContent, replaceWithoutHistory, undo, canUndo } = useHistory<ThemePlanContent>(EMPTY);
  const [status, setStatus] = useState<PlanStatus>("nhap");
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genController, setGenController] = useState<AbortController | null>(null);

  const [annualPlans, setAnnualPlans] = useState<AnnualPlanRecord[]>([]);
  const [annualPlanId, setAnnualPlanId] = useState("");
  const [annualContent, setAnnualContent] = useState<AnnualPlanContent | null>(null);

  useEffect(() => {
    annualPlansApi.list().then(setAnnualPlans as any);
  }, []);

  useEffect(() => {
    if (isNew) return;
    themePlansApi.get(id!).then((p) => {
      replaceWithoutHistory(p.content);
      setStatus(p.status);
      setVersion(p.version);
      setAnnualPlanId(p.annualPlanId);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!annualPlanId) { setAnnualContent(null); return; }
    annualPlansApi.get(annualPlanId).then((p) => setAnnualContent(p.content));
  }, [annualPlanId]);

  function update<K extends keyof ThemePlanContent>(key: K, value: ThemePlanContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function allowedIdsFor(domain: Domain): string[] {
    return annualContent ? annualContent.domainGoals[domain].map((g) => g.objectiveId).filter(Boolean) : [];
  }
  function allAllowedIds(): string[] {
    if (!annualContent) return [];
    return DOMAIN_VALUES.flatMap((d) => allowedIdsFor(d));
  }

  async function generateWithAi() {
    if (!annualContent) return alert("Vui lòng chọn Kế hoạch giáo dục năm làm cấp trên trước.");
    if (!content.themeName || !content.startDate || !content.endDate) return alert("Vui lòng nhập Tên chủ đề, ngày bắt đầu và ngày kết thúc trước khi tạo bằng AI.");
    if (generating) return;
    setGenerating(true);
    setError("");
    setWarnings([]);
    const controller = new AbortController();
    setGenController(controller);
    try {
      const res = await aiApi.generate<ThemePlanContent>(
        {
          planType: "theme",
          ageGroup: content.ageGroup,
          inputData: {
            themeName: content.themeName,
            branchTopics: content.branchTopics,
            startDate: content.startDate,
            endDate: content.endDate,
            weeksCount: content.weeksCount,
            ageGroup: content.ageGroup,
            classGroup: content.classGroup,
            teacherNames: content.teacherNames,
          },
          parentContext: { annualPlanDomainGoals: annualContent.domainGoals, educationContent: annualContent.educationContent },
        },
        controller.signal
      );
      setContent(() => ({ ...res.content, themeName: content.themeName, startDate: content.startDate, endDate: content.endDate, ageGroup: content.ageGroup, classGroup: content.classGroup, teacherNames: content.teacherNames }));
      setWarnings(res.warnings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo nội dung bằng AI.");
    } finally {
      setGenerating(false);
      setGenController(null);
    }
  }

  async function save(confirm = false) {
    if (!annualPlanId) return setError("Vui lòng chọn Kế hoạch giáo dục năm làm cấp trên.");
    setSaving(true);
    setError("");
    setSaveMsg("");
    try {
      if (isNew) {
        const res = await themePlansApi.create({ annualPlanId, content });
        navigate(`/theme-plans/${res.id}`, { replace: true });
        setSaveMsg("Đã lưu kế hoạch (bản nháp).");
      } else {
        const res = await themePlansApi.update(id!, content, { confirm });
        setStatus(res.status);
        setVersion(res.version);
        setWarnings(res.warnings);
        setSaveMsg("Đã lưu thay đổi.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "approved_edit_requires_confirm") {
        if (window.confirm(err.message)) return save(true);
        return;
      }
      setError(err instanceof ApiError ? [err.message, ...(err.issues || [])].join(" ") : "Không thể lưu kế hoạch.");
    } finally {
      setSaving(false);
    }
  }

  function addDomainRow(domain: Domain) {
    const rows = content.domains[domain];
    update("domains", { ...content.domains, [domain]: [...rows, { stt: rows.length + 1, objectiveId: "", content: "", activity: "" }] });
  }
  function updateDomainRow(domain: Domain, idx: number, patch: Partial<ThemePlanContent["domains"]["the_chat"][number]>) {
    update("domains", { ...content.domains, [domain]: content.domains[domain].map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }
  function removeDomainRow(domain: Domain, idx: number) {
    update("domains", { ...content.domains, [domain]: content.domains[domain].filter((_, i) => i !== idx).map((r, i) => ({ ...r, stt: i + 1 })) });
  }

  function addParentRow() {
    update("parentCoordination", [...content.parentCoordination, { weekOrTime: "", content: "" }]);
  }
  function updateParentRow(idx: number, patch: Partial<{ weekOrTime: string; content: string }>) {
    update("parentCoordination", content.parentCoordination.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeParentRow(idx: number) {
    update("parentCoordination", content.parentCoordination.filter((_, i) => i !== idx));
  }

  function addWeekRow() {
    update("weeklyLearningActivities", [
      ...content.weeklyLearningActivities,
      { weekNumber: content.weeklyLearningActivities.length + 1, weekLabel: `Tuần ${content.weeklyLearningActivities.length + 1}`, days: { mon: null, tue: null, wed: null, thu: null, fri: null } },
    ]);
  }
  function updateWeekDay(weekIdx: number, day: (typeof WEEKDAYS)[number], value: DayLearningActivity | null) {
    update(
      "weeklyLearningActivities",
      content.weeklyLearningActivities.map((w, i) => (i === weekIdx ? { ...w, days: { ...w.days, [day]: value } } : w))
    );
  }
  function removeWeekRow(idx: number) {
    update("weeklyLearningActivities", content.weeklyLearningActivities.filter((_, i) => i !== idx));
  }

  async function computeUnused(): Promise<string[]> {
    if (!annualContent) return [];
    const allowed = allAllowedIds();
    const bank = await objectivesApi.list({ ageGroup: content.ageGroup });
    const used = new Set<string>();
    DOMAIN_VALUES.forEach((d) => content.domains[d].forEach((r) => r.objectiveId && used.add(r.objectiveId)));
    content.weeklyLearningActivities.forEach((w) => WEEKDAYS.forEach((d) => w.days[d]?.objectiveId && used.add(w.days[d]!.objectiveId)));
    const unused = bank.filter((o) => allowed.includes(o.id) && !used.has(o.id));
    return unused.length ? [`Có ${unused.length} mục tiêu đã chọn ở kế hoạch năm nhưng chưa dùng trong chủ đề này: ${unused.map((o) => o.code).join(", ")}`] : [];
  }
  function computeDuplicates(): string[] {
    const counts = new Map<string, number>();
    DOMAIN_VALUES.forEach((d) => content.domains[d].forEach((r) => r.objectiveId && counts.set(r.objectiveId, (counts.get(r.objectiveId) || 0) + 1)));
    const dup = Array.from(counts.entries()).filter(([, c]) => c > 2);
    return dup.length ? [`Mục tiêu bị lặp nhiều lần trong bảng lĩnh vực: ${dup.map(([id, c]) => `${id} (${c} lần)`).join(", ")}`] : [];
  }

  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{isNew ? "Tạo kế hoạch chủ đề/tháng" : `Chủ đề: ${content.themeName}`}</h2>
        <div className="spacer" />
        {!isNew && <StatusWorkflowBar api={themePlansApi} planId={id!} status={status} onChanged={setStatus} />}
      </div>
      {error && <div className="banner error">{error}</div>}
      {warnings.map((w, i) => <div key={i} className="banner warn">{w}</div>)}
      {saveMsg && <div className="banner success">{saveMsg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Thông tin chủ đề</h3>
        <div className="field">
          <label>Kế hoạch giáo dục năm (cấp trên)</label>
          <select value={annualPlanId} onChange={(e) => setAnnualPlanId(e.target.value)} disabled={!isNew}>
            <option value="">-- Chọn kế hoạch năm --</option>
            {annualPlans.map((a) => <option key={a.id} value={a.id}>{a.schoolYear} - {a.classGroup}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field"><label>Tên chủ đề</label><input value={content.themeName} onChange={(e) => update("themeName", e.target.value)} /></div>
          <div className="field"><label>Chủ đề nhánh (cách nhau bởi dấu phẩy)</label><input value={content.branchTopics.join(", ")} onChange={(e) => update("branchTopics", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Từ ngày</label><input value={content.startDate} onChange={(e) => update("startDate", e.target.value)} placeholder="dd/mm/yyyy" /></div>
          <div className="field"><label>Đến ngày</label><input value={content.endDate} onChange={(e) => update("endDate", e.target.value)} placeholder="dd/mm/yyyy" /></div>
          <div className="field" style={{ maxWidth: 100 }}><label>Số tuần</label><input type="number" value={content.weeksCount} onChange={(e) => update("weeksCount", Number(e.target.value))} /></div>
          <div className="field">
            <label>Độ tuổi</label>
            <select value={content.ageGroup} onChange={(e) => update("ageGroup", e.target.value as any)}>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a} tuổi</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Lớp</label><input value={content.classGroup} onChange={(e) => update("classGroup", e.target.value)} /></div>
          <div className="field"><label>Giáo viên thực hiện</label><input value={content.teacherNames.join(", ")} onChange={(e) => update("teacherNames", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
        </div>
        <div className="toolbar">
          <button className="primary" disabled={generating || !annualContent} onClick={generateWithAi}>{generating ? "Đang tạo nội dung..." : "Tạo kế hoạch bằng AI"}</button>
          {generating && <button onClick={() => genController?.abort()}>Hủy yêu cầu</button>}
          <button disabled={!canUndo} onClick={undo}>Hoàn tác</button>
        </div>
        {!annualContent && <p className="hint">Chọn kế hoạch năm để có thể kế thừa mục tiêu và tạo bằng AI.</p>}
      </div>

      {DOMAIN_VALUES.map((domain) => (
        <div className="card" key={domain}>
          <h3 style={{ marginTop: 0 }}>{DOMAIN_LABELS[domain]}</h3>
          <table className="grid">
            <thead><tr><th style={{ width: 40 }}>STT</th><th style={{ width: "25%" }}>Mục tiêu</th><th>Nội dung</th><th>Hoạt động</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {content.domains[domain].map((row, idx) => (
                <tr key={idx}>
                  <td>{row.stt}</td>
                  <td><RestrictedObjectivePicker ageGroup={content.ageGroup} domain={domain} allowedIds={allowedIdsFor(domain)} value={row.objectiveId} onChange={(v) => updateDomainRow(domain, idx, { objectiveId: v })} /></td>
                  <td>
                    <textarea value={row.content} onChange={(e) => updateDomainRow(domain, idx, { content: e.target.value })} />
                    <AiFieldToolbar planType="theme" ageGroup={content.ageGroup} sectionPath={`domains.${domain}[${idx}].content`} value={row.content} fullPlanContext={content} onApply={(v) => updateDomainRow(domain, idx, { content: v })} />
                  </td>
                  <td>
                    <textarea value={row.activity} onChange={(e) => updateDomainRow(domain, idx, { activity: e.target.value })} />
                    <AiFieldToolbar planType="theme" ageGroup={content.ageGroup} sectionPath={`domains.${domain}[${idx}].activity`} value={row.activity} fullPlanContext={content} onApply={(v) => updateDomainRow(domain, idx, { activity: v })} />
                  </td>
                  <td><button className="link-btn" onClick={() => removeDomainRow(domain, idx)}>Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => addDomainRow(domain)} style={{ marginTop: 4 }}>+ Thêm dòng</button>
        </div>
      ))}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Rèn nền nếp, thói quen</h3>
        <textarea value={content.routinesAndHabits} onChange={(e) => update("routinesAndHabits", e.target.value)} />
        <AiFieldToolbar planType="theme" ageGroup={content.ageGroup} sectionPath="routinesAndHabits" value={content.routinesAndHabits} fullPlanContext={content} onApply={(v) => update("routinesAndHabits", v)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Nội dung phối hợp với phụ huynh</h3>
        <table className="grid">
          <thead><tr><th>Tuần/chủ đề nhánh/thời gian</th><th>Nội dung</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {content.parentCoordination.map((row, idx) => (
              <tr key={idx}>
                <td><input value={row.weekOrTime} onChange={(e) => updateParentRow(idx, { weekOrTime: e.target.value })} /></td>
                <td><textarea value={row.content} onChange={(e) => updateParentRow(idx, { content: e.target.value })} /></td>
                <td><button className="link-btn" onClick={() => removeParentRow(idx)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addParentRow} style={{ marginTop: 4 }}>+ Thêm dòng</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Hoạt động học của chủ đề</h3>
        <table className="grid">
          <thead><tr><th>Thời gian</th>{WEEKDAYS.map((d) => <th key={d}>{WEEKDAY_LABELS[d]}</th>)}<th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {content.weeklyLearningActivities.map((w, wi) => (
              <tr key={wi}>
                <td><input value={w.weekLabel} onChange={(e) => update("weeklyLearningActivities", content.weeklyLearningActivities.map((x, i) => (i === wi ? { ...x, weekLabel: e.target.value } : x)))} /></td>
                {WEEKDAYS.map((d) => (
                  <td key={d}>
                    <DayActivityEditor ageGroup={content.ageGroup} allAllowedIds={allAllowedIds()} value={w.days[d]} onChange={(v) => updateWeekDay(wi, d, v)} />
                  </td>
                ))}
                <td><button className="link-btn" onClick={() => removeWeekRow(wi)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addWeekRow} style={{ marginTop: 4 }}>+ Thêm tuần</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Nhận xét của Ban giám hiệu</h3>
        <textarea value={content.principalComment} onChange={(e) => update("principalComment", e.target.value)} placeholder="Dành cho Ban giám hiệu nhận xét, ký duyệt" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kiểm tra chất lượng kế hoạch</h3>
        <PlanQualityChecks planType="theme" content={content} computeDuplicates={computeDuplicates} computeUnused={computeUnused} />
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="primary" disabled={saving} onClick={() => save(false)}>{saving ? "Đang lưu..." : "Lưu kế hoạch"}</button>
          {!isNew && <VersionHistoryPanel api={themePlansApi} planId={id!} onRestored={() => window.location.reload()} />}
        </div>
        {!isNew && (
          <div style={{ marginTop: 10 }}>
            <ExportBar docxUrl={themePlansApi.exportDocxUrl(id!)} pdfUrl={themePlansApi.exportPdfUrl(id!)} />
          </div>
        )}
      </div>
    </div>
  );
}

function DayActivityEditor({ ageGroup, allAllowedIds, value, onChange }: { ageGroup: any; allAllowedIds: string[]; value: DayLearningActivity | null; onChange: (v: DayLearningActivity | null) => void }) {
  if (!value) {
    return <button type="button" onClick={() => onChange({ domain: "the_chat", activityType: "", activityName: "", objectiveId: "" })}>+ Thêm hoạt động</button>;
  }
  return (
    <div>
      <select value={value.domain} onChange={(e) => onChange({ ...value, domain: e.target.value as Domain })}>
        {DOMAIN_VALUES.map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
      </select>
      <input placeholder="Loại hoạt động" value={value.activityType} onChange={(e) => onChange({ ...value, activityType: e.target.value })} style={{ marginTop: 4 }} />
      <input placeholder="Tên hoạt động" value={value.activityName} onChange={(e) => onChange({ ...value, activityName: e.target.value })} style={{ marginTop: 4 }} />
      <div style={{ marginTop: 4 }}>
        <RestrictedObjectivePicker ageGroup={ageGroup} allowedIds={allAllowedIds} value={value.objectiveId} onChange={(v) => onChange({ ...value, objectiveId: v })} />
      </div>
      <button type="button" className="link-btn" onClick={() => onChange(null)}>Xóa hoạt động</button>
    </div>
  );
}
