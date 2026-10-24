import { Download } from "lucide-react";
import { downloadText } from "@/lib/download";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { CopyButton } from "./CopyButton";

export function CodeOutput({
  value,
  placeholder = "Output appears here",
  filename,
  language,
  maxHeight = 420,
  wrap = true,
  className,
}: {
  value: string;
  placeholder?: string;
  filename?: string;
  language?: string;
  maxHeight?: number | string;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-surface-2", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
          {language ?? "output"}
        </span>
        <div className="flex items-center gap-0.5">
          <CopyButton value={value} size="icon" />
          {filename ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => downloadText(value, filename)}
              aria-label={`Download ${filename}`}
              title={`Download ${filename}`}
              disabled={!value}
            >
              <Download className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      <pre
        className={cn(
          "overflow-auto p-3.5 font-mono text-[13px] leading-relaxed text-text",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        )}
        style={{ maxHeight }}
      >
        {value || <span className="text-faint">{placeholder}</span>}
      </pre>
    </div>
  );
}
