import { useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  InlineRow,
  Panel,
  Select,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { CRON_FIELD_REFERENCE, CRON_PRESETS, analyzeCron } from "./logic";

const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const COMMON_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const ZONE_OPTIONS = [
  { value: LOCAL_ZONE, label: `${LOCAL_ZONE} (local)` },
  ...COMMON_ZONES.filter((zone) => zone !== LOCAL_ZONE).map((zone) => ({
    value: zone,
    label: zone,
  })),
];

export default function CronParserTool() {
  const [expression, setExpression] = useState("*/15 9-17 * * 1-5");
  const [timeZone, setTimeZone] = useState(LOCAL_ZONE);
  const [, setRefreshKey] = useState(0);

  const analysis = analyzeCron(expression, { timeZone, currentDate: new Date() });

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Expression"
          description="Five fields, or six when the first field is seconds."
        >
          <div className="space-y-3">
            <Field
              label="Cron expression"
              hint="Example: */15 9-17 * * 1-5 runs every 15 minutes on weekdays from 09:00 to 17:59."
            >
              <Input
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
                placeholder="* * * * *"
                aria-label="Cron expression"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted">Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((preset) => (
                  <Button
                    key={preset.expression}
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpression(preset.expression)}
                    title={preset.expression}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Select
              label="Time zone"
              value={timeZone}
              onChange={setTimeZone}
              options={ZONE_OPTIONS}
            />
            {analysis.fields.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                {analysis.fields.map((field) => (
                  <InlineRow key={field.name} label={field.name}>
                    {field.value}
                  </InlineRow>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-faint">
              Parsing runs locally with the standard cron rules. Day-of-month and day-of-week use OR
              semantics when both are restricted.
            </p>
          </div>
        </Panel>

        <Panel
          title="Schedule"
          description="Next five runs from now in the selected time zone."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
          }
        >
          <div className="space-y-3">
            {analysis.error ? (
              <Alert tone="danger" title="Invalid expression">
                {analysis.error}
              </Alert>
            ) : null}
            {analysis.description ? (
              <Alert tone="info" title="Description">
                {analysis.description}
              </Alert>
            ) : null}
            {analysis.warning ? (
              <Alert tone="warning" title="Check this expression">
                {analysis.warning}
              </Alert>
            ) : null}
            {analysis.error ? (
              <EmptyState
                icon={<CalendarClock className="size-5" aria-hidden />}
                title="No upcoming runs"
                description="Fix the expression to preview the next five trigger times."
              />
            ) : (
              <ol className="space-y-1.5">
                {analysis.nextRuns.map((run, index) => (
                  <li
                    key={run.iso}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    <Badge>{index + 1}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm text-text">{run.formatted}</p>
                      <p className="font-mono text-[11px] text-faint">{run.iso}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-faint">
              Times are computed with the IANA time zone rules for{" "}
              <span className="font-mono">{timeZone}</span>.
            </p>
          </div>
        </Panel>
      </ToolGrid>

      <Panel title="Field reference" description="Standard cron syntax; named months and weekdays are accepted.">
        <div className="overflow-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-faint">
              <tr>
                <th className="border-b border-line px-3 py-2 font-semibold">Field</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Range</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Special characters</th>
              </tr>
            </thead>
            <tbody>
              {CRON_FIELD_REFERENCE.map((field) => (
                <tr key={field.name} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-text">{field.name}</td>
                  <td className="px-3 py-2 font-mono text-muted">{field.range}</td>
                  <td className="px-3 py-2 font-mono text-muted">{field.special}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">
          <span className="font-mono">*</span> any value · <span className="font-mono">,</span> list
          · <span className="font-mono">-</span> range · <span className="font-mono">/</span> step ·{" "}
          <span className="font-mono">?</span> no specific value ·{" "}
          <span className="font-mono">L</span> last day or last weekday ·{" "}
          <span className="font-mono">#</span> nth weekday.
        </p>
      </Panel>
    </ToolStack>
  );
}
