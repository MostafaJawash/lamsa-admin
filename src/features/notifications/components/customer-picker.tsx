import { useMemo, useState } from "react";

import { SearchPicker } from "@/components/shared/search-picker";
import { useCustomers } from "@/features/customers";
import { useDebounced } from "@/hooks/use-debounced";
import { m } from "@/messages";

export type PickedCustomer = { id: number; name: string; phone: string };

type Props = {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  invalid?: boolean;
};

/** Finds ONE active customer by name or phone (the backend's `search`). */
export function CustomerPicker({ value, onChange, invalid }: Props) {
  const t = m.notifications.compose;
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const customers = useCustomers({ page: 1, q, status: "active" });
  const options = useMemo(
    () =>
      (customers.data?.items ?? []).map((c) => ({
        value: String(c.id),
        label: c.name,
        hint: c.phone ?? undefined,
      })),
    [customers.data],
  );
  return (
    <SearchPicker
      id="notification-customer"
      selected={
        value
          ? { value: String(value.id), label: value.name, hint: value.phone }
          : null
      }
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) =>
        onChange({ id: Number(o.value), name: o.label, phone: o.hint ?? "" })
      }
      onClear={() => onChange(null)}
      placeholder={t.customerSearch}
      loading={customers.isFetching}
      noResults={t.noCustomers}
      invalid={invalid}
    />
  );
}
