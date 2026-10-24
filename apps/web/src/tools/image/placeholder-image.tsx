import { useEffect, useMemo, useState } from "react";
import { Download, ImageDown, Square } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  InlineRow,
  Panel,
  Select,
  Slider,
  ToolGrid,
} from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import { canvasToBlob, renderPlaceholder } from "./canvas";
import {
  MAX_CANVAS_DIMENSION,
  extensionForMime,
  isLossyFormat,
  mimeForFormat,
  parseDimension,
  placeholderFontSize,
  validateCanvasSize,
  withExtension,
  type ImageFormat,
} from "./logic";

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

const SIZE_PRESETS = [
  { label: "1200 × 630", width: 1200, height: 630 },
  { label: "1080 × 1080", width: 1080, height: 1080 },
  { label: "1920 × 1080", width: 1920, height: 1080 },
  { label: "800 × 600", width: 800, height: 600 },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export default function PlaceholderImageTool() {
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("630");
  const [background, setBackground] = useState("#1e293b");
  const [textColor, setTextColor] = useState("#f8fafc");
  const [label, setLabel] = useState("1200 × 630");
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const dimensions = useMemo(() => {
    const nextWidth = parseDimension(width);
    const nextHeight = parseDimension(height);
    if (nextWidth === null || nextHeight === null) return null;
    return { width: nextWidth, height: nextHeight };
  }, [height, width]);

  const inputError = useMemo(() => {
    if (parseDimension(width) === null) return "Width must be a positive whole number.";
    if (parseDimension(height) === null) return "Height must be a positive whole number.";
    if (Number(width) > MAX_CANVAS_DIMENSION || Number(height) > MAX_CANVAS_DIMENSION) {
      return `Each dimension is capped at ${MAX_CANVAS_DIMENSION} px.`;
    }
    if (!HEX_COLOR.test(background)) return "Background must be a hex color such as #1e293b.";
    if (!HEX_COLOR.test(textColor)) return "Text color must be a hex color such as #f8fafc.";
    return dimensions ? validateCanvasSize(dimensions.width, dimensions.height) ?? "" : "";
  }, [background, dimensions, height, textColor, width]);

  const fontSize = useMemo(() => {
    if (!dimensions) return null;
    return placeholderFontSize(dimensions.width, dimensions.height, label.length);
  }, [dimensions, label]);

  function applyPreset(preset: (typeof SIZE_PRESETS)[number]) {
    setWidth(String(preset.width));
    setHeight(String(preset.height));
    if (label === `${width} × ${height}`) setLabel(preset.label);
  }

  async function generate() {
    if (!dimensions || inputError) return;
    setBusy(true);
    setError("");
    let next: Result | null = null;
    try {
      const canvas = renderPlaceholder(
        dimensions.width,
        dimensions.height,
        background,
        textColor,
        label,
      );
      const requested = mimeForFormat(format);
      const blob = await canvasToBlob(
        canvas,
        requested.mime,
        isLossyFormat(format) ? quality / 100 : undefined,
      );
      next = {
        url: URL.createObjectURL(blob),
        blob,
        width: dimensions.width,
        height: dimensions.height,
        mime: blob.type || requested.mime,
      };
      setResult(next);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Could not render this placeholder.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Placeholder"
        description="Render a flat label image on a canvas. No network requests."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setResult(null);
              setError("");
            }}
            disabled={!result && !error}
          >
            Reset output
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (px)">
              <Input
                inputMode="numeric"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
                aria-label="Placeholder width in pixels"
              />
            </Field>
            <Field label="Height (px)">
              <Input
                inputMode="numeric"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                aria-label="Placeholder height in pixels"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SIZE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant={
                  width === String(preset.width) && height === String(preset.height)
                    ? "primary"
                    : "secondary"
                }
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Background color">
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                  aria-label="Background color picker"
                  className="w-14 shrink-0 px-1 py-1"
                />
                <Input
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                  aria-label="Background hex color"
                  spellCheck={false}
                />
              </div>
            </Field>
            <Field label="Text color">
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                  aria-label="Text color picker"
                  className="w-14 shrink-0 px-1 py-1"
                />
                <Input
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                  aria-label="Text hex color"
                  spellCheck={false}
                />
              </div>
            </Field>
          </div>

          <Field label="Label" hint="Leave blank for a plain color block.">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Image coming soon"
              aria-label="Placeholder label"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Output format"
              value={format}
              onChange={(value) => setFormat(value as ImageFormat)}
              options={FORMAT_OPTIONS}
            />
            {isLossyFormat(format) ? (
              <Slider
                label="Quality"
                min={10}
                max={100}
                value={quality}
                onChange={setQuality}
                format={(value) => `${value}%`}
              />
            ) : (
              <p className="self-end pb-2 text-xs text-faint">PNG is lossless.</p>
            )}
          </div>

          {inputError ? <Alert tone="danger">{inputError}</Alert> : null}
          {dimensions && !inputError ? (
            <div className="flex flex-wrap items-center gap-2">
              <InlineRow label="Preview size" className="flex-1">
                {dimensions.width} × {dimensions.height} px
              </InlineRow>
              {fontSize ? <Badge>{fontSize} px label</Badge> : null}
            </div>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void generate()}
            disabled={Boolean(inputError) || !dimensions || busy}
          >
            <Square className="size-4" aria-hidden />
            {busy ? "Rendering…" : "Generate placeholder"}
          </Button>
        </div>
      </Panel>

      <Panel title="Generated image" description="Download the rendered file." flush>
        <div className="space-y-3 p-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {result ? (
            <>
              <img
                src={result.url}
                alt="Generated placeholder preview"
                className="max-h-72 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Dimensions">
                {result.width} × {result.height} px
              </InlineRow>
              <InlineRow label="File size">{formatBytes(result.blob.size)}</InlineRow>
              <InlineRow label="MIME type">{result.mime}</InlineRow>
              <Button
                variant="primary"
                onClick={() =>
                  downloadBlob(
                    result.blob,
                    withExtension("placeholder", extensionForMime(result.mime)),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                Download image
              </Button>
            </>
          ) : (
            <p className="flex flex-col items-center gap-2 py-10 text-center text-sm text-faint">
              <ImageDown className="size-5" aria-hidden />
              Set a size and label, then generate to see the result.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
