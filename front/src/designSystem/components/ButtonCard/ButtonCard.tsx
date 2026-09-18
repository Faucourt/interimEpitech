import type { ReactNode } from "react";
import type { ButtonSize } from "../Button";
export type ButtonCardColor = "primary" | "secondary" | "accent" | "neutral";
export function ButtonCard({
  size = "2",
  color = "primary",
  title,
  description,
  icon,
  badge,
  selected,
  disabled,
  onClick,
}: {
  size?: ButtonSize;
  color?: ButtonCardColor;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<ButtonCardColor, string> = {
    primary: "border-primary-200 bg-primary-50 text-primary-900",
    secondary: "border-secondary-200 bg-secondary-50 text-secondary-900",
    accent: "border-accent-200 bg-accent-50 text-accent-900",
    neutral: "border-neutral-200 bg-white text-neutral-900",
  };
  const heights = {
    "1": "min-h-16",
    "2": "min-h-20",
    "3": "min-h-24",
    "4": "min-h-28",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-50 ${heights[size]} ${colors[color]} ${selected ? "ring-2 ring-secondary-500 ring-offset-2" : ""}`}
    >
      <span className="mt-0.5 text-xl" aria-hidden={icon ? true : undefined}>
        {icon ?? "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 font-bold">
          <span>{title}</span>
          {badge}
        </span>
        {description && (
          <span className="mt-1 block text-sm leading-5 opacity-75">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
