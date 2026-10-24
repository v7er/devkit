import { useMemo, useState } from "react";
import { CaseSensitive, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  CopyButton,
  EmptyState,
  Field,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { CASE_STYLES, convertCase, splitWords } from "./logic";

const SAMPLE = "HTTPServer responseCode 200 for userProfile";

export default function CaseConverterTool() {
  const [input, setInput] = useState(SAMPLE);
  const words = useMemo(() => splitWords(input), [input]);
  const conversions = useMemo(
    () => CASE_STYLES.map((style) => ({ ...style, output: convertCase(input, style.value) })),
    [input],
  );

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Input"
          description="Word boundaries come from separators, case changes, and digits."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Text" hint="Existing spaces, dashes, underscores, and dots are replaced.">
              <TextArea
                mono
                rows={10}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type or paste text to convert"
                aria-label="Text to convert"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted">
                Detected words
              </p>
              {words.length === 0 ? (
                <p className="text-xs text-faint">No words detected yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {words.slice(0, 24).map((word, index) => (
                    <Badge key={`${word}-${index}`}>{word}</Badge>
                  ))}
                  {words.length > 24 ? (
                    <Badge tone="accent">+{words.length - 24} more</Badge>
                  ) : null}
                </div>
              )}
            </div>
            <p className="text-xs text-faint">
              {words.length} word{words.length === 1 ? "" : "s"} · acronyms keep their letters, so{" "}
              <span className="font-mono">HTTPRequest</span> splits into{" "}
              <span className="font-mono">HTTP</span> and{" "}
              <span className="font-mono">Request</span>.
            </p>
          </div>
        </Panel>

        <Panel
          title="Conversions"
          description="Every style updates as you type."
          actions={<Badge tone="accent">{CASE_STYLES.length} styles</Badge>}
        >
          {words.length === 0 ? (
            <EmptyState
              icon={<CaseSensitive className="size-5" aria-hidden />}
              title="Nothing to convert"
              description="Enter a word, identifier, sentence, or title to see every casing."
            />
          ) : (
            <ul className="space-y-2">
              {conversions.map((conversion) => (
                <li
                  key={conversion.value}
                  className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                      {conversion.label}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[13px] text-text">
                      {conversion.output || "—"}
                    </p>
                  </div>
                  <CopyButton
                    value={conversion.output}
                    size="icon"
                    label={`Copy ${conversion.label}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
