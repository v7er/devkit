import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, categoryById } from "@/tools/categories";
import { tools } from "@/tools/registry";
import { searchTools } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastQuery, setLastQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchTools(query, tools, 50), [query]);

  if (query !== lastQuery) {
    setLastQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter") {
        const tool = results[activeIndex];
        if (tool) {
          event.preventDefault();
          navigate(`/tools/${tool.id}`);
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, navigate, onClose, results]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 p-4 pt-[8vh] backdrop-blur-md animate-fade-in sm:pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-surface/95 shadow-2xl ring-1 ring-line/60 backdrop-blur-2xl animate-rise"
      >
        <div className="flex items-center gap-3 border-b border-line/70 px-5">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools, keywords, categories…"
            aria-label="Search tools"
            aria-controls="command-results"
            aria-activedescendant={results[activeIndex] ? `command-result-${results[activeIndex]?.id}` : undefined}
            className="h-14 w-full bg-transparent text-[16px] text-text placeholder:text-faint focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto p-2.5">
          {results.map((tool, index) => {
            const category = categoryById.get(tool.category);
            const Icon = category?.icon;
            return (
              <button
                key={tool.id}
                id={`command-result-${tool.id}`}
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  navigate(`/tools/${tool.id}`);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  index === activeIndex ? "bg-surface-3" : "hover:bg-surface-2/70",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-faint">
                  {Icon ? <Icon className="size-4" aria-hidden /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{tool.name}</span>
                  <span className="block truncate text-[12px] text-faint">{tool.description}</span>
                </span>
                <span className="hidden shrink-0 text-[12px] uppercase tracking-wider text-faint sm:block">
                  {category?.name}
                </span>
                <ArrowRight
                  className={cn(
                    "size-3.5 shrink-0",
                    index === activeIndex ? "text-accent" : "text-transparent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-text">No tools match “{query}”</p>
              <p className="mt-1 text-xs text-faint">
                Try a format, a keyword, or one of the {CATEGORIES.length} categories.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-line/70 px-5 py-2.5 text-[12px] text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd>
            open
          </span>
          <span className="ml-auto">Everything runs on this device</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
