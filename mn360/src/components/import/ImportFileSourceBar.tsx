import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "../ui/Button";
import { loadGoogleDriveConfig, pickExcelFileFromGoogleDrive } from "../../lib/import/googleDrive";

/** Hai nguồn chọn tệp Excel để nhập dữ liệu: tệp có sẵn trên máy, hoặc chọn từ Google Drive. */
export function ImportFileSourceBar({
  onFile,
  disabled,
}: {
  onFile: (bytes: ArrayBuffer, name: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLocalFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      onFile(bytes, file.name);
    } catch {
      setError("Không đọc được tệp đã chọn");
    }
  }

  async function handleGoogleDrive() {
    setDriveBusy(true);
    setError(null);
    try {
      const config = await loadGoogleDriveConfig();
      const picked = await pickExcelFileFromGoogleDrive(config);
      if (picked) onFile(picked.bytes, picked.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối Google Drive");
    } finally {
      setDriveBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleLocalFile}
          disabled={disabled}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Chọn tệp trên máy
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || driveBusy} onClick={handleGoogleDrive}>
          {driveBusy ? "Đang kết nối Google Drive..." : "Chọn từ Google Drive"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
