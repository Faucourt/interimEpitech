import type { ButtonHTMLAttributes } from "react";

export type ButtonSize = "1" | "2" | "3" | "4";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
const sizes: Record<ButtonSize, string> = {
  "1": "min-h-9 px-3 text-sm",
  "2": "min-h-11 px-4 text-base",
  "3": "min-h-12 px-5 text-base",
  "4": "min-h-14 px-6 text-lg",
};
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900",
  secondary:
    "bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800",
  outline:
    "border border-primary-200 bg-white text-primary-700 hover:border-primary-500 hover:bg-primary-50",
  ghost: "text-primary-700 hover:bg-primary-50 active:bg-primary-100",
  danger: "bg-error-700 text-white hover:bg-error-800 active:bg-error-900",
};
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  loading?: boolean;
};
export function Button({
  variant = "primary",
  size = "2",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
