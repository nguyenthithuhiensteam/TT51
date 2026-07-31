import { useEffect, useState } from "react";
import { Card, Button } from "../components/ui";
import { reviewEvidence, watchCriteria, watchEvidenceByStatus } from "../lib/data";
import type { AccreditationCriteria, EvidenceFile, PortalUser } from "../types";

export function ApprovalPage({ currentUser }: { currentUser: PortalUser }) {
  const [pending, setPending] = useState<EvidenceFile[]>([]);
  const [criteria, setCriteria] = useState<AccreditationCriteria[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  useEffect(() => watchEvidenceByStatus("pending_approval", setPending), []);
  useEffect(() => watchCriteria(setCriteria), []);

  const criteriaName = (id: string) => criteria.find((c) => c.id === id)?.name ?? id;

  async function approve(ev: EvidenceFile) {
    setBusyId(ev.id);
    try {
      await reviewEvidence(ev.id, "approved", currentUser.uid, null);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(ev: EvidenceFile) {
    setBusyId(ev.id);
    try {
      await reviewEvidence(ev.id, "rejected", currentUser.uid, rejectNote[ev.id]?.trim() || "Không đạt yêu cầu");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-navy">Minh chứng chờ duyệt ({pending.length})</h2>
      <div className="space-y-3">
        {pending.map((ev) => (
          <div key={ev.id} className="rounded-lg border border-navy/10 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-navy">{criteriaName(ev.criteriaId)}</p>
                <a href={ev.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">
                  {ev.fileName}
                </a>
              </div>
              <p className="text-xs text-navy/50">
                {ev.uploadedByEmail} · {new Date(ev.uploadedAt).toLocaleString("vi-VN")}
              </p>
            </div>
            {ev.description && <p className="mb-2 text-sm text-navy/70">{ev.description}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-48 flex-1 rounded-lg border border-navy/15 px-2 py-1 text-sm"
                placeholder="Lý do từ chối (nếu có)"
                value={rejectNote[ev.id] ?? ""}
                onChange={(e) => setRejectNote((p) => ({ ...p, [ev.id]: e.target.value }))}
              />
              <Button variant="success" disabled={busyId === ev.id} onClick={() => approve(ev)}>
                Duyệt
              </Button>
              <Button variant="danger" disabled={busyId === ev.id} onClick={() => reject(ev)}>
                Từ chối
              </Button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-navy/50">Không có minh chứng nào đang chờ duyệt.</p>}
      </div>
    </Card>
  );
}
