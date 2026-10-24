import { useRef, useState } from "react";
import { Image as ImageIcon, ScanLine, X } from "lucide-react";
import jsQR from "jsqr";
import {
  Alert,
  Button,
  CodeOutput,
  EmptyState,
  FileDrop,
  InlineRow,
  Panel,
  Spinner,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { readFileAsDataUrl } from "@/lib/download";
import { formatBytes, formatNumber } from "@/lib/utils";
import { describePayload } from "./logic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DECODE_SIDE = 1600;

interface LoadedImage {
  name: string;
  size: number;
  preview: string;
  width: number;
  height: number;
}

interface ScanResult {
  data: string;
  version: number;
  bytes: number;
  analyzedWidth: number;
  analyzedHeight: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode this image file."));
    image.src = src;
  });
}

export default function QrReaderTool() {
  const [file, setFile] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  async function handleFiles(files: File[]) {
    const next = files[0];
    if (!next) return;

    const current = ++requestId.current;
    setBusy(true);
    setError("");
    setResult(null);
    setFile(null);

    try {
      if (!next.type.startsWith("image/")) {
        throw new Error("Choose an image file such as PNG, JPEG, WebP, or GIF.");
      }
      if (next.size > MAX_FILE_BYTES) {
        throw new Error(`This image is ${formatBytes(next.size)}. Keep it under 20 MB.`);
      }

      const preview = await readFileAsDataUrl(next);
      const image = await loadImage(preview);
      if (current !== requestId.current) return;

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width === 0 || height === 0) throw new Error("This image has no pixels to scan.");

      setFile({ name: next.name, size: next.size, preview, width, height });

      const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(width, height));
      const analyzedWidth = Math.max(1, Math.round(width * scale));
      const analyzedHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = analyzedWidth;
      canvas.height = analyzedHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser could not provide a 2D canvas context.");
      context.drawImage(image, 0, 0, analyzedWidth, analyzedHeight);

      const pixels = context.getImageData(0, 0, analyzedWidth, analyzedHeight);
      const code = jsQR(pixels.data, analyzedWidth, analyzedHeight, {
        inversionAttempts: "attemptBoth",
      });
      if (current !== requestId.current) return;

      if (!code || !code.data) {
        throw new Error(
          "No QR code was found. Try a sharper, larger, or less cropped image with a clear quiet zone.",
        );
      }

      setResult({
        data: code.data,
        version: code.version,
        bytes: new TextEncoder().encode(code.data).length,
        analyzedWidth,
        analyzedHeight,
      });
    } catch (caught) {
      if (current === requestId.current) {
        setError(caught instanceof Error ? caught.message : "Could not scan this image.");
      }
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Image"
          description="Scanned in memory with jsQR. Nothing is uploaded."
          actions={
            file ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  requestId.current += 1;
                  setFile(null);
                  setResult(null);
                  setError("");
                  setBusy(false);
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
              accept="image/*"
              onFiles={handleFiles}
              label="Drop a QR code image or click to browse"
              hint="PNG, JPEG, WebP, GIF · up to 20 MB"
            />

            {busy ? <Spinner label="Scanning image" /> : null}

            {file ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center rounded-lg border border-line bg-surface-2 p-3">
                  <img
                    src={file.preview}
                    alt={`Uploaded image ${file.name}`}
                    className="max-h-72 max-w-full rounded object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ImageIcon className="size-3.5 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 font-mono">
                    {formatNumber(file.width)} × {formatNumber(file.height)}
                  </span>
                  <span className="shrink-0 text-faint">{formatBytes(file.size)}</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert tone="danger" title="No QR code decoded">
                {error}
              </Alert>
            ) : null}

            <Alert tone="info" title="Decoded content is untrusted">
              A QR code can point to a phishing page or contain unexpected text. Check the payload
              before opening a link or acting on it.
            </Alert>
          </div>
        </Panel>

        <Panel title="Payload" description="Decoded text, byte count, and QR version.">
          {result ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Content type</p>
                  <p className="mt-0.5 font-mono text-text">{describePayload(result.data)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">QR version</p>
                  <p className="mt-0.5 font-mono text-text">
                    {result.version} · {17 + result.version * 4} × {17 + result.version * 4}
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Payload size</p>
                  <p className="mt-0.5 font-mono text-text">
                    {formatNumber(result.bytes)} {result.bytes === 1 ? "byte" : "bytes"}
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Scanned at</p>
                  <p className="mt-0.5 font-mono text-text">
                    {formatNumber(result.analyzedWidth)} × {formatNumber(result.analyzedHeight)}
                  </p>
                </div>
              </div>

              <InlineRow label="Characters">{formatNumber(result.data.length)}</InlineRow>

              <CodeOutput
                value={result.data}
                language="decoded payload"
                filename="qr-payload.txt"
                maxHeight={360}
              />
            </div>
          ) : (
            <EmptyState
              icon={<ScanLine className="size-5" aria-hidden />}
              title="No code scanned yet"
              description="Upload an image that contains a QR code. The decoded text will appear here."
            />
          )}
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
