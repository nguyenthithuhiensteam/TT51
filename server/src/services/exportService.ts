import { AlignmentType, Document, Packer, PageBreak, Paragraph, Table, TableCell, WidthType } from "docx";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  bodyCell,
  buildDocument,
  cellBorders,
  dottedLines,
  headerCell,
  makeTable,
  para,
  sectionHeading,
  subTitleParagraph,
  titleParagraph,
} from "./docxKit.js";
import { AnnualPlanContent } from "../schema/annualPlan.js";
import { ThemePlanContent } from "../schema/themePlan.js";
import { WeeklyPlanContent } from "../schema/weeklyPlan.js";
import { LessonPlanContent } from "../schema/lessonPlan.js";
import { ACTIVITY_TYPE_LABELS } from "../schema/lessonPlan.js";
import { DOMAIN_LABELS, WEEKDAYS, WEEKDAY_LABELS } from "../schema/common.js";

type ObjLookup = Record<string, { code: string; statement: string }>;

function objLabel(objLookup: ObjLookup, id: string | undefined | null): string {
  if (!id) return "";
  const o = objLookup[id];
  if (!o) return "";
  return `${o.statement} (${o.code})`;
}

function objCodeOnly(objLookup: ObjLookup, id: string | undefined | null): string {
  if (!id) return "";
  return objLookup[id]?.code || "";
}

export function slugFileName(text: string): string {
  const withoutDiacritics = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return withoutDiacritics
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ---------- KẾ HOẠCH GIÁO DỤC NĂM ----------
export function buildAnnualPlanDoc(content: AnnualPlanContent, objLookup: ObjLookup, meta: { status: string; version: number }) {
  const children: (Paragraph | Table)[] = [];
  children.push(titleParagraph(`Kế hoạch giáo dục năm học ${content.schoolYear}`));
  children.push(subTitleParagraph(`${content.schoolName} - Lớp ${content.classGroup} (${content.ageGroup} tuổi)`));
  children.push(para(`Giáo viên thực hiện: ${content.teacherNames.join(", ")}`, { align: AlignmentType.CENTER, italics: true }));
  children.push(para(`Trạng thái: ${meta.status} - Phiên bản: ${meta.version}`, { align: AlignmentType.CENTER, italics: true }));

  children.push(sectionHeading("I. THÔNG TIN CHUNG"));
  children.push(para(`Số lượng trẻ: ${content.childCount}`));
  children.push(para(`Chương trình áp dụng: ${content.program}`));

  children.push(sectionHeading("II. ĐẶC ĐIỂM TÌNH HÌNH NHÓM/LỚP"));
  children.push(para(content.classCharacteristics || ""));

  children.push(sectionHeading("III. THUẬN LỢI, KHÓ KHĂN"));
  children.push(para(`Thuận lợi: ${content.advantages || ""}`));
  children.push(para(`Khó khăn: ${content.difficulties || ""}`));

  children.push(sectionHeading("IV. MỤC TIÊU VÀ YÊU CẦU CẦN ĐẠT THEO LĨNH VỰC"));
  (Object.keys(DOMAIN_LABELS) as (keyof typeof DOMAIN_LABELS)[]).forEach((domain) => {
    children.push(para(DOMAIN_LABELS[domain], { bold: true }));
    const goals = content.domainGoals[domain] || [];
    if (goals.length === 0) {
      children.push(para("(Chưa chọn mục tiêu)", { italics: true }));
      return;
    }
    children.push(
      makeTable(
        [headerCell("STT", 8), headerCell("Mục tiêu", 62), headerCell("Ghi chú", 30)],
        goals.map((g, i) => [bodyCell(String(i + 1), { widthPct: 8 }), bodyCell(objLabel(objLookup, g.objectiveId), { widthPct: 62 }), bodyCell(g.note || "", { widthPct: 30 })])
      )
    );
  });

  children.push(sectionHeading("V. NỘI DUNG GIÁO DỤC"));
  children.push(para(content.educationContent || ""));

  children.push(sectionHeading("VI. DỰ KIẾN CHỦ ĐỀ/THÁNG"));
  children.push(
    makeTable(
      [
        headerCell("Tháng/thời gian", 14),
        headerCell("Chủ đề", 18),
        headerCell("Số tuần", 8),
        headerCell("Mục tiêu trọng tâm", 22),
        headerCell("Nội dung chính", 18),
        headerCell("Sự kiện/hoạt động nổi bật", 12),
        headerCell("Ghi chú", 8),
      ],
      content.themesOverview.map((t) => [
        bodyCell(t.monthOrTime, { widthPct: 14 }),
        bodyCell(t.themeName, { widthPct: 18 }),
        bodyCell(String(t.weeksCount), { widthPct: 8 }),
        bodyCell(t.focusObjectiveIds.map((id) => objCodeOnly(objLookup, id)).filter(Boolean).join(", "), { widthPct: 22 }),
        bodyCell(t.mainContent, { widthPct: 18 }),
        bodyCell(t.events, { widthPct: 12 }),
        bodyCell(t.note, { widthPct: 8 }),
      ])
    )
  );

  children.push(sectionHeading("VII. ĐỊNH HƯỚNG TÍCH HỢP VÀ SỰ KIỆN"));
  children.push(para(content.eventsAndIntegration || ""));

  children.push(sectionHeading("VIII. PHỐI HỢP VỚI CHA MẸ TRẺ VÀ CỘNG ĐỒNG"));
  children.push(para(content.parentCoordination || ""));

  children.push(sectionHeading("IX. ĐIỀU KIỆN THỰC HIỆN"));
  children.push(para(content.facilityConditions || ""));

  children.push(sectionHeading("X. THEO DÕI, ĐÁNH GIÁ VÀ ĐIỀU CHỈNH"));
  children.push(para(content.monitoringAdjustment || ""));

  children.push(sectionHeading("PHÊ DUYỆT CỦA BAN GIÁM HIỆU"));
  children.push(...dottedLines(4));

  return buildDocument({ orientation: "portrait", children });
}

// ---------- KẾ HOẠCH CHỦ ĐỀ/THÁNG ----------
export function buildThemePlanDoc(content: ThemePlanContent, objLookup: ObjLookup, meta: { status: string; version: number }) {
  const children: (Paragraph | Table)[] = [];
  children.push(titleParagraph(`Chủ đề: ${content.themeName}`));
  children.push(
    para(`(Thời gian ${content.weeksCount} tuần. Từ ${content.startDate} đến ${content.endDate})`, { align: AlignmentType.CENTER, bold: true })
  );
  children.push(para(`Độ tuổi/lớp: ${content.ageGroup} tuổi - ${content.classGroup}`, { align: AlignmentType.CENTER }));
  children.push(para(`Giáo viên thực hiện: ${content.teacherNames.join(", ")}`, { align: AlignmentType.CENTER, italics: true }));
  if (content.branchTopics.length) {
    children.push(para(`Chủ đề nhánh: ${content.branchTopics.join(" | ")}`, { align: AlignmentType.CENTER }));
  }
  children.push(para(`Trạng thái: ${meta.status} - Phiên bản: ${meta.version}`, { align: AlignmentType.CENTER, italics: true }));

  const domainRoman: Record<string, string> = {
    the_chat: "I",
    tinh_cam_ky_nang_xa_hoi: "II",
    ngon_ngu: "III",
    nhan_thuc: "IV",
    tham_my: "V",
  };
  (Object.keys(DOMAIN_LABELS) as (keyof typeof DOMAIN_LABELS)[]).forEach((domain) => {
    children.push(sectionHeading(`${domainRoman[domain]}/ ${DOMAIN_LABELS[domain].toUpperCase()}`));
    const rows = content.domains[domain] || [];
    if (rows.length === 0) {
      children.push(para("(Chưa có nội dung)", { italics: true }));
      return;
    }
    children.push(
      makeTable(
        [headerCell("STT", 6), headerCell("Mục tiêu", 28), headerCell("Nội dung", 33), headerCell("Hoạt động", 33)],
        rows.map((r) => [
          bodyCell(String(r.stt), { widthPct: 6 }),
          bodyCell(objLabel(objLookup, r.objectiveId), { widthPct: 28 }),
          bodyCell(r.content, { widthPct: 33 }),
          bodyCell(r.activity, { widthPct: 33 }),
        ])
      )
    );
  });

  children.push(sectionHeading("RÈN NỀN NẾP, THÓI QUEN"));
  children.push(para(content.routinesAndHabits || ""));

  children.push(sectionHeading("NỘI DUNG PHỐI HỢP VỚI PHỤ HUYNH"));
  if (content.parentCoordination.length) {
    children.push(
      makeTable(
        [headerCell("Tuần/chủ đề nhánh/thời gian", 30), headerCell("Nội dung", 70)],
        content.parentCoordination.map((r) => [bodyCell(r.weekOrTime, { widthPct: 30 }), bodyCell(r.content, { widthPct: 70 })])
      )
    );
  } else {
    children.push(para("(Chưa có nội dung)", { italics: true }));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(titleParagraph(`Hoạt động học chủ đề: ${content.themeName}`));
  const dayHeaders = [
    headerCell("Thời gian", 14),
    headerCell("Thứ Hai", 17.2),
    headerCell("Thứ Ba", 17.2),
    headerCell("Thứ Tư", 17.2),
    headerCell("Thứ Năm", 17.2),
    headerCell("Thứ Sáu", 17.2),
  ];
  function dayCellText(d: any) {
    if (!d) return "";
    return `${DOMAIN_LABELS[d.domain as keyof typeof DOMAIN_LABELS]}\n${d.activityType}\n${d.activityName}${d.objectiveId ? `\n(${objCodeOnly(objLookup, d.objectiveId)})` : ""}`;
  }
  children.push(
    makeTable(
      dayHeaders,
      content.weeklyLearningActivities.map((w) => [
        bodyCell(w.weekLabel, { widthPct: 14, bold: true }),
        bodyCell(dayCellText(w.days.mon), { widthPct: 17.2 }),
        bodyCell(dayCellText(w.days.tue), { widthPct: 17.2 }),
        bodyCell(dayCellText(w.days.wed), { widthPct: 17.2 }),
        bodyCell(dayCellText(w.days.thu), { widthPct: 17.2 }),
        bodyCell(dayCellText(w.days.fri), { widthPct: 17.2 }),
      ])
    )
  );

  children.push(sectionHeading("NHẬN XÉT CỦA BAN GIÁM HIỆU"));
  children.push(...dottedLines(4));

  return buildDocument({ orientation: "landscape", children });
}

// ---------- KẾ HOẠCH GIÁO DỤC TUẦN ----------
export function buildWeeklyPlanDoc(content: WeeklyPlanContent, objLookup: ObjLookup, meta: { status: string; version: number }) {
  const children: (Paragraph | Table)[] = [];
  children.push(titleParagraph(`Kế hoạch chăm sóc, giáo dục trẻ - Tuần ${content.weekNumber}`));
  children.push(para(`Chủ đề: ${content.themeName}`, { align: AlignmentType.CENTER, bold: true }));
  children.push(para(`Chủ đề nhánh: ${content.branchTopic}`, { align: AlignmentType.CENTER, bold: true }));
  children.push(para(`Thời gian thực hiện: từ ${content.startDate} đến ${content.endDate}`, { align: AlignmentType.CENTER }));
  children.push(para(`Giáo viên thực hiện: ${content.teacherNames.join(", ")}`, { align: AlignmentType.CENTER, italics: true }));
  children.push(para(`Lớp/độ tuổi: ${content.classGroup} - ${content.ageGroup} tuổi`, { align: AlignmentType.CENTER }));
  children.push(para(`Trạng thái: ${meta.status} - Phiên bản: ${meta.version}`, { align: AlignmentType.CENTER, italics: true }));

  const dayHeaders = [
    headerCell("Nội dung hoạt động", 14),
    ...WEEKDAYS.map((d) => headerCell(`${WEEKDAY_LABELS[d]}\n${content.dayDates[d]}`, 17.2)),
  ];

  function learningCellText(d: any) {
    if (!d) return "";
    return `${DOMAIN_LABELS[d.domain as keyof typeof DOMAIN_LABELS]}\n${d.activityType}: ${d.activityName}${d.objectiveId ? `\n(${objCodeOnly(objLookup, d.objectiveId)})` : ""}`;
  }

  const rows: TableCell[][] = [
    [bodyCell("Đón trẻ, chơi, thể dục sáng", { widthPct: 14, bold: true }), mergedCell(content.welcomeAndMorningExercise, 5)],
    [bodyCell("Trò chuyện đầu tuần", { widthPct: 14, bold: true }), mergedCell(content.weeklyOpeningTalk, 5)],
    [
      bodyCell("Hoạt động học", { widthPct: 14, bold: true }),
      ...WEEKDAYS.map((d) => bodyCell(learningCellText(content.learningActivities[d]), { widthPct: 17.2 })),
    ],
    [bodyCell("Chơi, hoạt động ở các góc", { widthPct: 14, bold: true }), mergedCell("(Xem bảng chi tiết bên dưới)", 5)],
    [bodyCell("Chơi ngoài trời", { widthPct: 14, bold: true }), mergedCell("(Xem bảng chi tiết bên dưới)", 5)],
    [bodyCell("Tổ chức giờ ăn - giờ ngủ", { widthPct: 14, bold: true }), mergedCell(content.mealsAndSleep, 5)],
    [
      bodyCell("Chơi, hoạt động theo ý thích", { widthPct: 14, bold: true }),
      ...WEEKDAYS.map((d) => bodyCell(content.afternoonActivities[d] || "", { widthPct: 17.2 })),
    ],
    [bodyCell("Trả trẻ", { widthPct: 14, bold: true }), ...WEEKDAYS.map((d) => bodyCell(content.pickup[d] || "", { widthPct: 17.2 }))],
    [bodyCell("Nội dung phối hợp với cha mẹ trẻ", { widthPct: 14, bold: true }), mergedCell(content.parentCoordination, 5)],
  ];

  children.push(makeTable(dayHeaders, rows));

  children.push(sectionHeading("CHƠI, HOẠT ĐỘNG Ở CÁC GÓC"));
  if (content.cornerActivities.length) {
    children.push(
      makeTable(
        [headerCell("Tên góc/nội dung chơi", 25), headerCell("Chuẩn bị", 25), headerCell("Yêu cầu, kỹ năng và cách tiến hành", 50)],
        content.cornerActivities.map((c) => [bodyCell(c.cornerName, { widthPct: 25 }), bodyCell(c.preparation, { widthPct: 25 }), bodyCell(c.skillsAndProcess, { widthPct: 50 })])
      )
    );
  } else {
    children.push(para("(Chưa có nội dung)", { italics: true }));
  }

  children.push(sectionHeading("CHƠI NGOÀI TRỜI"));
  children.push(
    makeTable(
      [headerCell("Nội dung", 16), ...WEEKDAYS.map((d) => headerCell(WEEKDAY_LABELS[d], 16.8))],
      [
        ["Hoạt động có mục đích", "purposeActivity"],
        ["Yêu cầu", "requirement"],
        ["Chuẩn bị", "preparation"],
        ["Cách tiến hành", "method"],
        ["Trò chơi vận động/học tập", "game"],
        ["Chơi tự do", "freePlay"],
        ["Biện pháp bảo đảm an toàn", "safetyMeasures"],
      ].map(([label, key]) => [
        bodyCell(label, { widthPct: 16, bold: true }),
        ...WEEKDAYS.map((d) => bodyCell((content.outdoorActivities[d] as any)?.[key as string] || "", { widthPct: 16.8 })),
      ])
    )
  );

  return buildDocument({ orientation: "landscape", children });
}

function mergedCell(text: string, colSpan: number) {
  return new TableCell({ columnSpan: colSpan, borders: cellBorders(), children: [para(text || "")] });
}

// ---------- GIÁO ÁN NGÀY ----------
export function buildLessonPlanDoc(content: LessonPlanContent, objLookup: ObjLookup, meta: { status: string; version: number }) {
  const children: (Paragraph | Table)[] = [];
  children.push(para(`${content.dayOfWeek} ngày ${content.date}`, { align: AlignmentType.RIGHT, italics: true }));
  children.push(titleParagraph(DOMAIN_LABELS[content.domain as keyof typeof DOMAIN_LABELS]));
  children.push(para(`${ACTIVITY_TYPE_LABELS[content.activityType as keyof typeof ACTIVITY_TYPE_LABELS]}: ${content.topic}`, { align: AlignmentType.CENTER, bold: true }));
  if (content.combinedContent) {
    children.push(para(content.combinedContent, { align: AlignmentType.CENTER, italics: true }));
  }
  children.push(para(`Mã mục tiêu: ${objCodeOnly(objLookup, content.objectiveId) || "(chưa gán)"}`, { align: AlignmentType.CENTER, italics: true }));
  children.push(para(`Trạng thái: ${meta.status} - Phiên bản: ${meta.version}`, { align: AlignmentType.CENTER, italics: true }));

  children.push(sectionHeading("I. MỤC ĐÍCH - YÊU CẦU"));
  children.push(para(`- Kiến thức/Kết quả mong đợi: ${content.purpose.knowledge}`));
  children.push(para(`- Kỹ năng: ${content.purpose.skill}`));
  children.push(para(`- Thái độ: ${content.purpose.attitude}`));
  if (content.purpose.differentiation) children.push(para(`- Phân hoá/hỗ trợ trẻ: ${content.purpose.differentiation}`));

  children.push(sectionHeading("II. CHUẨN BỊ"));
  children.push(para(`- Đồ dùng của giáo viên: ${content.preparation.teacherItems}`));
  children.push(para(`- Đồ dùng của trẻ: ${content.preparation.childItems}`));
  children.push(para(`- Không gian tổ chức: ${content.preparation.space}`));
  children.push(para(`- Học liệu, thiết bị: ${content.preparation.materials}`));
  if (content.preparation.safety) children.push(para(`- Yêu cầu an toàn: ${content.preparation.safety}`));

  children.push(sectionHeading("III. TIẾN HÀNH HOẠT ĐỘNG"));
  children.push(
    makeTable(
      [headerCell("Hoạt động của giáo viên", 55), headerCell("Hoạt động của trẻ", 45)],
      content.procedure.map((step) => [
        bodyCell(`* ${step.section}:\n${step.teacherActivity}`, { widthPct: 55 }),
        bodyCell(step.childActivity, { widthPct: 45 }),
      ])
    )
  );

  children.push(sectionHeading("ĐÁNH GIÁ CUỐI NGÀY"));
  children.push(...dottedLines(content.evaluationNotes ? 0 : 3));
  if (content.evaluationNotes) children.push(para(content.evaluationNotes));

  return buildDocument({ orientation: "portrait", children });
}

export async function toBuffer(doc: Document): Promise<Buffer> {
  return Packer.toBuffer(doc);
}

export async function convertDocxToPdf(docxBuffer: Buffer, baseName: string): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mamnon-export-"));
  const docxPath = path.join(tmpDir, `${baseName}.docx`);
  await fs.writeFile(docxPath, docxBuffer);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("soffice", ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", tmpDir, docxPath]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`soffice thoát mã ${code}: ${stderr}`))));
  });
  const pdfPath = path.join(tmpDir, `${baseName}.pdf`);
  const buf = await fs.readFile(pdfPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
  return buf;
}
