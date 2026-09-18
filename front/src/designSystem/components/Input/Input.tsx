import type { InputHTMLAttributes } from "react";
export const fieldClass =
  "min-h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors hover:border-neutral-400 focus:border-primary-600 focus:ring-2 focus:ring-secondary-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${fieldClass} ${props["aria-invalid"] ? "border-error-700 focus:ring-error-100" : ""} ${props.className ?? ""}`}
    />
  );
}
