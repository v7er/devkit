import { useMemo, useState } from "react";
import { ListFilter, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  CodeOutput,
  Panel,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { GITIGNORE_PRESETS, mergeGitignore } from "./logic";

export default function GitignoreTool() {
  const [selected, setSelected] = useState<string[]>(["node", "macos", "editors"]);
  const result = useMemo(() => mergeGitignore(selected), [selected]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Stack presets"
          description="Patterns are merged in a stable order and deduplicated across presets."
          actions={
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(GITIGNORE_PRESETS.map((preset) => preset.id))}
              >
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          }
        >
          <div className="grid gap-2">
            {GITIGNORE_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(preset.id)}
                  onChange={() => toggle(preset.id)}
                  aria-label={preset.label}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                    {preset.label}
                    <span className="font-mono text-[12px] text-faint">
                      {preset.patterns.length}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                    {preset.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Panel>

        <Panel
          title=".gitignore"
          description="Ready to save in the repository root."
          actions={<Badge tone="accent">{result.patternCount} patterns</Badge>}
        >
          <div className="space-y-3">
            {result.sections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.sections.map((section) => (
                  <Badge key={section.id}>
                    {section.label} · {section.count}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-faint">
                <Sparkles className="size-3.5" aria-hidden />
                Select one or more presets to build the file.
              </p>
            )}

            <CodeOutput
              value={result.text}
              language="gitignore"
              filename=".gitignore"
              placeholder="Selected ignore patterns appear here"
              maxHeight={520}
              wrap={false}
            />

            {result.duplicatesRemoved > 0 ? (
              <p className="flex items-start gap-1.5 text-xs text-faint">
                <ListFilter className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Removed {result.duplicatesRemoved}{" "}
                {result.duplicatesRemoved === 1 ? "duplicate pattern" : "duplicate patterns"} shared
                between presets.
              </p>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
