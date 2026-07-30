import ExcelJS from "exceljs";
import { downloadBlob } from "../export/download";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

/**
 * Đọc trang tính đầu tiên của một tệp .xlsx: dòng 1 là tiêu đề cột, mỗi dòng sau là một bản ghi
 * dạng { [tiêu đề cột]: giá trị dạng chuỗi }. Ngày tháng được chuẩn hóa về YYYY-MM-DD.
 */
export async function parseWorkbookRows(bytes: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cellToString(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = cellToString(row.getCell(colNumber).value).trim();
      obj[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

/** Tạo tệp mẫu Excel (tiêu đề + 1 dòng ví dụ) để người dùng điền rồi tải lên nhập hàng loạt. */
export async function downloadImportTemplate(
  sheetName: string,
  fileName: string,
  headers: string[],
  exampleRow: (string | number)[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers).font = { bold: true };
  sheet.addRow(exampleRow);
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer]), fileName);
}
