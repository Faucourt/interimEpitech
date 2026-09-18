import { cloneElement, isValidElement, type ReactElement } from "react";
type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<ControlProps>;
}) {
  const messageId = `${id}-message`;
  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": messageId,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;
  return (
    <div className="grid gap-1.5 text-base font-bold text-neutral-700">
      <label htmlFor={id}>{label}</label>
      {control}
      <span
        id={messageId}
        className={`text-sm font-medium ${error ? "text-error-900" : "text-neutral-500"}`}
        role={error ? "alert" : undefined}
      >
        {error ?? hint}
      </span>
    </div>
  );
}
