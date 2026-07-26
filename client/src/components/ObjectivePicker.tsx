import { useEffect, useState } from "react";
import { objectivesApi } from "../api/resources";
import type { AgeGroup, CurriculumObjective, Domain } from "../types";

export default function ObjectivePicker({
  ageGroup,
  domain,
  value,
  onChange,
}: {
  ageGroup: AgeGroup;
  domain?: Domain;
  value: string;
  onChange: (id: string) => void;
}) {
  const [items, setItems] = useState<CurriculumObjective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    objectivesApi
      .list({ ageGroup, domain })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [ageGroup, domain]);

  if (!loading && items.length === 0) {
    return <div className="banner warn" style={{ padding: 6, fontSize: 11.5 }}>Chưa có mục tiêu nào trong ngân hàng chương trình cho độ tuổi {ageGroup}. Vào "Ngân hàng mục tiêu" để bổ sung.</div>;
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? "Đang tải..." : "-- Chọn mục tiêu --"}</option>
      {items.map((o) => (
        <option key={o.id} value={o.id}>
          {o.code} - {o.statement.slice(0, 70)}
          {o.statement.length > 70 ? "…" : ""}
        </option>
      ))}
    </select>
  );
}
