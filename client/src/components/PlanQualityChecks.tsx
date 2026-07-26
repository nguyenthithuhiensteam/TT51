import { useState } from "react";
import { aiApi } from "../api/resources";
import { ApiError } from "../api/client";

export default function PlanQualityChecks({
  planType,
  content,
  computeDuplicates,
  computeUnused,
}: {
  planType: "annual" | "theme" | "weekly" | "lesson";
  content: unknown;
  computeDuplicates?: () => string[];
  computeUnused?: () => Promise<string[]>;
}) {
  const [result, setResult] = useState<{ kind: "success" | "warn" | "error"; lines: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkConsistency() {
    setBusy(true);
    try {
      const res = await aiApi.validate(planType, content);
      setResult(res.valid ? { kind: "success", lines: ["Dữ liệu kế hoạch hợp lệ, đầy đủ cấu trúc."] } : { kind: "error", lines: res.issues });
    } catch (err) {
      setResult({ kind: "error", lines: [err instanceof ApiError ? err.message : "Không thể kiểm tra."] });
    } finally {
      setBusy(false);
    }
  }

  function checkDuplicates() {
    const dups = computeDuplicates?.() || [];
    setResult(dups.length ? { kind: "warn", lines: dups } : { kind: "success", lines: ["Không phát hiện mục tiêu bị lặp quá nhiều."] });
  }

  async function checkUnused() {
    if (!computeUnused) return;
    setBusy(true);
    try {
      const unused = await computeUnused();
      setResult(unused.length ? { kind: "warn", lines: unused } : { kind: "success", lines: ["Tất cả mục tiêu trong ngân hàng phù hợp đã được sử dụng."] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="ai-toolbar">
        <button type="button" disabled={busy} onClick={checkConsistency}>Kiểm tra tính thống nhất</button>
        {computeDuplicates && <button type="button" disabled={busy} onClick={checkDuplicates}>Kiểm tra trùng lặp</button>}
        {computeUnused && <button type="button" disabled={busy} onClick={checkUnused}>Kiểm tra mục tiêu chưa sử dụng</button>}
      </div>
      {result && (
        <div className={`banner ${result.kind === "success" ? "success" : result.kind === "warn" ? "warn" : "error"}`}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
