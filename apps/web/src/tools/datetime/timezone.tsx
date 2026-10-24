import { useEffect, useMemo, useState } from "react";
import { Globe2, Plus, RefreshCw, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  formatInZone,
  listTimeZones,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  zoneDateDifference,
} from "./logic";

const ALL_ZONES = listTimeZones();
const ZONE_OPTIONS = ALL_ZONES.map((zone) => ({ value: zone, label: zone }));

const DEFAULT_COMPARISONS = ["America/New_York", "Europe/London", "Asia/Tokyo"];

export default function TimezoneTool() {
  const [instant, setInstant] = useState("");
  const [baseZone, setBaseZone] = useState("UTC");
  const [zones, setZones] = useState<string[]>(DEFAULT_COMPARISONS);
  const [pendingZone, setPendingZone] = useState("America/Los_Angeles");

  useEffect(() => {
    const fill = window.setTimeout(() => {
      setInstant((current) => current || toDateTimeLocalValue(Date.now()));
    }, 0);
    return () => window.clearTimeout(fill);
  }, []);

  const instantMs = parseDateTimeLocalValue(instant);

  const rows = useMemo(() => {
    if (instantMs === null) return [];
    const displayed = [baseZone, ...zones.filter((zone) => zone !== baseZone)];
    return displayed.map((zone) => ({
      ...formatInZone(instantMs, zone),
      dayDifference: zoneDateDifference(instantMs, zone, baseZone),
      isBase: zone === baseZone,
    }));
  }, [baseZone, instantMs, zones]);

  function addZone() {
    if (!pendingZone || pendingZone === baseZone || zones.includes(pendingZone)) return;
    setZones((current) => [...current, pendingZone]);
  }

  return (
    <ToolStack>
      <Alert tone="info">
        Offsets come from your browser&apos;s IANA time zone database, so daylight-saving
        transitions are handled. Historical dates before 1970 may differ from local records.
      </Alert>

      <ToolGrid>
        <Panel title="Instant and zones" description="Pick a moment once, then read it everywhere.">
          <div className="space-y-4">
            <Field label="Instant (your local time)" htmlFor="instant-input">
              <Input
                id="instant-input"
                type="datetime-local"
                step="1"
                value={instant}
                onChange={(event) => setInstant(event.target.value)}
                aria-label="Instant in your local time"
              />
            </Field>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInstant(toDateTimeLocalValue(Date.now()))}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Use now
              </Button>
            </div>

            <Select
              label="Base zone"
              value={baseZone}
              onChange={setBaseZone}
              options={ZONE_OPTIONS}
            />

            <div className="space-y-2">
              <Select
                label="Compare with"
                value={pendingZone}
                onChange={setPendingZone}
                options={ZONE_OPTIONS}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={addZone}
                disabled={
                  !pendingZone || pendingZone === baseZone || zones.includes(pendingZone)
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Add zone
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Times around the world"
          description="Each row shows the same instant in a different zone."
          flush
        >
          <div className="space-y-3 p-4">
            {!instant ? (
              <EmptyState
                icon={<Globe2 className="size-8" aria-hidden />}
                title="Choose an instant"
                description="Pick a local date and time, or use the current moment."
              />
            ) : instantMs === null ? (
              <Alert tone="danger" title="Invalid date">
                Use a valid date and time.
              </Alert>
            ) : (
              rows.map((row) => (
                <div
                  key={row.zone}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold text-text">{row.time}</p>
                    <p className="text-xs text-muted">
                      {row.weekday} {row.date}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {row.zone} · {row.abbreviation}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={row.isBase ? "accent" : "neutral"}>
                        {row.isBase ? "Base" : "UTC"}
                        {row.offset}
                      </Badge>
                      {row.dayDifference !== 0 ? (
                        <Badge tone="warning">
                          {row.dayDifference > 0 ? "+" : ""}
                          {row.dayDifference} day
                        </Badge>
                      ) : null}
                    </div>
                    <CopyButton
                      value={`${row.date} ${row.time} ${row.zone} (UTC${row.offset})`}
                      size="icon"
                      label={`Copy time in ${row.zone}`}
                    />
                    {row.isBase ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.zone}`}
                        title={`Remove ${row.zone}`}
                        onClick={() =>
                          setZones((current) => current.filter((zone) => zone !== row.zone))
                        }
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
