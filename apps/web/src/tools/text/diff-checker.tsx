import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import {
  Alert,
  Badge,
  CopyButton,
  EmptyState,
  Field,
  Panel,
  Segmented,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";
import {
  analyzeDiff,
  unifiedDiffText,
  type DiffKind,
  type DiffLine,
  type DiffMode,
  type DiffToken,
} from "./logic";

const OLD_SAMPLE = `The quick brown fox jumps over the lazy dog.
devkit keeps every tool local.
No network calls are made.
Results stay in memory.`;

const NEW_SAMPLE = `The quick brown fox leaps over the lazy dog.
devkit keeps every tool local and offline.
No network calls are made.
Results stay in memory.
Scanning is fast.`;

const LINE_TONE: Record<DiffKind, string> = {
  equal: "bg-surface-2 text-text",
  added: "bg-accent-soft text-accent",
  removed: "bg-danger-soft text-danger",
};

const TOKEN_TONE: Record<DiffKind, string> = {
  equal: "text-text",
  added: "rounded bg-accent-soft px-0.5 text-accent",
  removed: "rounded bg-danger-soft px-0.5 text-danger line-through decoration-danger/50",
};

function UnifiedLines({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="max-h-[460px] overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse font-mono text-[12px] leading-relaxed">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className={LINE_TONE[line.kind]}>
              <td className="w-10 select-none border-r border-line/70 px-1.5 text-right text-faint">
                {line.oldLine ?? ""}
              </td>
              <td className="w-10 select-none border-r border-line/70 px-1.5 text-right text-faint">
                {line.newLine ?? ""}
              </td>
              <td className="w-5 select-none text-center opacity-70">
                {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
              </td>
              <td className="whitespace-pre-wrap break-words px-2 py-0.5">
                {line.text === "" ? "\u00a0" : line.text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SideBySideLines({
  rows,
}: {
  rows: Array<{ left: DiffLine | null; right: DiffLine | null }>;
}) {
  return (
    <div className="max-h-[460px] overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse font-mono text-[12px] leading-relaxed">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="w-10 select-none border-r border-line/70 px-1.5 text-right text-faint">
                {row.left?.oldLine ?? ""}
              </td>
              <td
                className={cn(
                  "w-1/2 whitespace-pre-wrap break-words border-r border-line px-2 py-0.5",
                  row.left ? LINE_TONE[row.left.kind] : "bg-surface-2/40",
                )}
              >
                {row.left ? (row.left.text === "" ? "\u00a0" : row.left.text) : ""}
              </td>
              <td className="w-10 select-none border-r border-line/70 px-1.5 text-right text-faint">
                {row.right?.newLine ?? ""}
              </td>
              <td
                className={cn(
                  "w-1/2 whitespace-pre-wrap break-words px-2 py-0.5",
                  row.right ? LINE_TONE[row.right.kind] : "bg-surface-2/40",
                )}
              >
                {row.right ? (row.right.text === "" ? "\u00a0" : row.right.text) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TokenFlow({ tokens, hide }: { tokens: DiffToken[]; hide?: DiffKind }) {
  return (
    <div className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed">
      {tokens
        .filter((token) => token.kind !== hide)
        .map((token, index) => (
          <span key={index} className={TOKEN_TONE[token.kind]}>
            {token.value}
          </span>
        ))}
    </div>
  );
}

export default function DiffCheckerTool() {
  const [oldText, setOldText] = useState(OLD_SAMPLE);
  const [newText, setNewText] = useState(NEW_SAMPLE);
  const [mode, setMode] = useState<DiffMode>("lines");
  const [view, setView] = useState<"unified" | "side-by-side">("unified");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);

  const diff = useMemo(
    () => analyzeDiff(oldText, newText, { mode, ignoreWhitespace, ignoreCase }),
    [ignoreCase, ignoreWhitespace, mode, newText, oldText],
  );

  const isEmpty = oldText === "" && newText === "";

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Compare" description="Text never leaves this browser tab.">
          <div className="space-y-3">
            <Field label="Original">
              <TextArea
                mono
                rows={10}
                value={oldText}
                onChange={(event) => setOldText(event.target.value)}
                placeholder="Original text"
                aria-label="Original text"
              />
            </Field>
            <Field label="Changed">
              <TextArea
                mono
                rows={10}
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                placeholder="Changed text"
                aria-label="Changed text"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Segmented
                label="Compare"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "lines", label: "Lines" },
                  { value: "words", label: "Words" },
                ]}
              />
              <Segmented
                label="Layout"
                value={view}
                onChange={setView}
                options={[
                  { value: "unified", label: "Unified" },
                  { value: "side-by-side", label: "Side by side" },
                ]}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label="Ignore whitespace"
                description="Line mode: collapse runs of spaces and trim."
                checked={ignoreWhitespace}
                onChange={setIgnoreWhitespace}
              />
              <Toggle
                label="Ignore case"
                description="Treat upper and lower case as equal."
                checked={ignoreCase}
                onChange={setIgnoreCase}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="Differences"
          description={
            mode === "lines" ? "Line numbers follow each side." : "Changed words are highlighted."
          }
          actions={
            <>
              <Badge tone={diff.summary.added > 0 ? "accent" : "neutral"}>
                +{formatNumber(diff.summary.added)}
              </Badge>
              <Badge tone={diff.summary.removed > 0 ? "warning" : "neutral"}>
                −{formatNumber(diff.summary.removed)}
              </Badge>
              {mode === "lines" && diff.lines.length > 0 ? (
                <CopyButton value={unifiedDiffText(diff.lines)} label="Copy diff" />
              ) : null}
            </>
          }
        >
          <div className="space-y-3">
            {diff.error ? (
              <Alert tone="danger" title="Cannot compare">
                {diff.error}
              </Alert>
            ) : null}
            {isEmpty ? (
              <EmptyState
                icon={<GitCompare className="size-5" aria-hidden />}
                title="Nothing to compare"
                description="Paste text into either side to see line and word differences."
              />
            ) : mode === "words" ? (
              view === "unified" ? (
                <TokenFlow tokens={diff.tokens} />
              ) : (
                <div className="grid gap-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      Original
                    </p>
                    <TokenFlow tokens={diff.tokens} hide="added" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      Changed
                    </p>
                    <TokenFlow tokens={diff.tokens} hide="removed" />
                  </div>
                </div>
              )
            ) : view === "unified" ? (
              <UnifiedLines lines={diff.lines} />
            ) : (
              <SideBySideLines rows={diff.sideBySide} />
            )}
            {!diff.error && !isEmpty ? (
              <p className="text-xs text-faint">
                {formatNumber(diff.summary.added)} added · {formatNumber(diff.summary.removed)}{" "}
                removed · {formatNumber(diff.summary.unchanged)} unchanged
                {mode === "lines" ? " lines" : " words"}
              </p>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
