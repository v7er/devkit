import { ChevronRight, Command, Download, Moon, Search, Sun } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/app/theme";
import { categoryById } from "@/tools/categories";
import { toolById } from "@/tools/registry";
import type { ToolCategory } from "@/tools/types";
import { Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const toolId = location.pathname.startsWith("/tools/")
    ? location.pathname.slice("/tools/".length).split("/")[0]
    : null;
  const categoryId = location.pathname.startsWith("/categories/")
    ? location.pathname.slice("/categories/".length).split("/")[0]
    : null;
  const tool = toolId ? toolById.get(toolId) : undefined;
  const category = tool
    ? categoryById.get(tool.category)
    : categoryId
      ? categoryById.get(categoryId as ToolCategory)
      : undefined;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-5 sm:px-8">
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-full"
          aria-label="devkit home"
        >
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-text text-canvas transition-transform group-active:scale-95">
            <Command className="size-3.5" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.02em] text-text">devkit</span>
        </Link>

        <nav
          aria-label="Breadcrumb"
          className={cn(
            "ml-1 flex min-w-0 flex-1 items-center gap-1.5 text-[14px]",
            !category && "invisible",
          )}
        >
          {category ? (
            <>
              <ChevronRight
                className={cn("size-3.5 shrink-0 text-faint", tool && "hidden sm:block")}
                aria-hidden
              />
              <Link
                to={`/categories/${category.id}`}
                className={cn(
                  "truncate text-muted transition-colors hover:text-text",
                  tool && "hidden sm:block",
                )}
              >
                {category.name}
              </Link>
            </>
          ) : null}
          {tool ? (
            <>
              <ChevronRight className="hidden size-3.5 shrink-0 text-faint sm:block" aria-hidden />
              <span className="truncate font-medium text-text">{tool.name}</span>
            </>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/download"
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Download desktop app"
            title="Download desktop app"
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden md:inline">Download</span>
          </Link>

          <button
            type="button"
            onClick={onSearch}
            className="hidden h-9 items-center gap-2 rounded-full bg-field pl-3 pr-2 text-[14px] text-faint ring-1 ring-line/60 transition-colors hover:bg-field-hover hover:text-muted hover:ring-line-strong sm:flex"
            aria-label="Search tools"
          >
            <Search className="size-3.5" aria-hidden />
            <span>Search</span>
            <Kbd>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} K</Kbd>
          </button>

          <button
            type="button"
            onClick={onSearch}
            className="flex size-9 items-center justify-center rounded-full bg-field text-muted ring-1 ring-line/60 transition-colors hover:bg-field-hover hover:text-text hover:ring-line-strong sm:hidden"
            aria-label="Search tools"
          >
            <Search className="size-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
