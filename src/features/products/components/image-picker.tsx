import { ImagePlusIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { m } from "@/messages";

import { ACCEPTED_IMAGE_TYPES, validateImageFiles } from "../images";

type Props = {
  /** Images the product already has (or has staged), for the 15-image limit. */
  existing: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

/** Click-or-drop area. Rejects wrong types, files over 5 MB and overflow before `onFiles`. */
export function ImagePicker({ existing, disabled, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { accepted, errors } = validateImageFiles([...list], existing);
    for (const message of errors) toast.error(message);
    if (accepted.length > 0) onFiles(accepted);
    if (input.current) input.current.value = "";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) handle(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center",
        over ? "border-brand bg-brand-soft" : "border-line",
        disabled && "opacity-50",
      )}
    >
      <ImagePlusIcon className="size-7 text-ink-muted" aria-hidden />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="font-medium text-brand hover:underline max-md:min-h-11"
      >
        {m.products.images.add}
      </button>
      <p className="text-sm text-ink-muted">{m.products.images.drop}</p>
      <p className="text-xs text-ink-muted">{m.products.images.hint}</p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-testid="image-input"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        aria-label={m.products.images.add}
        onChange={(event) => handle(event.target.files)}
      />
    </div>
  );
}
