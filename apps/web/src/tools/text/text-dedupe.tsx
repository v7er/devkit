import { useMemo, useState } from "react";
import { ListFilter, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  CodeOutput,
  EmptyState,
  Field,
  InlineRow,
  Panel,
  Select,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { dedupeText, type DedupeSort } from "./logic";

const SAMPLE = [
  "apple",
  "banana",
  "Apple",
  "  apple  ",
  "banana",
  "",
  "cherry",
  "date",
  "cherry",
].join("\n");

const SORT_OPTIONS = [
  { value: "none", label: "Keep original order" },
  { value: "asc", label: "Sort A → Z" },
  { value: "desc", label: "Sort Z → A" },
] satisfies Array<{ value: DedupeSort; label: string }>;

export default function TextDedupeTool() {
  const [input, setInput] = useState(SAMPLE);
  const [trim, setTrim] = useState(true);
  const [dropEmpty, setDropEmpty] = useState(true);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [sort, setSort] = useState<DedupeSort>("none");

  const result = useMemo(
    () =>
      dedupeText(input, {
        trim,
        dropEmpty,
        removeDuplicates,
        caseInsensitive,
        sort,
      }),
    [caseInsensitive, dropEmpty, input, removeDuplicates, sort, trim],
  );

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Input"
          description="One entry per line; line endings are normalized before comparing."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Lines">
              <TextArea
                mono
                rows={16}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={"apple\nbanana\napple"}
                aria-label="Lines to deduplicate"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Trim whitespace"
                description="Removes spaces around each line."
                checked={trim}
                onChange={setTrim}
              />
              <Toggle
                label="Drop empty lines"
                description="Skips lines that are blank after trimming."
                checked={dropEmpty}
                onChange={setDropEmpty}
              />
              <Toggle
                label="Remove duplicates"
                description="Keeps the first occurrence of each line."
                checked={removeDuplicates}
                onChange={setRemoveDuplicates}
              />
              <Toggle
                label="Ignore case"
                description="Treats Apple and apple as the same line."
                checked={caseInsensitive}
                onChange={setCaseInsensitive}
              />
            </div>
            <Select
              label="Sort output"
              value={sort}
              onChange={(value) => setSort(value as DedupeSort)}
              options={SORT_OPTIONS}
            />
          </div>
        </Panel>

        <Panel
          title="Result"
          description="Counts reflect the chosen options."
          actions={<Badge tone="accent">{formatNumber(result.outputLines)} lines</Badge>}
        >
          <div className="space-y-3">
            <CodeOutput
              value={result.output}
              language="deduplicated text"
              filename="deduplicated.txt"
              maxHeight={360}
              placeholder="Cleaned lines appear here"
            />
            <div className="space-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <InlineRow label="Input lines">{formatNumber(result.inputLines)}</InlineRow>
              <InlineRow label="Output lines">{formatNumber(result.outputLines)}</InlineRow>
              <InlineRow label="Duplicate lines removed">
                {formatNumber(result.duplicateLines)}
              </InlineRow>
              <InlineRow label="Empty lines dropped">{formatNumber(result.droppedEmpty)}</InlineRow>
            </div>
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="Repeated lines"
        description="Counts include lines removed by the current options."
        actions={<Badge>{formatNumber(result.duplicates.length)} groups</Badge>}
      >
        {result.duplicates.length === 0 ? (
          <EmptyState
            icon={<ListFilter className="size-5" aria-hidden />}
            title="No repeated lines"
            description="Every line is unique with the current comparison settings."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.duplicates.map((group) => (
              <li
                key={group.value}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
              >
                <span className="min-w-0 break-all font-mono text-[12px] text-text">
                  {group.value || "(empty line)"}
                </span>
                <Badge tone="warning">×{group.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ToolStack>
  );
}
