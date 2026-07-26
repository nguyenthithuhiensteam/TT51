import { useEffect, useState } from "react";
import { ApiError } from "../api/client";

interface VersionApi {
  versions: (id: string) => Promise<{ version_number: number; change_note: string | null; edited_by: string | null; edited_at: string }[]>;
  restore: (id: string, versionNumber: number) => Promise<{ ok: boolean; version: number }>;
}

export default function VersionHistoryPanel({ api, planId, onRestored }: { api: VersionApi; planId: string; onRestored: () => void }) {
  const [items, setItems] = useState<{ version_number: number; change_note: string | null; edited_by: string | null; edited_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.versions(planId).then(setItems).catch(() => setItems([]));
  }, [open, planId]);

  async function restore(v: number) {
    if (!confirm(`Khôi phục về phiên bản ${v}? Trạng thái hiện tại sẽ được lưu lại như một phiên bản mới trước khi khôi phục.`)) return;
    setBusy(true);
    setError("");
    try {
      await api.restore(planId, v);
      onRestored();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể khôi phục phiên bản.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {open ? "Ẩn lịch sử phiên bản" : "Lịch sử phiên bản"}
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          {error && <div className="banner error">{error}</div>}
          {items.length === 0 && <p className="muted">Chưa có lịch sử phiên bản.</p>}
          <table className="grid">
            <thead>
              <tr>
                <th>Phiên bản</th>
                <th>Người chỉnh sửa</th>
                <th>Thời gian</th>
                <th>Ghi chú</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.version_number}>
                  <td>{v.version_number}</td>
                  <td>{v.edited_by || "-"}</td>
                  <td>{v.edited_at}</td>
                  <td>{v.change_note || "-"}</td>
                  <td>
                    <button type="button" disabled={busy} onClick={() => restore(v.version_number)}>
                      Khôi phục
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
