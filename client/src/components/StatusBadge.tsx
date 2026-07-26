import { PLAN_STATUS_LABELS, type PlanStatus } from "../types";

export default function StatusBadge({ status }: { status: PlanStatus }) {
  return <span className={`status-pill status-${status}`}>{PLAN_STATUS_LABELS[status]}</span>;
}
