import { ArrowRightIcon } from "lucide-react";
import { Link, useParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CustomerActions,
  CustomerProfile,
  isCustomerAccount,
  useCustomer,
  type Customer,
} from "@/features/customers";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { CustomerOrders, LatestOrderAddress } from "./customer-orders";

function CustomerView({ customer }: { customer: Customer }) {
  const t = m.customers.detail;
  // An admin account is shown read-only: this page manages customers only.
  const isCustomer = isCustomerAccount(customer);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{customer.name}</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <FormSection title={t.profile}>
            <CustomerProfile customer={customer} />
          </FormSection>
          {isCustomer ? (
            <FormSection title={t.orders}>
              <CustomerOrders customer={customer} />
            </FormSection>
          ) : null}
        </div>
        {isCustomer ? (
          <div className="flex flex-col gap-4">
            <FormSection title={t.actions}>
              <CustomerActions customer={customer} />
            </FormSection>
            <FormSection title={t.address}>
              <LatestOrderAddress customer={customer} />
            </FormSection>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** /customers/:id */
export function CustomerDetailPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : null;
  const query = useCustomer(id);
  const t = m.customers.detail;

  let body;
  if (id === null) {
    body = <ErrorState message={t.notFound} />;
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = (
      <ErrorState message={notFound ? t.notFound : errorMessage(query.error)}>
        {notFound ? null : (
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        )}
      </ErrorState>
    );
  } else {
    body = <CustomerView customer={query.data} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/customers"
        className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        {t.back}
      </Link>
      {body}
    </section>
  );
}
