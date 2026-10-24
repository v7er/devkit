import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import * as QRCode from "qrcode";
import type { QRCodeErrorCorrectionLevel } from "qrcode";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  Slider,
  TextArea,
  ToolGrid,
  Toggle,
  ToolStack,
} from "@/components/ui";
import { downloadDataUrl, downloadText } from "@/lib/download";
import { buildWifiPayload, describePayload } from "./logic";

type Mode = "text" | "url" | "wifi";
type WifiSecurity = "WPA" | "WEP" | "nopass";

const ERROR_LEVELS: Array<{ value: QRCodeErrorCorrectionLevel; label: string }> = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
];

export default function QrGeneratorTool() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("https://example.com");
  const [url, setUrl] = useState("https://example.com");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);
  const [level, setLevel] = useState<QRCodeErrorCorrectionLevel>("M");
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(4);
  const [dark, setDark] = useState("#000000");
  const [light, setLight] = useState("#ffffff");
  const [output, setOutput] = useState({ png: "", svg: "", error: "" });

  const payload = useMemo(() => {
    if (mode === "text") {
      return text.trim()
        ? { value: text, error: "" }
        : { value: "", error: "Enter the text you want to encode." };
    }
    if (mode === "url") {
      const trimmed = url.trim();
      if (!trimmed) return { value: "", error: "Enter a URL to encode." };
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { value: "", error: "Use an http:// or https:// URL." };
        }
        return { value: parsed.toString(), error: "" };
      } catch {
        return { value: "", error: "Enter a complete URL, including https://." };
      }
    }
    try {
      return {
        value: buildWifiPayload({ ssid, password, security, hidden }),
        error: "",
      };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not build the Wi-Fi payload.",
      };
    }
  }, [hidden, mode, password, security, ssid, text, url]);

  useEffect(() => {
    if (payload.error || !payload.value) return;

    let cancelled = false;
    const options = {
      errorCorrectionLevel: level,
      width: size,
      margin,
      color: { dark, light },
    };

    Promise.all([
      QRCode.toDataURL(payload.value, { ...options, type: "image/png" }),
      QRCode.toString(payload.value, { ...options, type: "svg" }),
    ])
      .then(([png, svg]) => {
        if (!cancelled) setOutput({ png, svg, error: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOutput({
            png: "",
            svg: "",
            error: error instanceof Error ? error.message : "Could not generate the QR code.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dark, level, light, margin, payload.error, payload.value, size]);

  const kind = payload.value ? describePayload(payload.value) : "";
  const png = payload.error ? "" : output.png;
  const svg = payload.error ? "" : output.svg;
  const generationError = payload.error ? "" : output.error;

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Content" description="Pick what the code should contain.">
          <div className="space-y-3">
            <Segmented
              label="Payload type"
              value={mode}
              onChange={setMode}
              options={[
                { value: "text", label: "Text" },
                { value: "url", label: "URL" },
                { value: "wifi", label: "Wi-Fi" },
              ]}
            />

            {mode === "text" ? (
              <Field label="Text" hint="Any UTF-8 text, up to the capacity of the selected error correction level.">
                <TextArea
                  mono
                  rows={6}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Text to encode"
                  aria-label="Text to encode"
                />
              </Field>
            ) : null}

            {mode === "url" ? (
              <Field label="URL" hint="Links are normalized with the browser's URL parser.">
                <Input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  aria-label="URL to encode"
                />
              </Field>
            ) : null}

            {mode === "wifi" ? (
              <div className="space-y-3">
                <Field label="Network name (SSID)">
                  <Input
                    value={ssid}
                    onChange={(event) => setSsid(event.target.value)}
                    placeholder="Cafe Guest"
                    aria-label="Wi-Fi network name"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Security">
                    <Select
                      value={security}
                      onChange={(value) => setSecurity(value as WifiSecurity)}
                      options={[
                        { value: "WPA", label: "WPA / WPA2 / WPA3" },
                        { value: "WEP", label: "WEP" },
                        { value: "nopass", label: "Open (no password)" },
                      ]}
                    />
                  </Field>
                  <Field label="Password" hint="Visible here and embedded in the code.">
                    <Input
                      type="text"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      aria-label="Wi-Fi password"
                      disabled={security === "nopass"}
                    />
                  </Field>
                </div>
                <Toggle
                  label="Hidden network"
                  description="Adds H:true so scanners know the SSID is not broadcast."
                  checked={hidden}
                  onChange={setHidden}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Error correction"
                value={level}
                onChange={(value) => setLevel(value as QRCodeErrorCorrectionLevel)}
                options={ERROR_LEVELS}
              />
              <Slider
                label="Output size"
                value={size}
                min={128}
                max={1024}
                step={32}
                onChange={setSize}
                format={(value) => `${value} × ${value} px`}
              />
            </div>

            <Slider
              label="Quiet zone"
              value={margin}
              min={0}
              max={8}
              onChange={setMargin}
              format={(value) => `${value} modules`}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Dark modules">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dark}
                    onChange={(event) => setDark(event.target.value)}
                    aria-label="Dark module color"
                    className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1"
                  />
                  <span className="font-mono text-xs text-muted">{dark}</span>
                </div>
              </Field>
              <Field label="Light modules">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={light}
                    onChange={(event) => setLight(event.target.value)}
                    aria-label="Light module color"
                    className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1"
                  />
                  <span className="font-mono text-xs text-muted">{light}</span>
                </div>
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          title="Preview"
          description="Generated locally with the qrcode library."
          actions={
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => downloadDataUrl(png, "qr-code.png")}
                disabled={!png}
              >
                <Download className="size-3.5" aria-hidden />
                PNG
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadText(svg, "qr-code.svg", "image/svg+xml")}
                disabled={!svg}
              >
                <Download className="size-3.5" aria-hidden />
                SVG
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {payload.error ? (
              <Alert tone="danger" title="Cannot generate a code">
                {payload.error}
              </Alert>
            ) : null}
            {generationError ? (
              <Alert tone="danger" title="QR generation failed">
                {generationError}
              </Alert>
            ) : null}

            <div className="flex min-h-64 items-center justify-center rounded-lg border border-line bg-surface-2 p-4">
              {png ? (
                <img
                  src={png}
                  alt="Generated QR code"
                  className="h-auto max-w-full rounded"
                  style={{ width: Math.min(size, 360) }}
                />
              ) : (
                <p className="text-xs text-faint">
                  {payload.error || generationError ? "Fix the input to see a preview." : "Generating…"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Payload</p>
                <p className="mt-0.5 font-mono text-text">{kind || "—"}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Length</p>
                <p className="mt-0.5 font-mono text-text">
                  {new TextEncoder().encode(payload.value).length} bytes
                </p>
              </div>
            </div>

            {mode === "wifi" && payload.value ? (
              <CodeOutput value={payload.value} language="wifi payload" maxHeight={120} wrap />
            ) : null}

            <Alert tone="info">
              Keep contrast high: scanners need dark modules on a light background. Test the code
              with your target phone before printing it.{" "}
              <a
                href="https://www.qrcode.com/en/about/error_correction.html"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 underline decoration-dotted"
              >
                About error correction
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </Alert>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
