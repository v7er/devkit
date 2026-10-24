import { useMemo, useState } from "react";
import { ArrowLeftRight, Braces, RotateCcw } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  CopyButton,
  Field,
  Panel,
  Segmented,
  Select,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  ESCAPE_STYLES,
  escapeText,
  unescapeText,
  type EscapeDirection,
  type EscapeStyle,
} from "./logic";

const SAMPLE = 'He said "hello" to O\'Brien.\nPath: C:\\Users\\dev@example.com\tDone.';

const DIRECTIONS: Array<{ value: EscapeDirection; label: string }> = [
  { value: "escape", label: "Escape" },
  { value: "unescape", label: "Unescape" },
];

const STYLE_OPTIONS = ESCAPE_STYLES.map((style) => ({
  value: style.value,
  label: style.label,
}));

export default function StringEscapeTool() {
  const [style, setStyle] = useState<EscapeStyle>("javascript");
  const [direction, setDirection] = useState<EscapeDirection>("escape");
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(
    () => (direction === "escape" ? escapeText(input, style) : unescapeText(input, style)),
    [direction, input, style],
  );

  const hint = ESCAPE_STYLES.find((entry) => entry.value === style)?.hint ?? "";

  function handleSwap() {
    if (!result.output) return;
    setInput(result.output);
    setDirection(direction === "escape" ? "unescape" : "escape");
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Input"
          description="Escaping follows the selected language's literal syntax; shell output includes its own quotes."
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwap}
                disabled={!result.output}
                title="Use the output as the next input"
              >
                <ArrowLeftRight className="size-3.5" aria-hidden />
                Swap
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInput(SAMPLE);
                  setDirection("escape");
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Sample
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Select
              label="Language"
              value={style}
              onChange={(value) => setStyle(value as EscapeStyle)}
              options={STYLE_OPTIONS}
            />
            <Segmented
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={DIRECTIONS}
            />
            <Field label={direction === "escape" ? "Raw text" : "Escaped text"} hint={hint}>
              <TextArea
                mono
                rows={12}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  direction === "escape" ? "Paste raw text" : "Paste an escaped string body"
                }
                aria-label={direction === "escape" ? "Raw text" : "Escaped text"}
                spellCheck={false}
              />
            </Field>
            <p className="text-xs text-faint">
              Unescape also accepts a full quoted literal; the surrounding quotes are kept as
              ordinary characters except for SQL and shell input.
            </p>
          </div>
        </Panel>

        <Panel
          title="Output"
          description={`${ESCAPE_STYLES.find((entry) => entry.value === style)?.label ?? style} · ${
            direction === "escape" ? "escaped" : "unescaped"
          }`}
          actions={<CopyButton value={result.output} label="Copy" />}
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Cannot process this string">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.output}
              language={direction === "escape" ? "escaped output" : "unescaped text"}
              filename={direction === "escape" ? "escaped.txt" : "unescaped.txt"}
              maxHeight={460}
              placeholder="Converted text appears here"
            />
            <div className="flex items-start gap-2 text-xs text-faint">
              <Braces className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Only the listed escapes are recognized. Unknown escapes report an error with their
                position rather than passing through silently.
              </span>
            </div>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
