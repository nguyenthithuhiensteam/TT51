/**
 * Tính z-score tăng trưởng theo Chuẩn tăng trưởng trẻ em WHO 2006 (0-60 tháng tuổi),
 * dùng phương pháp LMS (Cole). Nguồn tham số L/M/S: xem chú thích trong
 * `src-tauri/src/db/sql/029_seed_who_growth_standards.sql`.
 */

export type GrowthIndicator = "wfa" | "hfa" | "bmifa";

export const WHO_MAX_AGE_DAYS = 1826; // 60 tháng tuổi — giới hạn của chuẩn WHO 0-60 tháng

/** Số ngày tuổi tại một thời điểm, tính từ ngày sinh (dob), theo lịch dương, không âm. */
export function ageInDays(dob: string, atDate: string): number {
  const d1 = Date.parse(`${dob}T00:00:00Z`);
  const d2 = Date.parse(`${atDate}T00:00:00Z`);
  return Math.max(0, Math.round((d2 - d1) / 86_400_000));
}

/**
 * Số ngày tuổi đã giới hạn (clamp) trong phạm vi chuẩn WHO [0, 1826]. Trẻ trên 60 tháng
 * (Mẫu giáo lớn) tạm dùng mốc 60 tháng theo quyết định của người dùng — xem ROADMAP Phase D.
 */
export function clampToWhoRange(days: number): number {
  return Math.min(Math.max(days, 0), WHO_MAX_AGE_DAYS);
}

/** Công thức LMS (Cole): z = ((X/M)^L − 1) / (L·S) khi L≠0, ngược lại z = ln(X/M)/S. */
export function calcZScore(l: number, m: number, s: number, x: number): number {
  if (x <= 0 || m <= 0 || s === 0) return NaN;
  if (Math.abs(l) < 1e-9) return Math.log(x / m) / s;
  return (Math.pow(x / m, l) - 1) / (l * s);
}

export interface GrowthClassification {
  code: string;
  label: string;
  severity: "severe" | "moderate" | "normal" | "risk" | "high";
}

/** Phân loại Cân nặng theo tuổi (WAZ) — WHO chỉ đánh giá thiếu cân, không có ngưỡng thừa cân. */
export function classifyWfa(z: number): GrowthClassification {
  if (!Number.isFinite(z)) return { code: "khong_xac_dinh", label: "Không xác định", severity: "normal" };
  if (z < -3) return { code: "sdd_nhe_can_nang", label: "Suy dinh dưỡng thể nhẹ cân, mức độ nặng", severity: "severe" };
  if (z < -2) return { code: "sdd_nhe_can", label: "Suy dinh dưỡng thể nhẹ cân", severity: "moderate" };
  return { code: "binh_thuong", label: "Bình thường", severity: "normal" };
}

/** Phân loại Chiều cao theo tuổi (HAZ). */
export function classifyHfa(z: number): GrowthClassification {
  if (!Number.isFinite(z)) return { code: "khong_xac_dinh", label: "Không xác định", severity: "normal" };
  if (z < -3) return { code: "thap_coi_nang", label: "Suy dinh dưỡng thể thấp còi, mức độ nặng", severity: "severe" };
  if (z < -2) return { code: "thap_coi", label: "Suy dinh dưỡng thể thấp còi", severity: "moderate" };
  return { code: "binh_thuong", label: "Bình thường", severity: "normal" };
}

/** Phân loại BMI theo tuổi (BAZ) — chuẩn WHO 0-5 tuổi, có cả ngưỡng gầy còm và thừa cân/béo phì. */
export function classifyBmifa(z: number): GrowthClassification {
  if (!Number.isFinite(z)) return { code: "khong_xac_dinh", label: "Không xác định", severity: "normal" };
  if (z < -3) return { code: "gay_com_nang", label: "Suy dinh dưỡng thể gầy còm, mức độ nặng", severity: "severe" };
  if (z < -2) return { code: "gay_com", label: "Suy dinh dưỡng thể gầy còm", severity: "moderate" };
  if (z <= 1) return { code: "binh_thuong", label: "Bình thường", severity: "normal" };
  if (z <= 2) return { code: "nguy_co_thua_can", label: "Có nguy cơ thừa cân", severity: "risk" };
  if (z <= 3) return { code: "thua_can", label: "Thừa cân", severity: "high" };
  return { code: "beo_phi", label: "Béo phì", severity: "high" };
}

export function classifyByIndicator(indicator: GrowthIndicator, z: number): GrowthClassification {
  if (indicator === "wfa") return classifyWfa(z);
  if (indicator === "hfa") return classifyHfa(z);
  return classifyBmifa(z);
}

export const GROWTH_INDICATOR_LABELS: Record<GrowthIndicator, string> = {
  wfa: "Cân nặng theo tuổi",
  hfa: "Chiều cao theo tuổi",
  bmifa: "BMI theo tuổi",
};

/** Tra cứu nhãn/mức độ hiển thị từ mã phân loại — dùng khi chỉ còn lại `code` (vd sau khi đã
 * đếm tổng hợp theo lớp/trường). Gộp từ cả 3 hàm phân loại, đủ để hiển thị lại đúng nhãn. */
export const GROWTH_CLASSIFICATION_BY_CODE: Record<string, GrowthClassification> = Object.fromEntries(
  [-4, -2.5, -1, 0, 1.5, 2.5, 3.5, NaN].flatMap((z) => [
    classifyWfa(z),
    classifyHfa(z),
    classifyBmifa(z),
  ]).map((c) => [c.code, c]),
);
