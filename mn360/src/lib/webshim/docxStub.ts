/**
 * Bản artifact (một tệp HTML) không nhúng thư viện `docx` — thư viện này kéo theo mã XML
 * làm bản dựng vượt giới hạn nội dung khi lưu trữ dạng trang tĩnh. Xuất Word chỉ khả dụng ở
 * bản xem trước trình duyệt đầy đủ (`npm run build:web`) hoặc ứng dụng desktop thật.
 */
const MESSAGE =
  "Xuất Word không khả dụng trong bản xem trước rút gọn này — dùng bản `npm run build:web` đầy đủ hoặc ứng dụng desktop thật.";

function throwingProxy(): unknown {
  return new Proxy(function stub() {}, {
    get() {
      throw new Error(MESSAGE);
    },
    construct() {
      throw new Error(MESSAGE);
    },
    apply() {
      throw new Error(MESSAGE);
    },
  });
}

export const Document = throwingProxy();
export const Packer = throwingProxy();
export const Paragraph = throwingProxy();
export const HeadingLevel = throwingProxy();
export const TextRun = throwingProxy();
