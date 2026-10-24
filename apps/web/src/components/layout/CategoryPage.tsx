import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { categoryById } from "@/tools/categories";
import type { ToolCategory } from "@/tools/types";
import { toolsByCategory } from "@/tools/registry";
import { ToolCard } from "./ToolCard";
import { NotFoundPage } from "./NotFoundPage";

export function CategoryPage() {
  const { categoryId } = useParams();
  const category = categoryId
    ? categoryById.get(categoryId as ToolCategory)
    : undefined;
  if (!category) return <NotFoundPage />;

  const list = toolsByCategory.get(category.id) ?? [];
  const Icon = category.icon;

  return (
    <div className="animate-fade-in">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All tools
      </Link>

      <header className="mt-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-accent shadow-panel">
          <Icon className="size-5" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
          {category.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{category.description}</p>
        <p className="mt-2 text-xs text-faint">{list.length} tools</p>
      </header>

      {list.length > 0 ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-panel bg-surface px-6 py-14 text-center shadow-panel">
          <p className="text-sm font-medium text-text">No tools in this category yet.</p>
          <p className="mt-1 text-xs text-faint">New utilities are added as they are ready.</p>
        </div>
      )}

      <p className="mt-10 border-t border-line pt-6 text-xs text-faint">
        Every tool on this page runs locally in your browser.
      </p>
    </div>
  );
}
