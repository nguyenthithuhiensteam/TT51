/**
 * Bản artifact (một tệp HTML) không nhúng thư viện `exceljs` — cùng lý do với docxStub.ts.
 * Xuất Excel chỉ khả dụng ở bản xem trước trình duyệt đầy đủ hoặc ứng dụng desktop thật.
 */
const MESSAGE =
  "Xuất Excel không khả dụng trong bản xem trước rút gọn này — dùng bản `npm run build:web` đầy đủ hoặc ứng dụng desktop thật.";

function throwingProxy(): unknown {
  return new Proxy(function stub() {}, {
    get() {
      throw new Error(MESSAGE);
    },
    construct() {
      throw new Error(MESSAGE);
    },
  });
}

export default { Workbook: throwingProxy() };
