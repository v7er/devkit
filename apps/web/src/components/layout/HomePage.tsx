import { useMemo } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useSearchPalette } from "@/app/palette";
import { Kbd } from "@/components/ui";
import { recentTools } from "@/lib/recent";
import { CATEGORIES } from "@/tools/categories";
import { featuredTools, tools, toolsByCategory } from "@/tools/registry";
import { ToolCard } from "./ToolCard";

export function HomePage() {
  const onSearch = useSearchPalette();
  const recent = useMemo(() => recentTools().slice(0, 8), []);
  const featured = featuredTools.length > 0 ? featuredTools.slice(0, 6) : tools.slice(0, 6);

  return (
    <div className="animate-fade-in">
      <section className="pb-14 pt-6 text-center sm:pb-20 sm:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Local-first developer toolbox
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-text sm:text-6xl">
          Every developer tool, in one place.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
          Format, inspect, convert, and generate. Everything runs in your browser and stays on your
          device.
        </p>

        <button
          type="button"
          onClick={onSearch}
          className="mx-auto mt-8 flex h-12 w-full max-w-md items-center gap-3 rounded-full bg-surface-2 px-5 text-left text-sm text-faint shadow-panel transition-colors hover:bg-surface-3 hover:text-muted"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">Search {tools.length} tools</span>
          <Kbd>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} K</Kbd>
        </button>

        <p className="mt-5 text-xs text-faint">
          {tools.length} tools · {CATEGORIES.length} categories · No uploads · MIT licensed
        </p>
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="mb-14">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-tight text-text">
            Recently used
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {recent.map((tool) => (
              <Link
                key={tool.id}
                to={`/tools/${tool.id}`}
                className="inline-flex items-center rounded-full bg-surface px-3.5 py-2 text-[13px] text-text shadow-panel transition-colors hover:bg-surface-2"
              >
                {tool.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="categories-heading" className="mb-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="categories-heading" className="text-lg font-semibold tracking-tight text-text">
            Browse
          </h2>
          <p className="text-xs text-faint">Everything, sorted.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = toolsByCategory.get(category.id)?.length ?? 0;
            return (
              <Link
                key={category.id}
                to={`/categories/${category.id}`}
                className="group flex flex-col items-center rounded-panel bg-surface px-3 py-6 text-center shadow-panel transition-colors hover:bg-surface-2"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors group-hover:text-accent">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="mt-4 text-sm font-medium text-text">{category.name}</span>
                <span className="mt-1 text-xs text-faint">{count} tools</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="featured-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="featured-heading" className="text-lg font-semibold tracking-tight text-text">
            Popular tools
          </h2>
          <p className="text-xs text-faint">A good place to start.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <p className="mt-14 border-t border-line pt-6 text-xs leading-relaxed text-faint">
        devkit processes input in memory and works offline. There are no accounts, analytics, or
        uploads.
      </p>
    </div>
  );
}
