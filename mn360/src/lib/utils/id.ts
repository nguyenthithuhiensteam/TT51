import { v4 as uuidv4 } from "uuid";

export function newId(): string {
  return uuidv4();
}

/** Sinh mã nghiệp vụ dễ đọc, VD: NV-2026-0007 */
export function newBusinessCode(prefix: string, sequence: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `${prefix}-${y}-${String(sequence).padStart(4, "0")}`;
}
