import { useMemo, useState } from "react";
import { AlignLeft, Braces, Minimize2, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Panel,
  Select,
  TextArea,
  Toggle,
  ToolStack,
} from "@/components/ui";
import { JsonParseError, formatJson, parseJson, sortJsonKeys } from "@/lib/json";
import { formatBytes, formatNumber } from "@/lib/utils";

const SAMPLE = `{"project":"devkit","private":true,"tools":[{"id":"json-formatter","local":true}],"meta":{"stars":1280,"tags":["json","format"]}}`;

type View = "pretty" | "minified";
type Indent = "2" | "4" | "tab";

function describeError(error: unknown): string {
  if (error instanceof JsonParseError) {
    return `Line ${error.line}, column ${error.column}: ${error.message}`;
  }
  return error instanceof Error ? error.message : "Invalid JSON";
}

export default function JsonFormatterTool() {
  const [input, setInput] = useState(SAMPLE);
  const [indent, setIndent] = useState<Indent>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [view, setView] = useState<View>("pretty");

  const analysis = useMemo(() => {
    try {
      const value = parseJson(input);
      const width = indent === "tab" ? "\t" : Number(indent);
      const transformed = sortKeys ? sortJsonKeys(value) : value;
      const pretty = JSON.stringify(transformed, null, width) + "\n";
      const minified = JSON.stringify(transformed);
      const isArray = Array.isArray(value);
      const keys =
        value && typeof value === "object" && !isArray
          ? Object.keys(value as Record<string, unknown>).length
          : isArray
            ? value.length
            : 0;
      return {
        error: "",
        pretty,
        minified,
        keys,
        type: isArray ? "array" : value === null ? "null" : typeof value,
        inputBytes: new TextEncoder().encode(input).length,
        outputBytes: new TextEncoder().encode(view === "pretty" ? pretty : minified).length,
      };
    } catch (error) {
      return {
        error: describeError(error),
        pretty: "",
        minified: "",
        keys: 0,
        type: "",
        inputBytes: 0,
        outputBytes: 0,
      };
    }
  }, [indent, input, sortKeys, view]);

  const output = view === "pretty" ? analysis.pretty : analysis.minified;

  return (
    <ToolStack>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="JSON input"
          description="Parsed locally with the browser's JSON engine."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput(SAMPLE);
                setView("pretty");
              }}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <TextArea
              mono
              rows={16}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder='{"hello": "world"}'
              aria-label="JSON input"
              spellCheck={false}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Indentation"
                value={indent}
                onChange={(value) => setIndent(value as Indent)}
                options={[
                  { value: "2", label: "2 spaces" },
                  { value: "4", label: "4 spaces" },
                  { value: "tab", label: "Tabs" },
                ]}
              />
              <Field label="Output mode">
                <div className="flex h-10 items-center gap-1 rounded-lg border border-line bg-surface p-1">
                  <Button
                    variant={view === "pretty" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setView("pretty")}
                  >
                    <AlignLeft className="size-3.5" aria-hidden />
                    Pretty
                  </Button>
                  <Button
                    variant={view === "minified" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setView("minified")}
                  >
                    <Minimize2 className="size-3.5" aria-hidden />
                    Minify
                  </Button>
                </div>
              </Field>
            </div>
            <Toggle
              label="Sort object keys"
              description="Recursively alphabetize keys for stable diffs."
              checked={sortKeys}
              onChange={setSortKeys}
            />
          </div>
        </Panel>

        <Panel title="Formatted output" description="Valid JSON, ready to copy or download." flush>
          <div className="space-y-3 p-4">
            {analysis.error ? (
              <Alert tone="danger" title="Invalid JSON">
                {analysis.error}
              </Alert>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Root type</p>
                  <p className="mt-0.5 font-mono text-text">{analysis.type}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Entries</p>
                  <p className="mt-0.5 font-mono text-text">{formatNumber(analysis.keys)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Input</p>
                  <p className="mt-0.5 font-mono text-text">{formatBytes(analysis.inputBytes)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Minified</p>
                  <p className="mt-0.5 font-mono text-text">{formatBytes(analysis.outputBytes)}</p>
                </div>
              </div>
            )}
            <CodeOutput
              value={output}
              language={view === "pretty" ? "json" : "json (minified)"}
              filename={view === "pretty" ? "formatted.json" : "minified.json"}
              placeholder="Formatted JSON appears here"
              maxHeight={420}
            />
            {analysis.error ? (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    try {
                      setInput(formatJson(input, indent === "tab" ? "\t" : Number(indent)));
                    } catch {
                      // The error is already shown above.
                    }
                  }}
                >
                  <Braces className="size-3.5" aria-hidden />
                  Try formatting
                </Button>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </ToolStack>
  );
}
