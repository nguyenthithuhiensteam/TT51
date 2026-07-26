import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { WeeklyPlanContentSchema } from "../schema/weeklyPlan.js";
import { ThemePlanContentSchema } from "../schema/themePlan.js";
import { assertEditAllowed, handlePlanError, validateStatusTransition } from "./planCrudHelpers.js";
import { saveVersionSnapshot, listVersions, getVersionSnapshot } from "../services/planVersioning.js";
import { validateWeeklyInheritsTheme } from "../services/inheritanceValidation.js";
import { buildWeeklyPlanDoc, convertDocxToPdf, slugFileName, toBuffer } from "../services/exportService.js";
import { collectObjectiveIds, getObjectivesByIds } from "../services/objectiveBank.js";
import { PLAN_STATUS_LABELS } from "../schema/common.js";

export const weeklyPlansRouter = Router();
weeklyPlansRouter.use(requireAuth);

function rowToApi(row: any) {
  return {
    id: row.id,
    code: row.code,
    themePlanId: row.theme_plan_id,
    weekNumber: row.week_number,
    content: JSON.parse(row.data_json),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getThemeContent(themePlanId: string) {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(themePlanId) as any;
  if (!row) return null;
  const parsed = ThemePlanContentSchema.safeParse(JSON.parse(row.data_json));
  return parsed.success ? parsed.data : null;
}

weeklyPlansRouter.get("/", (req, res) => {
  const { search, status, themePlanId } = req.query as Record<string, string | undefined>;
  let sql = `SELECT * FROM weekly_plans WHERE 1=1`;
  const params: any[] = [];
  if (themePlanId) {
    sql += ` AND theme_plan_id = ?`;
    params.push(themePlanId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (search) {
    sql += ` AND code LIKE ?`;
    params.push(`%${search}%`);
  }
  sql += ` ORDER BY updated_at DESC`;
  res.json((db.prepare(sql).all(...params) as any[]).map(rowToApi));
});

weeklyPlansRouter.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM lesson_plans WHERE weekly_plan_id = ?`).get(req.params.id) as any).c;
  res.json({ ...rowToApi(row), dependentsCount: dependents });
});

weeklyPlansRouter.post("/", (req: AuthedRequest, res) => {
  const { themePlanId, content } = req.body;
  if (!themePlanId) return res.status(400).json({ error: "Vui lòng chọn kế hoạch chủ đề làm cấp trên cho kế hoạch tuần." });
  const theme = getThemeContent(themePlanId);
  if (!theme) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề đã chọn." });
  const parsed = WeeklyPlanContentSchema.safeParse(content);
  if (!parsed.success) return res.status(400).json({ error: "Nội dung kế hoạch tuần không hợp lệ.", issues: parsed.error.issues });
  const inheritanceErrors = validateWeeklyInheritsTheme(parsed.data, theme);
  if (inheritanceErrors.length) return res.status(400).json({ error: "Kế hoạch tuần chưa khớp với kế hoạch chủ đề.", issues: inheritanceErrors });

  const id = newId("weekly");
  db.prepare(
    `INSERT INTO weekly_plans (id, code, theme_plan_id, week_number, data_json, status, version, created_by) VALUES (?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `Tuần ${parsed.data.weekNumber} - ${parsed.data.branchTopic}`, themePlanId, parsed.data.weekNumber, JSON.stringify(parsed.data), req.user?.id);
  saveVersionSnapshot("weekly", id, 1, parsed.data, req.user?.id, "Tạo mới");
  res.status(201).json({ id });
});

weeklyPlansRouter.put("/:id", (req: AuthedRequest, res) => {
  try {
    const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
    assertEditAllowed(row.status, Boolean(req.body.confirm));
    const parsed = WeeklyPlanContentSchema.safeParse(req.body.content);
    if (!parsed.success) return res.status(400).json({ error: "Nội dung kế hoạch tuần không hợp lệ.", issues: parsed.error.issues });
    const theme = getThemeContent(row.theme_plan_id);
    if (!theme) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề liên kết." });
    const inheritanceErrors = validateWeeklyInheritsTheme(parsed.data, theme);
    if (inheritanceErrors.length) return res.status(400).json({ error: "Kế hoạch tuần chưa khớp với kế hoạch chủ đề.", issues: inheritanceErrors });

    const wasApproved = row.status === "da_duyet";
    const newVersion = row.version + 1;
    saveVersionSnapshot("weekly", row.id, newVersion, parsed.data, req.user?.id, req.body.changeNote);
    const newStatus = wasApproved ? "can_dieu_chinh" : row.status;
    db.prepare(`UPDATE weekly_plans SET data_json = ?, code = ?, week_number = ?, status = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(parsed.data),
      `Tuần ${parsed.data.weekNumber} - ${parsed.data.branchTopic}`,
      parsed.data.weekNumber,
      newStatus,
      newVersion,
      row.id
    );
    const dependents = db.prepare(`SELECT plan_date FROM lesson_plans WHERE weekly_plan_id = ?`).all(row.id) as { plan_date: string }[];
    const warnings = dependents.length
      ? [`Có ${dependents.length} giáo án ngày đang kế thừa dữ liệu từ kế hoạch tuần này (${dependents.map((d) => d.plan_date).join(", ")}). Vui lòng kiểm tra lại nếu bạn vừa thay đổi hoạt động học hoặc mục tiêu.`]
      : [];
    res.json({ ok: true, version: newVersion, status: newStatus, warnings });
  } catch (err) {
    handlePlanError(err, res);
  }
});

weeklyPlansRouter.patch("/:id/status", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const err = validateStatusTransition(row.status, req.body.status, req.user!.role);
  if (err) return res.status(403).json({ error: err });
  db.prepare(`UPDATE weekly_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.status, row.id);
  res.json({ ok: true, status: req.body.status });
});

weeklyPlansRouter.post("/:id/duplicate", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const id = newId("weekly");
  db.prepare(
    `INSERT INTO weekly_plans (id, code, theme_plan_id, week_number, data_json, status, version, created_by) VALUES (?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `${row.code} (bản sao)`, row.theme_plan_id, row.week_number, row.data_json, req.user?.id);
  saveVersionSnapshot("weekly", id, 1, JSON.parse(row.data_json), req.user?.id, `Nhân bản từ ${row.id}`);
  res.status(201).json({ id });
});

weeklyPlansRouter.delete("/:id", requireRole("to_truong", "can_bo_quan_ly"), (req, res) => {
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM lesson_plans WHERE weekly_plan_id = ?`).get(req.params.id) as any).c;
  if (dependents > 0) {
    return res.status(409).json({ error: `Không thể xoá: đang có ${dependents} giáo án ngày kế thừa từ kế hoạch tuần này.` });
  }
  const info = db.prepare(`DELETE FROM weekly_plans WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  res.json({ ok: true });
});

weeklyPlansRouter.get("/:id/versions", (req, res) => res.json(listVersions("weekly", req.params.id)));

weeklyPlansRouter.post("/:id/restore/:versionNumber", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const snapshot = getVersionSnapshot("weekly", req.params.id, Number(req.params.versionNumber));
  if (!snapshot) return res.status(404).json({ error: "Không tìm thấy phiên bản cần khôi phục." });
  const newVersion = row.version + 1;
  saveVersionSnapshot("weekly", row.id, newVersion, snapshot, req.user?.id, `Khôi phục từ phiên bản ${req.params.versionNumber}`);
  db.prepare(`UPDATE weekly_plans SET data_json = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(snapshot), newVersion, row.id);
  res.json({ ok: true, version: newVersion });
});

function exportContext(row: any) {
  const content = JSON.parse(row.data_json);
  const objLookup = getObjectivesByIds(collectObjectiveIds(content));
  return { content, objLookup };
}

weeklyPlansRouter.get("/:id/export.docx", async (req, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const { content, objLookup } = exportContext(row);
  const doc = buildWeeklyPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const filename = `Ke_hoach_tuan_${content.weekNumber}_${slugFileName(content.branchTopic)}_${slugFileName(content.classGroup)}.docx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

weeklyPlansRouter.get("/:id/export.pdf", async (req, res) => {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần." });
  const { content, objLookup } = exportContext(row);
  const doc = buildWeeklyPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const base = `Ke_hoach_tuan_${content.weekNumber}_${slugFileName(content.branchTopic)}_${slugFileName(content.classGroup)}`;
  try {
    const pdf = await convertDocxToPdf(buffer, base);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch {
    res.status(500).json({ error: "Không thể xuất PDF do lỗi bộ chuyển đổi trên máy chủ. Vui lòng thử lại hoặc xuất DOCX." });
  }
});
