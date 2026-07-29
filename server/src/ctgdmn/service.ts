import crypto from "node:crypto";
import { db, newId } from "../db.js";
import {
  ALL_ROLES,
  PLAN_STATUS,
  PermissionError,
  Role,
  UserLike,
  assertCan,
  can,
  isSafeHttpsUrl,
  nextPlanStatus,
} from "./permissions.js";

const IDLE_TIMEOUT_MS = 20 * 60 * 1000;

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function makePasswordHash(password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  return { hash: hashPassword(password, salt), salt };
}

function verifyPassword(password: string, hash: string, salt: string) {
  return hashPassword(password, salt) === hash;
}

// ---- Phiên đăng nhập (giữ trong bộ nhớ máy chủ, không lưu vào DB) ----------
interface Session {
  userId: string;
  createdAt: number;
  lastActiveAt: number;
}
const sessions = new Map<string, Session>();

function issueSession(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { userId, createdAt: Date.now(), lastActiveAt: Date.now() });
  return token;
}

function touchSession(token: string): string | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.lastActiveAt > IDLE_TIMEOUT_MS) {
    sessions.delete(token);
    return null;
  }
  s.lastActiveAt = Date.now();
  return s.userId;
}

export interface DbUser extends UserLike {
  username: string;
  fullName: string;
  staffId: string | null;
  position: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
}

function rowToUser(row: any): DbUser & { passwordHash: string; passwordSalt: string } {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    role: row.role,
    staffId: row.staff_id,
    position: row.position,
    teamId: row.team_id,
    classId: row.class_id,
    scopeType: row.scope_type,
    scopeValue: row.scope_value,
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at,
  };
}

function publicUser(u: ReturnType<typeof rowToUser>): DbUser {
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}

function findUserByUsername(username: string) {
  const row = db.prepare(`SELECT * FROM ctgdmn_users WHERE username = ?`).get(username) as any;
  return row ? rowToUser(row) : null;
}

function findUserById(id: string) {
  const row = db.prepare(`SELECT * FROM ctgdmn_users WHERE id = ?`).get(id) as any;
  return row ? rowToUser(row) : null;
}

export function hasAnyUser(): boolean {
  return (db.prepare(`SELECT COUNT(*) c FROM ctgdmn_users`).get() as { c: number }).c > 0;
}

function nowIso() {
  return new Date().toISOString();
}

function logActivity(actorId: string | null, action: string, target: string | null, result: "success" | "failure", detail: unknown = {}, version: string | null = null) {
  db.prepare(
    `INSERT INTO ctgdmn_activity_log (id, actor_id, action, target, version, result, detail_json) VALUES (?,?,?,?,?,?,?)`
  ).run(newId("clog"), actorId, action, target, version, result, JSON.stringify(detail ?? {}));
}

export function requireUser(token: string): DbUser {
  const userId = touchSession(token);
  if (!userId) throw new Error("Phiên làm việc đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.");
  const user = findUserById(userId);
  if (!user) throw new Error("Không tìm thấy tài khoản.");
  return publicUser(user as any);
}

export function createFirstAdmin(username: string, password: string, fullName: string) {
  if (hasAnyUser()) throw new Error("Đã có tài khoản trong hệ thống; không thể tạo quản trị đầu tiên lần nữa.");
  const id = newId("user");
  const { hash, salt } = makePasswordHash(password);
  db.prepare(
    `INSERT INTO ctgdmn_users (id, username, full_name, password_hash, password_salt, role, scope_type, active, must_change_password, created_by) VALUES (?,?,?,?,?, 'admin', 'school_wide', 1, 0, ?)`
  ).run(id, username, fullName, hash, salt, id);
  logActivity(id, "account.create_first_admin", id, "success", { username });
  const token = issueSession(id);
  return { token, user: publicUser(rowToUser(db.prepare(`SELECT * FROM ctgdmn_users WHERE id = ?`).get(id))) };
}

export function login(username: string, password: string) {
  const user = findUserByUsername(username);
  if (!user || !user.active || !verifyPassword(password, (user as any).passwordHash, (user as any).passwordSalt)) {
    logActivity(null, "auth.login", username, "failure");
    return { ok: false as const };
  }
  db.prepare(`UPDATE ctgdmn_users SET last_login_at = ? WHERE id = ?`).run(nowIso(), user.id);
  const token = issueSession(user.id);
  logActivity(user.id, "auth.login", user.id, "success");
  return { ok: true as const, token, user: publicUser(user as any) };
}

export function logout(token: string) {
  sessions.delete(token);
}

export function whoAmI(token: string) {
  try {
    return { ok: true as const, user: requireUser(token) };
  } catch {
    return { ok: false as const };
  }
}

export function changeOwnPassword(actingUser: DbUser, currentPassword: string, newPassword: string) {
  const row = db.prepare(`SELECT * FROM ctgdmn_users WHERE id = ?`).get(actingUser.id) as any;
  if (!row || !verifyPassword(currentPassword, row.password_hash, row.password_salt)) {
    logActivity(actingUser.id, "account.change_password", actingUser.id, "failure");
    throw new Error("Mật khẩu hiện tại không đúng.");
  }
  const { hash, salt } = makePasswordHash(newPassword);
  db.prepare(`UPDATE ctgdmn_users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?`).run(hash, salt, actingUser.id);
  logActivity(actingUser.id, "account.change_password", actingUser.id, "success");
}

// ---- Tài khoản --------------------------------------------------------------

export function listUsers(actingUser: DbUser): DbUser[] {
  assertCan(actingUser, "manage_accounts");
  const rows = db.prepare(`SELECT * FROM ctgdmn_users ORDER BY created_at ASC`).all() as any[];
  return rows.map((r) => publicUser(rowToUser(r)));
}

export function createUser(actingUser: DbUser, input: { username: string; fullName: string; temporaryPassword: string; role: Role; staffId?: string; position?: string; teamId?: string; classId?: string; scopeType?: string; scopeValue?: string }) {
  assertCan(actingUser, "manage_accounts");
  if (findUserByUsername(input.username)) throw new Error("Tên đăng nhập đã tồn tại.");
  if (!ALL_ROLES.includes(input.role)) throw new Error("Vai trò không hợp lệ.");
  const id = newId("user");
  const { hash, salt } = makePasswordHash(input.temporaryPassword);
  db.prepare(
    `INSERT INTO ctgdmn_users (id, username, full_name, password_hash, password_salt, role, staff_id, position, team_id, class_id, scope_type, scope_value, active, must_change_password, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 1, 1, ?)`
  ).run(id, input.username, input.fullName, hash, salt, input.role, input.staffId || null, input.position || null, input.teamId || null, input.classId || null, input.scopeType || "school_wide", input.scopeValue || null, actingUser.id);
  logActivity(actingUser.id, "account.create", id, "success", { username: input.username, role: input.role });
  return publicUser(rowToUser(db.prepare(`SELECT * FROM ctgdmn_users WHERE id = ?`).get(id)));
}

export function setAccountLocked(actingUser: DbUser, targetUserId: string, locked: boolean) {
  assertCan(actingUser, "manage_accounts");
  db.prepare(`UPDATE ctgdmn_users SET active = ? WHERE id = ?`).run(locked ? 0 : 1, targetUserId);
  logActivity(actingUser.id, locked ? "account.lock" : "account.unlock", targetUserId, "success");
}

export function adminResetPassword(actingUser: DbUser, targetUserId: string, temporaryPassword: string) {
  assertCan(actingUser, "manage_accounts");
  const { hash, salt } = makePasswordHash(temporaryPassword);
  const info = db.prepare(`UPDATE ctgdmn_users SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?`).run(hash, salt, targetUserId);
  if (info.changes === 0) throw new Error("Không tìm thấy tài khoản.");
  logActivity(actingUser.id, "account.admin_reset_password", targetUserId, "success");
}

// ---- Kế hoạch ---------------------------------------------------------------

function planRow(id: string) {
  return db.prepare(`SELECT * FROM ctgdmn_plans WHERE id = ?`).get(id) as any;
}

function rowToPlan(row: any) {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    teamId: row.team_id,
    classId: row.class_id,
    status: row.status,
    content: JSON.parse(row.content_json),
    version: row.version,
    sharedWithViewers: Boolean(row.shared_with_viewers),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getPlanRaw(planId: string) {
  const row = planRow(planId);
  return row ? rowToPlan(row) : null;
}

export function getPlan(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) return null;
  assertCan(actingUser, "view_plan", { plan });
  return plan;
}

export function listPlansForUser(actingUser: DbUser) {
  const rows = db.prepare(`SELECT * FROM ctgdmn_plans ORDER BY updated_at DESC`).all() as any[];
  return rows.map(rowToPlan).filter((plan) => can(actingUser, "view_plan", { plan }));
}

function recordHistory(planId: string, fromStatus: string | null, toStatus: string, actorId: string, note?: string | null) {
  db.prepare(`INSERT INTO ctgdmn_plan_history (id, plan_id, from_status, to_status, actor_id, note) VALUES (?,?,?,?,?,?)`).run(
    newId("hist"),
    planId,
    fromStatus,
    toStatus,
    actorId,
    note || null
  );
}

function snapshotVersion(plan: ReturnType<typeof rowToPlan>, actorId: string) {
  db.prepare(`INSERT INTO ctgdmn_plan_versions (id, plan_id, version, content_json, status_at_version, created_by) VALUES (?,?,?,?,?,?)`).run(
    newId("ver"),
    plan.id,
    plan.version,
    JSON.stringify(plan.content),
    plan.status,
    actorId
  );
}

export function createPlan(actingUser: DbUser, input: { title: string; classId?: string; content?: unknown }) {
  assertCan(actingUser, "create_plan");
  const id = newId("plan");
  db.prepare(
    `INSERT INTO ctgdmn_plans (id, title, owner_id, team_id, class_id, status, content_json, version) VALUES (?,?,?,?,?, 'draft', ?, 1)`
  ).run(id, input.title, actingUser.id, actingUser.teamId || null, input.classId || null, JSON.stringify(input.content || {}));
  recordHistory(id, null, PLAN_STATUS.DRAFT, actingUser.id, "Tạo bản nháp");
  logActivity(actingUser.id, "plan.create", id, "success", {}, "1");
  return getPlanRaw(id)!;
}

export function updatePlanContent(actingUser: DbUser, planId: string, content: unknown) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "edit_plan", { plan });
  db.prepare(`UPDATE ctgdmn_plans SET content_json = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(content), planId);
  logActivity(actingUser.id, "plan.edit", planId, "success", {}, String(plan.version));
  return getPlanRaw(planId)!;
}

export function getPlanHistory(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "view_plan", { plan });
  return db.prepare(`SELECT * FROM ctgdmn_plan_history WHERE plan_id = ? ORDER BY created_at ASC`).all(planId);
}

export function submitPlan(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "submit_plan", { plan });
  const next = nextPlanStatus(plan.status as any, "submit");
  snapshotVersion(plan, actingUser.id);
  db.prepare(`UPDATE ctgdmn_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, planId);
  recordHistory(planId, plan.status, next, actingUser.id, "Gửi rà soát");
  logActivity(actingUser.id, "plan.submit", planId, "success", {}, String(plan.version));
  return getPlanRaw(planId)!;
}

export function addComment(actingUser: DbUser, planId: string, content: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "comment_plan", { plan });
  const id = newId("cmt");
  db.prepare(`INSERT INTO ctgdmn_comments (id, plan_id, author_id, content) VALUES (?,?,?,?)`).run(id, planId, actingUser.id, content);

  let next = plan.status;
  try {
    if (plan.status === PLAN_STATUS.SUBMITTED_TO_LEAD) next = nextPlanStatus(plan.status as any, "comment");
    else if (plan.status === PLAN_STATUS.SUBMITTED_TO_ACADEMIC) next = nextPlanStatus(plan.status as any, "review");
  } catch {
    next = plan.status;
  }
  if (next !== plan.status) {
    db.prepare(`UPDATE ctgdmn_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, planId);
    recordHistory(planId, plan.status, next, actingUser.id, "Đã nhận xét");
  }
  logActivity(actingUser.id, "plan.comment", planId, "success", {}, String(plan.version));
  return db.prepare(`SELECT * FROM ctgdmn_comments WHERE id = ?`).get(id);
}

export function listComments(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "view_plan", { plan });
  return db.prepare(`SELECT * FROM ctgdmn_comments WHERE plan_id = ? ORDER BY created_at ASC`).all(planId);
}

export function returnPlanForRevision(actingUser: DbUser, planId: string, note?: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  if (!can(actingUser, "request_revision", { plan }) && !can(actingUser, "return_plan", { plan })) {
    throw new PermissionError();
  }
  const next = PLAN_STATUS.REVISING;
  db.prepare(`UPDATE ctgdmn_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, planId);
  recordHistory(planId, plan.status, next, actingUser.id, note || "Yêu cầu chỉnh sửa");
  logActivity(actingUser.id, "plan.return", planId, "success", { note }, String(plan.version));
  return getPlanRaw(planId)!;
}

export function proposeNextStage(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "comment_plan", { plan });
  const transition = plan.status === PLAN_STATUS.LEAD_COMMENTED ? "propose" : plan.status === PLAN_STATUS.ACADEMIC_REVIEWED ? "propose" : null;
  if (!transition) throw new Error("Kế hoạch chưa ở bước có thể đề nghị chuyển tiếp.");
  const next = nextPlanStatus(plan.status as any, transition as any);
  snapshotVersion(plan, actingUser.id);
  db.prepare(`UPDATE ctgdmn_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, planId);
  recordHistory(planId, plan.status, next, actingUser.id, "Đề nghị chuyển bước tiếp theo");
  logActivity(actingUser.id, "plan.propose_next", planId, "success", {}, String(plan.version));
  return getPlanRaw(planId)!;
}

export function approvePlan(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "approve_plan", { plan });
  const next = nextPlanStatus(plan.status as any, "approve");
  snapshotVersion(plan, actingUser.id);
  db.prepare(`UPDATE ctgdmn_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, planId);
  recordHistory(planId, plan.status, next, actingUser.id, "Phê duyệt");
  logActivity(actingUser.id, "plan.approve", planId, "success", {}, String(plan.version));
  return getPlanRaw(planId)!;
}

export function reviseApprovedPlan(actingUser: DbUser, planId: string) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  if (plan.ownerId !== actingUser.id || actingUser.role !== "teacher") throw new PermissionError();
  if (plan.status !== PLAN_STATUS.APPROVED) throw new Error('Chỉ kế hoạch đã phê duyệt mới áp dụng thao tác này.');
  snapshotVersion(plan, actingUser.id);
  const nextVersion = plan.version + 1;
  const next = nextPlanStatus(plan.status as any, "revise");
  db.prepare(`UPDATE ctgdmn_plans SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?`).run(next, nextVersion, planId);
  recordHistory(planId, plan.status, next, actingUser.id, `Tạo phiên bản ${nextVersion}`);
  logActivity(actingUser.id, "plan.revise_after_approval", planId, "success", {}, String(nextVersion));
  return getPlanRaw(planId)!;
}

export function markSignedExport(actingUser: DbUser, planId: string, fileInfo: unknown) {
  const plan = getPlanRaw(planId);
  if (!plan) throw new Error("Không tìm thấy kế hoạch.");
  assertCan(actingUser, "export_word_signed", { plan });
  logActivity(actingUser.id, "plan.export_word_signed", planId, "success", fileInfo, String(plan.version));
}

// ---- Nhật ký hoạt động --------------------------------------------------------

export function listActivityLog(actingUser: DbUser, limit = 200) {
  assertCan(actingUser, "view_activity_log");
  return db.prepare(`SELECT * FROM ctgdmn_activity_log ORDER BY created_at DESC LIMIT ?`).all(Math.min(limit, 1000));
}

// ---- Video hướng dẫn ----------------------------------------------------------

function rowToVideo(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    audienceRoles: JSON.parse(row.audience_roles_json),
    thumbnail: row.thumbnail,
    sourceType: row.source_type,
    sourceValue: row.source_value,
    durationSeconds: row.duration_seconds,
    sortOrder: row.sort_order,
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function listVideosForUser(actingUser: DbUser) {
  assertCan(actingUser, "view_video_catalog");
  const rows = db.prepare(`SELECT * FROM ctgdmn_videos ORDER BY sort_order ASC`).all() as any[];
  return rows.map(rowToVideo).filter((v) => v.enabled && v.audienceRoles.includes(actingUser.role));
}

export function listAllVideos(actingUser: DbUser) {
  assertCan(actingUser, "manage_video_catalog");
  return (db.prepare(`SELECT * FROM ctgdmn_videos ORDER BY sort_order ASC`).all() as any[]).map(rowToVideo);
}

export function addVideo(actingUser: DbUser, input: any) {
  assertCan(actingUser, "manage_video_catalog");
  if (input.sourceType === "online" && !isSafeHttpsUrl(input.sourceValue)) {
    throw new Error("Chỉ chấp nhận URL bắt đầu bằng https://.");
  }
  const id = newId("vid");
  db.prepare(
    `INSERT INTO ctgdmn_videos (id, title, description, category, audience_roles_json, thumbnail, source_type, source_value, duration_seconds, sort_order, enabled, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?, 1, ?)`
  ).run(id, input.title, input.description || "", input.category, JSON.stringify(input.audienceRoles || ALL_ROLES), input.thumbnail || null, input.sourceType, input.sourceValue, input.durationSeconds || null, input.sortOrder || 0, actingUser.id);
  logActivity(actingUser.id, "video.add", id, "success", { title: input.title });
  return rowToVideo(db.prepare(`SELECT * FROM ctgdmn_videos WHERE id = ?`).get(id));
}

export function updateVideo(actingUser: DbUser, videoId: string, patch: any) {
  assertCan(actingUser, "manage_video_catalog");
  const existing = db.prepare(`SELECT * FROM ctgdmn_videos WHERE id = ?`).get(videoId) as any;
  if (!existing) throw new Error("Không tìm thấy video.");
  if (patch.sourceType === "online" && patch.sourceValue && !isSafeHttpsUrl(patch.sourceValue)) {
    throw new Error("Chỉ chấp nhận URL bắt đầu bằng https://.");
  }
  const merged = {
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    category: patch.category ?? existing.category,
    audience_roles_json: patch.audienceRoles ? JSON.stringify(patch.audienceRoles) : existing.audience_roles_json,
    thumbnail: patch.thumbnail ?? existing.thumbnail,
    source_type: patch.sourceType ?? existing.source_type,
    source_value: patch.sourceValue ?? existing.source_value,
    duration_seconds: patch.durationSeconds ?? existing.duration_seconds,
    sort_order: patch.sortOrder ?? existing.sort_order,
    enabled: patch.enabled === undefined ? existing.enabled : patch.enabled ? 1 : 0,
  };
  db.prepare(
    `UPDATE ctgdmn_videos SET title=?, description=?, category=?, audience_roles_json=?, thumbnail=?, source_type=?, source_value=?, duration_seconds=?, sort_order=?, enabled=?, updated_at=datetime('now'), updated_by=? WHERE id=?`
  ).run(merged.title, merged.description, merged.category, merged.audience_roles_json, merged.thumbnail, merged.source_type, merged.source_value, merged.duration_seconds, merged.sort_order, merged.enabled, actingUser.id, videoId);
  logActivity(actingUser.id, "video.update", videoId, "success", patch);
  return rowToVideo(db.prepare(`SELECT * FROM ctgdmn_videos WHERE id = ?`).get(videoId));
}

export function deleteVideo(actingUser: DbUser, videoId: string) {
  assertCan(actingUser, "manage_video_catalog");
  const video = db.prepare(`SELECT * FROM ctgdmn_videos WHERE id = ?`).get(videoId) as any;
  db.prepare(`DELETE FROM ctgdmn_videos WHERE id = ?`).run(videoId);
  logActivity(actingUser.id, "video.delete", videoId, "success");
  return video ? rowToVideo(video) : null;
}

// ---- Sao lưu / khôi phục -------------------------------------------------------

export function exportBackupData(actingUser: DbUser) {
  assertCan(actingUser, "backup_restore");
  logActivity(actingUser.id, "backup.export", null, "success");
  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    users: (db.prepare(`SELECT * FROM ctgdmn_users`).all() as any[]).map(rowToUser),
    plans: (db.prepare(`SELECT * FROM ctgdmn_plans`).all() as any[]).map(rowToPlan),
    planVersions: db.prepare(`SELECT * FROM ctgdmn_plan_versions`).all(),
    planHistory: db.prepare(`SELECT * FROM ctgdmn_plan_history`).all(),
    comments: db.prepare(`SELECT * FROM ctgdmn_comments`).all(),
    videos: (db.prepare(`SELECT * FROM ctgdmn_videos`).all() as any[]).map(rowToVideo),
    activityLog: db.prepare(`SELECT * FROM ctgdmn_activity_log`).all(),
  };
}

export function restoreBackupData(actingUser: DbUser, backup: any) {
  assertCan(actingUser, "backup_restore");
  if (!backup || backup.schemaVersion !== 1) {
    throw new Error("Tệp sao lưu không hợp lệ hoặc không đúng phiên bản cấu trúc.");
  }
  const tx = db.transaction(() => {
    db.exec(`DELETE FROM ctgdmn_comments; DELETE FROM ctgdmn_plan_history; DELETE FROM ctgdmn_plan_versions; DELETE FROM ctgdmn_plans; DELETE FROM ctgdmn_videos; DELETE FROM ctgdmn_activity_log; DELETE FROM ctgdmn_users;`);
    const insUser = db.prepare(
      `INSERT INTO ctgdmn_users (id, username, full_name, password_hash, password_salt, role, staff_id, position, team_id, class_id, scope_type, scope_value, active, must_change_password, created_at, created_by, last_login_at) VALUES (@id,@username,@fullName,@passwordHash,@passwordSalt,@role,@staffId,@position,@teamId,@classId,@scopeType,@scopeValue,@active,@mustChangePassword,@createdAt,@createdBy,@lastLoginAt)`
    );
    for (const u of backup.users || []) {
      insUser.run({
        id: u.id, username: u.username, fullName: u.fullName, passwordHash: u.passwordHash || "restored", passwordSalt: u.passwordSalt || "restored",
        role: u.role, staffId: u.staffId ?? null, position: u.position ?? null, teamId: u.teamId ?? null, classId: u.classId ?? null,
        scopeType: u.scopeType || "school_wide", scopeValue: u.scopeValue ?? null, active: u.active ? 1 : 0, mustChangePassword: u.mustChangePassword ? 1 : 0,
        createdAt: u.createdAt || nowIso(), createdBy: u.createdBy ?? null, lastLoginAt: u.lastLoginAt ?? null,
      });
    }
    const insPlan = db.prepare(
      `INSERT INTO ctgdmn_plans (id, title, owner_id, team_id, class_id, status, content_json, version, shared_with_viewers, created_at, updated_at) VALUES (@id,@title,@ownerId,@teamId,@classId,@status,@content,@version,@shared,@createdAt,@updatedAt)`
    );
    for (const p of backup.plans || []) {
      insPlan.run({
        id: p.id, title: p.title, ownerId: p.ownerId, teamId: p.teamId ?? null, classId: p.classId ?? null, status: p.status,
        content: JSON.stringify(p.content || {}), version: p.version || 1, shared: p.sharedWithViewers ? 1 : 0,
        createdAt: p.createdAt || nowIso(), updatedAt: p.updatedAt || nowIso(),
      });
    }
    const insVer = db.prepare(`INSERT INTO ctgdmn_plan_versions (id, plan_id, version, content_json, status_at_version, created_at, created_by) VALUES (?,?,?,?,?,?,?)`);
    for (const v of backup.planVersions || []) insVer.run(v.id, v.planId ?? v.plan_id, v.version, JSON.stringify(v.content ?? JSON.parse(v.content_json || "{}")), v.statusAtVersion ?? v.status_at_version, v.createdAt ?? v.created_at, v.createdBy ?? v.created_by);
    const insHist = db.prepare(`INSERT INTO ctgdmn_plan_history (id, plan_id, from_status, to_status, actor_id, note, created_at) VALUES (?,?,?,?,?,?,?)`);
    for (const h of backup.planHistory || []) insHist.run(h.id, h.plan_id, h.from_status, h.to_status, h.actor_id, h.note, h.created_at);
    const insCmt = db.prepare(`INSERT INTO ctgdmn_comments (id, plan_id, author_id, content, created_at) VALUES (?,?,?,?,?)`);
    for (const c of backup.comments || []) insCmt.run(c.id, c.plan_id, c.author_id, c.content, c.created_at);
    const insVid = db.prepare(
      `INSERT INTO ctgdmn_videos (id, title, description, category, audience_roles_json, thumbnail, source_type, source_value, duration_seconds, sort_order, enabled, updated_at, updated_by) VALUES (@id,@title,@description,@category,@audienceRoles,@thumbnail,@sourceType,@sourceValue,@durationSeconds,@sortOrder,@enabled,@updatedAt,@updatedBy)`
    );
    for (const v of backup.videos || []) {
      insVid.run({
        id: v.id, title: v.title, description: v.description || "", category: v.category, audienceRoles: JSON.stringify(v.audienceRoles || []),
        thumbnail: v.thumbnail ?? null, sourceType: v.sourceType, sourceValue: v.sourceValue, durationSeconds: v.durationSeconds ?? null,
        sortOrder: v.sortOrder || 0, enabled: v.enabled ? 1 : 0, updatedAt: v.updatedAt || nowIso(), updatedBy: v.updatedBy ?? null,
      });
    }
    const insLog = db.prepare(`INSERT INTO ctgdmn_activity_log (id, actor_id, action, target, version, result, detail_json, created_at) VALUES (?,?,?,?,?,?,?,?)`);
    for (const l of backup.activityLog || []) insLog.run(l.id, l.actor_id, l.action, l.target, l.version, l.result, JSON.stringify(l.detail ?? l.detail_json ?? {}), l.created_at);
  });
  tx();
  logActivity(actingUser.id, "backup.restore", null, "success");
}

export function migrateLegacyLocalStorage(actingUser: DbUser, legacyExport: { plans?: any[] }) {
  assertCan(actingUser, "backup_restore");
  const legacyPlans = Array.isArray(legacyExport?.plans) ? legacyExport.plans : [];
  let migrated = 0;
  for (const legacyPlan of legacyPlans) {
    const id = newId("plan");
    db.prepare(
      `INSERT INTO ctgdmn_plans (id, title, owner_id, status, content_json, version) VALUES (?,?,?, 'draft', ?, 1)`
    ).run(id, legacyPlan.title || "Kế hoạch chưa đặt tên (di chuyển từ dữ liệu cũ)", actingUser.id, JSON.stringify(legacyPlan));
    recordHistory(id, null, PLAN_STATUS.DRAFT, actingUser.id, "Di chuyển từ localStorage bản cũ");
    migrated += 1;
  }
  logActivity(actingUser.id, "migration.legacy_localstorage", null, "success", { count: migrated });
  return { migrated };
}
