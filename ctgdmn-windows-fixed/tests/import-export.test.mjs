import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { validateImportFile } = require('../electron/validation.cjs');
const { parseWordBuffer } = require('../electron/import-word.cjs');
const { parseExcelBuffer } = require('../electron/import-excel.cjs');
const { createPlanDocx } = require('../electron/export-word.cjs');
const { createProfessionalWorkbook, createDirectoryWorkbook } = require('../electron/export-excel.cjs');

test('chấp nhận DOCX, XLSX, XLS, PDF và từ chối phần mở rộng khác', () => {
  for (const [name, kind] of [['a.docx','word'],['a.xlsx','excel'],['a.xls','excel'],['a.pdf','pdf']]) assert.doesNotThrow(() => validateImportFile(name, 100, kind));
  assert.throws(() => validateImportFile('a.docm', 100, 'word'), /không được phép/);
  assert.throws(() => validateImportFile('a.exe', 100, 'pdf'), /không được phép/);
  assert.throws(() => validateImportFile('a.docx', 30 * 1024 * 1024, 'word'), /25 MB/);
});

test('từ chối riêng các phần mở rộng không hợp lệ và tệp quá kích thước', () => {
  assert.throws(() => validateImportFile('du-lieu.csv', 100, 'excel'), /không được phép/);
  assert.throws(() => validateImportFile('macro.docm', 100, 'word'), /không được phép/);
  assert.throws(() => validateImportFile('nguon.pdf', 26 * 1024 * 1024, 'pdf'), /25 MB/);
});

test('nhập Word đọc được tiêu đề, đoạn văn và bảng', async () => {
  const document = new Document({ sections:[{children:[new Paragraph({text:'KẾ HOẠCH TUẦN'}),new Paragraph({text:'Mục tiêu phát triển ngôn ngữ'}),new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph('Mục tiêu')]}),new TableCell({children:[new Paragraph('Hoạt động')]} )]}),new TableRow({children:[new TableCell({children:[new Paragraph('Nghe hiểu')]}),new TableCell({children:[new Paragraph('Kể chuyện')]} )]})]})]}] });
  const buffer = await Packer.toBuffer(document);
  const parsed = await parseWordBuffer(buffer, 'ke-hoach.docx');
  assert.match(parsed.text, /Mục tiêu phát triển ngôn ngữ/);
  assert.deepEqual(parsed.tables[0][1], ['Nghe hiểu','Kể chuyện']);
});

test('đọc danh sách sheet Excel và tối thiểu 20 dòng xem trước', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ID','Mục tiêu'],...Array.from({length:25},(_,i)=>[`m${i+1}`,`Mục tiêu ${i+1}`])]), 'Muc tieu');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ID'],['h1']]), 'Hoat dong');
  const parsed = parseExcelBuffer(XLSX.write(workbook,{bookType:'xlsx',type:'buffer'}),'data.xlsx');
  assert.deepEqual(parsed.sheets.map((sheet)=>sheet.name), ['Muc tieu','Hoat dong']);
  assert.equal(parsed.sheets[0].preview.length, 21);
});

test('tạo DOCX hợp lệ và đọc lại không mất trường chính', async () => {
  const buffer = await createPlanDocx({level:'Kế hoạch tuần',title:'Tuần cây xanh',ageGroup:'4–5 tuổi',period:'Tuần 1',author:'Giáo viên A',context:'Căn cứ chương trình',objectives:'Nhận biết cây',activities:'Tưới cây',materials:'Bình tưới',differentiation:'Hỗ trợ cá nhân',assessment:'Phiếu quan sát',family:'Phối hợp gia đình'},{name:'Trường Mầm non Tràng Đà',schoolYear:'2026–2027'});
  assert.equal(buffer.subarray(0,2).toString(), 'PK');
  const parsed = await parseWordBuffer(buffer,'out.docx');
  assert.match(parsed.text,/Tuần cây xanh/);
  assert.match(parsed.text,/Nhận biết cây/);
  assert.match(parsed.text,/Phiếu quan sát/);
});

test('tạo XLSX hợp lệ, đủ sheet và đọc lại ID nguồn', async () => {
  const workbook = await createProfessionalWorkbook({ records:[{id:'d1',objective:'Nhận biết cây',sourcePdf:'nguon.pdf',sourcePage:'12'}], matrix:[{id:'d1',month:'Tháng 9'}], plans:[{id:'p1',title:'Kế hoạch'}], reviewProgress:[{reviewed:2,total:3}], issues:[{id:'i1',title:'Thiếu nguồn'}] });
  const buffer = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook(); await restored.xlsx.load(buffer);
  assert.deepEqual(restored.worksheets.map((sheet)=>sheet.name), ['Hướng dẫn','Kho dữ liệu mở','Ma trận mục tiêu','Danh sách kế hoạch','Tiến độ rà soát','Cảnh báo dữ liệu']);
  assert.equal(restored.getWorksheet('Kho dữ liệu mở').getCell('A2').value, 'd1');
  assert.equal(restored.getWorksheet('Kho dữ liệu mở').views[0].state, 'frozen');
});

test('xuất Word có khối chữ ký đã chọn', async () => {
  const buffer = await createPlanDocx({ title:'Kế hoạch có ký', signers:[{role:'Hiệu trưởng',displayTitle:'HIỆU TRƯỞNG',name:'Nguyễn Văn A',mode:'name'}] }, {name:'Trường A'});
  const parsed = await parseWordBuffer(buffer, 'signed.docx');
  assert.match(parsed.text, /XÁC NHẬN VÀ CHỮ KÝ/); assert.match(parsed.text, /Nguyễn Văn A/);
});

test('xuất Word không có ảnh vẫn giữ khoảng trống ký tay', async () => {
  const buffer = await createPlanDocx({ title:'Kế hoạch ký tay', signers:[{role:'Người lập kế hoạch',displayTitle:'NGƯỜI LẬP KẾ HOẠCH',name:'',mode:'hand'}] }, {name:'Trường A'});
  const parsed = await parseWordBuffer(buffer, 'hand.docx');
  assert.match(parsed.text, /NGƯỜI LẬP KẾ HOẠCH/); assert.match(parsed.text, /XÁC NHẬN VÀ CHỮ KÝ/);
});

test('tạo Excel mẫu và xuất danh mục lớp, giáo viên hợp lệ', async () => {
  const classBook=await createDirectoryWorkbook('classes',[],true,{name:'Trường A',schoolYear:'2026–2027'});const classBuffer=await classBook.xlsx.writeBuffer();const restored=new ExcelJS.Workbook();await restored.xlsx.load(classBuffer);assert.equal(restored.getWorksheet('Danh mục lớp').getCell('A1').value,'ID lớp');assert.equal(restored.getWorksheet('Danh mục lớp').getCell('B2').value,'Lớp mẫu');
  const staffBook=await createDirectoryWorkbook('staff',[{id:'gv1',name:'Nguyễn A',title:'Giáo viên',roles:['Người soạn'],classIds:[],active:true}],false,{name:'Trường A'});assert.equal(staffBook.getWorksheet('Danh mục giáo viên').getCell('A2').value,'gv1');
});
