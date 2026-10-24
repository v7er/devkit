import { useMemo, useState } from "react";
import {
  Badge,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  ToolStack,
} from "@/components/ui";
import {
  searchTailwindUtilities,
  TAILWIND_CATEGORIES,
  type TailwindCategory,
} from "./logic";
import { TAILWIND_UTILITIES } from "./tailwind-data";

type CategoryFilter = TailwindCategory | "all";

const CATEGORY_LABELS = new Map(
  TAILWIND_CATEGORIES.map((category) => [category.id, category.label]),
);

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...TAILWIND_CATEGORIES.map((category) => ({
    value: category.id,
    label: category.label,
  })),
];

export default function TailwindSearchTool() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const results = useMemo(
    () => searchTailwindUtilities(TAILWIND_UTILITIES, query, category),
    [query, category],
  );

  return (
    <ToolStack>
      <Panel
        title="Tailwind reference"
        description="Search a curated set of utilities across layout, spacing, typography, color, borders, and effects."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <Field
            label="Search"
            hint="Match a class name, keyword, or CSS property."
          >
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="flex, spacing, shadow, rounded…"
              aria-label="Search Tailwind utilities"
              spellCheck={false}
            />
          </Field>
          <Select
            label="Category"
            value={category}
            onChange={(value) => setCategory(value as CategoryFilter)}
            options={CATEGORY_OPTIONS}
          />
        </div>
      </Panel>

      <Panel
        title={`${results.length} matching ${results.length === 1 ? "utility" : "utilities"}`}
        description="Copy the class name for your markup or the CSS it compiles to."
        flush
      >
        {results.length > 0 ? (
          <div className="max-h-96 divide-y divide-line overflow-auto">
            {results.map((utility) => (
              <div
                key={utility.className}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-accent">
                      {utility.className}
                    </code>
                    <Badge>{CATEGORY_LABELS.get(utility.category) ?? utility.category}</Badge>
                  </div>
                  <p className="text-xs text-muted">{utility.description}</p>
                  <p className="font-mono text-[11px] text-faint">{utility.css}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CopyButton value={utility.className} label="Copy class" />
                  <CopyButton value={utility.css} label="Copy CSS" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching utilities"
            description="Try a class name such as flex, a keyword such as spacing, or pick another category."
          />
        )}
      </Panel>
    </ToolStack>
  );
}
