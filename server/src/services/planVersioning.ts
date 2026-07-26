import { db, newId } from "../db.js";

export type PlanTypeKey = "annual" | "theme" | "weekly" | "lesson";

export function saveVersionSnapshot(planType: PlanTypeKey, planId: string, versionNumber: number, content: unknown, editedBy: string | undefined, changeNote?: string) {
  db.prepare(
    `INSERT INTO plan_versions (id, plan_type, plan_id, version_number, snapshot_json, change_note, edited_by) VALUES (?,?,?,?,?,?,?)`
  ).run(newId("ver"), planType, planId, versionNumber, JSON.stringify(content), changeNote || null, editedBy || null);
}

export function listVersions(planType: PlanTypeKey, planId: string) {
  return db
    .prepare(`SELECT id, version_number, change_note, edited_by, edited_at FROM plan_versions WHERE plan_type = ? AND plan_id = ? ORDER BY version_number DESC`)
    .all(planType, planId);
}

export function getVersionSnapshot(planType: PlanTypeKey, planId: string, versionNumber: number) {
  const row = db
    .prepare(`SELECT snapshot_json FROM plan_versions WHERE plan_type = ? AND plan_id = ? AND version_number = ?`)
    .get(planType, planId, versionNumber) as { snapshot_json: string } | undefined;
  if (!row) return undefined;
  return JSON.parse(row.snapshot_json);
}
