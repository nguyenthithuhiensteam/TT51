import { useRef, useState } from "react";
import { aiApi } from "../api/resources";
import { ApiError } from "../api/client";
import type { AgeGroup } from "../types";

type PlanType = "annual" | "theme" | "weekly" | "lesson";
type ActionKey = "regenerate" | "shorten" | "expand" | "age_adjust" | "steam" | "sel" | "differentiate";

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: "regenerate", label: "Viết lại mục này" },
  { key: "shorten", label: "Rút gọn" },
  { key: "expand", label: "Mở rộng" },
  { key: "age_adjust", label: "Điều chỉnh theo độ tuổi" },
  { key: "steam", label: "Tích hợp STEAM" },
  { key: "sel", label: "Tích hợp SEL" },
  { key: "differentiate", label: "Phân hóa theo nhu cầu trẻ" },
];

export default function AiFieldToolbar({
  planType,
  ageGroup,
  sectionPath,
  value,
  fullPlanContext,
  onApply,
  disabled,
}: {
  planType: PlanType;
  ageGroup: AgeGroup;
  sectionPath: string;
  value: unknown;
  fullPlanContext: unknown;
  onApply: (newValue: any) => void;
  disabled?: boolean;
}) {
  const [busyAction, setBusyAction] = useState<ActionKey | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function run(action: ActionKey) {
    if (busyAction) return;
    setBusyAction(action);
    setError("");
    setWarning("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await aiApi.regenerateSection(
        { planType, ageGroup, action, sectionPath, currentSectionValue: value, fullPlanContext },
        controller.signal
      );
      onApply(res.value);
      if (res.warnings.length) setWarning(res.warnings.join(" "));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Đã xảy ra lỗi không xác định khi gọi AI.");
    } finally {
      setBusyAction(null);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <div>
      <div className="ai-toolbar">
        {ACTIONS.map((a) => (
          <button key={a.key} type="button" disabled={disabled || Boolean(busyAction)} onClick={() => run(a.key)}>
            {busyAction === a.key ? "Đang xử lý..." : a.label}
          </button>
        ))}
        {busyAction && (
          <button type="button" onClick={cancel} style={{ background: "#fbdada", borderColor: "#f0b4ab", color: "#a02f22" }}>
            Hủy yêu cầu
          </button>
        )}
      </div>
      {error && <div className="banner error" style={{ padding: 6, fontSize: 12 }}>{error}</div>}
      {warning && <div className="banner warn" style={{ padding: 6, fontSize: 12 }}>{warning}</div>}
    </div>
  );
}
