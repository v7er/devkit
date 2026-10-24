import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Field,
  InlineRow,
  Input,
  Panel,
  Segmented,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  parseDateTimeLocalValue,
  parseTimestampInput,
  toDateTimeLocalValue,
  type TimestampInputKind,
} from "./logic";

const LOCAL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});
const UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  dateStyle: "full",
  timeStyle: "long",
});

const KIND_LABELS: Record<TimestampInputKind, string> = {
  seconds: "Unix seconds",
  milliseconds: "Unix milliseconds",
  microseconds: "Unix microseconds",
  nanoseconds: "Unix nanoseconds",
  date: "Date string",
};

type Mode = "toDate" | "toTimestamp";

function copyRow(label: string, value: string) {
  return (
    <InlineRow label={label}>
      <span className="inline-flex items-center gap-1">
        <span className="break-all">{value}</span>
        <CopyButton value={value} size="icon" label={`Copy ${label.toLowerCase()}`} />
      </span>
    </InlineRow>
  );
}

export default function TimestampTool() {
  const [mode, setMode] = useState<Mode>("toDate");
  const [timestampInput, setTimestampInput] = useState("1714550400");
  const [dateInput, setDateInput] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const fill = window.setTimeout(() => {
      setDateInput((current) => current || toDateTimeLocalValue(Date.now()));
    }, 0);
    return () => window.clearTimeout(fill);
  }, []);

  const timestampResult = useMemo(() => {
    if (!timestampInput.trim()) return { parsed: null, error: "" };
    try {
      return { parsed: parseTimestampInput(timestampInput), error: "" };
    } catch (error) {
      return {
        parsed: null,
        error: error instanceof Error ? error.message : "Could not read that timestamp",
      };
    }
  }, [timestampInput]);

  const dateResult = useMemo(() => {
    const ms = parseDateTimeLocalValue(dateInput);
    if (ms === null) return null;
    return {
      ms,
      seconds: Math.floor(ms / 1000),
      iso: new Date(ms).toISOString(),
      utc: UTC_FORMATTER.format(new Date(ms)),
    };
  }, [dateInput]);

  const live = useMemo(() => {
    if (now === 0) return null;
    return {
      seconds: Math.floor(now / 1000),
      iso: new Date(now).toISOString(),
      local: LOCAL_FORMATTER.format(new Date(now)),
      utc: UTC_FORMATTER.format(new Date(now)),
    };
  }, [now]);

  return (
    <ToolStack>
      <Panel
        title="Current time"
        description="Updates once per second from your system clock."
        actions={
          <Badge tone="accent">
            <Clock className="size-2.5" aria-hidden />
            Live
          </Badge>
        }
      >
        {live ? (
          <div className="space-y-2">
            <p className="font-mono text-2xl font-semibold tracking-tight text-text">
              {live.local}
            </p>
            {copyRow("Unix seconds", String(live.seconds))}
            {copyRow("Unix milliseconds", String(now))}
            {copyRow("ISO 8601", live.iso)}
            {copyRow("UTC", live.utc)}
          </div>
        ) : (
          <p className="text-sm text-faint">Reading the system clock…</p>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "toDate", label: "Timestamp → date" },
            { value: "toTimestamp", label: "Date → timestamp" },
          ]}
        />
      </div>

      <ToolGrid>
        {mode === "toDate" ? (
          <>
            <Panel
              title="Timestamp"
              description="Seconds, milliseconds, microseconds, and nanoseconds are detected by length."
            >
              <div className="space-y-3">
                <Field
                  label="Unix timestamp"
                  htmlFor="timestamp-input"
                  hint="Accepts 10-digit seconds, 13-digit milliseconds, or an ISO date."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTimestampInput(String(Math.floor(Date.now() / 1000)))}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Now
                    </Button>
                  }
                >
                  <Input
                    id="timestamp-input"
                    className="font-mono"
                    value={timestampInput}
                    onChange={(event) => setTimestampInput(event.target.value)}
                    placeholder="1714550400"
                    inputMode="numeric"
                    aria-label="Unix timestamp"
                  />
                </Field>
                {timestampInput.trim() === "now" ? (
                  <Alert tone="info">The word “now” reads your system clock at calculation time.</Alert>
                ) : null}
              </div>
            </Panel>

            <Panel title="Converted date" description="The same instant in local time, UTC, and ISO 8601." flush>
              <div className="space-y-3 p-4">
                {timestampResult.error ? (
                  <Alert tone="danger" title="Invalid timestamp">
                    {timestampResult.error}
                  </Alert>
                ) : null}
                {timestampResult.parsed ? (
                  <>
                    <Badge tone="accent">{KIND_LABELS[timestampResult.parsed.kind]}</Badge>
                    <div className="space-y-2">
                      {copyRow(
                        "Local time",
                        LOCAL_FORMATTER.format(new Date(timestampResult.parsed.milliseconds)),
                      )}
                      {copyRow(
                        "UTC",
                        UTC_FORMATTER.format(new Date(timestampResult.parsed.milliseconds)),
                      )}
                      {copyRow(
                        "ISO 8601",
                        new Date(timestampResult.parsed.milliseconds).toISOString(),
                      )}
                      {copyRow("Milliseconds", String(timestampResult.parsed.milliseconds))}
                    </div>
                  </>
                ) : !timestampResult.error ? (
                  <p className="text-sm text-faint">Enter a timestamp to see the converted date.</p>
                ) : null}
              </div>
            </Panel>
          </>
        ) : (
          <>
            <Panel title="Date and time" description="Interpreted in your browser's local time zone.">
              <div className="space-y-3">
                <Field label="Local date and time" htmlFor="date-input">
                  <Input
                    id="date-input"
                    type="datetime-local"
                    step="1"
                    value={dateInput}
                    onChange={(event) => setDateInput(event.target.value)}
                    aria-label="Local date and time"
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDateInput(toDateTimeLocalValue(Date.now()))}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Use now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDateInput("")}>
                    Clear
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel title="Timestamp" description="Unix seconds and milliseconds for that instant." flush>
              <div className="space-y-3 p-4">
                {dateInput && !dateResult ? (
                  <Alert tone="danger" title="Invalid date">
                    Choose a valid local date and time.
                  </Alert>
                ) : null}
                {dateResult ? (
                  <div className="space-y-2">
                    {copyRow("Unix seconds", String(dateResult.seconds))}
                    {copyRow("Unix milliseconds", String(dateResult.ms))}
                    {copyRow("ISO 8601", dateResult.iso)}
                    {copyRow("UTC", dateResult.utc)}
                  </div>
                ) : !dateInput ? (
                  <p className="text-sm text-faint">Pick a date and time to see its timestamp.</p>
                ) : null}
              </div>
            </Panel>
          </>
        )}
      </ToolGrid>
    </ToolStack>
  );
}
