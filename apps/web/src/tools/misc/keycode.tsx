import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Keyboard } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  InlineRow,
  Kbd,
  Panel,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import { describeKeyLocation, formatModifiers } from "./logic";

const MAX_EVENTS = 50;
const SCROLL_KEYS = new Set([
  " ",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

interface KeyEventRecord {
  id: string;
  type: "keydown" | "keyup";
  key: string;
  code: string;
  keyCode: number;
  location: string;
  modifiers: string;
  repeat: boolean;
  time: string;
}

function nextEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function displayKey(key: string): string {
  if (key === " ") return "Space (U+0020)";
  if (key === "\n") return "Line feed";
  return key;
}

export default function KeycodeTool() {
  const [events, setEvents] = useState<KeyEventRecord[]>([]);
  const [paused, setPaused] = useState(false);

  const latest = events[0];

  function capture(type: "keydown" | "keyup") {
    return (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (paused) return;
      if (SCROLL_KEYS.has(event.key)) event.preventDefault();

      const record: KeyEventRecord = {
        id: nextEventId(),
        type,
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        location: describeKeyLocation(event.location),
        modifiers: formatModifiers({
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
        }),
        repeat: event.repeat,
        time: new Date().toLocaleTimeString(),
      };
      setEvents((current) => [record, ...current].slice(0, MAX_EVENTS));
    };
  }

  return (
    <ToolGrid>
      <Panel
        title="Capture"
        description="Click the area, then press any key. Both keydown and keyup are recorded."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEvents([]);
              setPaused(false);
            }}
            disabled={events.length === 0 && !paused}
          >
            Clear
          </Button>
        }
      >
        <div className="space-y-3">
          <div
            role="application"
            tabIndex={0}
            aria-label="Keyboard capture area"
            onKeyDown={capture("keydown")}
            onKeyUp={capture("keyup")}
            className="flex cursor-text flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-8 text-center transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <Keyboard className="size-6 text-faint" aria-hidden />
            <p className="text-sm font-medium text-text">
              {paused ? "Capture is paused" : "Press a key to inspect it"}
            </p>
            <p className="text-xs text-faint">
              Tab is recorded but also moves focus. Use Shift+Tab to return here.
            </p>
          </div>

          <Toggle
            checked={paused}
            onChange={setPaused}
            label="Pause capture"
            description="Keys pressed while paused are ignored."
          />

          <div className="flex items-center justify-between gap-3 text-xs text-faint">
            <span>
              {events.length} of {MAX_EVENTS} events kept
            </span>
            <Badge tone={paused ? "warning" : "accent"}>{paused ? "Paused" : "Listening"}</Badge>
          </div>

          <Alert tone="info" title="Prefer key and code">
            <span className="font-mono">key</span> reflects the typed character and layout;{" "}
            <span className="font-mono">code</span> is the physical key position.{" "}
            <span className="font-mono">keyCode</span> is deprecated and varies between platforms.
          </Alert>
        </div>
      </Panel>

      <Panel title="Latest event" description="The most recent keydown or keyup.">
        {latest ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Kbd>{displayKey(latest.key)}</Kbd>
              <Badge tone={latest.type === "keydown" ? "accent" : "neutral"}>{latest.type}</Badge>
              {latest.repeat ? <Badge tone="warning">repeat</Badge> : null}
            </div>
            <InlineRow label="key">{displayKey(latest.key)}</InlineRow>
            <InlineRow label="code">{latest.code || "—"}</InlineRow>
            <InlineRow label="keyCode">{latest.keyCode}</InlineRow>
            <InlineRow label="Location">{latest.location}</InlineRow>
            <InlineRow label="Modifiers">{latest.modifiers}</InlineRow>
            <InlineRow label="Repeat">{latest.repeat ? "Yes" : "No"}</InlineRow>
            <InlineRow label="Captured at">{latest.time}</InlineRow>
          </div>
        ) : (
          <EmptyState
            icon={<Keyboard className="size-5" aria-hidden />}
            title="No keys captured yet"
            description="Focus the capture area on the left and press a key."
          />
        )}
      </Panel>

      <Panel
        title="Event log"
        description="Newest first. Keydown and keyup appear as separate rows."
        className="lg:col-span-2"
        bodyClassName="p-0"
        actions={<Badge>{events.length} events</Badge>}
      >
        {events.length === 0 ? (
          <EmptyState
            title="The log is empty"
            description="Captured key events will appear here with their modifiers and location."
          />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-2 text-faint">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Event</th>
                  <th scope="col" className="px-3 py-2 font-semibold">key</th>
                  <th scope="col" className="px-3 py-2 font-semibold">code</th>
                  <th scope="col" className="px-3 py-2 font-semibold">keyCode</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Location</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Modifiers</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Repeat</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-line/70 hover:bg-surface-2/60">
                    <td className="px-3 py-1.5 text-muted">{event.type}</td>
                    <td className="px-3 py-1.5 font-mono text-text">{displayKey(event.key)}</td>
                    <td className="px-3 py-1.5 font-mono text-muted">{event.code || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-muted">{event.keyCode}</td>
                    <td className="px-3 py-1.5 text-muted">{event.location}</td>
                    <td className="px-3 py-1.5 text-muted">{event.modifiers}</td>
                    <td className="px-3 py-1.5 text-muted">{event.repeat ? "Yes" : "No"}</td>
                    <td className="px-3 py-1.5 font-mono text-faint">{event.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </ToolGrid>
  );
}
