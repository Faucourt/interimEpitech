import type { TextareaHTMLAttributes } from "react";
import { fieldClass } from "../Input/Input";
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${fieldClass} min-h-28 py-3 ${props["aria-invalid"] ? "border-error-700 focus:ring-error-100" : ""} ${props.className ?? ""}`}
    />
  );
}
