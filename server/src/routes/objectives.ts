import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";

export const objectivesRouter = Router();
objectivesRouter.use(requireAuth);

objectivesRouter.get("/", (req, res) => {
  const { ageGroup, domain, search } = req.query as { ageGroup?: string; domain?: string; search?: string };
  let sql = `SELECT * FROM curriculum_objectives WHERE active = 1`;
  const params: any[] = [];
  if (ageGroup) {
    sql += ` AND age_group = ?`;
    params.push(ageGroup);
  }
  if (domain) {
    sql += ` AND domain = ?`;
    params.push(domain);
  }
  if (search) {
    sql += ` AND (code LIKE ? OR statement LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY age_group, domain, code`;
  res.json(db.prepare(sql).all(...params));
});

objectivesRouter.post("/", requireRole("to_truong", "can_bo_quan_ly"), (req: AuthedRequest, res) => {
  const { code, ageGroup, domain, statement, sourceRef } = req.body;
  if (!code || !ageGroup || !domain || !statement) {
    return res.status(400).json({ error: "Thiếu mã mục tiêu, độ tuổi, lĩnh vực hoặc nội dung yêu cầu cần đạt." });
  }
  const id = newId("obj");
  try {
    db.prepare(
      `INSERT INTO curriculum_objectives (id, code, age_group, domain, statement, source_ref) VALUES (?,?,?,?,?,?)`
    ).run(id, code, ageGroup, domain, statement, sourceRef || null);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: `Mã mục tiêu "${code}" đã tồn tại cho độ tuổi ${ageGroup}.` });
    }
    throw e;
  }
  res.status(201).json({ id });
});

objectivesRouter.put("/:id", requireRole("to_truong", "can_bo_quan_ly"), (req, res) => {
  const { statement, sourceRef, active } = req.body;
  const existing = db.prepare(`SELECT * FROM curriculum_objectives WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Không tìm thấy mục tiêu." });
  db.prepare(`UPDATE curriculum_objectives SET statement = COALESCE(?, statement), source_ref = COALESCE(?, source_ref), active = COALESCE(?, active) WHERE id = ?`).run(
    statement ?? null,
    sourceRef ?? null,
    active === undefined ? null : active ? 1 : 0,
    req.params.id
  );
  res.json({ ok: true });
});

objectivesRouter.delete("/:id", requireRole("can_bo_quan_ly"), (req, res) => {
  // Vô hiệu hoá thay vì xoá cứng để không phá vỡ các kế hoạch đã tham chiếu mục tiêu này.
  const info = db.prepare(`UPDATE curriculum_objectives SET active = 0 WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Không tìm thấy mục tiêu." });
  res.json({ ok: true });
});
