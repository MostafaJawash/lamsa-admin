import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import {
  useAttributeMutations,
  useVariantOptionMutations,
  type CategoryAttribute,
  type CategoryDetail,
  type CategoryVariantOption,
} from "../api";
import { inUseDetails, productsInUse } from "../definitions";
import { AttributeDialog } from "./attribute-dialog";
import { OptionDialog } from "./option-dialog";

const byOrder = <T extends { sort_order: number; id: number }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.id - b.id;

function Row({
  children,
  inherited,
  parentId,
  actions,
}: {
  children: ReactNode;
  inherited: boolean;
  parentId: number | null;
  actions: ReactNode;
}) {
  const t = m.categories.definitions;
  return (
    <li
      data-inherited={inherited ? "true" : undefined}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      {inherited ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t.inherited}</Badge>
          {parentId !== null ? (
            <Link
              to={`/categories/${parentId}/edit`}
              className="text-xs text-brand hover:underline"
            >
              {t.inheritedFrom}
            </Link>
          ) : null}
        </div>
      ) : (
        actions
      )}
    </li>
  );
}

function Actions({
  onEdit,
  onDelete,
  name,
}: {
  onEdit: () => void;
  onDelete: () => void;
  name: string;
}) {
  const t = m.categories.definitions;
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t.edit}: ${name}`}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t.delete}: ${name}`}
        onClick={onDelete}
      >
        <Trash2Icon className="text-danger" />
      </Button>
    </div>
  );
}

function Key({ value }: { value: string }) {
  return (
    <bdi dir="ltr" className="text-start text-xs text-ink-muted">
      {value}
    </bdi>
  );
}

/** The category's attributes: its own (editable) and the ones inherited from the parent (read-only). */
export function AttributesSection({ category }: { category: CategoryDetail }) {
  const t = m.categories.definitions;
  const types = t.typeLabels;
  const own = [...category.own_attributes].sort(byOrder);
  const inherited = category.effective_attributes
    .filter((a) => a.inherited)
    .sort(byOrder);
  const [editing, setEditing] = useState<CategoryAttribute | "new" | null>(
    null,
  );
  const [deleting, setDeleting] = useState<CategoryAttribute | null>(null);
  const [forcing, setForcing] = useState<{
    attribute: CategoryAttribute;
    count: number;
  } | null>(null);
  const { remove } = useAttributeMutations(category.id);
  const d = m.categories.definitionDelete;

  const confirmDelete = () => {
    if (!deleting) return;
    const attribute = deleting;
    remove.mutate(
      { id: attribute.id, force: false },
      {
        onSuccess: () => {
          toast.success(d.success);
          setDeleting(null);
        },
        onError: (error) => {
          setDeleting(null);
          const count = productsInUse(error);
          if (count !== null) setForcing({ attribute, count });
          else toast.error(errorMessage(error));
        },
      },
    );
  };

  const confirmForce = () => {
    if (!forcing) return;
    remove.mutate(
      { id: forcing.attribute.id, force: true },
      {
        onSuccess: () => {
          toast.success(d.success);
          setForcing(null);
        },
        onError: (error) => {
          setForcing(null);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const line = (a: CategoryAttribute) => (
    <>
      <span className="font-medium">
        {a.label}
        {a.unit ? <span className="text-ink-muted"> ({a.unit})</span> : null}
      </span>
      <Key value={a.key} />
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <span>{types[a.type] ?? a.type}</span>
        {a.is_required ? <Badge>{t.required}</Badge> : null}
        {a.is_filterable ? (
          <Badge variant="outline">{t.filterable}</Badge>
        ) : null}
        {a.options?.length ? <span>{a.options.join("، ")}</span> : null}
        <span>
          {t.sortOrder}: <bdi className="tabular-nums">{a.sort_order}</bdi>
        </span>
      </span>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {own.length === 0 && inherited.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.emptyAttributes}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {inherited.map((a) => (
          <Row
            key={`i${a.id}`}
            inherited
            parentId={category.parent_id}
            actions={null}
          >
            {line(a)}
          </Row>
        ))}
        {own.map((a) => (
          <Row
            key={a.id}
            inherited={false}
            parentId={null}
            actions={
              <Actions
                name={a.label}
                onEdit={() => setEditing(a)}
                onDelete={() => setDeleting(a)}
              />
            }
          >
            {line(a)}
          </Row>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing("new")}
        >
          <PlusIcon data-icon="inline-start" />
          {t.addAttribute}
        </Button>
      </div>
      <AttributeDialog
        categoryId={category.id}
        attribute={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={d.attributeTitle}
        description={`${deleting?.label ?? ""} — ${d.attributeDescription}`}
        confirmLabel={d.confirm}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={forcing !== null}
        onOpenChange={(open) => !open && setForcing(null)}
        title={d.forceTitle}
        description={`${forcing?.attribute.label ?? ""} — ${d.forceBefore} ${forcing?.count ?? 0} ${d.forceAfter}`}
        confirmLabel={d.forceConfirm}
        destructive
        pending={remove.isPending}
        onConfirm={confirmForce}
      />
    </div>
  );
}

/** The category's variant options (color, size...): own (editable) and inherited (read-only). */
export function VariantOptionsSection({
  category,
}: {
  category: CategoryDetail;
}) {
  const t = m.categories.definitions;
  const types = t.typeLabels;
  const own = [...category.own_variant_options].sort(byOrder);
  const inherited = category.effective_variant_options
    .filter((o) => o.inherited)
    .sort(byOrder);
  const [editing, setEditing] = useState<CategoryVariantOption | "new" | null>(
    null,
  );
  const [deleting, setDeleting] = useState<CategoryVariantOption | null>(null);
  const { remove } = useVariantOptionMutations(category.id);
  const d = m.categories.definitionDelete;

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(d.success);
        setDeleting(null);
      },
      onError: (error) => {
        setDeleting(null);
        const extra = inUseDetails(error);
        toast.error(
          extra ? `${errorMessage(error)} ${extra}` : errorMessage(error),
        );
      },
    });
  };

  const line = (o: CategoryVariantOption) => (
    <>
      <span className="font-medium">{o.label}</span>
      <Key value={o.key} />
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <span>{types[o.type] ?? o.type}</span>
        <span>
          {o.type === "color"
            ? t.colorFree
            : o.options?.length
              ? o.options.join("، ")
              : t.freeText}
        </span>
        <span>
          {t.sortOrder}: <bdi className="tabular-nums">{o.sort_order}</bdi>
        </span>
      </span>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {own.length === 0 && inherited.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.emptyOptions}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {inherited.map((o) => (
          <Row
            key={`i${o.id}`}
            inherited
            parentId={category.parent_id}
            actions={null}
          >
            {line(o)}
          </Row>
        ))}
        {own.map((o) => (
          <Row
            key={o.id}
            inherited={false}
            parentId={null}
            actions={
              <Actions
                name={o.label}
                onEdit={() => setEditing(o)}
                onDelete={() => setDeleting(o)}
              />
            }
          >
            {line(o)}
          </Row>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing("new")}
        >
          <PlusIcon data-icon="inline-start" />
          {t.addOption}
        </Button>
      </div>
      <OptionDialog
        categoryId={category.id}
        option={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={d.optionTitle}
        description={`${deleting?.label ?? ""} — ${d.optionDescription}`}
        confirmLabel={d.confirm}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
