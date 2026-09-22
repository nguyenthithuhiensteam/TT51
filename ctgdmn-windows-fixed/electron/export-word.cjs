const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');
const {
  DEVELOPMENT_DOMAINS,
  WEEK_DAYS,
  normalizePlanType,
  parseAnnualRows,
  parseThemeRows,
  parseWeeklyRows,
  splitLines,
} = require('./plan-schema.cjs');

const FONT = 'Times New Roman';
const A4 = { width: 11906, height: 16838 };
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

const run = (text, options = {}) => new TextRun({
  text: String(text || ''),
  font: FONT,
  size: options.size || 24,
  bold: Boolean(options.bold),
  italics: Boolean(options.italics),
  color: options.color || '000000',
});

function paragraph(text = '', options = {}) {
  const lines = String(text || '').split(/\r?\n/);
  const children = [];
  lines.forEach((line, index) => {
    if (index) children.push(new TextRun({ break: 1 }));
    children.push(run(line, options));
  });
  return new Paragraph({
    children,
    alignment: options.center ? AlignmentType.CENTER : options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: options.before || 0, after: options.after ?? 80, line: options.line || 276 },
    keepNext: Boolean(options.keepNext),
    heading: options.heading,
  });
}

function cell(content, width, options = {}) {
  const paragraphs = Array.isArray(content) ? content : [paragraph(content, options)];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    verticalAlign: options.verticalAlign || VerticalAlign.CENTER,
    shading: options.shading ? { fill: options.shading, color: 'auto' } : undefined,
    margins: { top: 90, right: 100, bottom: 90, left: 100 },
    borders: BORDERS,
    children: paragraphs,
  });
}

function headerRow(labels, widths) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: labels.map((label, index) => cell(label, widths[index], { bold: true, center: true, shading: 'E6F2F1' })),
  });
}

function table(rows, widths) {
  return new Table({
    width: { size: widths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: BORDERS,
    rows,
  });
}

function titleBlock(plan, school, type) {
  const typeTitle = {
    annual: 'KẾ HOẠCH GIÁO DỤC NĂM',
    theme: 'KẾ HOẠCH GIÁO DỤC CHỦ ĐỀ',
    weekly: 'KẾ HOẠCH CHĂM SÓC GIÁO DỤC TRẺ',
    lesson: 'GIÁO ÁN HOẠT ĐỘNG GIÁO DỤC',
  }[type];
  const children = [
    paragraph(String(school.name || 'TRƯỜNG MẦM NON').toUpperCase(), { bold: true, center: true, size: 26, after: 20 }),
    paragraph(typeTitle, { bold: true, center: true, size: 30, after: 20 }),
  ];
  if (type === 'weekly') {
    children.push(paragraph(plan.weekNumber ? `(TUẦN ${plan.weekNumber})` : '', { bold: true, center: true, size: 26, after: 20 }));
  }
  children.push(
    paragraph(String(plan.title || 'Kế hoạch giáo dục'), { bold: true, center: true, size: 28, after: 20 }),
    paragraph(`Thời gian thực hiện: ${plan.period || '................................'}`, { bold: true, center: true, size: 24, after: 20 }),
    paragraph(`Lớp: ${plan.className || plan.ageGroup || ''}    -    Giáo viên: ${plan.author || ''}`, { italics: true, center: true, size: 23, after: 120 }),
  );
  return children;
}

function annualContent(plan) {
  const widths = [520, 1120, 1800, 2400, 2400, 2440];
  const rows = [headerRow(['STT', 'Thời gian', 'Chủ đề', 'Mục tiêu', 'Nội dung', 'Hoạt động'], widths)];
  parseAnnualRows(plan).forEach((item, index) => {
    rows.push(new TableRow({
      cantSplit: true,
      children: [
        cell(index + 1, widths[0], { center: true }),
        cell(item.period, widths[1]),
        cell(item.theme, widths[2], { bold: true }),
        cell(item.objective, widths[3]),
        cell(item.content, widths[4]),
        cell(item.activity, widths[5]),
      ],
    }));
  });
  return [table(rows, widths)];
}

function themeContent(plan) {
  const widths = [560, 3360, 3240, 3240];
  const rows = [headerRow(['STT', 'Mục tiêu', 'Nội dung', 'Hoạt động'], widths)];
  const items = parseThemeRows(plan);
  let sequence = 0;
  for (const domain of DEVELOPMENT_DOMAINS) {
    const domainRows = items.filter((item) => item.domain === domain);
    if (!domainRows.length) continue;
    rows.push(new TableRow({
      cantSplit: true,
      children: [cell(domain.toUpperCase(), widths.reduce((sum, width) => sum + width, 0), { bold: true, shading: 'F2F2F2', columnSpan: 4 })],
    }));
    for (const item of domainRows) {
      sequence += 1;
      rows.push(new TableRow({
        cantSplit: true,
        children: [
          cell(sequence, widths[0], { center: true }),
          cell(item.objective, widths[1]),
          cell(item.content, widths[2]),
          cell(item.activity, widths[3]),
        ],
      }));
    }
  }
  return [table(rows, widths), ...themeAppendices(plan)];
}

function themeAppendices(plan) {
  const children = [];
  if (plan.themeFamilyWeeks) {
    children.push(
      paragraph('RÈN NỀN NẾP, THÓI QUEN VÀ PHỐI HỢP VỚI CHA MẸ TRẺ', { bold: true, center: true, size: 26, before: 160, keepNext: true }),
      table([
        headerRow(['Tuần', 'Nội dung'], [1800, 9040]),
        ...splitLines(plan.themeFamilyWeeks).map((line) => {
          const [week, ...content] = line.split('|');
          return new TableRow({ children: [cell(week, 1800, { bold: true }), cell(content.join('|').trim(), 9040)] });
        }),
      ], [1800, 9040]),
    );
  }
  return children;
}

function weeklyContent(plan) {
  const widths = [1600, 1848, 1848, 1848, 1848, 1848];
  const rows = [headerRow(['Nội dung hoạt động', ...WEEK_DAYS.map(([, label]) => label)], widths)];
  parseWeeklyRows(plan).forEach((item) => {
    rows.push(new TableRow({
      cantSplit: false,
      children: [
        cell(item.activity, widths[0], { bold: true, center: true }),
        ...WEEK_DAYS.map(([key], index) => cell(item[key], widths[index + 1])),
      ],
    }));
  });
  const children = [];
  if (plan.objectives) {
    children.push(
      paragraph('MỤC TIÊU TRỌNG TÂM TRONG TUẦN', { bold: true, size: 25, keepNext: true }),
      paragraph(plan.objectives, { after: 120 }),
    );
  }
  const morning = [plan.weeklyWelcome, plan.weeklyCircleTime, plan.weeklyMorningExercise].filter(Boolean).join('\n');
  if (morning) {
    children.push(
      paragraph('ĐÓN TRẺ, TRÒ CHUYỆN, THỂ DỤC SÁNG', { bold: true, size: 25, keepNext: true }),
      paragraph(morning, { after: 120 }),
    );
  }
  children.push(paragraph('HOẠT ĐỘNG HỌC', { bold: true, size: 25, keepNext: true, before: morning ? 120 : 0 }));
  children.push(table(rows, widths));
  if (plan.weeklyCornerActivities) {
    children.push(
      paragraph('HOẠT ĐỘNG GÓC', { bold: true, size: 25, before: 160, keepNext: true }),
      paragraph(plan.weeklyCornerActivities),
    );
  }
  if (plan.weeklyOutdoorActivities) {
    children.push(
      paragraph('HOẠT ĐỘNG NGOÀI TRỜI', { bold: true, size: 25, before: 160, keepNext: true }),
      paragraph(plan.weeklyOutdoorActivities),
    );
  }
  if (plan.weeklyMealSleep) {
    children.push(
      paragraph('VỆ SINH, ĂN, NGỦ', { bold: true, size: 25, before: 160, keepNext: true }),
      paragraph(plan.weeklyMealSleep),
    );
  }
  if (plan.weeklyAfternoon) {
    children.push(
      paragraph('HOẠT ĐỘNG CHIỀU', { bold: true, size: 25, before: 160, keepNext: true }),
      paragraph(plan.weeklyAfternoon),
    );
  }
  if (plan.assessment) {
    children.push(
      paragraph('ĐÁNH GIÁ VÀ ĐIỀU CHỈNH SAU TUẦN', { bold: true, size: 25, before: 160, keepNext: true }),
      paragraph(plan.assessment),
    );
  }
  if (plan.weeklyNotes) {
    children.push(paragraph('GHI CHÚ VÀ ĐIỀU CHỈNH TRONG TUẦN', { bold: true, center: true, size: 26, before: 160, keepNext: true }), paragraph(plan.weeklyNotes));
  }
  return children;
}

function lessonContent(plan) {
  const children = [
    paragraph(plan.lessonDomain || plan.developmentArea || 'LĨNH VỰC PHÁT TRIỂN', { bold: true, center: true, size: 27, after: 20 }),
    paragraph(String(plan.lessonTitle || plan.title || 'HOẠT ĐỘNG GIÁO DỤC').toUpperCase(), { bold: true, center: true, size: 29, after: 120 }),
    paragraph('I. MỤC ĐÍCH - YÊU CẦU', { bold: true, size: 26, keepNext: true }),
    paragraph(plan.lessonObjectives || plan.objectives || 'Chưa có nội dung.'),
    paragraph('II. CHUẨN BỊ', { bold: true, size: 26, keepNext: true }),
    paragraph(plan.lessonPreparation || plan.materials || 'Chưa có nội dung.'),
    paragraph('III. TIẾN HÀNH HOẠT ĐỘNG', { bold: true, size: 26, keepNext: true }),
  ];
  const widths = [5000, 5000];
  children.push(table([
    headerRow(['Hoạt động của cô', 'Hoạt động của trẻ'], widths),
    new TableRow({
      children: [
        cell(plan.teacherActivities || plan.activities || 'Chưa có nội dung.', widths[0], { verticalAlign: VerticalAlign.TOP }),
        cell(plan.childActivities || '', widths[1], { verticalAlign: VerticalAlign.TOP }),
      ],
    }),
  ], widths));
  children.push(
    paragraph('ĐÁNH GIÁ CUỐI NGÀY', { bold: true, center: true, size: 26, before: 180, keepNext: true }),
    paragraph(plan.dailyEvaluation || plan.assessment || '........................................................................................................................\n........................................................................................................................\n........................................................................................................................'),
  );
  return children;
}

function imageParagraph(signer) {
  if (signer.mode !== 'image' || !signer.imageData) return paragraph('\n\n', { center: true });
  const match = String(signer.imageData).match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) return paragraph('\n\n', { center: true });
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      data: Buffer.from(match[2], 'base64'),
      type: match[1] === 'jpeg' ? 'jpg' : 'png',
      transformation: { width: Number(signer.width) || 120, height: Number(signer.height) || 55 },
    })],
  });
}

function signatureBlocks(signers = []) {
  if (!signers.length) {
    return [
      paragraph('NHẬN XÉT CỦA BAN GIÁM HIỆU', { bold: true, center: true, size: 26, before: 180 }),
      paragraph('........................................................................................................................\n........................................................................................................................\n........................................................................................................................'),
    ];
  }
  const widths = signers.slice(0, 3).map(() => Math.floor(10000 / Math.min(3, signers.length)));
  const cells = signers.slice(0, 3).map((signer, index) => cell([
    paragraph(signer.displayTitle || signer.role, { bold: true, center: true }),
    imageParagraph(signer),
    paragraph(signer.mode === 'hand' ? '' : signer.name, { bold: true, center: true }),
  ], widths[index], { center: true }));
  return [paragraph('XÁC NHẬN VÀ CHỮ KÝ', { bold: true, center: true, size: 26, before: 180 }), table([new TableRow({ children: cells })], widths)];
}

function sectionProperties(type) {
  const landscape = type !== 'lesson';
  return {
    page: {
      size: landscape ? { width: A4.height, height: A4.width, orientation: PageOrientation.LANDSCAPE } : { ...A4, orientation: PageOrientation.PORTRAIT },
      margin: landscape
        ? { top: 650, right: 650, bottom: 650, left: 650, header: 300, footer: 300 }
        : { top: 900, right: 850, bottom: 850, left: 1100, header: 350, footer: 350 },
    },
  };
}

async function createPlanDocx(plan = {}, school = {}) {
  const type = normalizePlanType(plan.level);
  const content = type === 'annual'
    ? annualContent(plan)
    : type === 'theme'
      ? themeContent(plan)
      : type === 'weekly'
        ? weeklyContent(plan)
        : lessonContent(plan);
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 276, after: 60 } } },
        table: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 250, after: 20 } } },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true }, heading: HeadingLevel.HEADING_1 },
      ],
    },
    sections: [{
      properties: sectionProperties(type),
      children: [...titleBlock(plan, school, type), ...content, ...signatureBlocks(plan.signers || [])],
    }],
  });
  return Packer.toBuffer(document);
}

async function createReviewDocx(report = {}, school = {}) {
  return createPlanDocx({
    level: 'Ngày/hoạt động',
    title: report.title || 'Báo cáo rà soát dữ liệu',
    period: report.period,
    author: report.author,
    lessonDomain: 'BÁO CÁO RÀ SOÁT',
    lessonTitle: report.title || 'Báo cáo rà soát dữ liệu',
    lessonObjectives: report.summary,
    lessonPreparation: report.progress,
    teacherActivities: report.issues,
    childActivities: '',
    dailyEvaluation: report.conclusion,
  }, school);
}

module.exports = { createPlanDocx, createReviewDocx };
