import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { ThemePlanContentSchema } from "../schema/themePlan.js";
import { AnnualPlanContentSchema } from "../schema/annualPlan.js";
import { assertEditAllowed, handlePlanError, validateStatusTransition } from "./planCrudHelpers.js";
import { saveVersionSnapshot, listVersions, getVersionSnapshot } from "../services/planVersioning.js";
import { validateThemeInheritsAnnual } from "../services/inheritanceValidation.js";
import { buildThemePlanDoc, convertDocxToPdf, slugFileName, toBuffer } from "../services/exportService.js";
import { collectObjectiveIds, getObjectivesByIds } from "../services/objectiveBank.js";
import { PLAN_STATUS_LABELS } from "../schema/common.js";

export const themePlansRouter = Router();
themePlansRouter.use(requireAuth);

function rowToApi(row: any) {
  return {
    id: row.id,
    code: row.code,
    annualPlanId: row.annual_plan_id,
    themeName: row.theme_name,
    content: JSON.parse(row.data_json),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAnnualContent(annualPlanId: string) {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(annualPlanId) as any;
  if (!row) return null;
  const parsed = AnnualPlanContentSchema.safeParse(JSON.parse(row.data_json));
  return parsed.success ? parsed.data : null;
}

themePlansRouter.get("/", (req, res) => {
  const { search, status, annualPlanId } = req.query as Record<string, string | undefined>;
  let sql = `SELECT * FROM theme_plans WHERE 1=1`;
  const params: any[] = [];
  if (annualPlanId) {
    sql += ` AND annual_plan_id = ?`;
    params.push(annualPlanId);
  }
  if (search) {
    sql += ` AND theme_name LIKE ?`;
    params.push(`%${search}%`);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY updated_at DESC`;
  res.json((db.prepare(sql).all(...params) as any[]).map(rowToApi));
});

themePlansRouter.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM weekly_plans WHERE theme_plan_id = ?`).get(req.params.id) as any).c;
  res.json({ ...rowToApi(row), dependentsCount: dependents });
});

themePlansRouter.post("/", (req: AuthedRequest, res) => {
  const { annualPlanId, content } = req.body;
  if (!annualPlanId) return res.status(400).json({ error: "Vui lòng chọn kế hoạch giáo dục năm làm cấp trên cho kế hoạch chủ đề." });
  const annual = getAnnualContent(annualPlanId);
  if (!annual) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm đã chọn." });
  const parsed = ThemePlanContentSchema.safeParse(content);
  if (!parsed.success) return res.status(400).json({ error: "Nội dung kế hoạch chủ đề không hợp lệ.", issues: parsed.error.issues });
  const inheritanceErrors = validateThemeInheritsAnnual(parsed.data, annual);
  if (inheritanceErrors.length) return res.status(400).json({ error: "Kế hoạch chủ đề chứa mục tiêu không thuộc kế hoạch năm.", issues: inheritanceErrors });

  const id = newId("theme");
  db.prepare(
    `INSERT INTO theme_plans (id, code, annual_plan_id, theme_name, data_json, status, version, created_by) VALUES (?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, parsed.data.themeName, annualPlanId, parsed.data.themeName, JSON.stringify(parsed.data), req.user?.id);
  saveVersionSnapshot("theme", id, 1, parsed.data, req.user?.id, "Tạo mới");
  res.status(201).json({ id });
});

themePlansRouter.put("/:id", (req: AuthedRequest, res) => {
  try {
    const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
    assertEditAllowed(row.status, Boolean(req.body.confirm));
    const parsed = ThemePlanContentSchema.safeParse(req.body.content);
    if (!parsed.success) return res.status(400).json({ error: "Nội dung kế hoạch chủ đề không hợp lệ.", issues: parsed.error.issues });
    const annual = getAnnualContent(row.annual_plan_id);
    if (!annual) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm liên kết." });
    const inheritanceErrors = validateThemeInheritsAnnual(parsed.data, annual);
    if (inheritanceErrors.length) return res.status(400).json({ error: "Kế hoạch chủ đề chứa mục tiêu không thuộc kế hoạch năm.", issues: inheritanceErrors });

    const wasApproved = row.status === "da_duyet";
    const newVersion = row.version + 1;
    saveVersionSnapshot("theme", row.id, newVersion, parsed.data, req.user?.id, req.body.changeNote);
    const newStatus = wasApproved ? "can_dieu_chinh" : row.status;
    db.prepare(`UPDATE theme_plans SET data_json = ?, theme_name = ?, code = ?, status = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(parsed.data),
      parsed.data.themeName,
      parsed.data.themeName,
      newStatus,
      newVersion,
      row.id
    );
    const dependents = db.prepare(`SELECT week_number FROM weekly_plans WHERE theme_plan_id = ?`).all(row.id) as { week_number: number }[];
    const warnings = dependents.length
      ? [`Có ${dependents.length} kế hoạch tuần đang kế thừa dữ liệu từ kế hoạch chủ đề này (tuần ${dependents.map((d) => d.week_number).join(", ")}). Vui lòng kiểm tra lại nếu bạn vừa thay đổi mục tiêu hoặc hoạt động.`]
      : [];
    res.json({ ok: true, version: newVersion, status: newStatus, warnings });
  } catch (err) {
    handlePlanError(err, res);
  }
});

themePlansRouter.patch("/:id/status", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const err = validateStatusTransition(row.status, req.body.status, req.user!.role);
  if (err) return res.status(403).json({ error: err });
  db.prepare(`UPDATE theme_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.status, row.id);
  res.json({ ok: true, status: req.body.status });
});

themePlansRouter.post("/:id/duplicate", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const id = newId("theme");
  db.prepare(
    `INSERT INTO theme_plans (id, code, annual_plan_id, theme_name, data_json, status, version, created_by) VALUES (?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `${row.theme_name} (bản sao)`, row.annual_plan_id, row.theme_name, row.data_json, req.user?.id);
  saveVersionSnapshot("theme", id, 1, JSON.parse(row.data_json), req.user?.id, `Nhân bản từ ${row.id}`);
  res.status(201).json({ id });
});

themePlansRouter.delete("/:id", requireRole("to_truong", "can_bo_quan_ly"), (req, res) => {
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM weekly_plans WHERE theme_plan_id = ?`).get(req.params.id) as any).c;
  if (dependents > 0) {
    return res.status(409).json({ error: `Không thể xoá: đang có ${dependents} kế hoạch tuần kế thừa từ kế hoạch chủ đề này.` });
  }
  const info = db.prepare(`DELETE FROM theme_plans WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  res.json({ ok: true });
});

themePlansRouter.get("/:id/versions", (req, res) => res.json(listVersions("theme", req.params.id)));

themePlansRouter.post("/:id/restore/:versionNumber", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const snapshot = getVersionSnapshot("theme", req.params.id, Number(req.params.versionNumber));
  if (!snapshot) return res.status(404).json({ error: "Không tìm thấy phiên bản cần khôi phục." });
  const newVersion = row.version + 1;
  saveVersionSnapshot("theme", row.id, newVersion, snapshot, req.user?.id, `Khôi phục từ phiên bản ${req.params.versionNumber}`);
  db.prepare(`UPDATE theme_plans SET data_json = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(snapshot), newVersion, row.id);
  res.json({ ok: true, version: newVersion });
});

function exportContext(row: any) {
  const content = JSON.parse(row.data_json);
  const objLookup = getObjectivesByIds(collectObjectiveIds(content));
  return { content, objLookup };
}

themePlansRouter.get("/:id/export.docx", async (req, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const { content, objLookup } = exportContext(row);
  const doc = buildThemePlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const filename = `Ke_hoach_chu_de_${slugFileName(content.themeName)}_${slugFileName(content.classGroup)}.docx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

themePlansRouter.get("/:id/export.pdf", async (req, res) => {
  const row = db.prepare(`SELECT * FROM theme_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch chủ đề." });
  const { content, objLookup } = exportContext(row);
  const doc = buildThemePlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const base = `Ke_hoach_chu_de_${slugFileName(content.themeName)}_${slugFileName(content.classGroup)}`;
  try {
    const pdf = await convertDocxToPdf(buffer, base);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch {
    res.status(500).json({ error: "Không thể xuất PDF do lỗi bộ chuyển đổi trên máy chủ. Vui lòng thử lại hoặc xuất DOCX." });
  }
});
