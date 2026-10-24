import { useEffect, useMemo, useState } from "react";
import { Download, Expand, Lock, LockOpen, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  FileDrop,
  Input,
  InlineRow,
  Panel,
  Segmented,
  Select,
  Slider,
  Spinner,
  ToolGrid,
  Toggle,
} from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import { encodeImage } from "./canvas";
import {
  MAX_CANVAS_DIMENSION,
  extensionForMime,
  isLossyFormat,
  mimeForFormat,
  parseDimension,
  scaleByPercent,
  validateCanvasSize,
  withExtension,
  type ImageFormat,
} from "./logic";
import { useImageFile } from "./use-image-file";

type Mode = "pixels" | "percent";

interface Result {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  mime: string;
}

const FORMAT_OPTIONS: Array<{ value: ImageFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

const WIDTH_PRESETS = [1920, 1280, 1024, 800, 640, 320];
const PERCENT_PRESETS = [25, 50, 75, 100, 150, 200];

export default function ImageResizerTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [mode, setMode] = useState<Mode>("pixels");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [percent, setPercent] = useState(100);
  const [lock, setLock] = useState(true);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState(88);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [resizeError, setResizeError] = useState("");

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function resetOutput() {
    setResult(null);
    setResizeError("");
  }

  async function handleFiles(files: File[]) {
    resetOutput();
    const next = await load(files);
    if (next) {
      setWidth(String(next.width));
      setHeight(String(next.height));
      setPercent(100);
    }
  }

  function handleClear() {
    resetOutput();
    setWidth("");
    setHeight("");
    setPercent(100);
    clear();
  }

  const dimensions = useMemo(() => {
    if (!loaded) return null;
    if (mode === "percent") return scaleByPercent(loaded.width, loaded.height, percent);
    const nextWidth = parseDimension(width);
    const nextHeight = parseDimension(height);
    if (nextWidth === null || nextHeight === null) return null;
    return { width: nextWidth, height: nextHeight };
  }, [height, loaded, mode, percent, width]);

  const inputError = useMemo(() => {
    if (!loaded) return "";
    if (mode === "percent") {
      return dimensions ? validateCanvasSize(dimensions.width, dimensions.height) ?? "" : "";
    }
    if (parseDimension(width) === null) return "Width must be a positive whole number.";
    if (parseDimension(height) === null) return "Height must be a positive whole number.";
    if (Number(width) > MAX_CANVAS_DIMENSION || Number(height) > MAX_CANVAS_DIMENSION) {
      return `Each dimension is capped at ${MAX_CANVAS_DIMENSION} px.`;
    }
    return dimensions ? validateCanvasSize(dimensions.width, dimensions.height) ?? "" : "";
  }, [dimensions, height, loaded, mode, width]);

  const upscaling =
    loaded !== null &&
    dimensions !== null &&
    (dimensions.width > loaded.width || dimensions.height > loaded.height);

  function changeWidth(value: string) {
    resetOutput();
    setWidth(value);
    const parsed = parseDimension(value);
    if (lock && loaded && parsed !== null) {
      setHeight(String(Math.max(1, Math.round((parsed * loaded.height) / loaded.width))));
    }
  }

  function changeHeight(value: string) {
    resetOutput();
    setHeight(value);
    const parsed = parseDimension(value);
    if (lock && loaded && parsed !== null) {
      setWidth(String(Math.max(1, Math.round((parsed * loaded.width) / loaded.height))));
    }
  }

  function applyWidthPreset(preset: number) {
    resetOutput();
    setMode("pixels");
    setWidth(String(preset));
    if (loaded) {
      setHeight(String(Math.max(1, Math.round((preset * loaded.height) / loaded.width))));
    }
  }

  async function resize() {
    if (!loaded || !dimensions || inputError) return;
    setBusy(true);
    setResizeError("");
    try {
      const encoded = await encodeImage(
        loaded.image,
        dimensions.width,
        dimensions.height,
        format,
        quality / 100,
      );
      setResult({
        url: URL.createObjectURL(encoded.blob),
        blob: encoded.blob,
        width: dimensions.width,
        height: dimensions.height,
        mime: encoded.mime,
      });
    } catch (resizingError) {
      setResizeError(
        resizingError instanceof Error ? resizingError.message : "Could not resize this image.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Source"
        description="Resize by pixels or percentage. Input stays on this device."
        actions={
          file ? (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <FileDrop
            accept="image/*"
            onFiles={(files) => void handleFiles(files)}
            label={file ? "Choose another image" : "Drop an image or click to browse"}
            hint="PNG, JPEG, WebP, GIF, AVIF, or SVG · up to 50 MB"
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {loading ? <Spinner label="Decoding image" /> : null}
          {file && loaded ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-text" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-faint">
                {loaded.width} × {loaded.height} · {formatBytes(file.size)}
              </span>
            </div>
          ) : null}

          <Segmented
            label="Resize mode"
            value={mode}
            onChange={(value) => {
              setMode(value as Mode);
              resetOutput();
            }}
            options={[
              { value: "pixels", label: "Pixels" },
              { value: "percent", label: "Percentage" },
            ]}
          />

          {mode === "pixels" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Width (px)">
                  <Input
                    inputMode="numeric"
                    value={width}
                    onChange={(event) => changeWidth(event.target.value)}
                    placeholder={loaded ? String(loaded.width) : "Width"}
                    aria-label="Output width in pixels"
                  />
                </Field>
                <Field label="Height (px)">
                  <Input
                    inputMode="numeric"
                    value={height}
                    onChange={(event) => changeHeight(event.target.value)}
                    placeholder={loaded ? String(loaded.height) : "Height"}
                    aria-label="Output height in pixels"
                  />
                </Field>
              </div>
              <Toggle
                label="Lock aspect ratio"
                description="Editing one dimension updates the other."
                checked={lock}
                onChange={setLock}
              />
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted">Width presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {WIDTH_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      size="sm"
                      variant={width === String(preset) ? "primary" : "secondary"}
                      onClick={() => applyWidthPreset(preset)}
                      disabled={!loaded}
                    >
                      {preset} px
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <Slider
                label="Scale"
                min={5}
                max={400}
                step={5}
                value={percent}
                onChange={(value) => {
                  setPercent(value);
                  resetOutput();
                }}
                format={(value) => `${value}%`}
              />
              <div className="flex flex-wrap gap-1.5">
                {PERCENT_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant={percent === preset ? "primary" : "secondary"}
                    onClick={() => {
                      setPercent(preset);
                      resetOutput();
                    }}
                    disabled={!loaded}
                  >
                    {preset}%
                  </Button>
                ))}
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Output format"
              value={format}
              onChange={(value) => {
                setFormat(value as ImageFormat);
                resetOutput();
              }}
              options={FORMAT_OPTIONS}
            />
            {isLossyFormat(format) ? (
              <div className="pt-6">
                <Slider
                  label="Quality"
                  min={10}
                  max={100}
                  value={quality}
                  onChange={(value) => {
                    setQuality(value);
                    resetOutput();
                  }}
                  format={(value) => `${value}%`}
                />
              </div>
            ) : null}
          </div>

          {inputError ? <Alert tone="danger">{inputError}</Alert> : null}
          {dimensions ? (
            <div className="flex flex-wrap items-center gap-2">
              <InlineRow label="Output" className="flex-1">
                {dimensions.width} × {dimensions.height} px
              </InlineRow>
              {upscaling ? <Badge tone="warning">Upscaling</Badge> : <Badge tone="accent">Ready</Badge>}
            </div>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void resize()}
            disabled={!loaded || Boolean(inputError) || !dimensions || busy}
          >
            <Expand className="size-4" aria-hidden />
            {busy ? "Resizing…" : "Resize image"}
          </Button>
        </div>
      </Panel>

      <Panel title="Resized image" description="Download the result at its new dimensions." flush>
        <div className="space-y-3 p-4">
          {resizeError ? <Alert tone="danger">{resizeError}</Alert> : null}
          {result && file ? (
            <>
              <img
                src={result.url}
                alt="Resized preview"
                className="max-h-72 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Dimensions">
                {result.width} × {result.height} px
              </InlineRow>
              <InlineRow label="File size">{formatBytes(result.blob.size)}</InlineRow>
              {result.mime !== mimeForFormat(format).mime ? (
                <Alert tone="warning" title="Format fallback">
                  The browser encoded {result.mime} instead of {format.toUpperCase()}.
                </Alert>
              ) : null}
              <Button
                variant="primary"
                onClick={() =>
                  downloadBlob(
                    result.blob,
                    withExtension(file.name, extensionForMime(result.mime)),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                Download resized image
              </Button>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-faint">
              {lock ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
              Your resized preview appears here.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
