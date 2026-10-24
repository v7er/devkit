import { useMemo, useState } from "react";
import { Timer } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  CopyButton,
  Field,
  InlineRow,
  Input,
  Panel,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  breakDownDuration,
  formatDurationClock,
  formatDurationHuman,
  formatDurationIso,
  parseDuration,
} from "./logic";

const DECIMAL_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const INTEGER_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const SAMPLES = ["2h 30m", "1.5 days", "PT1H30M", "90", "01:30:00", "2 hours and 15 minutes"];

export default function DurationParserTool() {
  const [input, setInput] = useState("2h 30m");

  const result = useMemo(() => {
    try {
      const milliseconds = parseDuration(input);
      return { milliseconds, error: "" };
    } catch (error) {
      return {
        milliseconds: 0,
        error: error instanceof Error ? error.message : "Could not parse that duration",
      };
    }
  }, [input]);

  const parts = result.error ? null : breakDownDuration(result.milliseconds);
  const human = parts ? formatDurationHuman(result.milliseconds) : "";
  const clock = parts ? formatDurationClock(result.milliseconds) : "";
  const iso = parts ? formatDurationIso(result.milliseconds) : "";

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Duration" description="Combine units, use a clock, paste ISO 8601, or enter plain seconds.">
          <div className="space-y-4">
            <Field
              label="Duration"
              htmlFor="duration-input"
              hint="Units: ms, s, m, h, d, w, mo, y. Bare numbers are seconds."
            >
              <Input
                id="duration-input"
                className="font-mono"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="2h 30m"
                spellCheck={false}
                aria-label="Duration to parse"
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((sample) => (
                <Button
                  key={sample}
                  variant="ghost"
                  size="sm"
                  className="font-mono"
                  onClick={() => setInput(sample)}
                >
                  {sample}
                </Button>
              ))}
            </div>

            <Alert tone="info">
              Months and years use average lengths (30.44 and 365.2425 days) because a duration
              has no calendar anchor.
            </Alert>
          </div>
        </Panel>

        <Panel title="Result" description="The same duration in several formats." flush>
          <div className="space-y-4 p-4">
            {result.error ? (
              <Alert tone="danger" title="Invalid duration">
                {result.error}
              </Alert>
            ) : null}

            {parts ? (
              <>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    Breakdown
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-mono text-lg font-semibold text-text">
                    <Timer className="size-4 shrink-0 text-accent" aria-hidden />
                    {human}
                    <CopyButton value={human} size="icon" label="Copy breakdown" />
                  </p>
                </div>

                <div className="space-y-2">
                  <InlineRow label="Clock">
                    <span className="inline-flex items-center gap-1">
                      {clock}
                      <CopyButton value={clock} size="icon" label="Copy clock duration" />
                    </span>
                  </InlineRow>
                  <InlineRow label="Total milliseconds">
                    {INTEGER_FORMATTER.format(parts.totalMilliseconds)}
                  </InlineRow>
                  <InlineRow label="Total seconds">
                    {DECIMAL_FORMATTER.format(parts.totalSeconds)}
                  </InlineRow>
                  <InlineRow label="Total minutes">
                    {DECIMAL_FORMATTER.format(parts.totalMinutes)}
                  </InlineRow>
                  <InlineRow label="Total hours">
                    {DECIMAL_FORMATTER.format(parts.totalHours)}
                  </InlineRow>
                  <InlineRow label="Total days">
                    {DECIMAL_FORMATTER.format(parts.totalDays)}
                  </InlineRow>
                  <InlineRow label="Total weeks">
                    {DECIMAL_FORMATTER.format(parts.totalWeeks)}
                  </InlineRow>
                </div>

                <CodeOutput
                  value={iso}
                  language="ISO 8601"
                  filename="duration.txt"
                  placeholder="ISO 8601 output appears here"
                  maxHeight={120}
                />
              </>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
