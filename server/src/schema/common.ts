import { z } from "zod";

export const DOMAIN_VALUES = [
  "the_chat",
  "tinh_cam_ky_nang_xa_hoi",
  "ngon_ngu",
  "nhan_thuc",
  "tham_my",
] as const;

export const DOMAIN_LABELS: Record<(typeof DOMAIN_VALUES)[number], string> = {
  the_chat: "Giáo dục phát triển thể chất",
  tinh_cam_ky_nang_xa_hoi: "Giáo dục phát triển tình cảm và kỹ năng xã hội",
  ngon_ngu: "Giáo dục phát triển ngôn ngữ",
  nhan_thuc: "Giáo dục phát triển nhận thức",
  tham_my: "Giáo dục phát triển thẩm mỹ",
};

export const AGE_GROUP_VALUES = ["3-4", "4-5", "5-6"] as const;

export const DomainEnum = z.enum(DOMAIN_VALUES);
export const AgeGroupEnum = z.enum(AGE_GROUP_VALUES);

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  mon: "Thứ Hai",
  tue: "Thứ Ba",
  wed: "Thứ Tư",
  thu: "Thứ Năm",
  fri: "Thứ Sáu",
};

export const PlanStatusEnum = z.enum(["nhap", "cho_duyet", "da_duyet", "can_dieu_chinh"]);
export const PLAN_STATUS_LABELS: Record<string, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  can_dieu_chinh: "Cần điều chỉnh",
};
