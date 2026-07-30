/**
 * Nội dung căn cứ pháp lý cho tab "Chính sách" trong Khẩu phần dinh dưỡng.
 * Tham chiếu theo app "Bữa ăn hạnh phúc" (Trường Mầm non Hương Sen, Tuyên Quang).
 * Đây là nội dung tham khảo tĩnh — trường cần đối chiếu văn bản hiện hành của địa phương mình
 * trước khi áp dụng, vì mức hỗ trợ/đối tượng có thể khác nhau giữa các tỉnh/thành.
 */

export interface LegalReference {
  code: string;
  title: string;
}

export const LEGAL_REFERENCES: LegalReference[] = [
  {
    code: "01/VBHN-BGDĐT",
    title: "Văn bản hợp nhất về nuôi dưỡng, chăm sóc sức khỏe trẻ em trong cơ sở giáo dục mầm non",
  },
  {
    code: "2195/QĐ-BGDĐT (2022)",
    title: "Hướng dẫn công tác tổ chức bữa ăn học đường trong cơ sở giáo dục mầm non",
  },
  {
    code: "218/2025/QH15",
    title: "Nghị quyết của Quốc hội về phổ cập giáo dục mầm non cho trẻ em từ 3 đến 5 tuổi",
  },
  {
    code: "277/2025/NĐ-CP (20/10/2025)",
    title: "Quy định chi tiết thi hành Nghị quyết 218/2025/QH15 — chính sách hỗ trợ ăn trưa, chi phí học tập",
  },
  {
    code: "17/2025/NQ-HĐND (12/11/2025)",
    title:
      "Quy định các khoản thu, mức thu, cơ chế quản lý thu chi dịch vụ phục vụ hỗ trợ hoạt động giáo dục tại cơ sở giáo dục mầm non công lập (ban hành bởi HĐND cấp tỉnh — mỗi địa phương có nghị quyết riêng)",
  },
];

export const SUPPORT_AMOUNT_TEXT =
  "360.000 đ/tháng tiền ăn trưa + 150.000 đ/tháng chi phí học tập — tối đa 9 tháng/năm học (mức tham khảo theo NĐ 277/2025/NĐ-CP; đối chiếu văn bản địa phương để áp dụng đúng).";

export const BENEFICIARY_GROUPS: { icon: string; text: string }[] = [
  { icon: "🏔️", text: "Trẻ thường trú tại xã, thôn đặc biệt khó khăn, vùng DTTS & miền núi, bãi ngang ven biển, hải đảo" },
  { icon: "🏠", text: "Trẻ không có nguồn nuôi dưỡng (theo Nghị định 20/2021/NĐ-CP)" },
  { icon: "💛", text: "Trẻ thuộc hộ nghèo, cận nghèo đa chiều theo chuẩn hiện hành" },
  { icon: "🎖️", text: "Con liệt sĩ, Anh hùng LLVT, con thương binh, bệnh binh, người hưởng chính sách như thương binh" },
  { icon: "🤝", text: "Trẻ khuyết tật học hòa nhập" },
];

export const PAYMENT_SCHEDULE: { icon: string; label: string; note: string }[] = [
  { icon: "🎄", label: "Lần 1 — Tháng 12", note: "Chi trả 4 tháng đầu" },
  { icon: "🌸", label: "Lần 2 — Tháng 4", note: "Chi trả phần còn lại" },
];

export const COOK_SUPPORT_TEXT =
  "Hỗ trợ nhân viên nấu ăn: tối thiểu 3.900.000 đ/tháng cho 45 trẻ bán trú. Mỗi 20 trẻ dư được tính thêm 1 lần (mức tham khảo — đối chiếu văn bản địa phương).";

export const POLICY_CHECKLIST_ITEMS: string[] = [
  "Rà soát danh sách trẻ đối chiếu với các nhóm đối tượng theo Nghị định 277/2025/NĐ-CP",
  "Lập hồ sơ đề nghị gửi UBND xã/Sở GD&ĐT phê duyệt (trong 7 ngày làm việc)",
  "Công khai danh sách trẻ hưởng chính sách tại trường (trong 3 ngày sau khi được duyệt)",
  "Nhận kinh phí và chi trả bằng chuyển khoản hoặc tiền mặt",
  "Quản lý tách bạch: khoản hỗ trợ chính sách ≠ khoản thu tiền ăn hằng ngày từ phụ huynh",
  "Lưu hồ sơ thanh quyết toán theo 2 kỳ (tháng 12 và tháng 4)",
];
