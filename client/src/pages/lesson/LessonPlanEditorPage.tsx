import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { aiApi, lessonPlansApi, objectivesApi } from "../../api/resources";
import { ApiError } from "../../api/client";
import { useHistory } from "../../hooks/useHistory";
import AiFieldToolbar from "../../components/AiFieldToolbar";
import VersionHistoryPanel from "../../components/VersionHistoryPanel";
import ExportBar from "../../components/ExportBar";
import StatusWorkflowBar from "../../components/StatusWorkflowBar";
import PlanQualityChecks from "../../components/PlanQualityChecks";
import { ACTIVITY_PROCEDURE_OUTLINE, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_VALUES, DOMAIN_LABELS, type ActivityType, type LessonPlanContent, type PlanStatus } from "../../types";

export default function LessonPlanEditorPage() {
  const { id } = useParams();
  const { value: content, setValue: setContent, replaceWithoutHistory, undo, canUndo } = useHistory<LessonPlanContent | null>(null);
  const [status, setStatus] = useState<PlanStatus>("nhap");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genController, setGenController] = useState<AbortController | null>(null);
  const [objectiveLabel, setObjectiveLabel] = useState("");

  useEffect(() => {
    lessonPlansApi.get(id!).then((p) => {
      replaceWithoutHistory(p.content);
      setStatus(p.status);
      setLoading(false);
      if (p.content.objectiveId) {
        objectivesApi.list({}).then((list) => {
          const o = list.find((x) => x.id === p.content.objectiveId);
          if (o) setObjectiveLabel(`${o.code} - ${o.statement}`);
        });
      }
    });
  }, [id]);

  function update<K extends keyof LessonPlanContent>(key: K, value: LessonPlanContent[K]) {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function generateWithAi() {
    if (!content) return;
    if (generating) return;
    setGenerating(true);
    setError("");
    const controller = new AbortController();
    setGenController(controller);
    try {
      const res = await aiApi.generate<LessonPlanContent>(
        {
          planType: "lesson",
          ageGroup: "5-6",
          domain: content.domain,
          inputData: { domain: content.domain, activityType: content.activityType, topic: content.topic, combinedContent: content.combinedContent, date: content.date, dayOfWeek: content.dayOfWeek, objectiveId: content.objectiveId },
        },
        controller.signal
      );
      setContent((prev) => (prev ? { ...res.content, dayOfWeek: prev.dayOfWeek, date: prev.date, domain: prev.domain, objectiveId: prev.objectiveId, topic: prev.topic } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo nội dung bằng AI.");
    } finally {
      setGenerating(false);
      setGenController(null);
    }
  }

  async function save(confirm = false) {
    if (!content) return;
    setSaving(true);
    setError("");
    setSaveMsg("");
    try {
      const res = await lessonPlansApi.update(id!, content, { confirm });
      setStatus(res.status);
      setSaveMsg("Đã lưu thay đổi.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "approved_edit_requires_confirm") {
        if (window.confirm(err.message)) return save(true);
        return;
      }
      setError(err instanceof ApiError ? [err.message, ...(err.issues || [])].join(" ") : "Không thể lưu giáo án.");
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    if (!content) return;
    update("procedure", [...content.procedure, { section: "", teacherActivity: "", childActivity: "" }]);
  }
  function updateStep(idx: number, patch: Partial<LessonPlanContent["procedure"][number]>) {
    if (!content) return;
    update("procedure", content.procedure.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeStep(idx: number) {
    if (!content) return;
    update("procedure", content.procedure.filter((_, i) => i !== idx));
  }

  if (loading || !content) return <div>Đang tải...</div>;
  const outline = ACTIVITY_PROCEDURE_OUTLINE[content.activityType];

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Giáo án: {content.topic || "(chưa đặt tên)"}</h2>
        <div className="spacer" />
        <StatusWorkflowBar api={lessonPlansApi} planId={id!} status={status} onChanged={setStatus} />
      </div>
      {error && <div className="banner error">{error}</div>}
      {saveMsg && <div className="banner success">{saveMsg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Thông tin chung (kế thừa từ kế hoạch tuần)</h3>
        <div className="row">
          <div className="field"><label>Ngày thực hiện</label><input value={`${content.dayOfWeek} ngày ${content.date}`} disabled /></div>
          <div className="field"><label>Lĩnh vực giáo dục</label><input value={DOMAIN_LABELS[content.domain]} disabled /></div>
          <div className="field"><label>Mã mục tiêu</label><input value={objectiveLabel || "(chưa gán)"} disabled /></div>
        </div>
        <div className="row">
          <div className="field">
            <label>Loại hoạt động</label>
            <select value={content.activityType} onChange={(e) => update("activityType", e.target.value as ActivityType)}>
              {ACTIVITY_TYPE_VALUES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="field"><label>Tên đề tài/hoạt động</label><input value={content.topic} onChange={(e) => update("topic", e.target.value)} /></div>
        </div>
        <div className="field"><label>Nội dung kết hợp/trò chơi (nếu có)</label><input value={content.combinedContent} onChange={(e) => update("combinedContent", e.target.value)} /></div>
        <div className="hint">Quy trình chuyên môn gợi ý cho loại hoạt động này: {outline.join(" → ")}</div>
        <div className="toolbar">
          <button className="primary" disabled={generating} onClick={generateWithAi}>{generating ? "Đang tạo nội dung..." : "Tạo giáo án bằng AI"}</button>
          {generating && <button onClick={() => genController?.abort()}>Hủy yêu cầu</button>}
          <button disabled={!canUndo} onClick={undo}>Hoàn tác</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>I. Mục đích - yêu cầu</h3>
        <div className="field"><label>Kiến thức / Kết quả mong đợi</label><textarea value={content.purpose.knowledge} onChange={(e) => update("purpose", { ...content.purpose, knowledge: e.target.value })} /><AiFieldToolbar planType="lesson" ageGroup="5-6" sectionPath="purpose.knowledge" value={content.purpose.knowledge} fullPlanContext={content} onApply={(v) => update("purpose", { ...content.purpose, knowledge: v })} /></div>
        <div className="field"><label>Kỹ năng</label><textarea value={content.purpose.skill} onChange={(e) => update("purpose", { ...content.purpose, skill: e.target.value })} /><AiFieldToolbar planType="lesson" ageGroup="5-6" sectionPath="purpose.skill" value={content.purpose.skill} fullPlanContext={content} onApply={(v) => update("purpose", { ...content.purpose, skill: v })} /></div>
        <div className="field"><label>Thái độ/phẩm chất</label><textarea value={content.purpose.attitude} onChange={(e) => update("purpose", { ...content.purpose, attitude: e.target.value })} /></div>
        <div className="field"><label>Phân hóa, hỗ trợ trẻ (nếu cần)</label><textarea value={content.purpose.differentiation} onChange={(e) => update("purpose", { ...content.purpose, differentiation: e.target.value })} /><AiFieldToolbar planType="lesson" ageGroup="5-6" sectionPath="purpose.differentiation" value={content.purpose.differentiation} fullPlanContext={content} onApply={(v) => update("purpose", { ...content.purpose, differentiation: v })} /></div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>II. Chuẩn bị</h3>
        <div className="row">
          <div className="field"><label>Đồ dùng của giáo viên</label><textarea value={content.preparation.teacherItems} onChange={(e) => update("preparation", { ...content.preparation, teacherItems: e.target.value })} /></div>
          <div className="field"><label>Đồ dùng của trẻ</label><textarea value={content.preparation.childItems} onChange={(e) => update("preparation", { ...content.preparation, childItems: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Không gian tổ chức</label><input value={content.preparation.space} onChange={(e) => update("preparation", { ...content.preparation, space: e.target.value })} /></div>
          <div className="field"><label>Học liệu, thiết bị</label><input value={content.preparation.materials} onChange={(e) => update("preparation", { ...content.preparation, materials: e.target.value })} /></div>
          <div className="field"><label>Yêu cầu an toàn</label><input value={content.preparation.safety} onChange={(e) => update("preparation", { ...content.preparation, safety: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>III. Tiến hành hoạt động</h3>
        <table className="grid">
          <thead><tr><th style={{ width: "55%" }}>Hoạt động của giáo viên</th><th>Hoạt động của trẻ</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {content.procedure.map((step, idx) => (
              <tr key={idx}>
                <td>
                  <input placeholder="Tên bước (VD: Khởi động)" value={step.section} onChange={(e) => updateStep(idx, { section: e.target.value })} style={{ marginBottom: 4, fontWeight: 600 }} />
                  <textarea value={step.teacherActivity} onChange={(e) => updateStep(idx, { teacherActivity: e.target.value })} />
                  <AiFieldToolbar planType="lesson" ageGroup="5-6" sectionPath={`procedure[${idx}].teacherActivity`} value={step.teacherActivity} fullPlanContext={content} onApply={(v) => updateStep(idx, { teacherActivity: v })} />
                </td>
                <td>
                  <textarea value={step.childActivity} onChange={(e) => updateStep(idx, { childActivity: e.target.value })} />
                </td>
                <td><button className="link-btn" onClick={() => removeStep(idx)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addStep} style={{ marginTop: 4 }}>+ Thêm bước</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Đánh giá cuối ngày</h3>
        <p className="hint">Phần này do giáo viên ghi lại sau khi tổ chức hoạt động, không do AI tạo sẵn.</p>
        <textarea value={content.evaluationNotes} onChange={(e) => update("evaluationNotes", e.target.value)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kiểm tra chất lượng giáo án</h3>
        <PlanQualityChecks planType="lesson" content={content} />
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="primary" disabled={saving} onClick={() => save(false)}>{saving ? "Đang lưu..." : "Lưu giáo án"}</button>
          <VersionHistoryPanel api={lessonPlansApi} planId={id!} onRestored={() => window.location.reload()} />
        </div>
        <div style={{ marginTop: 10 }}>
          <ExportBar docxUrl={lessonPlansApi.exportDocxUrl(id!)} pdfUrl={lessonPlansApi.exportPdfUrl(id!)} />
        </div>
      </div>
    </div>
  );
}
