import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/messages";

import {
  hasActiveFilters,
  type ListParams,
  type StatusFilter,
} from "../list-filters";

const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  params: ListParams;
  onChange: (change: Partial<ListParams>) => void;
  onClear: () => void;
};

/** Name/phone search (debounced) and status; both live in the URL via `onChange`. */
export function CustomerFilters({ params, onChange, onClear }: Props) {
  const t = m.customers.filters;
  const [text, setText] = useState(params.q);
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setText(params.q);
  }
  useEffect(() => {
    if (text.trim() === params.q.trim()) return;
    const timer = setTimeout(
      () => onChange({ q: text.trim() }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [text, params.q, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t.search}
        aria-label={t.search}
        maxLength={100}
        className="w-64"
      />
      <Select
        value={params.status}
        onValueChange={(value) => onChange({ status: value as StatusFilter })}
      >
        <SelectTrigger aria-label={t.status} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{`${t.status}: ${t.all}`}</SelectItem>
          <SelectItem value="active">{m.customers.status.active}</SelectItem>
          <SelectItem value="inactive">
            {m.customers.status.inactive}
          </SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilters(params) ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t.clear}
        </Button>
      ) : null}
    </div>
  );
}
