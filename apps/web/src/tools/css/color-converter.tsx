import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Slider,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { ColorField } from "./fields";
import {
  compositeOver,
  contrastRatio,
  formatHex,
  formatHsl,
  formatHsv,
  formatOklch,
  formatRgb,
  parseColor,
  parseHex,
  readableTextColor,
  wcagLevels,
} from "./logic";

function ConversionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <p className="truncate font-mono text-xs text-text">{value}</p>
      </div>
      <CopyButton value={value} size="icon" label={`Copy ${label}`} />
    </div>
  );
}

export default function ColorConverterTool() {
  const [input, setInput] = useState("#6366f1");
  const [alpha, setAlpha] = useState(100);
  const [backgroundInput, setBackgroundInput] = useState("#ffffff");

  const parsed = useMemo(() => parseColor(input), [input]);
  const background = useMemo(() => parseColor(backgroundInput), [backgroundInput]);
  const color = useMemo(
    () => (parsed ? { ...parsed, a: alpha / 100 } : null),
    [parsed, alpha],
  );

  function handleColorValue(next: string) {
    setInput(next);
    const nextColor = parseColor(next);
    if (nextColor) setAlpha(Math.round(nextColor.a * 100));
  }

  function handlePicker(next: string) {
    const base = parseHex(next);
    if (!base) return;
    setInput(formatHex({ ...base, a: alpha / 100 }));
  }

  const formats = color
    ? [
        { label: "HEX", value: formatHex(color) },
        { label: "RGB", value: formatRgb(color) },
        { label: "HSL", value: formatHsl(color) },
        { label: "HSV", value: formatHsv(color) },
        { label: "OKLCH", value: formatOklch(color) },
      ]
    : [];

  const contrast = useMemo(() => {
    if (!color || !background) return null;
    const opaque = compositeOver(color, background);
    const ratio = contrastRatio(opaque, background);
    return {
      opaque,
      ratio,
      levels: wcagLevels(ratio),
      text: readableTextColor(opaque),
    };
  }, [color, background]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Color" description="Pick a color or paste any supported CSS notation.">
          <div className="space-y-4">
            <Field
              label="Color value"
              hint="Accepts hex, rgb(), hsl(), hsv(), and oklch() with optional alpha."
            >
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Color picker"
                  title="Color picker"
                  value={parsed ? formatHex(parsed, false) : "#000000"}
                  onChange={(event) => handlePicker(event.target.value)}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                />
                <Input
                  value={input}
                  onChange={(event) => handleColorValue(event.target.value)}
                  aria-label="Color value"
                  spellCheck={false}
                  className="font-mono text-[14px]"
                />
              </div>
            </Field>

            <Slider
              label="Alpha"
              value={alpha}
              min={0}
              max={100}
              onChange={setAlpha}
              format={(value) => `${value}%`}
            />

            {!parsed ? (
              <Alert tone="danger" title="Invalid color">
                Enter a hex value or an rgb(), hsl(), hsv(), or oklch() function.
              </Alert>
            ) : null}

            <div
              className="flex h-20 items-center justify-center rounded-xl border border-line"
              style={{ background: color ? formatRgb(color) : "transparent" }}
            >
              <span
                className="text-lg font-semibold"
                style={{ color: color ? readableTextColor(color) : undefined }}
              >
                Aa
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Conversions" description="Alpha is carried through every notation.">
          {formats.length > 0 ? (
            <div className="space-y-2">
              {formats.map((format) => (
                <ConversionRow key={format.label} label={format.label} value={format.value} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No conversion yet"
              description="Enter a valid color to see its HEX, RGB, HSL, HSV, and OKLCH forms."
            />
          )}
        </Panel>
      </ToolGrid>

      <Panel
        title="Contrast"
        description="Ratios use WCAG 2.1 relative luminance after alpha compositing over the background."
      >
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <ColorField
            label="Background"
            value={backgroundInput}
            onChange={setBackgroundInput}
            hint="The color behind the swatch."
          />

          {contrast ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xl font-semibold text-text">
                  {contrast.ratio.toFixed(2)}:1
                </span>
                <Badge tone={contrast.levels.aa ? "accent" : "neutral"}>
                  AA {contrast.levels.aa ? "pass" : "fail"}
                </Badge>
                <Badge tone={contrast.levels.aaa ? "accent" : "neutral"}>
                  AAA {contrast.levels.aaa ? "pass" : "fail"}
                </Badge>
                <Badge tone={contrast.levels.aaLarge ? "accent" : "neutral"}>
                  AA large {contrast.levels.aaLarge ? "pass" : "fail"}
                </Badge>
                <Badge tone={contrast.levels.aaaLarge ? "accent" : "neutral"}>
                  AAA large {contrast.levels.aaaLarge ? "pass" : "fail"}
                </Badge>
              </div>

              <div
                className="rounded-xl border border-line px-4 py-5"
                style={{ background: formatRgb(contrast.opaque) }}
              >
                <p
                  className="text-lg font-semibold"
                  style={{ color: contrast.text }}
                >
                  Readable text on this color
                </p>
                <p className="mt-1 font-mono text-xs" style={{ color: contrast.text }}>
                  {contrast.text}
                </p>
              </div>

              <p className="text-xs text-faint">
                AA needs 4.5:1 for body text and 3:1 for large text. AAA needs 7:1 and 4.5:1.
              </p>
            </div>
          ) : backgroundInput.trim() === "" ? (
            <Alert tone="warning" title="Background required">
              Enter a background color to calculate contrast.
            </Alert>
          ) : (
            <Alert tone="danger" title="Invalid background">
              Enter a background color such as <code>#ffffff</code> or <code>rgb(0 0 0)</code>.
            </Alert>
          )}
        </div>
      </Panel>
    </ToolStack>
  );
}
