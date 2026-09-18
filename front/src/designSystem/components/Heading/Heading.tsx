import type { ReactNode } from "react";
export function Heading({
  as: Tag = "h2",
  size = "md",
  children,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  className?: string;
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-[32px] sm:text-[40px]",
  };
  return (
    <Tag
      className={`font-display font-extrabold leading-tight tracking-tight text-neutral-900 ${sizes[size]} ${className}`}
    >
      {children}
    </Tag>
  );
}
