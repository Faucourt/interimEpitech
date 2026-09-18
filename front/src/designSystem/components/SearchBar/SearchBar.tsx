import { useId } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
export function SearchBar({
  value,
  onChange,
  onSubmit,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? `design-system-search-${generatedId}`;
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>
        Rechercher
      </label>
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Rechercher"
      />
      <Button type="submit" size="2" className="w-full sm:w-auto">
        Rechercher
      </Button>
    </form>
  );
}
