import clsx from "clsx";
import type { RecordStatus, TaskPriority } from "@/lib/db/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/db/types";

const STATUS_COLORS: Record<RecordStatus, string> = {
  draft: "bg-navy/10 text-navy",
  submitted: "bg-brand/10 text-brand-dark",
  pending_approval: "bg-warn/15 text-warn",
  needs_revision: "bg-danger/10 text-danger",
  approved: "bg-mint/15 text-mint",
  signed: "bg-mint/15 text-mint",
  published: "bg-mint/20 text-mint",
  locked: "bg-navy/15 text-navy",
  archived: "bg-navy/10 text-navy/60",
  cancelled: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-navy/10 text-navy/70",
  normal: "bg-brand/10 text-brand-dark",
  high: "bg-warn/15 text-warn",
  urgent: "bg-danger/15 text-danger",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PRIORITY_COLORS[priority],
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
