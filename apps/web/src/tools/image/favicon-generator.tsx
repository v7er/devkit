import { useEffect, useState } from "react";
import { Download, FileImage, Sparkles, X } from "lucide-react";
import {
  Alert,
  Button,
  Badge,
  FileDrop,
  InlineRow,
  Panel,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import { renderSquarePng } from "./canvas";
import { buildIco } from "./logic";
import { useImageFile } from "./use-image-file";

const ICON_SIZES = [16, 32, 48, 180, 192, 512];
const ICO_MAX_SIZE = 256;

interface IconResult {
  size: number;
  blob: Blob;
  bytes: Uint8Array;
  url: string;
}

function blobFromBytes(bytes: Uint8Array, type: string): Blob {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

export default function FaviconGeneratorTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [results, setResults] = useState<IconResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    return () => {
      for (const result of results) URL.revokeObjectURL(result.url);
    };
  }, [results]);

  async function handleFiles(files: File[]) {
    setResults([]);
    setGenerateError("");
    await load(files);
  }

  function handleClear() {
    setResults([]);
    setGenerateError("");
    clear();
  }

  async function generate() {
    if (!loaded) return;
    setBusy(true);
    setGenerateError("");
    const created: string[] = [];
    try {
      const next: IconResult[] = [];
      for (const size of ICON_SIZES) {
        const blob = await renderSquarePng(loaded.image, size);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const url = URL.createObjectURL(blob);
        created.push(url);
        next.push({ size, blob, bytes, url });
      }
      setResults(next);
    } catch (failure) {
      for (const url of created) URL.revokeObjectURL(url);
      setGenerateError(
        failure instanceof Error ? failure.message : "Could not generate the icons.",
      );
    } finally {
      setBusy(false);
    }
  }

  const icoIcons = results.filter((result) => result.size <= ICO_MAX_SIZE);

  function downloadIco() {
    try {
      const bytes = buildIco(icoIcons.map((result) => ({ size: result.size, png: result.bytes })));
      downloadBlob(blobFromBytes(bytes, "image/x-icon"), "favicon.ico");
    } catch (failure) {
      setGenerateError(
        failure instanceof Error ? failure.message : "Could not build the ICO file.",
      );
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Source image"
        description="Icons are square-fitted, centered, and padded with transparency."
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
                alt="Favicon source preview"
                className="max-h-48 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Source dimensions">
                {loaded.width} × {loaded.height} px
              </InlineRow>
              {Math.min(loaded.width, loaded.height) < 512 ? (
                <Alert tone="warning" title="Source is small">
                  Icons larger than the short edge of this image will be upscaled and may look
                  soft. A square source of at least 512 × 512 px works best.
                </Alert>
              ) : null}
              <Button variant="primary" onClick={() => void generate()} disabled={busy}>
                <Sparkles className="size-4" aria-hidden />
                {busy ? "Generating icons…" : "Generate icons"}
              </Button>
              {generateError ? <Alert tone="danger">{generateError}</Alert> : null}
            </>
          ) : null}
        </div>
      </Panel>

      <Panel title="Generated icons" description="Download any size, or bundle them as favicon.ico." flush>
        <div className="space-y-3 p-4">
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.map((result) => (
                  <div
                    key={result.size}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
                  >
                    <div className="flex h-20 items-center justify-center rounded-md bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                      <img
                        src={result.url}
                        alt={`${result.size} by ${result.size} favicon`}
                        width={result.size > 128 ? 64 : result.size}
                        height={result.size > 128 ? 64 : result.size}
                        className="[image-rendering:pixelated]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-text">
                        {result.size}×{result.size}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${result.size} by ${result.size} PNG`}
                        title={`Download ${result.size}×${result.size} PNG`}
                        onClick={() =>
                          downloadBlob(result.blob, `favicon-${result.size}x${result.size}.png`)
                        }
                      >
                        <Download className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                    <span className="text-[10px] text-faint">{formatBytes(result.blob.size)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{icoIcons.length} images in ICO</Badge>
                <span className="text-xs text-faint">512 px is PNG only; ICO images max out at 256 px.</span>
              </div>
              <Button variant="primary" onClick={downloadIco} disabled={icoIcons.length === 0}>
                <FileImage className="size-4" aria-hidden />
                Download favicon.ico
              </Button>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-faint">
              <FileImage className="size-4" aria-hidden />
              Upload an image, then generate the icon set.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
