export type UserRole = "pending" | "staff" | "approver" | "admin";

export interface PortalUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface AccreditationStandard {
  id: string;
  code: string;
  name: string;
  orderNo: number;
}

export interface AccreditationCriteria {
  id: string;
  standardId: string;
  code: string;
  name: string;
  orderNo: number;
}

export type EvidenceStatus = "pending_approval" | "approved" | "rejected";

export interface EvidenceFile {
  id: string;
  criteriaId: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  description: string;
  status: EvidenceStatus;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}
