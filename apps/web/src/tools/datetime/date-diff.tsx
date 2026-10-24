import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CalendarClock, RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  InlineRow,
  Input,
  Panel,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { pluralize } from "@/lib/utils";
import {
  calendarBreakdown,
  countBusinessDays,
  differenceBetweenInstants,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  type CalendarBreakdown,
} from "./logic";

const DECIMAL_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

function describeBreakdown(breakdown: CalendarBreakdown): string {
  const parts: string[] = [];
  if (breakdown.years) parts.push(pluralize(breakdown.years, "year"));
  if (breakdown.months) parts.push(pluralize(breakdown.months, "month"));
  if (breakdown.days) parts.push(pluralize(breakdown.days, "day"));
  if (breakdown.hours) parts.push(pluralize(breakdown.hours, "hour"));
  if (breakdown.minutes) parts.push(pluralize(breakdown.minutes, "minute"));
  if (breakdown.seconds) parts.push(pluralize(breakdown.seconds, "second"));
  if (breakdown.milliseconds) parts.push(`${breakdown.milliseconds} ms`);
  return parts.length > 0 ? parts.join(", ") : "0 seconds";
}

export default function DateDiffTool() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [includeEndDay, setIncludeEndDay] = useState(false);

  useEffect(() => {
    const fill = window.setTimeout(() => {
      const now = Date.now();
      setStart((current) => current || toDateTimeLocalValue(now));
      setEnd((current) => current || toDateTimeLocalValue(now + 7 * 86_400_000));
    }, 0);
    return () => window.clearTimeout(fill);
  }, []);

  const analysis = useMemo(() => {
    const startMs = parseDateTimeLocalValue(start);
    const endMs = parseDateTimeLocalValue(end);
    if (startMs === null || endMs === null) {
      return {
        error: start || end ? "Choose both a start and an end date." : "",
        data: null,
      };
    }
    return {
      error: "",
      data: {
        totals: differenceBetweenInstants(startMs, endMs),
        calendar: calendarBreakdown(startMs, endMs),
        business: countBusinessDays(startMs, endMs, includeEndDay),
      },
    };
  }, [end, includeEndDay, start]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Dates" description="Times are read in your local zone; durations are exact elapsed time.">
          <div className="space-y-4">
            <Field label="Start" htmlFor="diff-start">
              <Input
                id="diff-start"
                type="datetime-local"
                step="1"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-label="Start date and time"
              />
            </Field>
            <Field label="End" htmlFor="diff-end">
              <Input
                id="diff-end"
                type="datetime-local"
                step="1"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                aria-label="End date and time"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStart(end);
                  setEnd(start);
                }}
                disabled={!start && !end}
              >
                <ArrowLeftRight className="size-3.5" aria-hidden />
                Swap
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStart(toDateTimeLocalValue(Date.now()));
                  setEnd(toDateTimeLocalValue(Date.now() + 7 * 86_400_000));
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Reset to now
              </Button>
            </div>
            <div className="border-t border-line pt-3">
              <Toggle
                label="Include the end day in business days"
                description="Off by default, matching elapsed working days."
                checked={includeEndDay}
                onChange={setIncludeEndDay}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Difference" description="Calendar parts plus total elapsed units." flush>
          <div className="space-y-4 p-4">
            {analysis.error ? (
              <Alert tone="danger" title="Invalid dates">
                {analysis.error}
              </Alert>
            ) : null}

            {analysis.data ? (
              <>
                {analysis.data.calendar.negative ? (
                  <Alert tone="warning">
                    The end is before the start; values are shown as absolute durations.
                  </Alert>
                ) : null}

                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                    Calendar difference
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-text">
                    <CalendarClock className="size-4 shrink-0 text-accent" aria-hidden />
                    {describeBreakdown(analysis.data.calendar)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="accent">
                    {DECIMAL_FORMATTER.format(analysis.data.totals.days)} days total
                  </Badge>
                  <Badge>
                    {DECIMAL_FORMATTER.format(analysis.data.totals.weeks)} weeks total
                  </Badge>
                </div>

                <div className="space-y-2">
                  <InlineRow label="Days">{DECIMAL_FORMATTER.format(analysis.data.totals.days)}</InlineRow>
                  <InlineRow label="Hours">
                    {DECIMAL_FORMATTER.format(analysis.data.totals.hours)}
                  </InlineRow>
                  <InlineRow label="Minutes">
                    {DECIMAL_FORMATTER.format(analysis.data.totals.minutes)}
                  </InlineRow>
                  <InlineRow label="Seconds">
                    {DECIMAL_FORMATTER.format(analysis.data.totals.seconds)}
                  </InlineRow>
                  <InlineRow label="Milliseconds">
                    {DECIMAL_FORMATTER.format(analysis.data.totals.milliseconds)}
                  </InlineRow>
                </div>

                <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                  <InlineRow label="Business days (Mon–Fri)">
                    <span className="text-sm font-semibold text-text">
                      {DECIMAL_FORMATTER.format(analysis.data.business)}
                    </span>
                  </InlineRow>
                  <p className="mt-1 text-[12px] text-faint">
                    Weekends are excluded; public holidays are not.
                  </p>
                </div>
              </>
            ) : !analysis.error ? (
              <p className="text-sm text-faint">Pick a start and end date to compare them.</p>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
