import type { ReactNode } from "react";
import { Heading } from "../Heading";
import { Text } from "../Text";
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-5 py-10 text-center">
      <div
        className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary-50 text-xl text-primary-700"
        aria-hidden="true"
      >
        ⌕
      </div>
      <Heading as="h3" size="md">
        {title}
      </Heading>
      <Text muted className="mx-auto mt-2 max-w-sm">
        {description}
      </Text>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
