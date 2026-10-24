import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import {
  Alert,
  Badge,
  EmptyState,
  InlineRow,
  Panel,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";

interface Metrics {
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  clientHeight: number;
  visualWidth: number | null;
  visualHeight: number | null;
  visualScale: number | null;
  dpr: number;
  outerWidth: number;
  outerHeight: number;
  screenWidth: number;
  screenHeight: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
  maxTouchPoints: number;
  coarsePointer: boolean;
  finePointer: boolean;
  canHover: boolean;
  orientation: string;
}

function readMetrics(): Metrics {
  const viewport = window.visualViewport;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    visualWidth: viewport ? Math.round(viewport.width) : null,
    visualHeight: viewport ? Math.round(viewport.height) : null,
    visualScale: viewport ? viewport.scale : null,
    dpr: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    finePointer: window.matchMedia("(any-pointer: fine)").matches,
    canHover: window.matchMedia("(hover: hover)").matches,
    orientation: window.screen.orientation?.type ?? "Unknown",
  };
}

function size(width: number, height: number): string {
  return `${formatNumber(width)} × ${formatNumber(height)}`;
}

function pixels(width: number, height: number, dpr: number): string {
  return size(Math.round(width * dpr), Math.round(height * dpr));
}

export default function DprTool() {
  const [metrics, setMetrics] = useState<Metrics | null>(() =>
    typeof window === "undefined" ? null : readMetrics(),
  );

  useEffect(() => {
    const update = () => setMetrics(readMetrics());
    update();

    const viewport = window.visualViewport;
    const coarse = window.matchMedia("(pointer: coarse)");
    const hover = window.matchMedia("(hover: hover)");

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    viewport?.addEventListener("resize", update);
    coarse.addEventListener("change", update);
    hover.addEventListener("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      viewport?.removeEventListener("resize", update);
      coarse.removeEventListener("change", update);
      hover.removeEventListener("change", update);
    };
  }, []);

  if (!metrics) {
    return (
      <Panel title="Device metrics">
        <Spinner label="Reading display metrics" />
      </Panel>
    );
  }

  const pageZoom =
    metrics.innerWidth > 0 ? metrics.outerWidth / metrics.innerWidth : null;

  return (
    <ToolGrid>
      <Panel
        title="Viewport"
        description="Live CSS-pixel measurements for the window content area."
        actions={<Badge>Live</Badge>}
      >
        <div className="space-y-2.5">
          <InlineRow label="Window inner size">{size(metrics.innerWidth, metrics.innerHeight)}</InlineRow>
          <InlineRow label="Document client size">
            {size(metrics.clientWidth, metrics.clientHeight)}
          </InlineRow>
          <InlineRow label="Window outer size">
            {size(metrics.outerWidth, metrics.outerHeight)}
          </InlineRow>
          <InlineRow label="Device pixels (viewpoint)">
            {pixels(metrics.innerWidth, metrics.innerHeight, metrics.dpr)}
          </InlineRow>
          <InlineRow label="Device pixel ratio">
            {metrics.dpr.toFixed(2).replace(/\.?0+$/, "")}×
          </InlineRow>
          {metrics.visualWidth !== null && metrics.visualHeight !== null ? (
            <InlineRow label="Visual viewport">
              {size(metrics.visualWidth, metrics.visualHeight)}
            </InlineRow>
          ) : null}
          <InlineRow label="Orientation">{metrics.orientation}</InlineRow>
        </div>
      </Panel>

      <Panel title="Screen" description="The whole display, as reported by the browser.">
        <div className="space-y-2.5">
          <InlineRow label="Screen size (CSS px)">
            {size(metrics.screenWidth, metrics.screenHeight)}
          </InlineRow>
          <InlineRow label="Screen size (device px)">
            {pixels(metrics.screenWidth, metrics.screenHeight, metrics.dpr)}
          </InlineRow>
          <InlineRow label="Available size">
            {size(metrics.availWidth, metrics.availHeight)}
          </InlineRow>
          <InlineRow label="Color depth">{metrics.colorDepth}-bit per pixel</InlineRow>
          <InlineRow label="Pixel depth">{metrics.pixelDepth}-bit per pixel</InlineRow>
          <InlineRow label="Device-pixel width">
            {metrics.screenWidth > 0
              ? `${formatNumber(Math.round(metrics.screenWidth * metrics.dpr))} px`
              : "—"}
          </InlineRow>
        </div>
      </Panel>

      <Panel title="Zoom estimate" description="How page and pinch zoom affect the layout viewport.">
        <div className="space-y-2.5">
          <InlineRow label="Visual viewport scale">
            {metrics.visualScale !== null ? `${metrics.visualScale.toFixed(2)}×` : "Unavailable"}
          </InlineRow>
          <InlineRow label="Outer / inner width ratio">
            {pageZoom !== null ? `${pageZoom.toFixed(2)}×` : "Unavailable"}
          </InlineRow>
          <InlineRow label="Input pointer">
            {metrics.coarsePointer ? "Coarse (touch)" : metrics.finePointer ? "Fine (mouse or pen)" : "Unknown"}
          </InlineRow>
          <InlineRow label="Hover">{metrics.canHover ? "Supported" : "Not supported"}</InlineRow>
          <InlineRow label="Touch points">{metrics.maxTouchPoints}</InlineRow>
        </div>
        <Alert tone="info" className="mt-3">
          Pinch zoom is read directly from the visual viewport. The outer/inner ratio also includes
          browser window chrome, so treat it as a rough page-zoom hint rather than an exact value.
        </Alert>
      </Panel>

      <Panel title="What the numbers mean" description="CSS pixels and device pixels differ on high-DPI screens.">
        <div className="space-y-2.5 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-mono text-text">1 CSS px</span> is a layout unit; the browser draws
            it with <span className="font-mono text-text">{metrics.dpr.toFixed(2)}×</span> device
            pixels per side at the current DPR.
          </p>
          <p>
            A viewport of{" "}
            <span className="font-mono text-text">{size(metrics.innerWidth, metrics.innerHeight)}</span>{" "}
            CSS px therefore covers{" "}
            <span className="font-mono text-text">
              {pixels(metrics.innerWidth, metrics.innerHeight, metrics.dpr)}
            </span>{" "}
            device pixels.
          </p>
          <p>
            Media queries and canvas backing stores use these values. Set a canvas{" "}
            <span className="font-mono text-text">width</span> and{" "}
            <span className="font-mono text-text">height</span> to device pixels, then scale the
            context to keep drawing coordinates in CSS pixels.
          </p>
        </div>
        {metrics.screenWidth === 0 ? (
          <EmptyState
            icon={<Monitor className="size-5" aria-hidden />}
            title="Screen details are hidden"
            description="This environment reports a zero-sized screen, which is common in headless browsers."
          />
        ) : null}
      </Panel>
    </ToolGrid>
  );
}
