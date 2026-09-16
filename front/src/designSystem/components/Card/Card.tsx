import type { ReactNode } from "react";
export type CardVariant = "default" | "outlined" | "elevated" | "interactive";
export type CardSize = "sm" | "md" | "lg";
export function Card({
  variant = "default",
  size = "md",
  children,
  className = "",
}: {
  variant?: CardVariant;
  size?: CardSize;
  children: ReactNode;
  className?: string;
}) {
  const variants = {
    default: "bg-white border border-transparent",
    outlined: "bg-white border border-neutral-200",
    elevated: "bg-white shadow-soft border border-neutral-100",
    interactive:
      "bg-white border border-neutral-200 transition-transform hover:-translate-y-0.5 hover:shadow-soft motion-reduce:transform-none",
  };
  const sizes = { sm: "p-3", md: "p-5", lg: "p-6 sm:p-8" };
  return (
    <div
      className={`rounded-lg ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </div>
  );
}
