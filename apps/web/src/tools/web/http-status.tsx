import { useMemo, useState } from "react";
import { Badge, EmptyState, Input, Panel, Segmented, ToolStack } from "@/components/ui";
import { filterHttpStatuses } from "./logic";
import type { HttpStatusCategory } from "./reference";

type CategoryFilter = "all" | HttpStatusCategory;

const CATEGORY_LABELS: Record<HttpStatusCategory, string> = {
  informational: "Informational",
  success: "Success",
  redirection: "Redirection",
  client: "Client error",
  server: "Server error",
};

const CATEGORY_SHORT: Record<HttpStatusCategory, string> = {
  informational: "1xx",
  success: "2xx",
  redirection: "3xx",
  client: "4xx",
  server: "5xx",
};

export default function HttpStatusTool() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const results = useMemo(
    () => filterHttpStatuses(query, category === "all" ? null : category),
    [query, category],
  );

  return (
    <ToolStack>
      <Panel
        title="HTTP Status Codes"
        description="Search standard response codes by number, name, or meaning."
      >
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 404, timeout, redirect, unauthorized…"
            aria-label="Search HTTP status codes"
          />
          <Segmented<CategoryFilter>
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All" },
              { value: "informational", label: "1xx" },
              { value: "success", label: "2xx" },
              { value: "redirection", label: "3xx" },
              { value: "client", label: "4xx" },
              { value: "server", label: "5xx" },
            ]}
          />
        </div>
      </Panel>

      <Panel
        title={`${results.length} ${results.length === 1 ? "code" : "codes"}`}
        description={
          category === "all"
            ? "Codes defined across the HTTP core specifications and WebDAV."
            : `${CATEGORY_LABELS[category]} responses.`
        }
        flush
      >
        {results.length === 0 ? (
          <EmptyState
            title="No status codes match"
            description="Try a number such as 404, a name such as “gateway”, or clear the category filter."
          />
        ) : (
          <ul className="divide-y divide-line">
            {results.map((status) => (
              <li
                key={status.code}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-5"
              >
                <div className="flex w-28 shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text">{status.code}</span>
                  <Badge tone={status.category === "success" ? "accent" : "neutral"}>
                    {CATEGORY_SHORT[status.category]}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{status.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-faint">{status.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ToolStack>
  );
}
