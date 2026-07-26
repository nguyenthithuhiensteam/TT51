import { db, newId } from "../db.js";
import seedData from "./objectives.seed.json" with { type: "json" };

export function ensureSeedObjectives() {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM curriculum_objectives`).get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO curriculum_objectives (id, code, age_group, domain, statement, source_ref) VALUES (?,?,?,?,?,?)`
  );
  const tx = db.transaction(() => {
    for (const item of seedData.items) {
      insert.run(newId("obj"), item.code, seedData.age_group, item.domain, item.statement, seedData.source_ref);
    }
  });
  tx();
}
