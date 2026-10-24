import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  InlineRow,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import { parseHeaders, type ParsedHeaderBlock } from "./logic";

type HeaderState = { ok: true; value: ParsedHeaderBlock } | { ok: false; error: string };

const PLACEHOLDER = `HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
Set-Cookie: session=abc123; Path=/; HttpOnly; Secure
X-Content-Type-Options: nosniff

{"ok":true}`;

function readHeaders(input: string): HeaderState {
  try {
    return { ok: true, value: parseHeaders(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse these headers.",
    };
  }
}

export default function HttpHeadersTool() {
  const [input, setInput] = useState("");
  const state = useMemo(() => readHeaders(input), [input]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Raw headers"
          description="Paste a request line, status line, or header block. A blank line ends the headers."
        >
          <div className="space-y-3">
            <Field
              label="Header block"
              hint="Folded lines are joined. The body after the first blank line is ignored."
            >
              <TextArea
                mono
                rows={16}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={PLACEHOLDER}
                aria-label="Raw HTTP headers to inspect"
              />
            </Field>
            {state.ok ? (
              state.value.bodyIgnored ? (
                <Alert tone="info">A body was present after the blank line and was not parsed.</Alert>
              ) : null
            ) : (
              <Alert tone="danger" title="Invalid header block">
                {state.error}
              </Alert>
            )}
          </div>
        </Panel>

        <Panel
          title="Summary"
          description={state.ok ? "Parsed start line, counts, duplicates, and security controls." : "Summary appears after valid headers are entered."}
        >
          {state.ok ? (
            <div className="space-y-3">
              <div className="divide-y divide-line">
                <InlineRow label="Start line">{state.value.startLine ?? "None (headers only)"}</InlineRow>
                <InlineRow label="Message type">
                  {state.value.startLine === null
                    ? "Headers only"
                    : state.value.isResponse
                      ? "Response"
                      : "Request"}
                </InlineRow>
                <InlineRow label="Protocol">{state.value.protocol ?? "—"}</InlineRow>
                {state.value.isResponse ? (
                  <InlineRow label="Status">
                    {state.value.statusCode ?? "—"} {state.value.statusText}
                  </InlineRow>
                ) : null}
                <InlineRow label="Headers">{state.value.headers.length}</InlineRow>
                <InlineRow label="Size">{formatBytes(state.value.byteSize)}</InlineRow>
                <InlineRow label="Cookies">{state.value.cookies.length}</InlineRow>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Security headers
                </p>
                <ul className="space-y-1.5">
                  {state.value.security.map((check) => (
                    <li key={check.name} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-mono text-text">{check.name}</p>
                        <p className="text-faint">{check.note}</p>
                      </div>
                      <Badge tone={check.present ? "accent" : "warning"}>
                        {check.present ? "set" : "missing"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Duplicate headers
                </p>
                {state.value.duplicates.length === 0 ? (
                  <p className="text-xs text-faint">No duplicate names.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {state.value.duplicates.map((duplicate) => (
                      <li key={duplicate.name}>
                        <span className="font-mono text-text">{duplicate.name}</span>
                        <span className="text-faint"> · {duplicate.values.length} values</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No headers parsed"
              description="Paste a block on the left to see the header count, duplicates, cookies, and security header coverage."
            />
          )}
        </Panel>
      </ToolGrid>

      {state.ok ? (
        <>
          <Panel title="Headers" description="Every parsed field, in source order." flush>
            <ul className="divide-y divide-line">
              {state.value.headers.map((header) => (
                <li
                  key={`${header.line}-${header.name}`}
                  className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:items-start sm:gap-4"
                >
                  <span className="w-56 shrink-0 break-all font-mono text-xs text-muted">
                    {header.name}
                  </span>
                  <span className="min-w-0 break-words font-mono text-xs text-text">{header.value || "—"}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {state.value.cookies.length > 0 ? (
            <Panel title="Cookies" description="Cookie and Set-Cookie values with their attributes." flush>
              <ul className="divide-y divide-line">
                {state.value.cookies.map((cookie, index) => (
                  <li key={`${cookie.source}-${cookie.name}-${index}`} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={cookie.source === "set-cookie" ? "accent" : "neutral"}>
                        {cookie.source}
                      </Badge>
                      <span className="break-all font-mono text-xs text-text">
                        {cookie.name}={cookie.value}
                      </span>
                    </div>
                    {cookie.attributes.length > 0 ? (
                      <p className="mt-1 text-xs text-faint">
                        {cookie.attributes
                          .map((attribute) =>
                            attribute.value ? `${attribute.name}=${attribute.value}` : attribute.name,
                          )
                          .join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}
    </ToolStack>
  );
}
