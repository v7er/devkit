import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  CodeOutput,
  EmptyState,
  Field,
  Panel,
  Select,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { parseUserAgent, type AgentPart } from "./logic";
import { UA_PRESETS } from "./reference";

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  bot: "Bot / crawler",
  console: "Console",
  unknown: "Unknown",
};

function describePart(part: AgentPart | null): string {
  if (!part) return "Unknown";
  return part.version ? `${part.name} ${part.version}` : part.name;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-0.5 break-words font-mono text-xs text-text">{value}</p>
    </div>
  );
}

export default function UserAgentTool() {
  const [input, setInput] = useState("");
  const [preset, setPreset] = useState("");
  const parsed = useMemo(() => parseUserAgent(input), [input]);
  const hasInput = input.trim().length > 0;

  const device = [
    DEVICE_LABELS[parsed.device.type] ?? parsed.device.type,
    parsed.device.vendor,
    parsed.device.model,
  ]
    .filter(Boolean)
    .join(" · ");

  function choosePreset(value: string) {
    setPreset(value);
    const selected = UA_PRESETS.find((entry) => entry.value === value);
    if (selected) setInput(selected.value);
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="User agent string"
          description="Paste a User-Agent value or load a common preset. Detection is heuristic, not authoritative."
          actions={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (typeof navigator !== "undefined") setInput(navigator.userAgent);
                setPreset("");
              }}
            >
              Use this browser
            </Button>
          }
        >
          <div className="space-y-3">
            <Select
              label="Common presets"
              value={preset}
              onChange={choosePreset}
              options={[
                { value: "", label: "Choose a preset…" },
                ...UA_PRESETS.map((entry) => ({ value: entry.value, label: entry.label })),
              ]}
            />
            <Field label="Raw value" hint="Values are parsed locally and never sent anywhere.">
              <TextArea
                mono
                rows={8}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setPreset("");
                }}
                placeholder="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 …"
                aria-label="User agent string to parse"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Parsed result" description="Best-effort browser, engine, OS, and device detection.">
          {hasInput ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <ResultRow label="Browser" value={describePart(parsed.browser)} />
                <ResultRow label="Engine" value={describePart(parsed.engine)} />
                <ResultRow label="Operating system" value={describePart(parsed.os)} />
                <ResultRow label="Device" value={device || "Unknown"} />
              </div>
              {parsed.bot ? (
                <Alert tone="info" title="Crawler detected">
                  Matched {parsed.bot}. A user agent string is self-declared and can be spoofed.
                </Alert>
              ) : (
                <Alert tone="info">
                  Values come from pattern matching on the self-declared string, so uncommon clients can
                  be misidentified.
                </Alert>
              )}
              <CodeOutput
                value={input.trim()}
                language="raw user agent"
                filename="user-agent.txt"
                maxHeight={140}
              />
            </div>
          ) : (
            <EmptyState
              title="Paste a user agent"
              description="Choose a preset or paste a User-Agent header value to see the parsed browser, engine, OS, and device."
            />
          )}
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
