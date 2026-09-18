import type { ReactNode } from "react";
import type { StatusTone } from "../Badge";
export function Status({
  status,
  children,
}: {
  status: StatusTone;
  children: ReactNode;
}) {
  const dot: Record<StatusTone, string> = {
    success: "bg-success-700",
    warning: "bg-warning-700",
    error: "bg-error-700",
    info: "bg-info-700",
    neutral: "bg-neutral-500",
    secondary: "bg-secondary-600",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold">
      <span
        className={`size-2 rounded-full ${dot[status]}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
