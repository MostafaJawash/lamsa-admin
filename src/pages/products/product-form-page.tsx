import { useParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProductForm, useProduct } from "@/features/products";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /products/new */
export function ProductCreatePage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{m.products.addTitle}</h1>
      <ProductForm />
    </section>
  );
}

/** /products/:id/edit */
export function ProductEditPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : null;
  const query = useProduct(id);

  let body;
  if (id === null) {
    body = <ErrorState message={m.products.form.notFound} />;
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = (
      <ErrorState
        message={
          notFound ? m.products.form.notFound : errorMessage(query.error)
        }
      >
        {notFound ? null : (
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        )}
      </ErrorState>
    );
  } else {
    body = <ProductForm key={query.data.id} product={query.data} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">
        {m.products.editTitle}
      </h1>
      {body}
    </section>
  );
}
