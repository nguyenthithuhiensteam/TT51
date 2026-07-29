// Chuyển thể trực tiếp từ webapp/ctgdmn-web/src/browser-backend.js (mục 2:
// "Tầng bảo mật / phân quyền") sang TypeScript phía máy chủ. Giữ nguyên tên
// vai trò, tên trạng thái và quy tắc chuyển trạng thái để không phải sửa
// webapp/ctgdmn-web/src/app.js hay auth-client.js.

export const ROLES = {
  ADMIN: "admin",
  PRINCIPAL: "principal",
  VICE_PRINCIPAL: "vice_principal",
  TEAM_LEAD: "team_lead",
  TEACHER: "teacher",
  VIEWER: "viewer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ALL_ROLES: Role[] = Object.values(ROLES);

export const PLAN_STATUS = {
  DRAFT: "draft",
  SUBMITTED_TO_LEAD: "submitted_to_lead",
  LEAD_COMMENTED: "lead_commented",
  REVISING: "revising",
  SUBMITTED_TO_ACADEMIC: "submitted_to_academic",
  ACADEMIC_REVIEWED: "academic_reviewed",
  SUBMITTED_FOR_APPROVAL: "submitted_for_approval",
  APPROVED: "approved",
} as const;
export type PlanStatusValue = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

const BASE_PERMISSIONS: Record<string, Role[]> = {
  manage_accounts: [ROLES.ADMIN],
  configure_school: [ROLES.ADMIN],
  manage_permissions: [ROLES.ADMIN],
  backup_restore: [ROLES.ADMIN],
  manage_video_catalog: [ROLES.ADMIN],
  view_activity_log: [ROLES.ADMIN],
  view_school_wide: [ROLES.ADMIN, ROLES.PRINCIPAL],
  view_reports: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
  create_plan: [ROLES.TEACHER],
  edit_own_draft: [ROLES.TEACHER],
  submit_plan: [ROLES.TEACHER],
  comment_plan: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEAD],
  request_revision: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEAD],
  assign_review: [ROLES.VICE_PRINCIPAL],
  propose_approval: [ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEAD],
  approve_or_return: [ROLES.PRINCIPAL],
  export_word_signed: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
  view_video_catalog: ALL_ROLES,
  view_open_data: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEAD, ROLES.TEACHER],
};

export class PermissionError extends Error {
  constructor(message = "Không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "PermissionError";
  }
}

export interface UserLike {
  id: string;
  role: Role;
  active: boolean;
  teamId?: string | null;
  classId?: string | null;
  scopeType?: string | null;
  scopeValue?: string | null;
}

export interface PlanLike {
  ownerId: string;
  teamId?: string | null;
  classId?: string | null;
  status: PlanStatusValue;
  sharedWithViewers?: boolean;
}

function hasBaseCapability(role: Role, action: string): boolean {
  const allowedRoles = BASE_PERMISSIONS[action];
  return Boolean(allowedRoles && allowedRoles.includes(role));
}

function isSameTeam(user: UserLike, plan: PlanLike): boolean {
  return Boolean(user.teamId) && user.teamId === plan.teamId;
}

function isWithinAssignedScope(user: UserLike, plan: PlanLike): boolean {
  if (!user.scopeType || user.scopeType === "school_wide") return true;
  if (user.scopeType === "team") return user.scopeValue === plan.teamId;
  if (user.scopeType === "class") return user.scopeValue === plan.classId;
  return false;
}

export function canViewPlan(user: UserLike, plan: PlanLike): boolean {
  if (!user || !user.active) return false;
  switch (user.role) {
    case ROLES.ADMIN:
    case ROLES.PRINCIPAL:
      return true;
    case ROLES.VICE_PRINCIPAL:
      return isWithinAssignedScope(user, plan);
    case ROLES.TEAM_LEAD:
      return isSameTeam(user, plan);
    case ROLES.TEACHER:
      return plan.ownerId === user.id;
    case ROLES.VIEWER:
      return Boolean(plan.sharedWithViewers);
    default:
      return false;
  }
}

export function canEditPlan(user: UserLike, plan: PlanLike): boolean {
  if (!user || !user.active) return false;
  if (user.role !== ROLES.TEACHER) return false;
  if (plan.ownerId !== user.id) return false;
  return plan.status === PLAN_STATUS.DRAFT || plan.status === PLAN_STATUS.REVISING;
}

export function canSubmitPlan(user: UserLike, plan: PlanLike): boolean {
  if (!canEditPlan(user, plan)) return false;
  return plan.status === PLAN_STATUS.DRAFT || plan.status === PLAN_STATUS.REVISING;
}

export function canCommentPlan(user: UserLike, plan: PlanLike): boolean {
  if (!user || !user.active) return false;
  if (!hasBaseCapability(user.role, "comment_plan")) return false;
  return canViewPlan(user, plan);
}

export function canApprovePlan(user: UserLike, plan: PlanLike): boolean {
  if (!user || !user.active) return false;
  if (user.role !== ROLES.PRINCIPAL) return false;
  if (plan.ownerId === user.id) return false;
  return plan.status === PLAN_STATUS.SUBMITTED_FOR_APPROVAL;
}

export function canExportSignedWord(user: UserLike, plan: PlanLike): boolean {
  if (!user || !user.active) return false;
  if (!hasBaseCapability(user.role, "export_word_signed")) return false;
  return canViewPlan(user, plan);
}

export function can(user: UserLike, action: string, context: { plan?: PlanLike } = {}): boolean {
  if (!user || user.active === false) return false;
  switch (action) {
    case "view_plan":
      return context.plan ? canViewPlan(user, context.plan) : false;
    case "create_plan":
      return hasBaseCapability(user.role, "create_plan");
    case "edit_plan":
      return context.plan ? canEditPlan(user, context.plan) : false;
    case "submit_plan":
      return context.plan ? canSubmitPlan(user, context.plan) : false;
    case "comment_plan":
      return context.plan ? canCommentPlan(user, context.plan) : false;
    case "request_revision":
      return context.plan ? canCommentPlan(user, context.plan) : false;
    case "approve_plan":
    case "return_plan":
      return context.plan ? canApprovePlan(user, context.plan) : false;
    case "export_word_signed":
      return context.plan ? canExportSignedWord(user, context.plan) : false;
    case "view_activity_log":
      return hasBaseCapability(user.role, "view_activity_log");
    case "manage_accounts":
      return hasBaseCapability(user.role, "manage_accounts");
    case "manage_permissions":
      return hasBaseCapability(user.role, "manage_permissions");
    case "backup_restore":
      return hasBaseCapability(user.role, "backup_restore");
    case "manage_video_catalog":
      return hasBaseCapability(user.role, "manage_video_catalog");
    case "view_video_catalog":
      return hasBaseCapability(user.role, "view_video_catalog");
    case "view_open_data":
      return hasBaseCapability(user.role, "view_open_data");
    case "view_reports":
      return hasBaseCapability(user.role, "view_reports");
    case "write_data":
      return user.role !== ROLES.VIEWER;
    default:
      return false;
  }
}

export function assertCan(user: UserLike, action: string, context: { plan?: PlanLike } = {}) {
  if (!can(user, action, context)) throw new PermissionError();
}

type Transition = "submit" | "comment" | "return" | "propose" | "review" | "approve" | "revise";

export function nextPlanStatus(current: PlanStatusValue, transition: Transition): PlanStatusValue {
  const table: Partial<Record<PlanStatusValue, Partial<Record<Transition, PlanStatusValue>>>> = {
    [PLAN_STATUS.DRAFT]: { submit: PLAN_STATUS.SUBMITTED_TO_LEAD },
    [PLAN_STATUS.SUBMITTED_TO_LEAD]: { comment: PLAN_STATUS.LEAD_COMMENTED, return: PLAN_STATUS.REVISING },
    [PLAN_STATUS.LEAD_COMMENTED]: { propose: PLAN_STATUS.SUBMITTED_TO_ACADEMIC, return: PLAN_STATUS.REVISING },
    [PLAN_STATUS.REVISING]: { submit: PLAN_STATUS.SUBMITTED_TO_LEAD },
    [PLAN_STATUS.SUBMITTED_TO_ACADEMIC]: { review: PLAN_STATUS.ACADEMIC_REVIEWED, return: PLAN_STATUS.REVISING },
    [PLAN_STATUS.ACADEMIC_REVIEWED]: { propose: PLAN_STATUS.SUBMITTED_FOR_APPROVAL, return: PLAN_STATUS.REVISING },
    [PLAN_STATUS.SUBMITTED_FOR_APPROVAL]: { approve: PLAN_STATUS.APPROVED, return: PLAN_STATUS.REVISING },
    [PLAN_STATUS.APPROVED]: { revise: PLAN_STATUS.REVISING },
  };
  const next = table[current]?.[transition];
  if (!next) throw new Error(`Không thể chuyển trạng thái từ "${current}" bằng thao tác "${transition}".`);
  return next;
}

export function isSafeHttpsUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}
