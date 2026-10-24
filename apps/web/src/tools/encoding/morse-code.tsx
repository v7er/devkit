import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Square, Volume2 } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Panel,
  Segmented,
  Slider,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  morseTimeline,
  morseToText,
  morseUnitMs,
  textToMorse,
  type MorseSegment,
} from "./logic";

type Mode = "encode" | "decode";

interface Playback {
  context: AudioContext;
  oscillator: OscillatorNode;
  timer: number;
}

const TONE_FREQUENCY = 620;

export default function MorseCodeTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [wpm, setWpm] = useState(20);
  const [input, setInput] = useState("SOS help");
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const playbackRef = useRef<Playback | null>(null);

  const result = useMemo(() => {
    try {
      const value = mode === "encode" ? textToMorse(input) : morseToText(input);
      return { value, morse: mode === "encode" ? value : input.trim(), error: "" };
    } catch (error) {
      return {
        value: "",
        morse: "",
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [input, mode]);

  const disposePlayback = useCallback(() => {
    const playback = playbackRef.current;
    if (!playback) return;
    playbackRef.current = null;
    window.clearTimeout(playback.timer);
    try {
      playback.oscillator.stop();
    } catch {
      // The oscillator may already have stopped.
    }
    void playback.context.close().catch(() => undefined);
  }, []);

  const stopPlayback = useCallback(() => {
    disposePlayback();
    setPlaying(false);
  }, [disposePlayback]);

  useEffect(() => disposePlayback, [disposePlayback]);

  function togglePlayback() {
    if (playing) {
      stopPlayback();
      return;
    }
    setAudioError("");
    if (!result.morse) return;

    let timeline: MorseSegment[];
    try {
      timeline = morseTimeline(result.morse, wpm);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Could not build the tones.");
      return;
    }
    if (timeline.length === 0) return;
    if (typeof window.AudioContext !== "function") {
      setAudioError("Web Audio is not available in this browser.");
      return;
    }

    stopPlayback();
    let context: AudioContext;
    try {
      context = new window.AudioContext();
    } catch {
      setAudioError("Could not start audio playback.");
      return;
    }
    void context.resume().catch(() => undefined);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = TONE_FREQUENCY;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    const startAt = context.currentTime + 0.08;
    for (const segment of timeline) {
      if (!segment.tone) continue;
      const start = startAt + segment.startMs / 1000;
      const end = start + segment.durationMs / 1000;
      const ramp = Math.min(0.005, segment.durationMs / 4000);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + ramp);
      gain.gain.setValueAtTime(0.2, Math.max(start + ramp, end - ramp));
      gain.gain.linearRampToValueAtTime(0, end);
    }

    const last = timeline[timeline.length - 1];
    const totalMs = last.startMs + last.durationMs + 120;
    const timer = window.setTimeout(() => stopPlayback(), totalMs);
    playbackRef.current = { context, oscillator, timer };
    setPlaying(true);
  }

  const unit = Math.round(morseUnitMs(wpm));

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={(next) => {
            stopPlayback();
            setMode(next);
          }}
          options={[
            { value: "encode", label: "Text to Morse" },
            { value: "decode", label: "Morse to text" },
          ]}
        />
        <div className="w-48">
          <Slider
            label="Speed"
            min={5}
            max={45}
            value={wpm}
            onChange={(next) => {
              stopPlayback();
              setWpm(next);
            }}
            format={(value) => `${value} WPM`}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!result.error) setInput(result.value);
            stopPlayback();
            setMode((current) => (current === "encode" ? "decode" : "encode"));
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
        <Button
          variant={playing ? "danger" : "primary"}
          size="sm"
          onClick={togglePlayback}
          disabled={!result.morse || Boolean(result.error)}
        >
          {playing ? <Square className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
          {playing ? "Stop" : "Play audio"}
        </Button>
      </div>

      {audioError ? <Alert tone="danger" title="Audio error">{audioError}</Alert> : null}

      <ToolGrid>
        <Panel
          title={mode === "encode" ? "Text" : "Morse input"}
          description={
            mode === "encode"
              ? "Letters, digits, and common punctuation are supported. Words are separated with /."
              : "Separate letters with spaces and words with / or |. Decoded text is uppercase."
          }
        >
          <Field
            label={mode === "encode" ? "Text" : "Morse code"}
            hint={
              mode === "encode"
                ? "Morse is case-insensitive; decoded output is uppercase."
                : `Timing: ${unit} ms dot · ${unit * 3} ms dash · ${unit * 3} ms letter gap`
            }
          >
            <TextArea
              mono={mode === "decode"}
              rows={12}
              value={input}
              onChange={(event) => {
                stopPlayback();
                setInput(event.target.value);
              }}
              placeholder={
                mode === "encode" ? "Type text to translate…" : "Paste Morse such as ... --- ... / .... .."
              }
              aria-label={mode === "encode" ? "Text to translate to Morse" : "Morse code to translate"}
            />
          </Field>
        </Panel>

        <Panel title="Result" description={mode === "encode" ? "Morse output" : "Decoded text"}>
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "encode" ? "morse" : "text"}
              filename={mode === "encode" ? "morse.txt" : "decoded.txt"}
              placeholder={mode === "encode" ? "Morse output appears here" : "Decoded text appears here"}
              maxHeight={360}
            />
            <p className="text-xs text-faint">
              Playback uses Web Audio generated locally in your browser. No audio leaves this app.
            </p>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
