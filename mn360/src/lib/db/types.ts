export type RecordStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "needs_revision"
  | "approved"
  | "signed"
  | "published"
  | "locked"
  | "archived"
  | "cancelled";

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Bản nháp",
  submitted: "Đã gửi",
  pending_approval: "Chờ duyệt",
  needs_revision: "Yêu cầu điều chỉnh",
  approved: "Đã phê duyệt",
  signed: "Đã ký",
  published: "Đã ban hành",
  locked: "Đã khóa",
  archived: "Đã lưu trữ",
  cancelled: "Đã hủy",
};

export interface School {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  principal_name: string | null;
  data_dir: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolYear {
  id: string;
  school_id: string;
  code: string;
  start_date: string;
  end_date: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  password_algo: string;
  must_change_password: number;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: number;
}

export const ROLE_LABELS: Record<string, string> = {
  system_admin: "Quản trị hệ thống",
  principal: "Hiệu trưởng",
  vice_principal: "Phó hiệu trưởng",
  team_lead: "Tổ trưởng",
  teacher: "Giáo viên",
  clerk: "Văn thư",
  accountant: "Kế toán",
  nurse: "Nhân viên y tế",
  nutrition_staff: "Nhân viên nuôi dưỡng",
  party_committee: "Cấp ủy",
  parent: "Phụ huynh",
  tech_admin: "Quản trị kỹ thuật",
};

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export interface Task {
  id: string;
  code: string;
  school_year_id: string;
  title: string;
  field: string | null;
  content: string | null;
  priority: TaskPriority;
  assigned_by: string | null;
  owner_id: string;
  start_date: string | null;
  due_date: string | null;
  deliverable: string | null;
  done_criteria: string | null;
  progress_percent: number;
  difficulty: string | null;
  proposal: string | null;
  review_comment: string | null;
  approval_result: string | null;
  status: RecordStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskWithOwner extends Task {
  owner_name: string;
  assigned_by_name: string | null;
}

export type DocumentType = "incoming" | "outgoing" | "internal" | "draft";

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  incoming: "Văn bản đến",
  outgoing: "Văn bản đi",
  internal: "Văn bản nội bộ",
  draft: "Dự thảo",
};

export interface SchoolClass {
  id: string;
  school_year_id: string;
  code: string;
  name: string;
  age_group: string;
  homeroom_teacher_id: string | null;
  room: string | null;
  capacity: number | null;
  status: RecordStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export type ChildStatus =
  | "studying"
  | "transferred_class"
  | "reserved"
  | "transferred_school"
  | "dropped_out"
  | "completed";

export const CHILD_STATUS_LABELS: Record<ChildStatus, string> = {
  studying: "Đang học",
  transferred_class: "Đã chuyển lớp",
  reserved: "Bảo lưu",
  transferred_school: "Đã chuyển trường",
  dropped_out: "Đã thôi học",
  completed: "Hoàn thành chương trình",
};

export interface Child {
  id: string;
  code: string;
  school_year_id: string;
  class_id: string | null;
  full_name: string;
  dob: string;
  gender: "male" | "female";
  enrollment_date: string;
  status: ChildStatus;
  note: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface Guardian {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "present" | "absent_excused" | "absent_unexcused" | "late";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent_excused: "Nghỉ có phép",
  absent_unexcused: "Nghỉ không phép",
  late: "Đi muộn",
};

export type EmploymentType = "payroll" | "contract" | "probation";

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  payroll: "Biên chế",
  contract: "Hợp đồng",
  probation: "Thử việc",
};

export interface Staff {
  id: string;
  user_id: string;
  employee_code: string;
  position: string;
  employment_type: EmploymentType;
  degree: string | null;
  start_date: string | null;
  status: "active" | "on_leave" | "resigned";
  note: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export type EvaluatorRole = "self" | "team_lead" | "principal";

export const EVALUATOR_ROLE_LABELS: Record<EvaluatorRole, string> = {
  self: "Tự đánh giá",
  team_lead: "Tổ trưởng đánh giá",
  principal: "Lãnh đạo đánh giá",
};

export type PlanType =
  | "year"
  | "month"
  | "topic"
  | "week"
  | "day"
  | "activity"
  | "steam"
  | "sel"
  | "inclusive";

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  year: "Kế hoạch năm",
  month: "Kế hoạch tháng",
  topic: "Kế hoạch chủ đề/dự án",
  week: "Kế hoạch tuần",
  day: "Kế hoạch ngày",
  activity: "Kế hoạch hoạt động",
  steam: "Kế hoạch STEAM",
  sel: "Kế hoạch SEL",
  inclusive: "Giáo dục hòa nhập",
};

export type AssessmentDomain =
  | "the_chat"
  | "nhan_thuc"
  | "ngon_ngu"
  | "tinh_cam_xa_hoi"
  | "tham_my";

export const ASSESSMENT_DOMAIN_LABELS: Record<AssessmentDomain, string> = {
  the_chat: "Thể chất",
  nhan_thuc: "Nhận thức",
  ngon_ngu: "Ngôn ngữ",
  tinh_cam_xa_hoi: "Tình cảm - xã hội",
  tham_my: "Thẩm mỹ",
};

export interface DocumentRecord {
  id: string;
  code: string;
  school_year_id: string;
  doc_type: DocumentType;
  title: string;
  summary: string | null;
  issuing_unit: string | null;
  recipient: string | null;
  sign_date: string | null;
  effective_date: string | null;
  category: string | null;
  status: RecordStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
}
