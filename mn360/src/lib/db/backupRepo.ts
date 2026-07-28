import { invoke } from "@tauri-apps/api/core";
import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";

export interface BackupRow {
  id: string;
  file_path: string;
  size_bytes: number | null;
  kind: "manual" | "auto";
  created_by: string;
  created_at: string;
  note: string | null;
}

export async function runBackup(
  backupDir: string,
  createdBy: string,
  kind: "manual" | "auto" = "manual",
): Promise<string> {
  const filePath = await invoke<string>("backup_database", { backupDir });
  await dbExecute(
    "INSERT INTO backups (id, file_path, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), filePath, kind, createdBy, nowIso()],
  );
  return filePath;
}

export async function runRestore(backupPath: string): Promise<string> {
  return invoke<string>("restore_database", { backupPath });
}

export async function listBackupFiles(backupDir: string): Promise<string[]> {
  return invoke<string[]>("list_backups", { backupDir });
}

export async function listBackupHistory(limit = 20): Promise<BackupRow[]> {
  return dbSelect<BackupRow>("SELECT * FROM backups ORDER BY created_at DESC LIMIT ?", [limit]);
}

export async function getDataDir(): Promise<string> {
  return invoke<string>("get_data_dir");
}

export async function setDataDir(newDir: string): Promise<string> {
  return invoke<string>("set_data_dir", { newDir });
}
