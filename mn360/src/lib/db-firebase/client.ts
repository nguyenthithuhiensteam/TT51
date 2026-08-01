import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";

export { db };

/** Tiền tố chung cho mọi collection của MN360 trong project Firestore dùng chung với
 * Cổng minh chứng kiểm định — tránh trùng tên với các collection "users"/"criteria"/... của
 * dự án đó. */
export const COL = {
  users: "mn360_users",
  roles: "mn360_roles",
  schools: "mn360_schools",
  schoolYears: "mn360_school_years",
  tasks: "mn360_tasks",
  taskAssignees: "mn360_task_assignees",
  taskStatusHistory: "mn360_task_status_history",
  taskComments: "mn360_task_comments",
  taskEvidence: "mn360_task_evidence",
  notifications: "mn360_notifications",
  auditLogs: "mn360_audit_logs",
  counters: "mn360_counters",
  classes: "mn360_classes",
  children: "mn360_children",
  childStatusHistory: "mn360_child_status_history",
  attendance: "mn360_attendance",
  childLeaveRequests: "mn360_child_leave_requests",
  parentMessages: "mn360_parent_messages",
  staff: "mn360_staff",
  staffAssignments: "mn360_staff_assignments",
  staffLeaves: "mn360_staff_leaves",
  staffEvaluations: "mn360_staff_evaluations",
  partyMembers: "mn360_party_members",
  partyMeetings: "mn360_party_meetings",
  partyMeetingMinutes: "mn360_party_meeting_minutes",
  partyResolutions: "mn360_party_resolutions",
  resolutionTracking: "mn360_resolution_tracking",
  partyMemberEvaluations: "mn360_party_member_evaluations",
  partyFees: "mn360_party_fees",
  educationPlans: "mn360_education_plans",
  planApprovals: "mn360_plan_approvals",
  observations: "mn360_observations",
  childAssessments: "mn360_child_assessments",
  dishes: "mn360_dishes",
  menus: "mn360_menus",
  menuItems: "mn360_menu_items",
  suppliers: "mn360_suppliers",
  foodDeliveries: "mn360_food_deliveries",
  threeStepInspections: "mn360_three_step_inspections",
  healthRecords: "mn360_health_records",
  systemSettings: "mn360_system_settings",
  foods: "mn360_foods",
  nutritionNorms: "mn360_nutrition_norms",
  dailyRations: "mn360_daily_rations",
  rationItems: "mn360_ration_items",
  growthMeasurements: "mn360_growth_measurements",
  whoGrowthStandards: "mn360_who_growth_standards",
  vaccinations: "mn360_vaccinations",
  physicalExams: "mn360_physical_exams",
  incidents: "mn360_incidents",
  safetyInspections: "mn360_safety_inspections",
  feeItems: "mn360_fee_items",
  revenues: "mn360_revenues",
  expenses: "mn360_expenses",
  assets: "mn360_assets",
  assetStatusHistory: "mn360_asset_status_history",
  accreditationStandards: "mn360_accreditation_standards",
  accreditationCriteria: "mn360_accreditation_criteria",
  criteriaAssignments: "mn360_criteria_assignments",
  evidenceFiles: "mn360_evidence_files",
  criteriaEvidenceLinks: "mn360_criteria_evidence_links",
} as const;

export function nowIso(): string {
  return new Date().toISOString();
}

/** Sinh số thứ tự tăng dần an toàn khi nhiều người dùng cùng thao tác, dùng transaction thay
 * cho SELECT COUNT(*) (không an toàn khi có ghi đồng thời trên Firestore). */
export async function nextSequence(counterKey: string): Promise<number> {
  const ref = doc(db, COL.counters, counterKey);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists() ? (snap.data().value as number) : 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}
