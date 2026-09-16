import type { SelectHTMLAttributes } from "react";
import { fieldClass } from "../Input/Input";
export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${fieldClass} ${props["aria-invalid"] ? "border-error-700 focus:ring-error-100" : ""} ${props.className ?? ""}`}
    >
      {children}
    </select>
  );
}
