import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { AnnualPlanContentSchema } from "../schema/annualPlan.js";
import { assertEditAllowed, handlePlanError, validateStatusTransition } from "./planCrudHelpers.js";
import { saveVersionSnapshot, listVersions, getVersionSnapshot } from "../services/planVersioning.js";
import { buildAnnualPlanDoc, convertDocxToPdf, slugFileName, toBuffer } from "../services/exportService.js";
import { collectObjectiveIds, getObjectivesByIds } from "../services/objectiveBank.js";
import { PLAN_STATUS_LABELS } from "../schema/common.js";

export const annualPlansRouter = Router();
annualPlansRouter.use(requireAuth);

function rowToApi(row: any) {
  return {
    id: row.id,
    code: row.code,
    schoolYear: row.school_year,
    classGroup: row.class_group,
    ageGroup: row.age_group,
    content: JSON.parse(row.data_json),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

annualPlansRouter.get("/", (req, res) => {
  const { search, status, schoolYear } = req.query as Record<string, string | undefined>;
  let sql = `SELECT * FROM annual_plans WHERE 1=1`;
  const params: any[] = [];
  if (search) {
    sql += ` AND (code LIKE ? OR class_group LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (schoolYear) {
    sql += ` AND school_year = ?`;
    params.push(schoolYear);
  }
  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows.map(rowToApi));
});

annualPlansRouter.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM theme_plans WHERE annual_plan_id = ?`).get(req.params.id) as any).c;
  res.json({ ...rowToApi(row), dependentsCount: dependents });
});

annualPlansRouter.post("/", (req: AuthedRequest, res) => {
  const parsed = AnnualPlanContentSchema.safeParse(req.body.content);
  if (!parsed.success) {
    return res.status(400).json({ error: "Nội dung kế hoạch không hợp lệ.", issues: parsed.error.issues });
  }
  const id = newId("annual");
  const content = parsed.data;
  db.prepare(
    `INSERT INTO annual_plans (id, code, school_year, class_group, age_group, data_json, status, version, created_by) VALUES (?,?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `${content.schoolYear}-${content.classGroup}`, content.schoolYear, content.classGroup, content.ageGroup, JSON.stringify(content), req.user?.id);
  saveVersionSnapshot("annual", id, 1, content, req.user?.id, "Tạo mới");
  res.status(201).json({ id });
});

annualPlansRouter.put("/:id", (req: AuthedRequest, res) => {
  try {
    const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
    assertEditAllowed(row.status, Boolean(req.body.confirm));
    const parsed = AnnualPlanContentSchema.safeParse(req.body.content);
    if (!parsed.success) return res.status(400).json({ error: "Nội dung kế hoạch không hợp lệ.", issues: parsed.error.issues });

    const wasApproved = row.status === "da_duyet";
    const newVersion = row.version + 1;
    saveVersionSnapshot("annual", row.id, newVersion, parsed.data, req.user?.id, req.body.changeNote);
    const newStatus = wasApproved ? "can_dieu_chinh" : row.status;
    db.prepare(
      `UPDATE annual_plans SET data_json = ?, status = ?, version = ?, school_year = ?, class_group = ?, age_group = ?, code = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(parsed.data), newStatus, newVersion, parsed.data.schoolYear, parsed.data.classGroup, parsed.data.ageGroup, `${parsed.data.schoolYear}-${parsed.data.classGroup}`, row.id);

    const dependents = db.prepare(`SELECT theme_name FROM theme_plans WHERE annual_plan_id = ?`).all(row.id) as { theme_name: string }[];
    const warnings =
      dependents.length > 0
        ? [`Có ${dependents.length} kế hoạch chủ đề đang kế thừa dữ liệu từ kế hoạch năm này (${dependents.map((d) => d.theme_name).join(", ")}). Vui lòng kiểm tra lại các mục tiêu liên quan nếu bạn vừa thay đổi.`]
        : [];
    res.json({ ok: true, version: newVersion, status: newStatus, warnings });
  } catch (err) {
    handlePlanError(err, res);
  }
});

annualPlansRouter.patch("/:id/status", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const { status } = req.body;
  const err = validateStatusTransition(row.status, status, req.user!.role);
  if (err) return res.status(403).json({ error: err });
  db.prepare(`UPDATE annual_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, row.id);
  res.json({ ok: true, status });
});

annualPlansRouter.post("/:id/duplicate", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const newId2 = newId("annual");
  db.prepare(
    `INSERT INTO annual_plans (id, code, school_year, class_group, age_group, data_json, status, version, created_by) VALUES (?,?,?,?,?,?, 'nhap', 1, ?)`
  ).run(newId2, `${row.code} (bản sao)`, row.school_year, row.class_group, row.age_group, row.data_json, req.user?.id);
  saveVersionSnapshot("annual", newId2, 1, JSON.parse(row.data_json), req.user?.id, `Nhân bản từ ${row.id}`);
  res.status(201).json({ id: newId2 });
});

annualPlansRouter.delete("/:id", requireRole("to_truong", "can_bo_quan_ly"), (req, res) => {
  const dependents = (db.prepare(`SELECT COUNT(*) c FROM theme_plans WHERE annual_plan_id = ?`).get(req.params.id) as any).c;
  if (dependents > 0) {
    return res.status(409).json({ error: `Không thể xoá: đang có ${dependents} kế hoạch chủ đề kế thừa từ kế hoạch năm này. Vui lòng xoá các kế hoạch chủ đề liên quan trước.` });
  }
  const info = db.prepare(`DELETE FROM annual_plans WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  res.json({ ok: true });
});

annualPlansRouter.get("/:id/versions", (req, res) => {
  res.json(listVersions("annual", req.params.id));
});

annualPlansRouter.post("/:id/restore/:versionNumber", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const snapshot = getVersionSnapshot("annual", req.params.id, Number(req.params.versionNumber));
  if (!snapshot) return res.status(404).json({ error: "Không tìm thấy phiên bản cần khôi phục." });
  const newVersion = row.version + 1;
  saveVersionSnapshot("annual", row.id, newVersion, snapshot, req.user?.id, `Khôi phục từ phiên bản ${req.params.versionNumber}`);
  db.prepare(`UPDATE annual_plans SET data_json = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(snapshot), newVersion, row.id);
  res.json({ ok: true, version: newVersion });
});

function exportContext(row: any) {
  const content = JSON.parse(row.data_json);
  const ids = collectObjectiveIds(content);
  const objLookup = getObjectivesByIds(ids);
  return { content, objLookup };
}

annualPlansRouter.get("/:id/export.docx", async (req, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const { content, objLookup } = exportContext(row);
  const doc = buildAnnualPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const filename = `Ke_hoach_nam_${slugFileName(content.schoolYear)}_${slugFileName(content.classGroup)}.docx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

annualPlansRouter.get("/:id/export.pdf", async (req, res) => {
  const row = db.prepare(`SELECT * FROM annual_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy kế hoạch giáo dục năm." });
  const { content, objLookup } = exportContext(row);
  const doc = buildAnnualPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const base = `Ke_hoach_nam_${slugFileName(content.schoolYear)}_${slugFileName(content.classGroup)}`;
  try {
    const pdf = await convertDocxToPdf(buffer, base);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: "Không thể xuất PDF do lỗi bộ chuyển đổi trên máy chủ. Vui lòng thử lại hoặc xuất DOCX." });
  }
});
