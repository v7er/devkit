import { useEffect, useRef, useState } from "react";
import { Flag, Pause, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Segmented,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatDurationHuman, parseDuration } from "./logic";

type Mode = "stopwatch" | "countdown";

const MODES: Array<{ value: Mode; label: string }> = [
  { value: "stopwatch", label: "Stopwatch" },
  { value: "countdown", label: "Countdown" },
];

const COUNTDOWN_SAMPLES = ["5m", "90s", "1h 30m", "PT10M"];

function formatClock(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      setElapsed(accumulatedRef.current + (performance.now() - startedAtRef.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  function start() {
    startedAtRef.current = performance.now();
    setRunning(true);
  }

  function pause() {
    const current = accumulatedRef.current + (performance.now() - startedAtRef.current);
    accumulatedRef.current = current;
    setElapsed(current);
    setRunning(false);
  }

  function reset() {
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    setElapsed(0);
    setLaps([]);
    setRunning(false);
  }

  function lap() {
    const current = running
      ? accumulatedRef.current + (performance.now() - startedAtRef.current)
      : accumulatedRef.current;
    setLaps((previous) => [...previous, current]);
  }

  const canLap = elapsed > 0;

  return (
    <ToolGrid>
      <Panel title="Stopwatch" description="Elapsed time is measured with a monotonic clock.">
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5 text-center">
            <p className="font-mono text-3xl tabular-nums text-text" aria-live="off">
              {formatClock(elapsed)}
            </p>
            <p className="mt-1 text-xs text-faint">hours : minutes : seconds . milliseconds</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="primary" onClick={pause}>
                <Pause className="size-4" aria-hidden />
                Pause
              </Button>
            ) : (
              <Button variant="primary" onClick={start}>
                <Play className="size-4" aria-hidden />
                {elapsed > 0 ? "Resume" : "Start"}
              </Button>
            )}
            <Button variant="secondary" onClick={lap} disabled={!canLap}>
              <Flag className="size-4" aria-hidden />
              Lap
            </Button>
            <Button variant="ghost" onClick={reset} disabled={elapsed === 0 && laps.length === 0}>
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Laps" description={`${laps.length} recorded`}>
        {laps.length === 0 ? (
          <EmptyState
            icon={<Flag className="size-5" aria-hidden />}
            title="No laps yet"
            description="Start the stopwatch and record a lap to see splits."
          />
        ) : (
          <ol className="space-y-2">
            {laps.map((total, index) => {
              const previous = index === 0 ? 0 : laps[index - 1];
              return (
                <li
                  key={`${index}-${total}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge>{index + 1}</Badge>
                    <span className="text-muted">Split</span>
                    <span className="font-mono text-text">{formatClock(total - previous)}</span>
                  </div>
                  <span className="font-mono text-xs text-muted">{formatClock(total)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </ToolGrid>
  );
}

function Countdown() {
  const [input, setInput] = useState("5m");
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const left = deadlineRef.current - performance.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        setFinished(true);
        return;
      }
      setRemaining(left);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  function start() {
    if (remaining > 0 && !finished) {
      deadlineRef.current = performance.now() + remaining;
      setRunning(true);
      return;
    }

    try {
      const milliseconds = parseDuration(input);
      if (milliseconds <= 0) throw new Error("Enter a duration greater than zero.");
      setDuration(milliseconds);
      setRemaining(milliseconds);
      setFinished(false);
      setError("");
      deadlineRef.current = performance.now() + milliseconds;
      setRunning(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that duration");
    }
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setRemaining(0);
    setDuration(0);
    setFinished(false);
    setError("");
  }

  const progress = duration > 0 ? Math.min(100, Math.max(0, (remaining / duration) * 100)) : 0;

  return (
    <ToolGrid>
      <Panel title="Countdown" description="Accepts 2h 30m, 90s, 1.5 days, or ISO 8601 durations.">
        <div className="space-y-4">
          <Field label="Duration" htmlFor="countdown-input" error={error || undefined}>
            <Input
              id="countdown-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={running}
              placeholder="5m"
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {COUNTDOWN_SAMPLES.map((sample) => (
              <Button
                key={sample}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setInput(sample);
                  setError("");
                }}
                disabled={running}
              >
                {sample}
              </Button>
            ))}
          </div>

          <div className="rounded-lg border border-line bg-surface p-5 text-center">
            <p className="font-mono text-3xl tabular-nums text-text" aria-live="off">
              {formatClock(remaining)}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="primary" onClick={pause}>
                <Pause className="size-4" aria-hidden />
                Pause
              </Button>
            ) : (
              <Button variant="primary" onClick={start}>
                <Play className="size-4" aria-hidden />
                {remaining > 0 && !finished ? "Resume" : "Start"}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={reset}
              disabled={remaining === 0 && duration === 0 && !finished}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </Button>
          </div>

          {duration > 0 ? (
            <p className="text-xs text-faint">Total: {formatDurationHuman(duration)}</p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Status" description="The countdown keeps wall-clock accuracy while paused.">
        <div className="space-y-3">
          {finished ? (
            <Alert tone="success" title="Countdown finished">
              The timer reached zero. Reset to run another countdown.
            </Alert>
          ) : running ? (
            <Alert tone="info" title="Running">
              {formatClock(remaining)} left of {formatDurationHuman(duration)}.
            </Alert>
          ) : remaining > 0 ? (
            <Alert tone="warning" title="Paused">
              Press Resume to continue from {formatClock(remaining)}.
            </Alert>
          ) : (
            <Alert tone="info" title="Ready">
              Enter a duration and press Start.
            </Alert>
          )}

          <div className="flex items-center gap-2 text-xs text-muted">
            <TimerIcon className="size-4" aria-hidden />
            Timing uses <code className="font-mono">performance.now()</code>, so system clock
            changes do not affect it.
          </div>
        </div>
      </Panel>
    </ToolGrid>
  );
}

export default function TimerTool() {
  const [mode, setMode] = useState<Mode>("stopwatch");

  return (
    <ToolStack>
      <Segmented label="Timer" value={mode} onChange={setMode} options={MODES} />
      {mode === "stopwatch" ? <Stopwatch /> : <Countdown />}
    </ToolStack>
  );
}
