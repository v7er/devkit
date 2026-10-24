import { useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDrop({
  accept,
  multiple = false,
  onFiles,
  label = "Drop a file here or click to browse",
  hint,
  className,
  disabled = false,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-2xl border border-dashed transition-colors",
        dragging ? "border-accent bg-accent-soft/50" : "border-line-strong bg-surface-2/60",
        disabled && "opacity-60",
        className,
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 px-4 py-6 text-center",
          disabled && "cursor-not-allowed",
        )}
      >
        <UploadCloud className="size-5 text-faint" aria-hidden />
        <span className="text-sm font-medium text-text">{label}</span>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </label>
    </div>
  );
}
