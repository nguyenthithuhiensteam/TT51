import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("rounded-xl bg-white p-4 shadow-card", className)}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "success";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variantClass: Record<ButtonVariant, string> = {
    primary: "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/40",
    secondary: "bg-navy/5 text-navy hover:bg-navy/10 disabled:opacity-40",
    danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
    success: "bg-mint text-white hover:bg-mint/90 disabled:bg-mint/40",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}

const ROLE_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  staff: "Cán bộ",
  approver: "Người duyệt minh chứng",
  admin: "Quản trị",
};

export function RoleBadge({ role }: { role: string }) {
  const color =
    role === "admin"
      ? "bg-navy/15 text-navy"
      : role === "approver"
        ? "bg-brand/10 text-brand-dark"
        : role === "staff"
          ? "bg-mint/15 text-mint"
          : "bg-warn/15 text-warn";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "bg-mint/15 text-mint"
      : status === "rejected"
        ? "bg-danger/15 text-danger"
        : "bg-warn/15 text-warn";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
