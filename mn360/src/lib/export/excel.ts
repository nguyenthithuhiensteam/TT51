import ExcelJS from "exceljs";
import { downloadBlob } from "./download";
import { STATUS_LABELS, PRIORITY_LABELS, CHILD_STATUS_LABELS } from "../db/types";
import type { TaskWithOwner } from "../db/taskRepo";
import type { ChildWithClass } from "../db/childRepo";

async function exportRows(
  sheetName: string,
  fileName: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer]), fileName);
}

export async function exportTasksToExcel(tasks: TaskWithOwner[]): Promise<void> {
  await exportRows(
    "Công việc",
    `danh-sach-cong-viec-${new Date().toISOString().slice(0, 10)}.xlsx`,
    ["Mã", "Tên nhiệm vụ", "Người chủ trì", "Ưu tiên", "Hạn hoàn thành", "Trạng thái", "Tiến độ (%)"],
    tasks.map((t) => [
      t.code,
      t.title,
      t.owner_name,
      PRIORITY_LABELS[t.priority],
      t.due_date ?? "",
      STATUS_LABELS[t.status],
      t.progress_percent,
    ]),
  );
}

export async function exportChildrenToExcel(children: ChildWithClass[]): Promise<void> {
  await exportRows(
    "Trẻ em",
    `danh-sach-tre-${new Date().toISOString().slice(0, 10)}.xlsx`,
    ["Mã trẻ", "Họ và tên", "Ngày sinh", "Giới tính", "Lớp", "Trạng thái"],
    children.map((c) => [
      c.code,
      c.full_name,
      c.dob,
      c.gender === "male" ? "Nam" : "Nữ",
      c.class_name ?? "",
      CHILD_STATUS_LABELS[c.status],
    ]),
  );
}

export interface AttendanceExportRow {
  code: string;
  fullName: string;
  present: number;
  absentExcused: number;
  absentUnexcused: number;
  late: number;
}

export async function exportAttendanceReportToExcel(
  className: string,
  fromDate: string,
  toDate: string,
  rows: AttendanceExportRow[],
): Promise<void> {
  await exportRows(
    "Chuyên cần",
    `chuyen-can-${className}-${fromDate}-den-${toDate}.xlsx`,
    ["Mã trẻ", "Họ và tên", "Có mặt", "Nghỉ có phép", "Nghỉ không phép", "Đi muộn"],
    rows.map((r) => [r.code, r.fullName, r.present, r.absentExcused, r.absentUnexcused, r.late]),
  );
}
