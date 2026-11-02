import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { phoneDigits, type Customer } from "@/features/customers";
import {
  AddressCard,
  DEFAULT_PARAMS,
  OrdersTable,
  PAGE_SIZE,
  useOrder,
  useOrders,
} from "@/features/orders";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/**
 * The backend has no per-customer orders endpoint, so a customer's orders are found by
 * searching `GET /admin/orders` for their phone digits (the phone is stored on every order,
 * and phones are unique). Orders placed before the customer changed their number won't match.
 */
function useCustomerOrders(customer: Customer, page: number) {
  return useOrders({
    ...DEFAULT_PARAMS,
    q: phoneDigits(customer.phone),
    sort: "newest",
    page,
  });
}

/** The customer's orders, newest first, paged; each row links to the order. */
export function CustomerOrders({ customer }: { customer: Customer }) {
  const [search, setSearch] = useSearchParams();
  const page = Math.max(1, Number(search.get("page")) || 1);
  const query = useCustomerOrders(customer, page);
  const t = m.customers.detail;
  const data = query.data;

  if (query.isError && !data)
    return (
      <ErrorState message={errorMessage(query.error)}>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {m.common.retry}
        </Button>
      </ErrorState>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{t.ordersHint}</p>
      <div
        className={
          query.isPlaceholderData ? "opacity-60 transition-opacity" : ""
        }
      >
        <OrdersTable
          rows={data?.items ?? []}
          loading={query.isPending}
          emptyMessage={t.ordersEmpty}
          hideCustomer
        />
      </div>
      {data && data.total > PAGE_SIZE ? (
        <Pager
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          onPageChange={(next) =>
            setSearch(next > 1 ? { page: String(next) } : {}, {
              replace: false,
            })
          }
        />
      ) : null}
    </div>
  );
}

/**
 * The delivery address stored on the customer's latest order. Live saved addresses are not
 * exposed to admins by the backend, so this is the closest real data (one extra request for
 * the newest order), and it is labelled as an order's frozen snapshot.
 */
export function LatestOrderAddress({ customer }: { customer: Customer }) {
  const latest = useCustomerOrders(customer, 1).data?.items[0];
  const order = useOrder(latest?.id ?? null);
  const t = m.customers.detail;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{t.addressHint}</p>
      {!latest ? (
        <p className="text-sm text-ink-muted">{t.addressNone}</p>
      ) : order.data ? (
        <AddressCard order={order.data} />
      ) : order.isError ? (
        <p className="text-sm text-danger">{errorMessage(order.error)}</p>
      ) : (
        <p className="text-sm text-ink-muted">{m.app.loading}</p>
      )}
    </div>
  );
}
