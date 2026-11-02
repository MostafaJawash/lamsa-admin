import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { imageProps } from "@/lib/images";
import { m } from "@/messages";

import { moveItem } from "../images";
import {
  deleteImage,
  reorderImages,
  updateImageAlt,
  uploadImage,
} from "../requests";
import type { AdminImage } from "../types";
import { ImagePicker } from "./image-picker";

const NO_COLOR = "__none";

type Props = {
  productId: number;
  initial: readonly AdminImage[];
  /** Colors of the product's variants; images can be linked to one on upload. */
  colors: readonly string[];
};

/**
 * Edit page: every change is applied right away through the image endpoints (upload,
 * delete, reorder with the first image as the main one, alt text), independent of "save".
 */
export function ProductImages({ productId, initial, colors }: Props) {
  const [images, setImages] = useState<AdminImage[]>([...initial]);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(NO_COLOR);
  const client = useQueryClient();
  const t = m.products.images;

  const refreshLists = () =>
    client.invalidateQueries({ queryKey: ["products", "list"] });

  const upload = async (files: File[]) => {
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let done = 0;
    for (const file of files) {
      try {
        const result = await uploadImage(
          productId,
          file,
          color === NO_COLOR ? undefined : color,
        );
        setImages((current) => [...current, ...result.images]);
      } catch (error) {
        toast.error(`${t.uploadFailed} ${file.name} — ${errorMessage(error)}`);
      }
      setProgress({ done: ++done, total: files.length });
    }
    setProgress(null);
    setBusy(false);
    void refreshLists();
  };

  const move = async (index: number, to: number) => {
    const before = images;
    const next = moveItem(images, index, to);
    setImages(next);
    try {
      await reorderImages(
        productId,
        next.map((image) => image.id),
      );
      void refreshLists();
    } catch (error) {
      setImages(before);
      toast.error(errorMessage(error));
    }
  };

  const remove = async (image: AdminImage) => {
    setBusy(true);
    try {
      const result = await deleteImage(productId, image.id);
      setImages((current) => current.filter((item) => item.id !== image.id));
      if (result.warning) toast.warning(t.lastImageWarning);
      else toast.success(t.deleted);
      void refreshLists();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveAlt = async (image: AdminImage, value: string) => {
    if (value.trim() === (image.alt_text ?? "")) return;
    try {
      const updated = await updateImageAlt(productId, image.id, value.trim());
      setImages((current) =>
        current.map((item) => (item.id === image.id ? updated : item)),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {colors.length > 0 ? (
        <div className="flex items-center gap-2 text-sm">
          <span>{t.linkColor}</span>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger size="sm" aria-label={t.linkColor}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COLOR}>{t.noColor}</SelectItem>
              {colors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <ImagePicker existing={images.length} disabled={busy} onFiles={upload} />
      {progress ? (
        <p role="status" className="text-sm text-ink-muted">
          {t.uploading}{" "}
          <bdi>
            {progress.done}/{progress.total}
          </bdi>
        </p>
      ) : null}
      {images.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="flex flex-col gap-1 rounded-lg border border-line p-2"
            >
              <div className="relative">
                <img
                  {...imageProps(image.urls, "200px")}
                  alt={image.alt_text ?? ""}
                  className="aspect-square w-full rounded-md object-cover"
                />
                {index === 0 ? (
                  <Badge className="absolute start-1 top-1">{t.main}</Badge>
                ) : null}
                {image.color ? (
                  <Badge variant="secondary" className="absolute end-1 top-1">
                    {image.color}
                  </Badge>
                ) : null}
              </div>
              <Input
                aria-label={t.altText}
                placeholder={t.altText}
                maxLength={255}
                defaultValue={image.alt_text ?? ""}
                onBlur={(event) => void saveAlt(image, event.target.value)}
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || index === 0}
                  aria-label={t.moveEarlier}
                  onClick={() => void move(index, index - 1)}
                >
                  <ChevronRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t.remove}
                  onClick={() => void remove(image)}
                >
                  <XIcon className="text-danger" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || index === images.length - 1}
                  aria-label={t.moveLater}
                  onClick={() => void move(index, index + 1)}
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
