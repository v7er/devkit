import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import {
  Alert,
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
  IMAGE_FORMATS,
  MAX_CANVAS_DIMENSION,
  extensionForMime,
  fitToMaxEdge,
  formatSignedPercent,
  isLossyFormat,
  parseDimension,
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
  requestedMime: string;
}

export default function ImageConverterTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(88);
  const [maxEdge, setMaxEdge] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [convertError, setConvertError] = useState("");

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function resetOutput() {
    setResult(null);
    setConvertError("");
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

  async function convert() {
    if (!loaded || !dimensions || inputError) return;
    setBusy(true);
    setConvertError("");
    try {
      const encoded = await encodeImage(
        loaded.image,
        dimensions.width,
        dimensions.height,
        format,
        quality / 100,
      );
      const url = URL.createObjectURL(encoded.blob);
      setResult({
        url,
        blob: encoded.blob,
        width: dimensions.width,
        height: dimensions.height,
        mime: encoded.mime,
        requestedMime: encoded.requestedMime,
      });
    } catch (conversionError) {
      setConvertError(
        conversionError instanceof Error ? conversionError.message : "Could not convert this image.",
      );
    } finally {
      setBusy(false);
    }
  }

  const fallback = result !== null && result.mime !== result.requestedMime;

  return (
    <ToolGrid>
      <Panel
        title="Source image"
        description="Read locally with a Canvas. Nothing is uploaded."
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
                className="max-h-52 w-full rounded-lg border border-line object-contain"
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
              options={IMAGE_FORMATS}
            />
            <Field
              label="Maximum edge (optional)"
              hint="Leave blank to keep the original dimensions."
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
            <p className="text-xs text-faint">PNG is lossless, so quality does not apply.</p>
          )}
          {dimensions ? (
            <InlineRow label="Output dimensions">
              {dimensions.width} × {dimensions.height} px
            </InlineRow>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void convert()}
            disabled={!loaded || Boolean(inputError) || busy}
          >
            <RefreshCw className="size-4" aria-hidden />
            {busy ? "Converting…" : "Convert image"}
          </Button>
        </div>
      </Panel>

      <Panel title="Converted image" description="Preview and download the result." flush>
        <div className="space-y-3 p-4">
          {convertError ? <Alert tone="danger">{convertError}</Alert> : null}
          {fallback && result ? (
            <Alert tone="warning" title="Format fallback">
              You selected {format.toUpperCase()}, but the browser encoded{" "}
              {extensionForMime(result.mime).toUpperCase()} instead.
            </Alert>
          ) : null}
          {result ? (
            <>
              <img
                src={result.url}
                alt="Converted preview"
                className="max-h-72 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Dimensions">
                {result.width} × {result.height} px
              </InlineRow>
              <InlineRow label="File size">
                {formatBytes(result.blob.size)}
                {file
                  ? ` (${formatSignedPercent(
                      ((file.size - result.blob.size) / Math.max(1, file.size)) * 100,
                    )})`
                  : ""}
              </InlineRow>
              <InlineRow label="MIME type">{result.mime}</InlineRow>
              <Button
                variant="primary"
                onClick={() =>
                  downloadBlob(
                    result.blob,
                    withExtension(
                      file?.name ?? "image",
                      extensionForMime(result.mime),
                    ),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                Download
              </Button>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-faint">
              Choose a format and convert to see the result.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
