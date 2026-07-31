import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import type { AccreditationCriteria, AccreditationStandard, EvidenceFile, EvidenceStatus, PortalUser, UserRole } from "../types";

export function watchPortalUser(uid: string, cb: (user: PortalUser | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as PortalUser) : null);
  });
}

export async function createPendingUser(user: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
}) {
  await setDoc(doc(db, "users", user.uid), {
    ...user,
    createdAt: new Date().toISOString(),
    approvedBy: user.role === "admin" ? user.uid : null,
    approvedAt: user.role === "admin" ? new Date().toISOString() : null,
  } satisfies PortalUser);
}

export function watchAllUsers(cb: (users: PortalUser[]) => void) {
  return onSnapshot(query(collection(db, "users"), orderBy("createdAt", "asc")), (snap) => {
    cb(snap.docs.map((d) => d.data() as PortalUser));
  });
}

export async function setUserRole(uid: string, role: UserRole, approvedBy: string) {
  await updateDoc(doc(db, "users", uid), {
    role,
    approvedBy,
    approvedAt: new Date().toISOString(),
  });
}

export function watchStandards(cb: (standards: AccreditationStandard[]) => void) {
  return onSnapshot(query(collection(db, "standards"), orderBy("orderNo", "asc")), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccreditationStandard));
  });
}

export function watchCriteria(cb: (criteria: AccreditationCriteria[]) => void) {
  return onSnapshot(query(collection(db, "criteria"), orderBy("orderNo", "asc")), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccreditationCriteria));
  });
}

export async function addCriteria(input: { standardId: string; code: string; name: string; orderNo: number }) {
  await addDoc(collection(db, "criteria"), input);
}

export async function addStandard(input: { code: string; name: string; orderNo: number }) {
  await addDoc(collection(db, "standards"), input);
}

export function watchEvidenceForCriteria(criteriaId: string, cb: (files: EvidenceFile[]) => void) {
  return onSnapshot(
    query(collection(db, "evidence"), where("criteriaId", "==", criteriaId), orderBy("uploadedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvidenceFile)),
  );
}

export function watchEvidenceByStatus(status: EvidenceStatus, cb: (files: EvidenceFile[]) => void) {
  return onSnapshot(
    query(collection(db, "evidence"), where("status", "==", status), orderBy("uploadedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvidenceFile)),
  );
}

export async function uploadEvidence(
  criteriaId: string,
  file: File,
  description: string,
  uploadedBy: string,
  uploadedByEmail: string,
) {
  const storagePath = `evidence/${criteriaId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);
  await addDoc(collection(db, "evidence"), {
    criteriaId,
    fileName: file.name,
    fileUrl,
    storagePath,
    description,
    status: "pending_approval",
    uploadedBy,
    uploadedByEmail,
    uploadedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  } satisfies Omit<EvidenceFile, "id">);
}

export async function reviewEvidence(
  evidenceId: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  reviewNote: string | null,
) {
  await updateDoc(doc(db, "evidence", evidenceId), {
    status,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    reviewNote,
  });
}

export async function getUserOnce(uid: string): Promise<PortalUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as PortalUser) : null;
}
