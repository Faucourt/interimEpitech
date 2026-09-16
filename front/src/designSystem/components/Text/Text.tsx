import type { ReactNode } from "react";
export function Text({
  as: Tag = "p",
  size = "md",
  muted = false,
  children,
  className = "",
}: {
  as?: "p" | "span" | "div";
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={`${size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base"} leading-relaxed ${muted ? "text-neutral-500" : "text-neutral-700"} ${className}`}
    >
      {children}
    </Tag>
  );
}
