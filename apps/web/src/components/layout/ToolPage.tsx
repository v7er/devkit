import { Suspense, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { categoryById } from "@/tools/categories";
import { toolById } from "@/tools/registry";
import { recordRecent } from "@/lib/recent";
import { NotFoundPage } from "./NotFoundPage";
import { ToolErrorBoundary } from "./ToolErrorBoundary";

function ToolSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
      {[0, 1].map((index) => (
        <div key={index} className="space-y-3 rounded-panel bg-surface p-5 shadow-panel">
          <div className="h-3 w-24 animate-pulse rounded-full bg-surface-3" />
          <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

export function ToolPage() {
  const { toolId } = useParams();
  const tool = toolId ? toolById.get(toolId) : undefined;

  useEffect(() => {
    if (tool) recordRecent(tool.id);
  }, [tool]);

  if (!tool) return <NotFoundPage />;

  const category = categoryById.get(tool.category);
  const Tool = tool.component;

  return (
    <article className="animate-fade-in">
      <header className="mb-8">
        {category ? (
          <Link
            to={`/categories/${category.id}`}
            className="text-xs font-medium text-accent transition-opacity hover:opacity-75"
          >
            {category.name}
          </Link>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{tool.description}</p>
      </header>

      <ToolErrorBoundary key={tool.id}>
        <Suspense fallback={<ToolSkeleton />}>
          <Tool />
        </Suspense>
      </ToolErrorBoundary>
    </article>
  );
}
