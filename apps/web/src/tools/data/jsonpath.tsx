import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CopyButton,
  Field,
  Input,
  Panel,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { evaluateJsonPath, type JsonPathMatch } from "./logic";

const SAMPLE = `{
  "project": "devkit",
  "tools": [
    { "id": "json-formatter", "category": "data", "local": true },
    { "id": "dns-lookup", "category": "web", "local": false },
    { "id": "csv-json", "category": "data", "local": true }
  ]
}`;

const SAMPLE_EXPRESSION = "$.tools[?(@.local == true)].id";
const VISIBLE_MATCHES = 100;

function stringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, null, 2) ?? String(value);
}

export default function JsonPathTool() {
  const [input, setInput] = useState(SAMPLE);
  const [expression, setExpression] = useState(SAMPLE_EXPRESSION);

  const result = useMemo(() => {
    try {
      return { matches: evaluateJsonPath(input, expression), error: "" };
    } catch (error) {
      return {
        matches: [] as JsonPathMatch[],
        error: error instanceof Error ? error.message : "Could not evaluate this expression",
      };
    }
  }, [expression, input]);

  const visible = result.matches.slice(0, VISIBLE_MATCHES);
  const hidden = result.matches.length - visible.length;

  return (
    <ToolGrid>
      <Panel
        title="Input"
        description="Expressions run with jsonpath-plus in this tab."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInput(SAMPLE);
              setExpression(SAMPLE_EXPRESSION);
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
            rows={14}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='{"items": [{"id": 1}]}'
            aria-label="JSON input"
            spellCheck={false}
          />
          <Field
            label="JSONPath expression"
            hint="Supports filters, recursive descent, slices, and unions."
          >
            <Input
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="$.items[*].id"
              aria-label="JSONPath expression"
              spellCheck={false}
              className="font-mono text-[13px]"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {["$..*", "$.tools[*].id", "$.tools[?(@.local)]", "$.tools[0]"].map((example) => (
              <Button
                key={example}
                variant="ghost"
                size="sm"
                className="font-mono text-[11px]"
                onClick={() => setExpression(example)}
              >
                {example}
              </Button>
            ))}
          </div>
          <Alert tone="info">
            Every match is listed with its normalized path. A missing match is an empty result,
            not a syntax error.
          </Alert>
        </div>
      </Panel>

      <Panel
        title="Matches"
        description="Values are read-only and never leave this device."
        actions={
          <span className="font-mono text-xs text-faint">
            {formatNumber(result.matches.length)} found
          </span>
        }
      >
        <div className="space-y-3">
          {result.error ? (
            <Alert tone="danger" title="Evaluation failed">
              {result.error}
            </Alert>
          ) : result.matches.length === 0 ? (
            <Alert tone="warning" title="No matches">
              The expression is valid but selected nothing in this document.
            </Alert>
          ) : (
            <div className="space-y-2">
              {visible.map((match, index) => {
                const value = stringifyValue(match.value);
                return (
                  <div
                    key={`${match.path}-${index}`}
                    className="overflow-hidden rounded-lg border border-line bg-surface"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
                      <code className="truncate font-mono text-xs text-text">{match.path}</code>
                      <CopyButton value={value} size="icon" />
                    </div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-relaxed text-text">
                      {value}
                    </pre>
                  </div>
                );
              })}
              {hidden > 0 ? (
                <p className="text-xs text-faint">
                  Showing the first {VISIBLE_MATCHES} matches. {formatNumber(hidden)} more were
                  found.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
