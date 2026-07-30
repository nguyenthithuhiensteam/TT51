import { useState } from "react";
import { X } from "lucide-react";

/** Chỉ hiển thị khi chạy bản xem trước web/artifact (webshim) — không hiện trong app desktop thật. */
export function WebPreviewBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (!__IS_WEB_PREVIEW__ || dismissed) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-warn/90 px-3 py-1.5 text-center text-xs font-medium text-white">
      <span>
        Đây là bản xem trước trên web — dữ liệu chỉ lưu tạm trong trình duyệt, không phải hệ thống
        chính thức của trường. Bản desktop thật lưu dữ liệu cục bộ trên máy tính.
      </span>
      <button onClick={() => setDismissed(true)} aria-label="Đóng thông báo" className="shrink-0 rounded-full p-0.5 hover:bg-white/20">
        <X size={14} />
      </button>
    </div>
  );
}
