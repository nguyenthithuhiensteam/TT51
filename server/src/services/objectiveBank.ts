import { db } from "../db.js";

export interface ObjectiveRow {
  id: string;
  code: string;
  age_group: string;
  domain: string;
  statement: string;
  source_ref: string | null;
  active: number;
}

export function listObjectives(ageGroup?: string, domain?: string): ObjectiveRow[] {
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
  sql += ` ORDER BY domain, code`;
  return db.prepare(sql).all(...params) as ObjectiveRow[];
}

export function getObjectiveIdsSet(ageGroup: string): Set<string> {
  const rows = db.prepare(`SELECT id FROM curriculum_objectives WHERE active = 1 AND age_group = ?`).all(ageGroup) as {
    id: string;
  }[];
  return new Set(rows.map((r) => r.id));
}

export function getObjectiveById(id: string): ObjectiveRow | undefined {
  return db.prepare(`SELECT * FROM curriculum_objectives WHERE id = ?`).get(id) as ObjectiveRow | undefined;
}

export function getObjectivesByIds(ids: string[]): Record<string, { code: string; statement: string }> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};
  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = db.prepare(`SELECT id, code, statement FROM curriculum_objectives WHERE id IN (${placeholders})`).all(...uniqueIds) as {
    id: string;
    code: string;
    statement: string;
  }[];
  const map: Record<string, { code: string; statement: string }> = {};
  for (const r of rows) map[r.id] = { code: r.code, statement: r.statement };
  return map;
}

/** Thu thập mọi objectiveId xuất hiện trong nội dung JSON (đệ quy). */
export function collectObjectiveIds(content: any): string[] {
  const ids: string[] = [];
  function walk(node: any) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "objectiveId" && typeof value === "string" && value) ids.push(value);
        if (key === "objectiveIds" && Array.isArray(value)) ids.push(...value.filter((v) => typeof v === "string"));
        walk(value);
      }
    }
  }
  walk(content);
  return ids;
}

/**
 * Duyệt đệ quy một nội dung JSON, thu thập mọi khoá objectiveId/objectiveIds
 * và trả về danh sách mã không tồn tại trong ngân hàng mục tiêu của độ tuổi.
 * Đồng thời làm sạch (xoá) các mã không hợp lệ khỏi nội dung để tránh mã mục
 * tiêu bịa đặt lọt ra giao diện.
 */
export function stripInvalidObjectiveIds(content: any, ageGroup: string): { cleaned: any; invalidCodes: string[] } {
  const validIds = getObjectiveIdsSet(ageGroup);
  const invalid = new Set<string>();

  function walk(node: any): any {
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === "object") {
      const out: any = {};
      for (const [key, value] of Object.entries(node)) {
        if (key === "objectiveId" && typeof value === "string") {
          if (value && !validIds.has(value)) {
            invalid.add(value);
            out[key] = "";
            continue;
          }
        }
        if (key === "objectiveIds" && Array.isArray(value)) {
          const filtered = value.filter((v) => {
            if (typeof v !== "string") return false;
            if (!validIds.has(v)) {
              invalid.add(v);
              return false;
            }
            return true;
          });
          out[key] = filtered;
          continue;
        }
        out[key] = walk(value);
      }
      return out;
    }
    return node;
  }

  return { cleaned: walk(content), invalidCodes: Array.from(invalid) };
}
