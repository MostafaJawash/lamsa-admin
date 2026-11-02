import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/messages";

type Props = {
  id: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  invalid?: boolean;
};

/** An add/remove list of choice values (the options of a select-type definition). */
export function OptionsListEditor({ id, value, onChange, invalid }: Props) {
  const t = m.categories.attributeDialog;
  const set = (index: number, text: string) =>
    onChange(value.map((item, i) => (i === index ? text : item)));
  return (
    <div id={id} className="flex flex-col gap-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item}
            maxLength={100}
            placeholder={t.optionPlaceholder}
            aria-label={`${t.optionPlaceholder} ${index + 1}`}
            aria-invalid={invalid ? true : undefined}
            onChange={(event) => set(index, event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${t.removeValue} ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <XIcon className="text-danger" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...value, ""])}
      >
        <PlusIcon data-icon="inline-start" />
        {t.addValue}
      </Button>
    </div>
  );
}
