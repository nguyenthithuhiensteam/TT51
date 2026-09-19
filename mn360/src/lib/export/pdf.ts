import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PLAN_TYPE_LABELS, STATUS_LABELS } from "../db/types";
import type { EducationPlanRow } from "../db/curriculumRepo";

const FONT_NAME = "LiberationSerif";
const PAGE_MARGIN = 14;

/**
 * Nạp phông Liberation Serif (đầy đủ dấu tiếng Việt, tương thích số đo Times New Roman) vào tài
 * liệu PDF. Tải riêng bằng import động để không làm nặng gói chính khi người dùng không xuất PDF.
 */
async function loadVietnameseFont(doc: jsPDF): Promise<void> {
  const [{ LIBERATION_SERIF_REGULAR_BASE64 }, { LIBERATION_SERIF_BOLD_BASE64 }] = await Promise.all([
    import("./fonts/liberationSerifRegular"),
    import("./fonts/liberationSerifBold"),
  ]);
  doc.addFileToVFS("LiberationSerif-Regular.ttf", LIBERATION_SERIF_REGULAR_BASE64);
  doc.addFont("LiberationSerif-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("LiberationSerif-Bold.ttf", LIBERATION_SERIF_BOLD_BASE64);
  doc.addFont("LiberationSerif-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(`${i}/${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 8, { align: "right" });
  }
}

function section(doc: jsPDF, y: number, title: string, content: string | null): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PAGE_MARGIN * 2;
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(13);
  doc.text(title, PAGE_MARGIN, y);
  y += 6;
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(13);
  const lines = doc.splitTextToSize(content?.trim() || "—", maxWidth) as string[];
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    doc.text(line, PAGE_MARGIN, y);
    y += 6;
  }
  return y + 4;
}

/** Xuất kế hoạch giáo dục ra PDF (A4 dọc, phông Liberation Serif đầy đủ dấu tiếng Việt, có số trang). */
export async function exportEducationPlanToPdf(plan: EducationPlanRow): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadVietnameseFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(14);
  doc.text("TRƯỜNG MẦM NON", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(16);
  doc.text(PLAN_TYPE_LABELS[plan.plan_type].toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(plan.title, pageWidth / 2, y, { align: "center" });
  y += 9;

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(11);
  doc.text(
    `Mã kế hoạch: ${plan.code}    Lớp: ${plan.class_name ?? "Toàn khối"}    Độ tuổi: ${plan.age_group ?? "—"}`,
    PAGE_MARGIN,
    y,
  );
  y += 6;
  doc.text(
    `Thời gian: ${plan.period_start ?? "—"} → ${plan.period_end ?? "—"}    Trạng thái: ${STATUS_LABELS[plan.status]}`,
    PAGE_MARGIN,
    y,
  );
  y += 6;
  doc.text(`Người soạn: ${plan.created_by_name}`, PAGE_MARGIN, y);
  y += 10;

  y = section(doc, y, "I. Mục tiêu", plan.objectives);
  y = section(doc, y, "II. Yêu cầu cần đạt", plan.requirements);
  y = section(doc, y, "III. Nội dung", plan.content);
  y = section(doc, y, "IV. Hoạt động", plan.activities);
  y = section(doc, y, "V. Môi trường", plan.environment);
  y = section(doc, y, "VI. Học liệu", plan.materials);
  y = section(doc, y, "VII. Phương pháp", plan.methods);
  y = section(doc, y, "VIII. Đánh giá", plan.evaluation);
  y = section(doc, y, "IX. Điều chỉnh sau thực hiện", plan.adjustment);

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  autoTable(doc, {
    startY: y + 4,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["NHẬN XÉT CỦA BAN GIÁM HIỆU"]],
    body: [[""], [""], [""]],
    styles: { font: FONT_NAME, fontSize: 11, minCellHeight: 10 },
    headStyles: { font: FONT_NAME, fontStyle: "bold", fillColor: [230, 230, 230], textColor: [20, 20, 20] },
    theme: "grid",
  });

  addPageNumbers(doc);
  doc.save(`${plan.code}-${plan.title}.pdf`);
}
