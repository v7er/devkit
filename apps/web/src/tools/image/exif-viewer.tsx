import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Eraser, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  FileDrop,
  InlineRow,
  Panel,
  Select,
  Slider,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { downloadBlob, readFileAsArrayBuffer } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import { encodeImage } from "./canvas";
import {
  MAX_IMAGE_FILE_BYTES,
  describeOrientation,
  extensionForMime,
  fileBaseName,
  isLossyFormat,
  mimeForFormat,
  parseExif,
  savingsPercent,
  withExtension,
  type ExifEntry,
  type ExifResult,
  type ImageFormat,
} from "./logic";
import { useImageFile } from "./use-image-file";

const GROUP_ORDER = ["Image", "Camera", "Dates", "Exposure", "GPS"];

const STRIP_FORMATS: Array<{ value: ImageFormat; label: string }> = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

interface StripResult {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  requestedMime: string;
}

export default function ExifViewerTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [exif, setExif] = useState<ExifResult | null>(null);
  const [readError, setReadError] = useState("");
  const [format, setFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<StripResult | null>(null);
  const [stripping, setStripping] = useState(false);
  const [stripError, setStripError] = useState("");
  const readSequence = useRef(0);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  function resetOutput() {
    setResult(null);
    setStripError("");
  }

  async function handleFiles(files: File[]) {
    const next = files[0];
    if (!next) return;
    setReadError("");
    setExif(null);
    resetOutput();
    const sequence = readSequence.current + 1;
    readSequence.current = sequence;
    void load(files);
    if (!/\.jpe?g$/i.test(next.name) && next.type !== "image/jpeg") {
      setReadError("EXIF is read from JPEG files. Choose a .jpg or .jpeg file.");
      return;
    }
    if (next.size > MAX_IMAGE_FILE_BYTES) {
      setReadError(`Choose a file under ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    try {
      const buffer = await readFileAsArrayBuffer(next);
      if (readSequence.current !== sequence) return;
      setExif(parseExif(buffer));
    } catch (failure) {
      if (readSequence.current !== sequence) return;
      setReadError(failure instanceof Error ? failure.message : "Could not read this file.");
    }
  }

  const groups = useMemo(() => {
    if (!exif) return [];
    const map = new Map<string, ExifEntry[]>();
    for (const entry of exif.entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()].sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
    );
  }, [exif]);

  async function stripMetadata() {
    if (!loaded) return;
    setStripping(true);
    setStripError("");
    try {
      const encoded = await encodeImage(
        loaded.image,
        loaded.width,
        loaded.height,
        format,
        quality / 100,
      );
      setResult({
        url: URL.createObjectURL(encoded.blob),
        blob: encoded.blob,
        width: loaded.width,
        height: loaded.height,
        mime: encoded.mime,
        requestedMime: encoded.requestedMime,
      });
    } catch (failure) {
      setStripError(
        failure instanceof Error ? failure.message : "Could not re-encode this image.",
      );
    } finally {
      setStripping(false);
    }
  }

  const savings = result && file ? savingsPercent(file.size, result.blob.size) : 0;
  const fallback = result !== null && result.mime !== result.requestedMime;

  return (
    <ToolGrid>
      <Panel
        title="JPEG source"
        description="EXIF is parsed in memory from the APP1 segment."
        actions={
          file ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetOutput();
                clear();
                setExif(null);
                setReadError("");
              }}
            >
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <FileDrop
            accept="image/jpeg,.jpg,.jpeg"
            onFiles={(files) => void handleFiles(files)}
            label={file ? "Choose another JPEG" : "Drop a JPEG or click to browse"}
            hint="JPG / JPEG only · up to 50 MB"
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {readError ? <Alert tone="danger">{readError}</Alert> : null}
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
                alt="EXIF source preview"
                className="max-h-52 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Dimensions">
                {loaded.width} × {loaded.height} px
              </InlineRow>
            </>
          ) : null}
          {exif ? (
            exif.hasExif ? (
              <Alert tone="info" title="EXIF is untrusted metadata">
                Values are decoded as written and can be edited or forged. Decoding does not
                verify the camera or the file.
              </Alert>
            ) : (
              <Alert tone="warning" title="No readable EXIF">
                {exif.note}
              </Alert>
            )
          ) : null}
          {exif?.orientation != null && exif.orientation !== 1 ? (
            <Alert tone="info" title="Orientation tag">
              Orientation {exif.orientation}: {describeOrientation(exif.orientation)}. The
              stripped re-encode uses the orientation your browser displays.
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel title="Metadata and stripped copy" description="Remove EXIF, GPS, and embedded comments by re-encoding." flush>
        <div className="space-y-3 p-4">
          {groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map(([group, entries]) => (
                <div key={group} className="overflow-hidden rounded-lg border border-line">
                  <p className="border-b border-line bg-surface-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {group}
                  </p>
                  <dl className="divide-y divide-line">
                    {entries.map((entry) => (
                      <div
                        key={`${entry.group}-${entry.tag}`}
                        className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs"
                      >
                        <dt className="text-muted">{entry.label}</dt>
                        <dd className="min-w-0 break-words text-right font-mono text-text">
                          {entry.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-faint">
              Camera, exposure, date, and GPS fields appear here.
            </p>
          )}

          {exif?.gps ? (
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text">GPS coordinates</p>
                <CopyButton
                  value={`${exif.gps.latitude.toFixed(6)}, ${exif.gps.longitude.toFixed(6)}`}
                  label="Copy coordinates"
                />
              </div>
              <p className="mt-1 font-mono text-xs text-text">
                {exif.gps.latitude.toFixed(6)}, {exif.gps.longitude.toFixed(6)}
                {exif.gps.altitude !== null ? ` · ${exif.gps.altitude.toFixed(1)} m` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Stripped format"
              value={format}
              onChange={(value) => {
                setFormat(value as ImageFormat);
                resetOutput();
              }}
              options={STRIP_FORMATS}
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
          <Alert tone="info">
            Canvas re-encoding discards EXIF, GPS, and embedded comments. It can also change
            compression and color profiles.
          </Alert>
          <Button
            variant="primary"
            onClick={() => void stripMetadata()}
            disabled={!loaded || stripping}
          >
            <Eraser className="size-4" aria-hidden />
            {stripping ? "Re-encoding…" : "Create metadata-stripped copy"}
          </Button>
          {stripError ? <Alert tone="danger">{stripError}</Alert> : null}
          {fallback && result ? (
            <Alert tone="warning" title="Format fallback">
              The browser encoded {extensionForMime(result.mime).toUpperCase()} instead of{" "}
              {format.toUpperCase()}.
            </Alert>
          ) : null}
          {result ? (
            <>
              <img
                src={result.url}
                alt="Metadata-stripped preview"
                className="max-h-52 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Stripped size">{formatBytes(result.blob.size)}</InlineRow>
              <InlineRow label="Change">
                {savings >= 0
                  ? `${savings.toFixed(1)}% smaller`
                  : `${Math.abs(savings).toFixed(1)}% larger`}
              </InlineRow>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">EXIF removed</Badge>
                <Badge>{result.mime}</Badge>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadBlob(
                    result.blob,
                    withExtension(
                      `${fileBaseName(file?.name ?? "image")}-metadata-stripped`,
                      result.mime === mimeForFormat(format).mime
                        ? mimeForFormat(format).extension
                        : extensionForMime(result.mime),
                    ),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                Download stripped image
              </Button>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-faint">
              <Camera className="size-4" aria-hidden />
              Re-encode to remove GPS and camera metadata.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
