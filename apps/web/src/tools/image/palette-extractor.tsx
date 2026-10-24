import { useMemo, useState } from "react";
import { Palette, X } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  CopyButton,
  FileDrop,
  InlineRow,
  Panel,
  Select,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import { sampleImage } from "./canvas";
import { quantizePalette, type PaletteColor } from "./logic";
import { useImageFile } from "./use-image-file";

const COLOR_OPTIONS = [4, 6, 8, 10, 12, 16, 24].map((count) => ({
  value: String(count),
  label: `${count} colors`,
}));

const SAMPLE_EDGE = 240;

export default function PaletteExtractorTool() {
  const { file, loaded, error, loading, load, clear } = useImageFile();
  const [colorCount, setColorCount] = useState(8);

  const sample = useMemo<{ data: ImageData } | { error: string } | null>(() => {
    if (!loaded) return null;
    try {
      return { data: sampleImage(loaded.image, SAMPLE_EDGE) };
    } catch (failure) {
      return {
        error:
          failure instanceof Error ? failure.message : "Could not read pixels from this image.",
      };
    }
  }, [loaded]);

  const palette = useMemo<{ colors: PaletteColor[] } | { error: string } | null>(() => {
    if (!sample || "error" in sample) return null;
    try {
      return { colors: quantizePalette(sample.data.data, colorCount) };
    } catch (failure) {
      return {
        error: failure instanceof Error ? failure.message : "Could not build a palette.",
      };
    }
  }, [colorCount, sample]);

  const colors = palette && "colors" in palette ? palette.colors : null;
  const paletteError = palette && "error" in palette ? palette.error : "";
  const sampleError = sample && "error" in sample ? sample.error : "";
  const sampledPixels = sample && "data" in sample ? sample.data.width * sample.data.height : 0;
  const paletteText = colors
    ? colors.map((color) => `${color.hex}  ${color.percentage.toFixed(1)}%`).join("\n")
    : "";

  return (
    <ToolGrid>
      <Panel
        title="Source image"
        description="Pixels are sampled locally at up to 240 px on the long edge."
        actions={
          file ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <FileDrop
            accept="image/*"
            onFiles={load}
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
                alt="Palette source preview"
                className="max-h-56 w-full rounded-lg border border-line bg-surface-2 object-contain"
              />
              <InlineRow label="Source dimensions">
                {loaded.width} × {loaded.height} px
              </InlineRow>
              <Select
                label="Palette size"
                value={String(colorCount)}
                onChange={(value) => setColorCount(Number(value))}
                options={COLOR_OPTIONS}
              />
              {sampledPixels > 0 ? (
                <InlineRow label="Sampled pixels">
                  {sampledPixels.toLocaleString()}
                </InlineRow>
              ) : null}
              {sampleError ? <Alert tone="danger">{sampleError}</Alert> : null}
              {paletteError ? <Alert tone="danger">{paletteError}</Alert> : null}
            </>
          ) : null}
        </div>
      </Panel>

      <Panel title="Dominant colors" description="Median-cut quantization, sorted by coverage." flush>
        <div className="space-y-3 p-4">
          {colors ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {colors.map((color) => (
                  <div
                    key={color.hex}
                    className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2 p-2"
                  >
                    <span
                      className="size-10 shrink-0 rounded-md border border-line"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-text">{color.hex}</p>
                      <p className="text-[10px] text-faint">
                        {color.percentage.toFixed(1)}% · {color.count.toLocaleString()} px
                      </p>
                    </div>
                    <CopyButton value={color.hex} size="icon" label={`Copy ${color.hex}`} />
                  </div>
                ))}
              </div>
              <CodeOutput
                value={paletteText}
                filename="palette.txt"
                language="hex · coverage"
                maxHeight={180}
              />
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-faint">
              <Palette className="size-4" aria-hidden />
              The extracted palette appears here.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
