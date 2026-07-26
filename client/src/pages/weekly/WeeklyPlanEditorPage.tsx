import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { aiApi, lessonPlansApi, themePlansApi, weeklyPlansApi } from "../../api/resources";
import { ApiError } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import AiFieldToolbar from "../../components/AiFieldToolbar";
import RestrictedObjectivePicker from "../../components/RestrictedObjectivePicker";
import VersionHistoryPanel from "../../components/VersionHistoryPanel";
import ExportBar from "../../components/ExportBar";
import StatusWorkflowBar from "../../components/StatusWorkflowBar";
import PlanQualityChecks from "../../components/PlanQualityChecks";
import { AGE_GROUPS, DOMAIN_LABELS, DOMAIN_VALUES, WEEKDAYS, WEEKDAY_LABELS, type CornerActivity, type Domain, type LessonPlanRecord, type PlanStatus, type ThemePlanContent, type ThemePlanRecord, type WeeklyPlanContent } from "../../types";

const EMPTY_OUTDOOR = { purposeActivity: "", requirement: "", preparation: "", method: "", game: "", freePlay: "", safetyMeasures: "" };
const EMPTY: WeeklyPlanContent = {
  weekNumber: 1,
  themeName: "",
  branchTopic: "",
  startDate: "",
  endDate: "",
  teacherNames: [],
  classGroup: "",
  ageGroup: "5-6",
  dayDates: { mon: "", tue: "", wed: "", thu: "", fri: "" },
  welcomeAndMorningExercise: "",
  weeklyOpeningTalk: "",
  learningActivities: { mon: null, tue: null, wed: null, thu: null, fri: null },
  cornerActivities: [],
  outdoorActivities: { mon: { ...EMPTY_OUTDOOR }, tue: { ...EMPTY_OUTDOOR }, wed: { ...EMPTY_OUTDOOR }, thu: { ...EMPTY_OUTDOOR }, fri: { ...EMPTY_OUTDOOR } },
  mealsAndSleep: "",
  afternoonActivities: { mon: "", tue: "", wed: "", thu: "", fri: "" },
  pickup: { mon: "", tue: "", wed: "", thu: "", fri: "" },
  parentCoordination: "",
};

export default function WeeklyPlanEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { value: content, setValue: setContent, replaceWithoutHistory, undo, canUndo } = useHistory<WeeklyPlanContent>(EMPTY);
  const [status, setStatus] = useState<PlanStatus>("nhap");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genController, setGenController] = useState<AbortController | null>(null);

  const [themePlans, setThemePlans] = useState<ThemePlanRecord[]>([]);
  const [themePlanId, setThemePlanId] = useState("");
  const [themeContent, setThemeContent] = useState<ThemePlanContent | null>(null);

  const [lessons, setLessons] = useState<LessonPlanRecord[]>([]);
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { themePlansApi.list().then(setThemePlans as any); }, []);

  useEffect(() => {
    if (isNew) return;
    weeklyPlansApi.get(id!).then((p) => {
      replaceWithoutHistory(p.content);
      setStatus(p.status);
      setThemePlanId(p.themePlanId);
      setLoading(false);
    });
    lessonPlansApi.list({ weeklyPlanId: id }).then(setLessons as any);
  }, [id]);

  useEffect(() => {
    if (!themePlanId) { setThemeContent(null); return; }
    themePlansApi.get(themePlanId).then((t) => setThemeContent(t.content));
  }, [themePlanId]);

  function update<K extends keyof WeeklyPlanContent>(key: K, value: WeeklyPlanContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function allowedIds(): string[] {
    if (!themeContent) return [];
    const ids = new Set<string>();
    DOMAIN_VALUES.forEach((d) => themeContent.domains[d].forEach((r) => r.objectiveId && ids.add(r.objectiveId)));
    themeContent.weeklyLearningActivities.forEach((w) => WEEKDAYS.forEach((d) => w.days[d]?.objectiveId && ids.add(w.days[d]!.objectiveId)));
    return Array.from(ids);
  }

  async function generateWithAi() {
    if (!themeContent) return alert("Vui lòng chọn Kế hoạch chủ đề làm cấp trên trước.");
    if (!content.startDate || !content.endDate || !content.branchTopic) return alert("Vui lòng nhập chủ đề nhánh và thời gian thực hiện trước khi tạo bằng AI.");
    if (generating) return;
    setGenerating(true);
    setError("");
    setWarnings([]);
    const controller = new AbortController();
    setGenController(controller);
    try {
      const res = await aiApi.generate<WeeklyPlanContent>(
        {
          planType: "weekly",
          ageGroup: content.ageGroup,
          inputData: {
            weekNumber: content.weekNumber,
            branchTopic: content.branchTopic,
            startDate: content.startDate,
            endDate: content.endDate,
            classGroup: content.classGroup,
            ageGroup: content.ageGroup,
            teacherNames: content.teacherNames,
          },
          parentContext: { themeName: themeContent.themeName, domains: themeContent.domains, weeklyLearningActivities: themeContent.weeklyLearningActivities, routinesAndHabits: themeContent.routinesAndHabits },
        },
        controller.signal
      );
      setContent(() => ({
        ...res.content,
        weekNumber: content.weekNumber,
        themeName: themeContent.themeName,
        branchTopic: content.branchTopic,
        startDate: content.startDate,
        endDate: content.endDate,
        classGroup: content.classGroup,
        ageGroup: content.ageGroup,
        teacherNames: content.teacherNames,
      }));
      setWarnings(res.warnings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo nội dung bằng AI.");
    } finally {
      setGenerating(false);
      setGenController(null);
    }
  }

  async function save(confirm = false) {
    if (!themePlanId) return setError("Vui lòng chọn Kế hoạch chủ đề làm cấp trên.");
    setSaving(true);
    setError("");
    setSaveMsg("");
    try {
      if (isNew) {
        const res = await weeklyPlansApi.create({ themePlanId, content: { ...content, themeName: themeContent?.themeName || content.themeName } });
        navigate(`/weekly-plans/${res.id}`, { replace: true });
        setSaveMsg("Đã lưu kế hoạch (bản nháp).");
      } else {
        const res = await weeklyPlansApi.update(id!, content, { confirm });
        setStatus(res.status);
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

  async function bulkCreateLessons() {
    if (!id) return;
    setBulkBusy(true);
    setBulkMsg("");
    try {
      const res = await lessonPlansApi.bulkCreateFromWeekly(id);
      setBulkMsg(`Đã tạo ${res.createdIds.length} giáo án.${res.skipped.length ? " Bỏ qua: " + res.skipped.join(" ") : ""}`);
      lessonPlansApi.list({ weeklyPlanId: id }).then(setLessons as any);
    } catch (err) {
      setBulkMsg(err instanceof ApiError ? err.message : "Không thể tạo giáo án.");
    } finally {
      setBulkBusy(false);
    }
  }

  function addCorner() {
    update("cornerActivities", [...content.cornerActivities, { cornerName: "", preparation: "", skillsAndProcess: "" }]);
  }
  function updateCorner(idx: number, patch: Partial<CornerActivity>) {
    update("cornerActivities", content.cornerActivities.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeCorner(idx: number) {
    update("cornerActivities", content.cornerActivities.filter((_, i) => i !== idx));
  }

  function computeDuplicates(): string[] {
    const counts = new Map<string, number>();
    WEEKDAYS.forEach((d) => {
      const id2 = content.learningActivities[d]?.objectiveId;
      if (id2) counts.set(id2, (counts.get(id2) || 0) + 1);
    });
    const dup = Array.from(counts.entries()).filter(([, c]) => c > 1);
    return dup.length ? [`Mục tiêu trùng lặp trong cùng tuần: ${dup.map(([id2, c]) => `${id2} (${c} lần)`).join(", ")}`] : [];
  }

  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{isNew ? "Tạo kế hoạch giáo dục tuần" : `Kế hoạch tuần ${content.weekNumber} - ${content.branchTopic}`}</h2>
        <div className="spacer" />
        {!isNew && <StatusWorkflowBar api={weeklyPlansApi} planId={id!} status={status} onChanged={setStatus} />}
      </div>
      {error && <div className="banner error">{error}</div>}
      {warnings.map((w, i) => <div key={i} className="banner warn">{w}</div>)}
      {saveMsg && <div className="banner success">{saveMsg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Thông tin tuần</h3>
        <div className="field">
          <label>Kế hoạch chủ đề (cấp trên)</label>
          <select value={themePlanId} onChange={(e) => setThemePlanId(e.target.value)} disabled={!isNew}>
            <option value="">-- Chọn kế hoạch chủ đề --</option>
            {themePlans.map((t) => <option key={t.id} value={t.id}>{t.themeName}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field" style={{ maxWidth: 100 }}><label>Tuần số</label><input type="number" value={content.weekNumber} onChange={(e) => update("weekNumber", Number(e.target.value))} /></div>
          <div className="field"><label>Chủ đề nhánh</label><input value={content.branchTopic} onChange={(e) => update("branchTopic", e.target.value)} /></div>
          <div className="field">
            <label>Độ tuổi</label>
            <select value={content.ageGroup} onChange={(e) => update("ageGroup", e.target.value as any)}>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a} tuổi</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Từ ngày</label><input value={content.startDate} onChange={(e) => update("startDate", e.target.value)} /></div>
          <div className="field"><label>Đến ngày</label><input value={content.endDate} onChange={(e) => update("endDate", e.target.value)} /></div>
          <div className="field"><label>Lớp</label><input value={content.classGroup} onChange={(e) => update("classGroup", e.target.value)} /></div>
          <div className="field"><label>Giáo viên</label><input value={content.teacherNames.join(", ")} onChange={(e) => update("teacherNames", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
        </div>
        <div className="row">
          {WEEKDAYS.map((d) => (
            <div className="field" key={d}><label>Ngày {WEEKDAY_LABELS[d]}</label><input value={content.dayDates[d]} onChange={(e) => update("dayDates", { ...content.dayDates, [d]: e.target.value })} placeholder="dd/mm/yyyy" /></div>
          ))}
        </div>
        <div className="toolbar">
          <button className="primary" disabled={generating || !themeContent} onClick={generateWithAi}>{generating ? "Đang tạo nội dung..." : "Tạo kế hoạch bằng AI"}</button>
          {generating && <button onClick={() => genController?.abort()}>Hủy yêu cầu</button>}
          <button disabled={!canUndo} onClick={undo}>Hoàn tác</button>
        </div>
        {!themeContent && <p className="hint">Chọn kế hoạch chủ đề để có thể kế thừa mục tiêu và tạo bằng AI.</p>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Đón trẻ, chơi, thể dục sáng</h3>
        <textarea value={content.welcomeAndMorningExercise} onChange={(e) => update("welcomeAndMorningExercise", e.target.value)} />
        <AiFieldToolbar planType="weekly" ageGroup={content.ageGroup} sectionPath="welcomeAndMorningExercise" value={content.welcomeAndMorningExercise} fullPlanContext={content} onApply={(v) => update("welcomeAndMorningExercise", v)} />
        <h3>Trò chuyện đầu tuần</h3>
        <textarea value={content.weeklyOpeningTalk} onChange={(e) => update("weeklyOpeningTalk", e.target.value)} />
        <AiFieldToolbar planType="weekly" ageGroup={content.ageGroup} sectionPath="weeklyOpeningTalk" value={content.weeklyOpeningTalk} fullPlanContext={content} onApply={(v) => update("weeklyOpeningTalk", v)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Hoạt động học</h3>
        <table className="grid">
          <thead><tr>{WEEKDAYS.map((d) => <th key={d}>{WEEKDAY_LABELS[d]}</th>)}</tr></thead>
          <tbody>
            <tr>
              {WEEKDAYS.map((d) => (
                <td key={d}>
                  <DayEditor ageGroup={content.ageGroup} allowedIds={allowedIds()} value={content.learningActivities[d]} onChange={(v) => update("learningActivities", { ...content.learningActivities, [d]: v })} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Chơi, hoạt động ở các góc</h3>
        <table className="grid">
          <thead><tr><th>Tên góc/nội dung chơi</th><th>Chuẩn bị</th><th>Yêu cầu, kỹ năng và cách tiến hành</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {content.cornerActivities.map((c, idx) => (
              <tr key={idx}>
                <td><input value={c.cornerName} onChange={(e) => updateCorner(idx, { cornerName: e.target.value })} /></td>
                <td><textarea value={c.preparation} onChange={(e) => updateCorner(idx, { preparation: e.target.value })} /></td>
                <td>
                  <textarea value={c.skillsAndProcess} onChange={(e) => updateCorner(idx, { skillsAndProcess: e.target.value })} />
                  <AiFieldToolbar planType="weekly" ageGroup={content.ageGroup} sectionPath={`cornerActivities[${idx}].skillsAndProcess`} value={c.skillsAndProcess} fullPlanContext={content} onApply={(v) => updateCorner(idx, { skillsAndProcess: v })} />
                </td>
                <td><button className="link-btn" onClick={() => removeCorner(idx)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addCorner} style={{ marginTop: 4 }}>+ Thêm góc</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Chơi ngoài trời</h3>
        <table className="grid">
          <thead><tr><th>Nội dung</th>{WEEKDAYS.map((d) => <th key={d}>{WEEKDAY_LABELS[d]}</th>)}</tr></thead>
          <tbody>
            {([
              ["Hoạt động có mục đích", "purposeActivity"],
              ["Yêu cầu", "requirement"],
              ["Chuẩn bị", "preparation"],
              ["Cách tiến hành", "method"],
              ["Trò chơi vận động/học tập", "game"],
              ["Chơi tự do", "freePlay"],
              ["Biện pháp an toàn", "safetyMeasures"],
            ] as const).map(([label, key]) => (
              <tr key={key}>
                <td><strong>{label}</strong></td>
                {WEEKDAYS.map((d) => (
                  <td key={d}>
                    <textarea
                      value={(content.outdoorActivities[d] as any)[key]}
                      onChange={(e) => update("outdoorActivities", { ...content.outdoorActivities, [d]: { ...content.outdoorActivities[d], [key]: e.target.value } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Tổ chức giờ ăn - giờ ngủ</h3>
        <textarea value={content.mealsAndSleep} onChange={(e) => update("mealsAndSleep", e.target.value)} />
        <h3>Chơi, hoạt động theo ý thích</h3>
        <div className="row">
          {WEEKDAYS.map((d) => <div className="field" key={d}><label>{WEEKDAY_LABELS[d]}</label><textarea value={content.afternoonActivities[d]} onChange={(e) => update("afternoonActivities", { ...content.afternoonActivities, [d]: e.target.value })} /></div>)}
        </div>
        <h3>Trả trẻ</h3>
        <div className="row">
          {WEEKDAYS.map((d) => <div className="field" key={d}><label>{WEEKDAY_LABELS[d]}</label><textarea value={content.pickup[d]} onChange={(e) => update("pickup", { ...content.pickup, [d]: e.target.value })} /></div>)}
        </div>
        <h3>Nội dung phối hợp với cha mẹ trẻ</h3>
        <textarea value={content.parentCoordination} onChange={(e) => update("parentCoordination", e.target.value)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kiểm tra chất lượng kế hoạch</h3>
        <PlanQualityChecks planType="weekly" content={content} computeDuplicates={computeDuplicates} />
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="primary" disabled={saving} onClick={() => save(false)}>{saving ? "Đang lưu..." : "Lưu kế hoạch"}</button>
          {!isNew && <VersionHistoryPanel api={weeklyPlansApi} planId={id!} onRestored={() => window.location.reload()} />}
        </div>
        {!isNew && (
          <div style={{ marginTop: 10 }}>
            <ExportBar docxUrl={weeklyPlansApi.exportDocxUrl(id!)} pdfUrl={weeklyPlansApi.exportPdfUrl(id!)} />
          </div>
        )}
      </div>

      {!isNew && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Giáo án từng ngày</h3>
          <button disabled={bulkBusy} onClick={bulkCreateLessons}>{bulkBusy ? "Đang tạo..." : "Tạo đủ 5 giáo án từ kế hoạch tuần"}</button>
          {bulkMsg && <p className="muted">{bulkMsg}</p>}
          <table className="grid" style={{ marginTop: 8 }}>
            <thead><tr><th>Ngày</th><th>Lĩnh vực</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{DOMAIN_LABELS[l.domain]}</td>
                  <td>{l.status}</td>
                  <td><Link to={`/lesson-plans/${l.id}`}>Soạn giáo án</Link></td>
                </tr>
              ))}
              {lessons.length === 0 && <tr><td colSpan={4} className="muted">Chưa có giáo án nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DayEditor({ ageGroup, allowedIds, value, onChange }: { ageGroup: any; allowedIds: string[]; value: any; onChange: (v: any) => void }) {
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
        <RestrictedObjectivePicker ageGroup={ageGroup} allowedIds={allowedIds} value={value.objectiveId} onChange={(v) => onChange({ ...value, objectiveId: v })} />
      </div>
      <button type="button" className="link-btn" onClick={() => onChange(null)}>Xóa hoạt động</button>
    </div>
  );
}
