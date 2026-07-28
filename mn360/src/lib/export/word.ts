import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { downloadBlob } from "./download";
import { PLAN_TYPE_LABELS, STATUS_LABELS } from "../db/types";
import type { EducationPlanRow } from "../db/curriculumRepo";

function section(title: string, content: string | null): Paragraph[] {
  return [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
    new Paragraph({ text: content?.trim() || "—" }),
  ];
}

/** Xuất kế hoạch giáo dục ra Word (.docx) — nội dung lấy trực tiếp từ dữ liệu đã lưu, không cần nhập lại. */
export async function exportEducationPlanToWord(plan: EducationPlanRow): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: "center",
            children: [new TextRun({ text: "TRƯỜNG MẦM NON", bold: true, size: 24 })],
          }),
          new Paragraph({
            alignment: "center",
            children: [
              new TextRun({ text: PLAN_TYPE_LABELS[plan.plan_type].toUpperCase(), bold: true, size: 28 }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            alignment: "center",
            children: [new TextRun({ text: plan.title, bold: true, size: 24 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Mã kế hoạch: ${plan.code}    Lớp: ${plan.class_name ?? "Toàn khối"}    Độ tuổi: ${plan.age_group ?? "—"}`,
          }),
          new Paragraph({
            text: `Thời gian: ${plan.period_start ?? "—"} → ${plan.period_end ?? "—"}    Trạng thái: ${STATUS_LABELS[plan.status]}`,
          }),
          new Paragraph({
            text: `Người soạn: ${plan.created_by_name}`,
            spacing: { after: 200 },
          }),
          ...section("I. Mục tiêu", plan.objectives),
          ...section("II. Yêu cầu cần đạt", plan.requirements),
          ...section("III. Nội dung", plan.content),
          ...section("IV. Hoạt động", plan.activities),
          ...section("V. Môi trường", plan.environment),
          ...section("VI. Học liệu", plan.materials),
          ...section("VII. Phương pháp", plan.methods),
          ...section("VIII. Đánh giá", plan.evaluation),
          ...section("IX. Điều chỉnh sau thực hiện", plan.adjustment),
          new Paragraph({
            text: "Nội dung được xuất tự động từ hệ thống MN360.",
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${plan.code}-${plan.title}.docx`);
}
