import { useEffect, useMemo, useState } from "react";
import { Download, Gauge, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  FileDrop,
  Input,
  InlineRow,
  Panel,
  Select,
  Slider,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import { encodeImage } from "./canvas";
import {
  MAX_CANVAS_DIMENSION,
  extensionForMime,
  fitToMaxEdge,
  isLossyFormat,
  parseDimension,
  savingsPercent,
  validateCanvasSize,
  withExtension,
  type ImageFormat,
} from "./logic";
import { useImageFile } from "./use-image-file";

interface Result {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  mime: string;
}

const FORMAT_OPTIONS: Array<{ value: ImageFormat; label: string }> = [
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export default function ImageCompressorTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(75);
  const [maxEdge, setMaxEdge] = useState("1920");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [compressError, setCompressError] = useState("");

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function resetOutput() {
    setResult(null);
    setCompressError("");
  }

  async function handleFiles(files: File[]) {
    resetOutput();
    await load(files);
  }

  function handleClear() {
    resetOutput();
    clear();
  }

  const dimensions = useMemo(() => {
    if (!loaded) return null;
    if (!maxEdge.trim()) return { width: loaded.width, height: loaded.height };
    const edge = parseDimension(maxEdge);
    if (edge === null || edge > MAX_CANVAS_DIMENSION) return null;
    return fitToMaxEdge(loaded.width, loaded.height, edge);
  }, [loaded, maxEdge]);

  const inputError = useMemo(() => {
    if (!maxEdge.trim()) return "";
    if (parseDimension(maxEdge) === null) return "Enter a positive whole number of pixels.";
    if (Number(maxEdge) > MAX_CANVAS_DIMENSION) {
      return `The maximum edge is capped at ${MAX_CANVAS_DIMENSION} px.`;
    }
    return dimensions ? validateCanvasSize(dimensions.width, dimensions.height) ?? "" : "";
  }, [dimensions, maxEdge]);

  async function compress() {
    if (!loaded || !dimensions || inputError) return;
    setBusy(true);
    setCompressError("");
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
    } catch (compressionError) {
      setCompressError(
        compressionError instanceof Error ? compressionError.message : "Could not compress this image.",
      );
    } finally {
      setBusy(false);
    }
  }

  const savings = result && file ? savingsPercent(file.size, result.blob.size) : 0;

  return (
    <ToolGrid>
      <Panel
        title="Source"
        description="Compression happens on your machine using Canvas."
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
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-text" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-faint">{formatBytes(file.size)}</span>
              </div>
              <img
                src={loaded.image.src}
                alt="Source preview"
                className="max-h-48 w-full rounded-lg border border-line object-contain"
              />
              <InlineRow label="Source dimensions">
                {loaded.width} × {loaded.height} px
              </InlineRow>
            </>
          ) : null}

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
            <Field
              label="Maximum edge"
              hint="Blank keeps the original size; images are never enlarged."
              error={inputError || undefined}
            >
              <Input
                inputMode="numeric"
                value={maxEdge}
                onChange={(event) => {
                  setMaxEdge(event.target.value);
                  resetOutput();
                }}
                placeholder={loaded ? String(Math.max(loaded.width, loaded.height)) : "Original"}
                aria-label="Maximum output edge in pixels"
              />
            </Field>
          </div>
          {isLossyFormat(format) ? (
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
          ) : (
            <Alert tone="info">
              PNG is lossless. Compression only comes from reducing the dimensions.
            </Alert>
          )}
          {dimensions ? (
            <InlineRow label="Output dimensions">
              {dimensions.width} × {dimensions.height} px
            </InlineRow>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void compress()}
            disabled={!loaded || Boolean(inputError) || busy}
          >
            <Gauge className="size-4" aria-hidden />
            {busy ? "Compressing…" : "Compress image"}
          </Button>
        </div>
      </Panel>

      <Panel title="Result" description="Compare the sizes before downloading." flush>
        <div className="space-y-3 p-4">
          {compressError ? <Alert tone="danger">{compressError}</Alert> : null}
          {result && file ? (
            <>
              <img
                src={result.url}
                alt="Compressed preview"
                className="max-h-64 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] uppercase tracking-wider text-faint">Before</p>
                  <p className="mt-1 font-mono text-sm text-text">{formatBytes(file.size)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] uppercase tracking-wider text-faint">After</p>
                  <p className="mt-1 font-mono text-sm text-text">{formatBytes(result.blob.size)}</p>
                </div>
              </div>
              <InlineRow label="Savings">
                {savings >= 0 ? `${savings.toFixed(1)}% smaller` : `${Math.abs(savings).toFixed(1)}% larger`}
              </InlineRow>
              <InlineRow label="Dimensions">
                {result.width} × {result.height} px
              </InlineRow>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={savings >= 0 ? "accent" : "warning"}>
                  {savings >= 0 ? "Smaller" : "Larger than source"}
                </Badge>
                <Badge>{result.mime}</Badge>
              </div>
              {savings < 0 ? (
                <Alert tone="warning" title="The result is larger">
                  Re-encoding cannot always beat the original. Keep the source file or lower the
                  quality and dimensions.
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
                Download compressed image
              </Button>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-faint">
              Pick a quality and maximum edge, then compress.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
