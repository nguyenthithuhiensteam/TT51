import { useEffect, useState } from "react";
import { Card, Button, StatusBadge } from "../components/ui";
import { uploadEvidence, watchCriteria, watchEvidenceForCriteria, watchStandards } from "../lib/data";
import type { AccreditationCriteria, AccreditationStandard, EvidenceFile, PortalUser } from "../types";

export function EvidencePage({ currentUser }: { currentUser: PortalUser }) {
  const [standards, setStandards] = useState<AccreditationStandard[]>([]);
  const [criteria, setCriteria] = useState<AccreditationCriteria[]>([]);
  const [standardId, setStandardId] = useState("");
  const [criteriaId, setCriteriaId] = useState("");
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchStandards(setStandards), []);
  useEffect(() => watchCriteria(setCriteria), []);

  useEffect(() => {
    if (!standardId && standards[0]) setStandardId(standards[0].id);
  }, [standards, standardId]);

  const criteriaOfStandard = criteria.filter((c) => c.standardId === standardId);

  useEffect(() => {
    if (criteriaOfStandard.length > 0 && !criteriaOfStandard.some((c) => c.id === criteriaId)) {
      setCriteriaId(criteriaOfStandard[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardId, criteria]);

  useEffect(() => {
    if (!criteriaId) return;
    return watchEvidenceForCriteria(criteriaId, setEvidence);
  }, [criteriaId]);

  async function handleUpload() {
    if (!file || !criteriaId) return;
    setBusy(true);
    setError(null);
    try {
      await uploadEvidence(criteriaId, file, description.trim(), currentUser.uid, currentUser.email);
      setDescription("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải lên thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/60">Tiêu chuẩn</label>
            <select
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
              value={standardId}
              onChange={(e) => setStandardId(e.target.value)}
            >
              {standards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/60">Tiêu chí</label>
            <select
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
              value={criteriaId}
              onChange={(e) => setCriteriaId(e.target.value)}
            >
              {criteriaOfStandard.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Tải lên minh chứng mới</h2>
        <div className="space-y-2">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <input
            className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
            placeholder="Mô tả ngắn về minh chứng"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex items-center justify-between">
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button className="ml-auto" disabled={!file || busy} onClick={handleUpload}>
              Tải lên
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Minh chứng đã tải lên cho tiêu chí này</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-1 font-medium">Tệp</th>
              <th className="pb-1 font-medium">Người tải lên</th>
              <th className="pb-1 font-medium">Ngày</th>
              <th className="pb-1 font-medium">Trạng thái</th>
              <th className="pb-1 font-medium">Ghi chú duyệt</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((ev) => (
              <tr key={ev.id} className="border-b border-navy/5">
                <td className="py-1">
                  <a href={ev.fileUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {ev.fileName}
                  </a>
                  {ev.description && <p className="text-xs text-navy/50">{ev.description}</p>}
                </td>
                <td className="py-1">{ev.uploadedByEmail}</td>
                <td className="py-1">{new Date(ev.uploadedAt).toLocaleDateString("vi-VN")}</td>
                <td className="py-1">
                  <StatusBadge status={ev.status} />
                </td>
                <td className="py-1 text-navy/60">{ev.reviewNote ?? "—"}</td>
              </tr>
            ))}
            {evidence.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-center text-navy/50">
                  Chưa có minh chứng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
