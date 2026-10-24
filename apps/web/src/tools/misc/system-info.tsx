import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  CodeOutput,
  InlineRow,
  Panel,
  Spinner,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { detectBrowser, detectPlatform } from "./logic";

interface WebGlInfo {
  renderer: string;
  vendor: string;
  version: string;
}

interface UserAgentBrand {
  brand: string;
  version: string;
}

interface UserAgentData {
  brands?: UserAgentBrand[];
  mobile?: boolean;
  platform?: string;
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  userAgentData?: UserAgentData;
};

interface SystemInfo {
  browser: ReturnType<typeof detectBrowser>;
  platform: string;
  uaPlatform: string;
  mobile: string;
  brands: string;
  cores: string;
  memory: string;
  languages: string;
  locale: string;
  timezone: string;
  utcOffset: string;
  screen: string;
  viewport: string;
  colorDepth: string;
  touchPoints: string;
  colorScheme: string;
  reducedMotion: string;
  cookies: string;
  online: string;
  userAgent: string;
  webgl: WebGlInfo;
}

const FALLBACK: WebGlInfo = {
  renderer: "Not available",
  vendor: "Not available",
  version: "Not available",
};

function readWebGl(): WebGlInfo {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return FALLBACK;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererParameter = debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const vendorParameter = debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR;

    const result: WebGlInfo = {
      renderer: String(gl.getParameter(rendererParameter) || "Not available"),
      vendor: String(gl.getParameter(vendorParameter) || "Not available"),
      version: String(gl.getParameter(gl.VERSION) || "Not available"),
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return result;
  } catch {
    return {
      renderer: "Hidden by the browser",
      vendor: "Hidden by the browser",
      version: "Unavailable",
    };
  }
}

function readLocale(): { locale: string; timezone: string } {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return { locale: resolved.locale, timezone: resolved.timeZone };
  } catch {
    return { locale: "Unavailable", timezone: "Unavailable" };
  }
}

function utcOffset(): string {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function readInfo(): SystemInfo {
  const nav = navigator as NavigatorWithHints;
  const uaData = nav.userAgentData;
  const { locale, timezone } = readLocale();
  const dpr = window.devicePixelRatio;

  return {
    browser: detectBrowser(navigator.userAgent),
    platform: detectPlatform(navigator.userAgent),
    uaPlatform: uaData?.platform ?? "Not exposed by this browser",
    mobile: uaData ? (uaData.mobile ? "Yes" : "No") : "Not exposed by this browser",
    brands:
      uaData?.brands && uaData.brands.length > 0
        ? uaData.brands.map((brand) => `${brand.brand} ${brand.version}`).join(", ")
        : "Not exposed by this browser",
    cores:
      typeof nav.hardwareConcurrency === "number"
        ? `${nav.hardwareConcurrency} logical cores`
        : "Not exposed by this browser",
    memory:
      typeof nav.deviceMemory === "number"
        ? `At least ${nav.deviceMemory} GB (browser estimate)`
        : "Not exposed by this browser",
    languages: navigator.languages?.length ? navigator.languages.join(", ") : navigator.language,
    locale,
    timezone,
    utcOffset: utcOffset(),
    screen: `${window.screen.width} × ${window.screen.height} CSS px at ${dpr}× (${Math.round(
      window.screen.width * dpr,
    )} × ${Math.round(window.screen.height * dpr)} device px)`,
    viewport: `${window.innerWidth} × ${window.innerHeight} CSS px`,
    colorDepth: `${window.screen.colorDepth}-bit`,
    touchPoints: `${navigator.maxTouchPoints}`,
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "Reduced" : "No preference",
    cookies: navigator.cookieEnabled ? "Enabled" : "Disabled",
    online: navigator.onLine ? "Yes" : "No",
    userAgent: navigator.userAgent,
    webgl: readWebGl(),
  };
}

export default function SystemInfoTool() {
  const [info] = useState<SystemInfo | null>(() =>
    typeof window === "undefined" ? null : readInfo(),
  );

  const report = useMemo(
    () =>
      info
        ? JSON.stringify(
            {
              browser: `${info.browser.name} ${info.browser.version}`,
              engine: info.browser.engine,
              platform: info.platform,
              userAgentPlatform: info.uaPlatform,
              mobile: info.mobile,
              brands: info.brands,
              logicalCores: info.cores,
              deviceMemory: info.memory,
              languages: info.languages,
              locale: info.locale,
              timezone: `${info.timezone} (${info.utcOffset})`,
              screen: info.screen,
              viewport: info.viewport,
              colorDepth: info.colorDepth,
              touchPoints: info.touchPoints,
              colorScheme: info.colorScheme,
              reducedMotion: info.reducedMotion,
              cookies: info.cookies,
              online: info.online,
              webglRenderer: info.webgl.renderer,
              webglVendor: info.webgl.vendor,
              webglVersion: info.webgl.version,
              userAgent: info.userAgent,
            },
            null,
            2,
          )
        : "",
    [info],
  );

  if (!info) {
    return (
      <Panel title="System information">
        <Spinner label="Reading browser and hardware details" />
      </Panel>
    );
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Browser & platform"
          description="Best-effort detection from the user agent and client hints."
          actions={<Badge>Local only</Badge>}
        >
          <div className="space-y-2.5">
            <InlineRow label="Browser">{`${info.browser.name} ${info.browser.version}`}</InlineRow>
            <InlineRow label="Engine">{info.browser.engine}</InlineRow>
            <InlineRow label="Platform">{info.platform}</InlineRow>
            <InlineRow label="Client hints platform">{info.uaPlatform}</InlineRow>
            <InlineRow label="Mobile client hint">{info.mobile}</InlineRow>
            <InlineRow label="Brands">{info.brands}</InlineRow>
          </div>
          <Alert tone="info" className="mt-3">
            These values are read in this tab and never sent anywhere. Browsers may reduce or hide
            some values to limit fingerprinting.
          </Alert>
        </Panel>

        <Panel title="Hardware & locale" description="Capacity hints and regional settings.">
          <div className="space-y-2.5">
            <InlineRow label="Logical cores">{info.cores}</InlineRow>
            <InlineRow label="Device memory">{info.memory}</InlineRow>
            <InlineRow label="Languages">{info.languages}</InlineRow>
            <InlineRow label="Locale">{info.locale}</InlineRow>
            <InlineRow label="Time zone">{info.timezone}</InlineRow>
            <InlineRow label="UTC offset">{info.utcOffset}</InlineRow>
          </div>
        </Panel>

        <Panel title="Display & input" description="Screen geometry and accessibility preferences.">
          <div className="space-y-2.5">
            <InlineRow label="Screen">{info.screen}</InlineRow>
            <InlineRow label="Viewport">{info.viewport}</InlineRow>
            <InlineRow label="Color depth">{info.colorDepth}</InlineRow>
            <InlineRow label="Touch points">{info.touchPoints}</InlineRow>
            <InlineRow label="Color scheme">{info.colorScheme}</InlineRow>
            <InlineRow label="Reduced motion">{info.reducedMotion}</InlineRow>
            <InlineRow label="Cookies">{info.cookies}</InlineRow>
            <InlineRow label="Online">{info.online}</InlineRow>
          </div>
        </Panel>

        <Panel title="WebGL" description="The GPU renderer string, when the browser exposes it.">
          <div className="space-y-2.5">
            <InlineRow label="Renderer">{info.webgl.renderer}</InlineRow>
            <InlineRow label="Vendor">{info.webgl.vendor}</InlineRow>
            <InlineRow label="Version">{info.webgl.version}</InlineRow>
          </div>
          <Alert tone="warning" className="mt-3">
            Some browsers and privacy modes return a generic renderer or block WebGL entirely. A
            fallback here does not indicate a fault.
          </Alert>
        </Panel>
      </ToolGrid>

      <Panel
        title="JSON report"
        description="Copy or download the values above as structured data."
      >
        <CodeOutput
          value={report}
          filename="system-info.json"
          language="json"
          maxHeight={320}
        />
      </Panel>
    </ToolStack>
  );
}
