import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/messages";

import {
  AUDIENCES,
  STATUSES,
  hasActiveFilters,
  type ListParams,
} from "../list-filters";

type Props = {
  params: ListParams;
  onChange: (change: Partial<ListParams>) => void;
  onClear: () => void;
};

/** The two filters the backend really has: status and audience (all / one customer). */
export function NotificationFilters({ params, onChange, onClear }: Props) {
  const t = m.notifications.filters;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={params.status}
        onValueChange={(value) =>
          onChange({ status: value as ListParams["status"] })
        }
      >
        <SelectTrigger aria-label={t.status} className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{`${t.status}: ${t.all}`}</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {m.notifications.status[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.audience}
        onValueChange={(value) =>
          onChange({ audience: value as ListParams["audience"] })
        }
      >
        <SelectTrigger aria-label={t.audience} className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{`${t.audience}: ${t.all}`}</SelectItem>
          {AUDIENCES.map((audience) => (
            <SelectItem key={audience} value={audience}>
              {m.notifications.audience[audience]}
            </SelectItem>
          ))}
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
