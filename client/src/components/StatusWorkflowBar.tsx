import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import type { PlanStatus } from "../types";

interface StatusApi {
  setStatus: (id: string, status: PlanStatus) => Promise<{ ok: boolean; status: PlanStatus }>;
}

export default function StatusWorkflowBar({ api, planId, status, onChanged }: { api: StatusApi; planId: string; status: PlanStatus; onChanged: (s: PlanStatus) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: PlanStatus) {
    setBusy(true);
    setError("");
    try {
      const res = await api.setStatus(planId, next);
      onChanged(res.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể chuyển trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = user?.role && (status === "nhap" || status === "can_dieu_chinh");
  const canReview = user && (user.role === "to_truong" || user.role === "can_bo_quan_ly") && status === "cho_duyet";

  return (
    <div className="toolbar">
      <StatusBadge status={status} />
      {canSubmit && (
        <button type="button" disabled={busy} onClick={() => change("cho_duyet")}>
          Gửi duyệt
        </button>
      )}
      {canReview && (
        <>
          <button type="button" className="primary" disabled={busy} onClick={() => change("da_duyet")}>
            Phê duyệt
          </button>
          <button type="button" disabled={busy} onClick={() => change("can_dieu_chinh")}>
            Yêu cầu điều chỉnh
          </button>
        </>
      )}
      {error && <span style={{ color: "#a02f22", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
