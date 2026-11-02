import { useParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AttributesSection,
  CategoryForm,
  CategoryImage,
  VariantOptionsSection,
  useCategoryForEdit,
} from "@/features/categories";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /categories/new: the basic fields only; saving opens the edit page for everything else. */
export function CategoryCreatePage() {
  const t = m.categories;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{t.addTitle}</h1>
      <FormSection title={t.form.sections.basic}>
        <CategoryForm />
      </FormSection>
      <p className="text-sm text-ink-muted">{t.form.createFirst}</p>
    </section>
  );
}

/** /categories/:id/edit */
export function CategoryEditPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : null;
  const query = useCategoryForEdit(id);
  const t = m.categories;

  let body;
  if (id === null) {
    body = <ErrorState message={t.form.notFound} />;
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = (
      <ErrorState
        message={notFound ? t.form.notFound : errorMessage(query.error)}
      >
        {notFound ? null : (
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        )}
      </ErrorState>
    );
  } else {
    const category = query.data;
    body = (
      <>
        <FormSection title={t.form.sections.basic}>
          {/* keyed by id: refetches after attribute changes must not reset the form */}
          <CategoryForm key={category.id} category={category} />
        </FormSection>
        <FormSection title={t.form.sections.image}>
          <CategoryImage category={category} />
        </FormSection>
        <FormSection title={t.form.sections.attributes}>
          <AttributesSection category={category} />
        </FormSection>
        <FormSection title={t.form.sections.variantOptions}>
          <VariantOptionsSection category={category} />
        </FormSection>
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{t.editTitle}</h1>
      {body}
    </section>
  );
}
