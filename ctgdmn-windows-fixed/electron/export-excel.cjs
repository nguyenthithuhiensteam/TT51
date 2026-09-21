const ExcelJS = require('exceljs');

const sheets = [
  ['Kho dữ liệu mở', 'records'], ['Ma trận mục tiêu', 'matrix'], ['Danh sách kế hoạch', 'plans'],
  ['Tiến độ rà soát', 'reviewProgress'], ['Cảnh báo dữ liệu', 'issues'],
];

function valuesFor(rows) {
  if (!Array.isArray(rows) || !rows.length) return { headers: ['Thông tin'], rows: [['Chưa có dữ liệu']] };
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  return { headers, rows: rows.map((row) => headers.map((header) => row?.[header] ?? '')) };
}

async function createProfessionalWorkbook(data = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.school?.name || 'Trường Mầm non Số'; workbook.created = new Date();
  const guide = workbook.addWorksheet('Hướng dẫn');
  guide.addRows([[`${data.school?.name || 'Trường Mầm non Số'} — NĂM HỌC ${data.school?.schoolYear || '2026–2027'}`], [`Đơn vị chủ quản: ${data.school?.governingBody || 'Chưa cấu hình'}`], ['Mỗi sheet là một nhóm dữ liệu chuyên môn.'], ['Cột ID, nguồn PDF và trang nguồn dùng để truy xuất ngược.'], ['PDF chỉ là tài liệu nguồn, không phải dữ liệu làm việc.']]);
  guide.getColumn(1).width = 90; guide.getCell('A1').font = { bold: true, size: 14 };
  for (const [title, key] of sheets) {
    const worksheet = workbook.addWorksheet(title);
    const values = valuesFor(data[key]);
    worksheet.addRow(values.headers); values.rows.forEach((row) => worksheet.addRow(row));
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: values.headers.length } };
    worksheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF168C7D' } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
    worksheet.columns.forEach((column, index) => { const max = Math.max(values.headers[index]?.length || 10, ...values.rows.slice(0, 100).map((row) => String(row[index] ?? '').length)); column.width = Math.min(45, Math.max(12, max + 2)); });
  }
  return workbook;
}

async function createDirectoryWorkbook(kind, rows = [], template = false, school = {}) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = school.name || 'Trường Mầm non Số';
  const isClass = kind === 'classes';
  const isVideo = kind === 'videos';
  const title = isClass ? 'Danh mục lớp' : isVideo ? 'Danh mục video' : 'Danh mục giáo viên';
  const headers = isClass
    ? ['ID lớp','Tên lớp','Nhóm độ tuổi','Năm học','Điểm trường','Số lượng trẻ','ID giáo viên phụ trách','ID giáo viên phối hợp','Trạng thái','Ghi chú']
    : isVideo ? ['ID','Tiêu đề','Mô tả','Nhóm nội dung','Đối tượng','Loại nguồn','URL HTTPS','Thời lượng','Thứ tự','Trạng thái','Khóa ngữ cảnh'] : ['ID','Họ và tên','Chức vụ','Vai trò','ID lớp phụ trách','Tổ chuyên môn','Trạng thái','Liên hệ'];
  const sheet = workbook.addWorksheet(title); sheet.addRow(headers);
  if (template) sheet.addRow(isClass ? ['lop-01','Lớp mẫu','4–5 tuổi',school.schoolYear || '2026–2027','',25,'gv-01','','Đang sử dụng',''] : isVideo ? ['','Nhập dữ liệu từ Excel','Hướng dẫn thao tác','Quản lý dữ liệu','teacher; team_lead','Trực tuyến','https://example.com/video','05:00',1,'Bật','open-data'] : ['gv-01','Nguyễn Văn A','Giáo viên','Người soạn; Giáo viên phối hợp','lop-01','Tổ Mẫu giáo','Đang công tác','']);
  else rows.forEach((row) => sheet.addRow(isClass ? [row.id,row.name,row.ageGroup,row.schoolYear,row.campus,row.childCount,row.leadTeacherId,(row.collaboratingTeacherIds||[]).join('; '),row.active ? 'Đang sử dụng' : 'Ngừng sử dụng',row.notes] : isVideo ? [row.id,row.title,row.description,row.category,(row.audience||[]).join('; '),row.source_type==='offline'?'Ngoại tuyến':'Trực tuyến',row.url||'',row.duration,row.sort_order,row.enabled?'Bật':'Tắt',row.context_key||''] : [row.id,row.name,row.title,(row.roles||[]).join('; '),(row.classIds||[]).join('; '),row.team,row.active ? 'Đang công tác' : 'Ngừng sử dụng',row.contact]));
  sheet.views = [{ state:'frozen', ySplit:1 }]; sheet.autoFilter = { from:'A1', to:{ row:1, column:headers.length } };
  sheet.getRow(1).eachCell((cell) => { cell.font = {bold:true,color:{argb:'FFFFFFFF'}}; cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF168C7D'}}; });
  sheet.columns.forEach((column, index) => { column.width = Math.min(38, Math.max(14, headers[index].length + 3)); });
  const guide = workbook.addWorksheet('Hướng dẫn'); guide.addRows([[`${title.toUpperCase()} – ${school.name || 'Trường Mầm non Số'}`],['Không đổi tên hàng tiêu đề. ID phải duy nhất. Nhiều vai trò hoặc ID được phân cách bằng dấu chấm phẩy.'],['Dữ liệu được nhập và lưu cục bộ trên máy.']]); guide.getColumn(1).width = 100;
  return workbook;
}

module.exports = { createProfessionalWorkbook, createDirectoryWorkbook };
