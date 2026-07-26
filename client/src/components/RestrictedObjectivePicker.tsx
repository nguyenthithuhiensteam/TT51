import { useEffect, useState } from "react";
import { objectivesApi } from "../api/resources";
import type { AgeGroup, CurriculumObjective, Domain } from "../types";

export default function RestrictedObjectivePicker({
  ageGroup,
  domain,
  allowedIds,
  value,
  onChange,
}: {
  ageGroup: AgeGroup;
  domain?: Domain;
  allowedIds: string[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [items, setItems] = useState<CurriculumObjective[]>([]);
  useEffect(() => {
    objectivesApi.list({ ageGroup, domain }).then(setItems);
  }, [ageGroup, domain]);

  const allowedSet = new Set(allowedIds);
  const options = items.filter((o) => allowedSet.has(o.id));

  if (allowedIds.length === 0) {
    return <div className="hint">Chưa có mục tiêu nào được chọn ở cấp trên cho lĩnh vực này.</div>;
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Chọn mục tiêu (đã chọn ở cấp trên) --</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.code} - {o.statement.slice(0, 60)}</option>
      ))}
    </select>
  );
}
