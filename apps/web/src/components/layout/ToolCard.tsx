import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { categoryById } from "@/tools/categories";
import type { ToolDefinition } from "@/tools/types";
import { cn } from "@/lib/utils";

export function ToolCard({
  tool,
  className,
}: {
  tool: ToolDefinition;
  className?: string;
}) {
  const category = categoryById.get(tool.category);
  const Icon = category?.icon;

  return (
    <Link
      to={`/tools/${tool.id}`}
      className={cn(
        "group flex min-h-32 flex-col rounded-panel bg-surface p-5 shadow-panel transition-colors hover:bg-surface-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors group-hover:text-accent">
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
        </span>
        <ArrowUpRight
          className="size-3.5 text-faint/60 transition-colors group-hover:text-accent"
          aria-hidden
        />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text">{tool.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-faint">{tool.description}</p>
    </Link>
  );
}
