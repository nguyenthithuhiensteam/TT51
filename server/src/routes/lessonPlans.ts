import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { LessonPlanContentSchema } from "../schema/lessonPlan.js";
import { WeeklyPlanContentSchema } from "../schema/weeklyPlan.js";
import { assertEditAllowed, handlePlanError, validateStatusTransition } from "./planCrudHelpers.js";
import { saveVersionSnapshot, listVersions, getVersionSnapshot } from "../services/planVersioning.js";
import { validateLessonInheritsWeekly } from "../services/inheritanceValidation.js";
import { buildLessonPlanDoc, convertDocxToPdf, slugFileName, toBuffer } from "../services/exportService.js";
import { collectObjectiveIds, getObjectivesByIds } from "../services/objectiveBank.js";
import { DOMAIN_LABELS, PLAN_STATUS_LABELS, WEEKDAYS, WEEKDAY_LABELS } from "../schema/common.js";

export const lessonPlansRouter = Router();
lessonPlansRouter.use(requireAuth);

function rowToApi(row: any) {
  return {
    id: row.id,
    code: row.code,
    weeklyPlanId: row.weekly_plan_id,
    date: row.plan_date,
    domain: row.domain,
    content: JSON.parse(row.data_json),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWeeklyRowAndContent(weeklyPlanId: string) {
  const row = db.prepare(`SELECT * FROM weekly_plans WHERE id = ?`).get(weeklyPlanId) as any;
  if (!row) return null;
  const parsed = WeeklyPlanContentSchema.safeParse(JSON.parse(row.data_json));
  if (!parsed.success) return null;
  return { row, content: parsed.data };
}

function dayKeyForDate(content: any, date: string): (typeof WEEKDAYS)[number] | null {
  for (const d of WEEKDAYS) {
    if (content.dayDates[d] === date) return d;
  }
  return null;
}

lessonPlansRouter.get("/", (req, res) => {
  const { weeklyPlanId, status, search } = req.query as Record<string, string | undefined>;
  let sql = `SELECT * FROM lesson_plans WHERE 1=1`;
  const params: any[] = [];
  if (weeklyPlanId) {
    sql += ` AND weekly_plan_id = ?`;
    params.push(weeklyPlanId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (search) {
    sql += ` AND code LIKE ?`;
    params.push(`%${search}%`);
  }
  sql += ` ORDER BY plan_date ASC`;
  res.json((db.prepare(sql).all(...params) as any[]).map(rowToApi));
});

lessonPlansRouter.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  res.json(rowToApi(row));
});

// Tạo bộ khung 5 giáo án (thứ Hai - thứ Sáu) kế thừa đúng dữ liệu từ kế hoạch tuần đã chọn.
lessonPlansRouter.post("/bulk-create-from-weekly/:weeklyPlanId", (req: AuthedRequest, res) => {
  const found = getWeeklyRowAndContent(req.params.weeklyPlanId);
  if (!found) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần hoặc dữ liệu kế hoạch tuần không hợp lệ." });
  const { row: weeklyRow, content: weekly } = found;

  const existing = db.prepare(`SELECT plan_date FROM lesson_plans WHERE weekly_plan_id = ?`).all(weeklyRow.id) as { plan_date: string }[];
  const existingDates = new Set(existing.map((e) => e.plan_date));

  const created: string[] = [];
  const skipped: string[] = [];
  for (const d of WEEKDAYS) {
    const cell = weekly.learningActivities[d];
    const date = weekly.dayDates[d];
    if (!cell) {
      skipped.push(`${WEEKDAY_LABELS[d]} (${date}): kế hoạch tuần chưa có hoạt động học.`);
      continue;
    }
    if (existingDates.has(date)) {
      skipped.push(`${WEEKDAY_LABELS[d]} (${date}): đã có giáo án.`);
      continue;
    }
    const content = {
      dayOfWeek: WEEKDAY_LABELS[d],
      date,
      domain: cell.domain,
      activityType: guessActivityType(cell.activityType),
      topic: cell.activityName,
      combinedContent: "",
      objectiveId: cell.objectiveId,
      purpose: { knowledge: "", skill: "", attitude: "", differentiation: "" },
      preparation: { teacherItems: "", childItems: "", space: "", materials: "", safety: "" },
      procedure: [{ section: "Ổn định - gây hứng thú", teacherActivity: "", childActivity: "" }],
      evaluationNotes: "",
    };
    const id = newId("lesson");
    db.prepare(
      `INSERT INTO lesson_plans (id, code, weekly_plan_id, plan_date, domain, data_json, status, version, created_by) VALUES (?,?,?,?,?,?, 'nhap', 1, ?)`
    ).run(id, `${WEEKDAY_LABELS[d]} ${date} - ${cell.activityName}`, weeklyRow.id, date, cell.domain, JSON.stringify(content), req.user?.id);
    saveVersionSnapshot("lesson", id, 1, content, req.user?.id, "Tạo khung từ kế hoạch tuần");
    created.push(id);
  }
  res.status(201).json({ createdIds: created, skipped });
});

function guessActivityType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("thể dục") || l.includes("vận động")) return "the_duc";
  if (l.includes("âm nhạc") || l.includes("ân")) return "am_nhac";
  if (l.includes("tạo hình")) return "tao_hinh";
  if (l.includes("văn học") || l.includes("thơ") || l.includes("truyện")) return "van_hoc";
  if (l.includes("chữ cái") || l.includes("lqcv")) return "lam_quen_chu_cai";
  if (l.includes("toán")) return "lam_quen_voi_toan";
  if (l.includes("kpkh")) return "kham_pha_khoa_hoc";
  if (l.includes("kpxh")) return "kham_pha_xa_hoi";
  return "kham_pha_xa_hoi";
}

lessonPlansRouter.post("/", (req: AuthedRequest, res) => {
  const { weeklyPlanId, content } = req.body;
  if (!weeklyPlanId) return res.status(400).json({ error: "Vui lòng chọn kế hoạch tuần làm cấp trên cho giáo án." });
  const found = getWeeklyRowAndContent(weeklyPlanId);
  if (!found) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần đã chọn." });
  const parsed = LessonPlanContentSchema.safeParse(content);
  if (!parsed.success) return res.status(400).json({ error: "Nội dung giáo án không hợp lệ.", issues: parsed.error.issues });
  const dayKey = dayKeyForDate(found.content, parsed.data.date);
  if (!dayKey) return res.status(400).json({ error: "Ngày thực hiện không khớp với bất kỳ ngày nào trong kế hoạch tuần." });
  const inheritanceErrors = validateLessonInheritsWeekly(parsed.data, found.content, dayKey);
  if (inheritanceErrors.length) return res.status(400).json({ error: "Giáo án chưa khớp với kế hoạch tuần.", issues: inheritanceErrors });

  const id = newId("lesson");
  db.prepare(
    `INSERT INTO lesson_plans (id, code, weekly_plan_id, plan_date, domain, data_json, status, version, created_by) VALUES (?,?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `${parsed.data.dayOfWeek} ${parsed.data.date} - ${parsed.data.topic}`, weeklyPlanId, parsed.data.date, parsed.data.domain, JSON.stringify(parsed.data), req.user?.id);
  saveVersionSnapshot("lesson", id, 1, parsed.data, req.user?.id, "Tạo mới");
  res.status(201).json({ id });
});

lessonPlansRouter.put("/:id", (req: AuthedRequest, res) => {
  try {
    const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
    assertEditAllowed(row.status, Boolean(req.body.confirm));
    const parsed = LessonPlanContentSchema.safeParse(req.body.content);
    if (!parsed.success) return res.status(400).json({ error: "Nội dung giáo án không hợp lệ.", issues: parsed.error.issues });
    const found = getWeeklyRowAndContent(row.weekly_plan_id);
    if (!found) return res.status(404).json({ error: "Không tìm thấy kế hoạch tuần liên kết." });
    const dayKey = dayKeyForDate(found.content, parsed.data.date);
    if (!dayKey) return res.status(400).json({ error: "Ngày thực hiện không khớp với bất kỳ ngày nào trong kế hoạch tuần." });
    const inheritanceErrors = validateLessonInheritsWeekly(parsed.data, found.content, dayKey);
    if (inheritanceErrors.length) return res.status(400).json({ error: "Giáo án chưa khớp với kế hoạch tuần.", issues: inheritanceErrors });

    const wasApproved = row.status === "da_duyet";
    const newVersion = row.version + 1;
    saveVersionSnapshot("lesson", row.id, newVersion, parsed.data, req.user?.id, req.body.changeNote);
    const newStatus = wasApproved ? "can_dieu_chinh" : row.status;
    db.prepare(`UPDATE lesson_plans SET data_json = ?, code = ?, plan_date = ?, domain = ?, status = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(parsed.data),
      `${parsed.data.dayOfWeek} ${parsed.data.date} - ${parsed.data.topic}`,
      parsed.data.date,
      parsed.data.domain,
      newStatus,
      newVersion,
      row.id
    );
    res.json({ ok: true, version: newVersion, status: newStatus, warnings: [] });
  } catch (err) {
    handlePlanError(err, res);
  }
});

lessonPlansRouter.patch("/:id/status", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  const err = validateStatusTransition(row.status, req.body.status, req.user!.role);
  if (err) return res.status(403).json({ error: err });
  db.prepare(`UPDATE lesson_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.status, row.id);
  res.json({ ok: true, status: req.body.status });
});

lessonPlansRouter.post("/:id/duplicate", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  const id = newId("lesson");
  db.prepare(
    `INSERT INTO lesson_plans (id, code, weekly_plan_id, plan_date, domain, data_json, status, version, created_by) VALUES (?,?,?,?,?,?, 'nhap', 1, ?)`
  ).run(id, `${row.code} (bản sao)`, row.weekly_plan_id, row.plan_date, row.domain, row.data_json, req.user?.id);
  saveVersionSnapshot("lesson", id, 1, JSON.parse(row.data_json), req.user?.id, `Nhân bản từ ${row.id}`);
  res.status(201).json({ id });
});

lessonPlansRouter.delete("/:id", requireRole("to_truong", "can_bo_quan_ly"), (req, res) => {
  const info = db.prepare(`DELETE FROM lesson_plans WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  res.json({ ok: true });
});

lessonPlansRouter.get("/:id/versions", (req, res) => res.json(listVersions("lesson", req.params.id)));

lessonPlansRouter.post("/:id/restore/:versionNumber", (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  const snapshot = getVersionSnapshot("lesson", req.params.id, Number(req.params.versionNumber));
  if (!snapshot) return res.status(404).json({ error: "Không tìm thấy phiên bản cần khôi phục." });
  const newVersion = row.version + 1;
  saveVersionSnapshot("lesson", row.id, newVersion, snapshot, req.user?.id, `Khôi phục từ phiên bản ${req.params.versionNumber}`);
  db.prepare(`UPDATE lesson_plans SET data_json = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(snapshot), newVersion, row.id);
  res.json({ ok: true, version: newVersion });
});

function exportContext(row: any) {
  const content = JSON.parse(row.data_json);
  const objLookup = getObjectivesByIds(collectObjectiveIds(content));
  return { content, objLookup };
}

lessonPlansRouter.get("/:id/export.docx", async (req, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  const { content, objLookup } = exportContext(row);
  const weeklyRow = db.prepare(`SELECT code FROM weekly_plans WHERE id = ?`).get(row.weekly_plan_id) as any;
  const doc = buildLessonPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const filename = `Giao_an_${slugFileName(content.date)}_${slugFileName(content.topic)}_${slugFileName(weeklyRow?.code || "")}.docx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

lessonPlansRouter.get("/:id/export.pdf", async (req, res) => {
  const row = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Không tìm thấy giáo án." });
  const { content, objLookup } = exportContext(row);
  const doc = buildLessonPlanDoc(content, objLookup, { status: PLAN_STATUS_LABELS[row.status], version: row.version });
  const buffer = await toBuffer(doc);
  const base = `Giao_an_${slugFileName(content.date)}_${slugFileName(content.topic)}`;
  try {
    const pdf = await convertDocxToPdf(buffer, base);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch {
    res.status(500).json({ error: "Không thể xuất PDF do lỗi bộ chuyển đổi trên máy chủ. Vui lòng thử lại hoặc xuất DOCX." });
  }
});
