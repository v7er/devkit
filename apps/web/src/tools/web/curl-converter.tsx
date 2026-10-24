import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Panel,
  Segmented,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  curlHeaders,
  generateCurlCode,
  parseCurl,
  type CurlLanguage,
  type ParsedCurl,
} from "./logic";

const EXAMPLE = `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{"name":"Ada","role":"admin"}'`;

const FILENAMES: Record<CurlLanguage, string> = {
  fetch: "request.ts",
  python: "request.py",
  go: "main.go",
  node: "request.mjs",
};

const LANGUAGES: Array<{ value: CurlLanguage; label: string }> = [
  { value: "fetch", label: "fetch" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "node", label: "Node" },
];

type ParsedState =
  | { ok: true; value: ParsedCurl }
  | { ok: false; error: string };

function readCurl(input: string): ParsedState {
  try {
    return { ok: true, value: parseCurl(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse this command.",
    };
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</span>
      <span className="break-all font-mono text-xs text-text">{value}</span>
    </div>
  );
}

export default function CurlConverterTool() {
  const [input, setInput] = useState(EXAMPLE);
  const [language, setLanguage] = useState<CurlLanguage>("fetch");

  const parsed = useMemo(() => readCurl(input), [input]);
  const code = useMemo(
    () => (parsed.ok ? generateCurlCode(parsed.value, language) : ""),
    [parsed, language],
  );

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="cURL command"
          description="Paste a curl command. Quotes, escapes, and backslash line continuations are supported."
          actions={
            <Button size="sm" variant="ghost" onClick={() => setInput(EXAMPLE)}>
              Load example
            </Button>
          }
        >
          <Field
            label="Command"
            hint="File uploads (-T, -F @file) and cookie files are not converted."
          >
            <TextArea
              mono
              rows={14}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'curl https://api.example.com -H "Accept: application/json"'}
              aria-label="cURL command to convert"
            />
          </Field>
          {!parsed.ok ? (
            <Alert tone="danger" title="Could not parse this command" className="mt-3">
              {parsed.error}
            </Alert>
          ) : null}
          {parsed.ok && parsed.value.warnings.length > 0 ? (
            <Alert tone="warning" title="Conversion notes" className="mt-3">
              <ul className="list-disc space-y-0.5 pl-4">
                {parsed.value.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </Panel>

        <Panel
          title="Generated code"
          description="Runs a real request when executed; review the URL and credentials first."
          actions={
            <Segmented<CurlLanguage>
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
            />
          }
        >
          <div className="space-y-3">
            {parsed.ok ? (
              <div className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3 sm:grid-cols-2">
                <SummaryRow label="Method" value={parsed.value.method} />
                <SummaryRow label="Headers" value={String(curlHeaders(parsed.value).length)} />
                <div className="sm:col-span-2">
                  <SummaryRow label="URL" value={parsed.value.url} />
                </div>
                <SummaryRow
                  label="Body"
                  value={
                    parsed.value.form
                      ? `${parsed.value.form.length} form field${parsed.value.form.length === 1 ? "" : "s"}`
                      : parsed.value.body ?? "None"
                  }
                />
                <SummaryRow
                  label="Timeout"
                  value={
                    parsed.value.timeoutSeconds === null
                      ? "None"
                      : `${parsed.value.timeoutSeconds} s`
                  }
                />
              </div>
            ) : null}
            <CodeOutput
              value={code}
              language={language}
              filename={FILENAMES[language]}
              placeholder="Generated code appears here"
              maxHeight={430}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
