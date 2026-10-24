import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: PanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-panel bg-surface shadow-panel",
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-text">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-faint">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ToolGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid items-start gap-4 lg:grid-cols-2", className)}>{children}</div>;
}

export function ToolStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}
