import { Field, Input } from "@/components/ui";
import { formatHex, parseColor } from "./logic";

export function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const parsed = parseColor(value);
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          title={`${label} picker`}
          value={parsed ? formatHex(parsed, false) : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#000000"
          aria-label={label}
          spellCheck={false}
        />
      </div>
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
        }
        aria-label={label}
      />
    </Field>
  );
}
