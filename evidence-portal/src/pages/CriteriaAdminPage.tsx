import { useEffect, useState } from "react";
import { Card, Button } from "../components/ui";
import { addCriteria, addStandard, watchCriteria, watchStandards } from "../lib/data";
import type { AccreditationCriteria, AccreditationStandard } from "../types";

export function CriteriaAdminPage() {
  const [standards, setStandards] = useState<AccreditationStandard[]>([]);
  const [criteria, setCriteria] = useState<AccreditationCriteria[]>([]);
  const [standardForm, setStandardForm] = useState({ code: "", name: "" });
  const [criteriaForm, setCriteriaForm] = useState({ standardId: "", code: "", name: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => watchStandards(setStandards), []);
  useEffect(() => watchCriteria(setCriteria), []);

  useEffect(() => {
    if (!criteriaForm.standardId && standards[0]) {
      setCriteriaForm((p) => ({ ...p, standardId: standards[0].id }));
    }
  }, [standards, criteriaForm.standardId]);

  async function submitStandard() {
    if (!standardForm.code.trim() || !standardForm.name.trim()) return;
    setBusy(true);
    try {
      await addStandard({ code: standardForm.code.trim(), name: standardForm.name.trim(), orderNo: standards.length + 1 });
      setStandardForm({ code: "", name: "" });
    } finally {
      setBusy(false);
    }
  }

  async function submitCriteria() {
    if (!criteriaForm.standardId || !criteriaForm.code.trim() || !criteriaForm.name.trim()) return;
    setBusy(true);
    try {
      const orderNo = criteria.filter((c) => c.standardId === criteriaForm.standardId).length + 1;
      await addCriteria({
        standardId: criteriaForm.standardId,
        code: criteriaForm.code.trim(),
        name: criteriaForm.name.trim(),
        orderNo,
      });
      setCriteriaForm((p) => ({ ...p, code: "", name: "" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Thêm tiêu chuẩn</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-28 rounded-lg border border-navy/15 px-2 py-1 text-sm"
            placeholder="Mã (VD: TC4)"
            value={standardForm.code}
            onChange={(e) => setStandardForm((p) => ({ ...p, code: e.target.value }))}
          />
          <input
            className="min-w-64 flex-1 rounded-lg border border-navy/15 px-2 py-1 text-sm"
            placeholder="Tên tiêu chuẩn"
            value={standardForm.name}
            onChange={(e) => setStandardForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Button disabled={busy} onClick={submitStandard}>
            Thêm
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Thêm tiêu chí</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-navy/15 px-2 py-1 text-sm"
            value={criteriaForm.standardId}
            onChange={(e) => setCriteriaForm((p) => ({ ...p, standardId: e.target.value }))}
          >
            {standards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <input
            className="w-28 rounded-lg border border-navy/15 px-2 py-1 text-sm"
            placeholder="Mã (VD: TC4.1)"
            value={criteriaForm.code}
            onChange={(e) => setCriteriaForm((p) => ({ ...p, code: e.target.value }))}
          />
          <input
            className="min-w-64 flex-1 rounded-lg border border-navy/15 px-2 py-1 text-sm"
            placeholder="Tên tiêu chí"
            value={criteriaForm.name}
            onChange={(e) => setCriteriaForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Button disabled={busy} onClick={submitCriteria}>
            Thêm
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Danh sách hiện có</h2>
        {standards.map((s) => (
          <div key={s.id} className="mb-3">
            <p className="text-sm font-semibold text-navy">
              {s.code} — {s.name}
            </p>
            <ul className="ml-4 list-disc text-sm text-navy/70">
              {criteria
                .filter((c) => c.standardId === s.id)
                .map((c) => (
                  <li key={c.id}>
                    {c.code} — {c.name}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
