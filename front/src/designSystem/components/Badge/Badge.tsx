import type { ReactNode } from "react";
export type StatusTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "secondary";
const styles: Record<StatusTone, string> = {
  success: "bg-success-100 text-success-900",
  warning: "bg-warning-100 text-warning-900",
  error: "bg-error-100 text-error-900",
  info: "bg-info-100 text-info-700",
  neutral: "bg-neutral-100 text-neutral-700",
  secondary: "bg-secondary-100 text-secondary-900",
};
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
