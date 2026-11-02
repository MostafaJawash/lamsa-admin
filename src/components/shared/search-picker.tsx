import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/messages";

export type PickerOption = { value: string; label: string; hint?: string };

type Props = {
  id: string;
  /** What is chosen now; shown as a chip with a change button instead of the search box. */
  selected: PickerOption | null;
  options: readonly PickerOption[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (option: PickerOption) => void;
  onClear: () => void;
  placeholder: string;
  loading?: boolean;
  noResults?: string;
  invalid?: boolean;
};

/**
 * A searchable single choice: type, pick from the results. Filtering is the caller's job
 * (server-side for products and customers, in memory for the small category/brand lists).
 */
export function SearchPicker({
  id,
  selected,
  options,
  query,
  onQueryChange,
  onSelect,
  onClear,
  placeholder,
  loading,
  noResults = m.link.noResults,
  invalid,
}: Props) {
  if (selected)
    return (
      <div
        data-testid={`${id}-selected`}
        className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        <span className="flex flex-col">
          <span className="font-medium">{selected.label}</span>
          {selected.hint ? (
            <bdi dir="ltr" className="text-xs text-ink-muted">
              {selected.hint}
            </bdi>
          ) : null}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          {m.link.change}
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-invalid={invalid ? true : undefined}
      />
      <ul
        role="listbox"
        aria-label={placeholder}
        className="max-h-48 overflow-y-auto rounded-lg border border-line"
      >
        {options.length === 0 ? (
          <li className="px-3 py-2 text-sm text-ink-muted">
            {loading ? m.link.loading : noResults}
          </li>
        ) : (
          options.map((option) => (
            <li key={option.value} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onSelect(option)}
                className="flex w-full flex-col items-start px-3 py-2 text-start text-sm hover:bg-surface-2"
              >
                <span>{option.label}</span>
                {option.hint ? (
                  <bdi dir="ltr" className="text-xs text-ink-muted">
                    {option.hint}
                  </bdi>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
