import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { m } from "@/messages";

import { moveItem } from "../images";
import { ImagePicker } from "./image-picker";

type Props = {
  files: readonly File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** "3/5" style progress while the product's images upload after creation. */
  progress?: { done: number; total: number } | null;
};

/** Create page: images are chosen now and uploaded right after the product is created. */
export function StagedImages({ files, onChange, disabled, progress }: Props) {
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );
  const t = m.products.images;

  return (
    <div className="flex flex-col gap-3">
      <ImagePicker
        existing={files.length}
        disabled={disabled}
        onFiles={(added) => onChange([...files, ...added])}
      />
      {progress ? (
        <p role="status" className="text-sm text-ink-muted">
          {t.uploading}{" "}
          <bdi>
            {progress.done}/{progress.total}
          </bdi>
        </p>
      ) : null}
      {files.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex flex-col gap-1 rounded-lg border border-line p-2"
            >
              <div className="relative">
                <img
                  src={previews[index]}
                  alt={file.name}
                  className="aspect-square w-full rounded-md object-cover"
                />
                {index === 0 ? (
                  <Badge className="absolute start-1 top-1">{t.main}</Badge>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === 0}
                  aria-label={t.moveEarlier}
                  onClick={() => onChange(moveItem(files, index, index - 1))}
                >
                  <ChevronRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={t.remove}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                >
                  <XIcon className="text-danger" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === files.length - 1}
                  aria-label={t.moveLater}
                  onClick={() => onChange(moveItem(files, index, index + 1))}
                >
                  <ChevronLeftIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
