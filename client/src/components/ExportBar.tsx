import { useState } from "react";
import { downloadFile, openBlobInNewTab, ApiError } from "../api/client";

export default function ExportBar({ docxUrl, pdfUrl }: { docxUrl: string; pdfUrl: string }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xuất tệp. Vui lòng thử lại.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 4 }}>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("preview", () => openBlobInNewTab(pdfUrl))}>
          {busy === "preview" ? "Đang tạo bản xem trước..." : "Xem trước (PDF)"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("docx", () => downloadFile(docxUrl, "ke-hoach.docx"))}>
          {busy === "docx" ? "Đang xuất..." : "Tải DOCX"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("pdf", () => downloadFile(pdfUrl, "ke-hoach.pdf"))}>
          {busy === "pdf" ? "Đang xuất..." : "Tải PDF"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("print", () => openBlobInNewTab(pdfUrl, true))}>
          In trực tiếp
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}
