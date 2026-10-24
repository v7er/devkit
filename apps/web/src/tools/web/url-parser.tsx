import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  buildUrl,
  parseUrl,
  type UrlBreakdown,
  type UrlQueryParam,
} from "./logic";

type UrlState = { ok: true; value: UrlBreakdown } | { ok: false; error: string };

function readUrl(input: string): UrlState {
  try {
    return { ok: true, value: parseUrl(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse this URL.",
    };
  }
}

function valueOrDash(value: string): string {
  return value || "—";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-all text-right font-mono text-xs text-text">{value}</span>
    </div>
  );
}

export default function UrlParserTool() {
  const [input, setInput] = useState(
    "https://user:secret@example.com:8443/docs/page?tag=api&tag=web&q=hello%20world#section-2",
  );
  const [paramDraft, setParamDraft] = useState<{
    source: string;
    params: UrlQueryParam[];
  } | null>(null);

  const state = useMemo(() => readUrl(input), [input]);
  const parsedQuery = state.ok ? state.value.query : [];
  const params = paramDraft && paramDraft.source === input ? paramDraft.params : parsedQuery;

  const built = useMemo(
    () => (state.ok ? buildUrl(state.value, params) : ""),
    [state, params],
  );

  function commitParams(next: UrlQueryParam[]) {
    setParamDraft({ source: input, params: next });
  }

  function updateParam(index: number, patch: Partial<UrlQueryParam>) {
    commitParams(
      params.map((param, position) => (position === index ? { ...param, ...patch } : param)),
    );
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="URL"
          description="Absolute, protocol-relative, and relative paths are supported."
        >
          <div className="space-y-3">
            <Field
              label="URL or path"
              hint="Values are parsed with the browser's URL implementation."
            >
              <TextArea
                mono
                rows={5}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="https://example.com/path?query=1#fragment"
                aria-label="URL to parse"
              />
            </Field>
            {state.ok ? null : (
              <Alert tone="danger" title="Invalid URL">
                {state.error}
              </Alert>
            )}
          </div>
        </Panel>

        <Panel title="Breakdown" description="Decoded components and the normalized encoded URL.">
          {state.ok ? (
            <div className="space-y-3">
              <div className="divide-y divide-line">
                <Row
                  label="Type"
                  value={
                    state.value.protocolRelative
                      ? "Protocol-relative"
                      : state.value.isRelative
                        ? "Relative"
                        : "Absolute"
                  }
                />
                <Row label="Protocol" value={valueOrDash(state.value.protocol)} />
                <Row label="Username" value={valueOrDash(state.value.username)} />
                <Row label="Password" value={valueOrDash(state.value.password)} />
                <Row label="Hostname" value={valueOrDash(state.value.hostname)} />
                <Row label="Port" value={valueOrDash(state.value.port)} />
                <Row label="Origin" value={valueOrDash(state.value.origin)} />
                <Row label="Path" value={valueOrDash(state.value.pathname)} />
                <Row label="Query" value={valueOrDash(state.value.search)} />
                <Row label="Fragment" value={valueOrDash(state.value.hash)} />
              </div>
              <CodeOutput
                value={state.value.href}
                language="normalized URL"
                filename="url.txt"
                maxHeight={120}
              />
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-faint">
              Protocol, host, path, query, and fragment appear here.
            </div>
          )}
        </Panel>
      </ToolGrid>

      <ToolGrid>
        <Panel
          title="Query parameters"
          description="Edit decoded values; the built URL below re-encodes them."
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => commitParams([...params, { key: "", value: "" }])}
              disabled={!state.ok}
            >
              <Plus className="size-3.5" aria-hidden />
              Add parameter
            </Button>
          }
        >
          {state.ok ? (
            params.length === 0 ? (
              <p className="py-4 text-center text-xs text-faint">
                No query parameters. Add one to build a query string.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  <span>Key</span>
                  <span>Value</span>
                  <span className="w-9" />
                </div>
                {params.map((param, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <Input
                      value={param.key}
                      onChange={(event) => updateParam(index, { key: event.target.value })}
                      aria-label={`Query parameter ${index + 1} key`}
                      placeholder="key"
                      className="h-9 font-mono text-xs"
                    />
                    <Input
                      value={param.value}
                      onChange={(event) => updateParam(index, { value: event.target.value })}
                      aria-label={`Query parameter ${index + 1} value`}
                      placeholder="value"
                      className="h-9 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        commitParams(params.filter((_, position) => position !== index))
                      }
                      aria-label={`Remove query parameter ${index + 1}`}
                      title="Remove parameter"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="py-4 text-center text-xs text-faint">
              Fix the URL to edit its query parameters.
            </p>
          )}
        </Panel>

        <Panel title="Built URL" description="The path or URL with your edited query string.">
          <CodeOutput
            value={built}
            language="url"
            filename="built-url.txt"
            placeholder="Built URL appears here"
            maxHeight={180}
            className={state.ok ? undefined : "opacity-60"}
          />
          <p className="mt-2 text-xs text-faint">
            Keys and values are encoded with URLSearchParams. Empty pairs are skipped.
          </p>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
