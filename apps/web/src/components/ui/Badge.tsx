import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]",
        tone === "neutral" && "bg-surface-2 text-faint",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "warning" && "bg-warning-soft text-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md bg-surface-3/70 px-1.5 py-0.5 font-mono text-[10px] leading-none text-faint">
      {children}
    </kbd>
  );
}
