import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import {
  getDataDir,
  listBackupFiles,
  listBackupHistory,
  runBackup,
  runRestore,
  type BackupRow,
} from "@/lib/db/backupRepo";
import { Modal } from "../../components/ui/Modal";

export function BackupPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [backupDir, setBackupDir] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [history, setHistory] = useState<BackupRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  async function refresh(dir: string) {
    if (!dir) return;
    setFiles(await listBackupFiles(dir));
    setHistory(await listBackupHistory());
  }

  useEffect(() => {
    getDataDir().then(async (dir) => {
      const defaultBackupDir = `${dir}/backups`;
      setBackupDir(defaultBackupDir);
      refresh(defaultBackupDir);
    });
  }, []);

  async function pickBackupDir() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setBackupDir(selected);
    refresh(selected);
  }

  async function handleBackup() {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      const path = await runBackup(backupDir, user.id);
      setMessage(`Đã sao lưu thành công: ${path}`);
      refresh(backupDir);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sao lưu thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(filePath: string) {
    setBusy(true);
    setMessage(null);
    try {
      await runRestore(filePath);
      setMessage(
        "Khôi phục thành công. Vui lòng khởi động lại ứng dụng để tải lại dữ liệu đã khôi phục.",
      );
      setConfirmRestore(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Khôi phục thất bại");
    } finally {
      setBusy(false);
    }
  }

  if (!hasPermission("system.backup")) {
    return (
      <Card className="text-center text-navy/60">Bạn không có quyền sao lưu/khôi phục dữ liệu.</Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Sao lưu / Khôi phục dữ liệu</h1>
        <p className="text-sm text-navy/60">
          Nên sao lưu định kỳ ra ổ đĩa ngoài hoặc USB để phòng ngừa rủi ro mất máy tính.
        </p>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Thư mục sao lưu</h2>
        <code className="mb-3 block break-all rounded-lg bg-cream p-2 text-xs">{backupDir}</code>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={pickBackupDir}>
            Chọn thư mục khác
          </Button>
          <Button onClick={handleBackup} disabled={busy}>
            {busy ? "Đang xử lý..." : "Sao lưu ngay"}
          </Button>
        </div>
        {message && <p className="mt-3 text-sm text-navy">{message}</p>}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Các bản sao lưu trong thư mục</h2>
        <div className="space-y-1 text-sm">
          {files.length === 0 && <p className="text-navy/50">Chưa có bản sao lưu nào.</p>}
          {files.map((f) => (
            <div key={f} className="flex items-center justify-between rounded-lg border border-navy/5 p-2">
              <span className="truncate font-mono text-xs">{f}</span>
              {hasPermission("system.restore") && (
                <Button size="sm" variant="secondary" onClick={() => setConfirmRestore(f)}>
                  Khôi phục
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Lịch sử sao lưu (ghi trong CSDL)</h2>
        <div className="space-y-1 text-sm">
          {history.map((h) => (
            <div key={h.id} className="flex justify-between rounded-lg border border-navy/5 p-2">
              <span className="truncate font-mono text-xs">{h.file_path}</span>
              <span className="text-xs text-navy/50">
                {new Date(h.created_at).toLocaleString("vi-VN")}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!confirmRestore} onClose={() => setConfirmRestore(null)} title="Xác nhận khôi phục">
        <p className="text-sm text-navy/70">
          Dữ liệu hiện tại sẽ được thay thế bằng bản sao lưu đã chọn (một bản sao dữ liệu hiện tại
          sẽ tự động được giữ lại để phòng ngừa). Bạn có chắc chắn muốn tiếp tục?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmRestore(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => confirmRestore && handleRestore(confirmRestore)}
          >
            Xác nhận khôi phục
          </Button>
        </div>
      </Modal>
    </div>
  );
}
