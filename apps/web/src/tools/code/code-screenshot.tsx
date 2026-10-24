import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Panel,
  Select,
  Slider,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  SCREENSHOT_LANGUAGES,
  SCREENSHOT_THEMES,
  computeScreenshotLayout,
  expandTabs,
  highlightCode,
  screenshotFilename,
  screenshotThemeById,
  themeColor,
} from "./logic";

const MAX_LINES = 260;
const SCALE = 2;

const SAMPLE = `type Tool = {
  id: string;
  category: "code";
};

export function describe(tool: Tool) {
  return \`\${tool.id} is a \${tool.category} tool\`;
}
`;

export default function CodeScreenshotTool() {
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState("typescript");
  const [themeId, setThemeId] = useState("dark");
  const [fontSize, setFontSize] = useState(14);
  const [padding, setPadding] = useState(28);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [background, setBackground] = useState(true);
  const [filename, setFilename] = useState("snippet.ts");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const preview = useMemo(() => {
    const prepared = code
      .split("\n")
      .map((line) => expandTabs(line))
      .join("\n");
    const highlighted = highlightCode(prepared, language);
    const lines = highlighted.lines.slice(0, MAX_LINES);
    const maxLineLength = Math.max(
      1,
      ...lines.map((line) => line.reduce((total, token) => total + token.text.length, 0)),
    );
    const layout = computeScreenshotLayout({
      lineCount: lines.length,
      maxLineLength,
      fontSize,
      padding,
      showLineNumbers,
    });
    return {
      lines,
      layout,
      error: highlighted.error,
      truncated: highlighted.lines.length > MAX_LINES,
      maxLineLength,
    };
  }, [code, fontSize, language, padding, showLineNumbers]);

  const theme = screenshotThemeById(themeId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { layout, lines } = preview;
    canvas.width = Math.round(layout.width * SCALE);
    canvas.height = Math.round(layout.height * SCALE);
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    context.clearRect(0, 0, layout.width, layout.height);

    if (background) {
      context.fillStyle = theme.background;
      context.fillRect(0, 0, layout.width, layout.height);
    }

    context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textBaseline = "middle";

    if (showLineNumbers) {
      context.textAlign = "right";
      context.fillStyle = theme.lineNumber;
      lines.forEach((_, index) => {
        context.fillText(
          String(index + 1),
          padding + layout.gutterWidth - 10,
          padding + layout.lineHeight / 2 + index * layout.lineHeight,
        );
      });

      context.strokeStyle = theme.gutter;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(padding + layout.gutterWidth - 0.5, padding / 2);
      context.lineTo(padding + layout.gutterWidth - 0.5, layout.height - padding / 2);
      context.stroke();
    }

    context.textAlign = "left";
    const codeStart = padding + layout.gutterWidth + (showLineNumbers ? 12 : 0);
    lines.forEach((line, index) => {
      const y = padding + layout.lineHeight / 2 + index * layout.lineHeight;
      let x = codeStart;
      for (const token of line) {
        context.fillStyle = themeColor(theme, token.scope);
        context.fillText(token.text, x, y);
        x += context.measureText(token.text).width;
      }
    });
  }, [background, fontSize, padding, preview, showLineNumbers, theme]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, screenshotFilename(filename));
    }, "image/png");
  };

  return (
    <ToolStack>
      <ToolGrid>
        <ToolStack>
          <Panel
            title="Code"
            description="Highlighted with highlight.js and drawn to a canvas."
            actions={
              <Button variant="ghost" size="sm" onClick={() => setCode(SAMPLE)}>
                <Sparkles className="size-3.5" aria-hidden />
                Sample
              </Button>
            }
          >
            <div className="space-y-3">
              <Field label="Source" htmlFor="screenshot-source">
                <TextArea
                  id="screenshot-source"
                  mono
                  rows={16}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="const answer = 42;"
                  aria-label="Code to capture"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Language"
                  value={language}
                  onChange={setLanguage}
                  options={SCREENSHOT_LANGUAGES}
                />
                <Field label="File name" htmlFor="screenshot-filename" hint="Used for the PNG download.">
                  <Input
                    id="screenshot-filename"
                    value={filename}
                    onChange={(event) => setFilename(event.target.value)}
                    className="font-mono"
                    aria-label="Screenshot filename"
                  />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Appearance">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Theme"
                  value={themeId}
                  onChange={setThemeId}
                  options={SCREENSHOT_THEMES.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                />
                <div className="grid gap-3">
                  <Slider
                    label="Font size"
                    value={fontSize}
                    min={10}
                    max={24}
                    onChange={setFontSize}
                    format={(value) => `${value}px`}
                  />
                  <Slider
                    label="Padding"
                    value={padding}
                    min={8}
                    max={64}
                    step={4}
                    onChange={setPadding}
                    format={(value) => `${value}px`}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  label="Line numbers"
                  description="Adds a gutter with line counts."
                  checked={showLineNumbers}
                  onChange={setShowLineNumbers}
                />
                <Toggle
                  label="Background"
                  description="Draw the theme background instead of transparency."
                  checked={background}
                  onChange={setBackground}
                />
              </div>
            </div>
          </Panel>
        </ToolStack>

        <Panel
          title="Preview"
          description="The PNG is generated at twice the displayed size."
          actions={
            <div className="flex items-center gap-1.5">
              <Badge>{`${preview.layout.width}×${preview.layout.height}`}</Badge>
              <Button variant="primary" size="sm" onClick={download} disabled={!code.trim()}>
                <Download className="size-3.5" aria-hidden />
                Download PNG
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {preview.error ? (
              <Alert tone="danger" title="Highlighting failed">
                {preview.error}
              </Alert>
            ) : null}
            {preview.truncated ? (
              <Alert tone="warning" title="Preview limited to 260 lines">
                Split the snippet to capture the remaining lines.
              </Alert>
            ) : null}
            {preview.maxLineLength > 280 ? (
              <Alert tone="warning" title="Very long lines">
                Lines may be clipped at width 2400. Reduce the font size or wrap the code.
              </Alert>
            ) : null}

            <div className="overflow-auto rounded-lg border border-line bg-surface-2 p-3">
              <canvas
                ref={canvasRef}
                aria-label="Code screenshot preview"
                className="mx-auto block h-auto max-w-full rounded"
                style={{ width: preview.layout.width }}
              />
            </div>

            <p className="flex items-center gap-1.5 text-xs text-faint">
              <ImageIcon className="size-3.5" aria-hidden />
              {preview.lines.length} {preview.lines.length === 1 ? "line" : "lines"} · theme{" "}
              {theme.label}
            </p>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
