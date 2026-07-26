import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('giao_vien','to_truong','can_bo_quan_ly')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curriculum_objectives (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  age_group TEXT NOT NULL CHECK (age_group IN ('3-4','4-5','5-6')),
  domain TEXT NOT NULL CHECK (domain IN ('the_chat','tinh_cam_ky_nang_xa_hoi','ngon_ngu','nhan_thuc','tham_my')),
  statement TEXT NOT NULL,
  source_ref TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(code, age_group)
);

CREATE TABLE IF NOT EXISTS annual_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  school_year TEXT NOT NULL,
  class_group TEXT NOT NULL,
  age_group TEXT NOT NULL,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','cho_duyet','da_duyet','can_dieu_chinh')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  annual_plan_id TEXT NOT NULL REFERENCES annual_plans(id) ON DELETE RESTRICT,
  theme_name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','cho_duyet','da_duyet','can_dieu_chinh')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  theme_plan_id TEXT NOT NULL REFERENCES theme_plans(id) ON DELETE RESTRICT,
  week_number INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','cho_duyet','da_duyet','can_dieu_chinh')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  weekly_plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE RESTRICT,
  plan_date TEXT NOT NULL,
  domain TEXT NOT NULL,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','cho_duyet','da_duyet','can_dieu_chinh')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan_versions (
  id TEXT PRIMARY KEY,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('annual','theme','weekly','lesson')),
  plan_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_note TEXT,
  edited_by TEXT,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  endpoint TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  plan_type TEXT
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  compatible_base_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO ai_settings (id, provider, model) VALUES (1, 'gemini', 'gemini-2.0-flash');
`);

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
