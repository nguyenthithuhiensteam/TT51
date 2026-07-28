import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import type { School, SchoolYear, User } from "./types";

export async function getSchool(): Promise<School | null> {
  const rows = await dbSelect<School>("SELECT * FROM schools LIMIT 1");
  return rows[0] ?? null;
}

export async function updateSchool(
  id: string,
  data: { name: string; address?: string; phone?: string; principalName?: string },
): Promise<void> {
  await dbExecute(
    "UPDATE schools SET name = ?, address = ?, phone = ?, principal_name = ?, updated_at = ? WHERE id = ?",
    [data.name, data.address ?? null, data.phone ?? null, data.principalName ?? null, nowIso(), id],
  );
}

export async function listSchoolYears(schoolId: string): Promise<SchoolYear[]> {
  return dbSelect<SchoolYear>(
    "SELECT * FROM school_years WHERE school_id = ? ORDER BY start_date DESC",
    [schoolId],
  );
}

export async function getCurrentSchoolYear(schoolId: string): Promise<SchoolYear | null> {
  const rows = await dbSelect<SchoolYear>(
    "SELECT * FROM school_years WHERE school_id = ? AND is_current = 1 LIMIT 1",
    [schoolId],
  );
  return rows[0] ?? null;
}

export async function createSchoolYear(
  schoolId: string,
  code: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO school_years (id, school_id, code, start_date, end_date, is_current, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [newId(), schoolId, code, startDate, endDate, nowIso(), nowIso()],
  );
}

export async function setCurrentSchoolYear(schoolId: string, schoolYearId: string): Promise<void> {
  await dbExecute("UPDATE school_years SET is_current = 0, updated_at = ? WHERE school_id = ?", [
    nowIso(),
    schoolId,
  ]);
  await dbExecute("UPDATE school_years SET is_current = 1, updated_at = ? WHERE id = ?", [
    nowIso(),
    schoolYearId,
  ]);
}

export async function listActiveUsers(): Promise<User[]> {
  return dbSelect<User>(
    "SELECT * FROM users WHERE deleted_at IS NULL AND is_active = 1 ORDER BY full_name ASC",
  );
}
