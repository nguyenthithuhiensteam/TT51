import clsx from "clsx";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("rounded-xl bg-white p-5 shadow-card border border-navy/5", className)}>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "danger" | "mint";
}) {
  const toneClasses = {
    default: "text-navy",
    warn: "text-warn",
    danger: "text-danger",
    mint: "text-mint",
  }[tone];
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-navy/60">{label}</span>
      <span className={clsx("text-2xl font-semibold", toneClasses)}>{value}</span>
    </Card>
  );
}
