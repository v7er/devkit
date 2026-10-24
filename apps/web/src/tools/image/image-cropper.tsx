import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Crop, Download, X } from "lucide-react";
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
import { cropImage } from "./canvas";
import {
  centerCrop,
  cropFromDrag,
  cropFromPixels,
  cropPixels,
  extensionForMime,
  fileBaseName,
  isLossyFormat,
  validateCanvasSize,
  withExtension,
  type CropArea,
  type ImageFormat,
} from "./logic";
import { useImageFile } from "./use-image-file";

const PREVIEW_MAX_WIDTH = 680;
const PREVIEW_MAX_HEIGHT = 460;

const ASPECT_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
];

const FORMAT_OPTIONS: Array<{ value: ImageFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

interface Fields {
  x: string;
  y: string;
  width: string;
  height: string;
}

interface Result {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  mime: string;
}

function aspectValue(value: string): number | null {
  if (value === "free") return null;
  const [width, height] = value.split(":").map(Number);
  return width / height;
}

export default function ImageCropperTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 1, height: 1 });
  const [aspect, setAspect] = useState("free");
  const [fields, setFields] = useState<Fields>({ x: "0", y: "0", width: "", height: "" });
  const [fieldError, setFieldError] = useState("");
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [cropError, setCropError] = useState("");
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const view = useMemo(() => {
    if (!loaded) return null;
    const scale = Math.min(
      1,
      PREVIEW_MAX_WIDTH / loaded.width,
      PREVIEW_MAX_HEIGHT / loaded.height,
    );
    return {
      width: Math.max(1, Math.round(loaded.width * scale)),
      height: Math.max(1, Math.round(loaded.height * scale)),
    };
  }, [loaded]);

  const pixelRect = useMemo(() => {
    if (!loaded) return null;
    try {
      return cropPixels(crop, loaded.width, loaded.height);
    } catch {
      return null;
    }
  }, [crop, loaded]);

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function resetOutput() {
    setResult(null);
    setCropError("");
  }

  function commitCrop(next: CropArea) {
    setCrop(next);
    resetOutput();
    if (!loaded) return;
    try {
      const pixels = cropPixels(next, loaded.width, loaded.height);
      setFields({
        x: String(pixels.x),
        y: String(pixels.y),
        width: String(pixels.width),
        height: String(pixels.height),
      });
    } catch {
      setFields((current) => ({ ...current, width: "", height: "" }));
    }
  }

  async function handleFiles(files: File[]) {
    dragStart.current = null;
    resetOutput();
    setFieldError("");
    const next = await load(files);
    if (next) {
      setCrop({ x: 0, y: 0, width: 1, height: 1 });
      setFields({
        x: "0",
        y: "0",
        width: String(next.width),
        height: String(next.height),
      });
    }
  }

  function handleClear() {
    dragStart.current = null;
    resetOutput();
    setFieldError("");
    setFields({ x: "0", y: "0", width: "", height: "" });
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    clear();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded || !view) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, view.width, view.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.image, 0, 0, view.width, view.height);

    const x = crop.x * view.width;
    const y = crop.y * view.height;
    const width = crop.width * view.width;
    const height = crop.height * view.height;
    context.fillStyle = "rgba(15, 23, 42, 0.55)";
    context.fillRect(0, 0, view.width, y);
    context.fillRect(0, y + height, view.width, view.height - y - height);
    context.fillRect(0, y, x, height);
    context.fillRect(x + width, y, view.width - x - width, height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2));
    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 1;
    for (let step = 1; step < 3; step += 1) {
      const thirdX = x + (width * step) / 3;
      const thirdY = y + (height * step) / 3;
      context.beginPath();
      context.moveTo(thirdX, y);
      context.lineTo(thirdX, y + height);
      context.moveTo(x, thirdY);
      context.lineTo(x + width, thirdY);
      context.stroke();
    }
  }, [crop, loaded, view]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!loaded) return;
    const start = pointFromEvent(event);
    dragStart.current = start;
    event.currentTarget.setPointerCapture(event.pointerId);
    commitCrop(cropFromDrag(start, start, aspectValue(aspect)));
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragStart.current) return;
    commitCrop(cropFromDrag(dragStart.current, pointFromEvent(event), aspectValue(aspect)));
  }

  function handlePointerEnd() {
    dragStart.current = null;
  }

  function changeAspect(value: string) {
    setAspect(value);
    setFieldError("");
    commitCrop(centerCrop(aspectValue(value)));
  }

  function applyFields(next: Fields) {
    setFields(next);
    if (!loaded) return;
    const x = Number(next.x);
    const y = Number(next.y);
    const width = Number(next.width);
    const height = Number(next.height);
    if (![x, y, width, height].every((value) => Number.isFinite(value))) {
      setFieldError("Enter whole numbers for the crop rectangle.");
      return;
    }
    try {
      commitCrop(cropFromPixels({ x, y, width, height }, loaded.width, loaded.height));
      setFieldError("");
    } catch (fieldFailure) {
      setFieldError(fieldFailure instanceof Error ? fieldFailure.message : "This crop is invalid.");
    }
  }

  async function exportCrop() {
    if (!loaded || !pixelRect || fieldError) return;
    const sizeError = validateCanvasSize(pixelRect.width, pixelRect.height);
    if (sizeError) {
      setCropError(sizeError);
      return;
    }
    setBusy(true);
    setCropError("");
    try {
      const encoded = await cropImage(loaded.image, pixelRect, format, quality / 100);
      setResult({
        url: URL.createObjectURL(encoded.blob),
        blob: encoded.blob,
        width: pixelRect.width,
        height: pixelRect.height,
        mime: encoded.mime,
      });
    } catch (failure) {
      setCropError(failure instanceof Error ? failure.message : "Could not crop this image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Crop area"
        description="Drag a rectangle on the image, or type exact pixel values."
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
          {file && loaded && view ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-text" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-faint">
                  {loaded.width} × {loaded.height} · {formatBytes(file.size)}
                </span>
              </div>
              <div className="flex justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
                <canvas
                  ref={canvasRef}
                  width={view.width}
                  height={view.height}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  className="max-w-full cursor-crosshair touch-none"
                  role="img"
                  aria-label="Crop preview. Drag to select a crop rectangle or use the numeric fields."
                />
              </div>
              <Select
                label="Aspect ratio"
                value={aspect}
                onChange={changeAspect}
                options={ASPECT_OPTIONS}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="X (px)">
                  <Input
                    inputMode="numeric"
                    value={fields.x}
                    onChange={(event) => applyFields({ ...fields, x: event.target.value })}
                    aria-label="Crop left offset in pixels"
                  />
                </Field>
                <Field label="Y (px)">
                  <Input
                    inputMode="numeric"
                    value={fields.y}
                    onChange={(event) => applyFields({ ...fields, y: event.target.value })}
                    aria-label="Crop top offset in pixels"
                  />
                </Field>
                <Field label="Width (px)">
                  <Input
                    inputMode="numeric"
                    value={fields.width}
                    onChange={(event) => applyFields({ ...fields, width: event.target.value })}
                    aria-label="Crop width in pixels"
                  />
                </Field>
                <Field label="Height (px)">
                  <Input
                    inputMode="numeric"
                    value={fields.height}
                    onChange={(event) => applyFields({ ...fields, height: event.target.value })}
                    aria-label="Crop height in pixels"
                  />
                </Field>
              </div>
              {fieldError ? <Alert tone="danger">{fieldError}</Alert> : null}
            </>
          ) : null}
        </div>
      </Panel>

      <Panel title="Export crop" description="Only the selected rectangle is exported." flush>
        <div className="space-y-3 p-4">
          {pixelRect ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["X", pixelRect.x],
                ["Y", pixelRect.y],
                ["Width", pixelRect.width],
                ["Height", pixelRect.height],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] uppercase tracking-wider text-faint">{label}</p>
                  <p className="mt-1 font-mono text-sm text-text">{value} px</p>
                </div>
              ))}
            </div>
          ) : (
            <Alert tone="warning">Select a crop area with a width and height greater than zero.</Alert>
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
          {cropError ? <Alert tone="danger">{cropError}</Alert> : null}
          <Button
            variant="primary"
            onClick={() => void exportCrop()}
            disabled={!loaded || !pixelRect || Boolean(fieldError) || busy}
          >
            <Crop className="size-4" aria-hidden />
            {busy ? "Cropping…" : "Crop image"}
          </Button>

          {result && file ? (
            <>
              <img
                src={result.url}
                alt="Cropped preview"
                className="max-h-64 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Crop size">
                {result.width} × {result.height} px
              </InlineRow>
              <InlineRow label="File size">{formatBytes(result.blob.size)}</InlineRow>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadBlob(
                    result.blob,
                    withExtension(
                      `${fileBaseName(file.name)}-crop`,
                      extensionForMime(result.mime),
                    ),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                Download cropped image
              </Button>
            </>
          ) : null}
        </div>
      </Panel>
    </ToolGrid>
  );
}
