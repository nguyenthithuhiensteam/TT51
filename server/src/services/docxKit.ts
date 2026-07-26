import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx";

export const FONT = "Times New Roman";
export const SIZE_BODY = 26; // 13pt
export const SIZE_TITLE = 28; // 14pt

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

export function cellBorders() {
  return { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
}

export function textRun(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new TextRun({ text: text ?? "", font: FONT, size: opts.size || SIZE_BODY, bold: opts.bold, italics: opts.italics });
}

export function para(text: string, opts: { bold?: boolean; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 60 },
    children: (text || "").split("\n").length > 1
      ? (text || "").split("\n").flatMap((line, i, arr) => [
          textRun(line, opts),
          ...(i < arr.length - 1 ? [new TextRun({ text: "", break: 1 })] : []),
        ])
      : [textRun(text, opts)],
  });
}

export function titleParagraph(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [textRun(text.toUpperCase(), { bold: true, size: SIZE_TITLE })],
  });
}

export function subTitleParagraph(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [textRun(text, { bold: true })],
  });
}

export function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [textRun(text, { bold: true })],
  });
}

export function headerCell(text: string, widthPct?: number) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: "F2F2F2" },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun(text, { bold: true })] })],
  });
}

export function bodyCell(text: string, opts: { widthPct?: number; bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  const lines = (text || "").split("\n");
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: cellBorders(),
    verticalAlign: VerticalAlign.TOP,
    children: lines.length ? lines.map((l) => new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: [textRun(l, { bold: opts.bold })] })) : [new Paragraph({ children: [textRun("")] })],
  });
}

export function makeTable(headerCells: TableCell[], bodyRows: TableCell[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headerCells }),
      ...bodyRows.map((cells) => new TableRow({ children: cells })),
    ],
  });
}

export function dottedLines(count: number) {
  return Array.from({ length: count }).map(
    () => new Paragraph({ spacing: { after: 200 }, children: [textRun(".".repeat(120))] })
  );
}

export function buildDocument(opts: { orientation?: "portrait" | "landscape"; children: (Paragraph | Table)[] }) {
  const isLandscape = opts.orientation === "landscape";
  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE_BODY } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(isLandscape ? 297 : 210),
              height: convertMillimetersToTwip(isLandscape ? 210 : 297),
              orientation: isLandscape ? ("landscape" as any) : ("portrait" as any),
            },
            margin: { top: convertMillimetersToTwip(20), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20) },
          },
        },
        headers: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [textRun("Trang "), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE_BODY }), textRun("/"), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SIZE_BODY })],
              }),
            ],
          }),
        },
        children: opts.children,
      },
    ],
  });
}
