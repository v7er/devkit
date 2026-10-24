import { useId } from "react";
import { cn } from "@/lib/utils";

export function Select({
  label,
  value,
  onChange,
  options,
  className,
  id,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  id?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={selectId} className="block text-xs font-medium text-muted">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-transparent bg-surface-2 px-3 text-sm text-text transition-colors focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <span className="block text-xs font-medium text-muted">{label}</span> : null}
      <div className="inline-flex w-full rounded-full bg-surface-2 p-1" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-surface-3 text-text shadow-sm"
                : "text-muted hover:text-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
