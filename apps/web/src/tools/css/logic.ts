import { clamp } from "@/lib/utils";

/* ------------------------------------------------------------------ colors */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsla {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Oklcha {
  l: number;
  c: number;
  h: number;
  a: number;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function trimmedNumber(value: number, digits: number): string {
  return String(round(value, digits));
}

function parseNumber(token: string): number | null {
  const value = token.trim();
  if (!value) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

function parseHue(token: string): number | null {
  const value = token.trim().toLowerCase();
  if (value.endsWith("deg")) {
    const parsed = parseNumber(value.slice(0, -3));
    return parsed === null ? null : normalizeHue(parsed);
  }
  if (value.endsWith("turn")) {
    const parsed = parseNumber(value.slice(0, -4));
    return parsed === null ? null : normalizeHue(parsed * 360);
  }
  if (value.endsWith("rad")) {
    const parsed = parseNumber(value.slice(0, -3));
    return parsed === null ? null : normalizeHue((parsed * 180) / Math.PI);
  }
  const parsed = parseNumber(value);
  return parsed === null ? null : normalizeHue(parsed);
}

function parsePercent(token: string): number | null {
  const value = token.trim();
  const raw = value.endsWith("%") ? value.slice(0, -1) : value;
  const parsed = parseNumber(raw);
  return parsed === null ? null : clamp(parsed, 0, 100);
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const value = token.trim();
  if (!value) return null;
  if (value.endsWith("%")) {
    const parsed = parseNumber(value.slice(0, -1));
    return parsed === null ? null : clamp(parsed / 100, 0, 1);
  }
  const parsed = parseNumber(value);
  return parsed === null ? null : clamp(parsed, 0, 1);
}

function parseRgbChannel(token: string): number | null {
  const value = token.trim();
  if (value.endsWith("%")) {
    const parsed = parseNumber(value.slice(0, -1));
    return parsed === null ? null : clamp((parsed / 100) * 255, 0, 255);
  }
  const parsed = parseNumber(value);
  return parsed === null ? null : clamp(parsed, 0, 255);
}

function splitChannels(body: string): string[] {
  return body
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function splitColorBody(body: string): { channels: string[]; alpha?: string } | null {
  const pieces = body.split("/");
  if (pieces.length > 2) return null;
  const channels = splitChannels(pieces[0] ?? "");
  const alpha = pieces[1]?.trim();
  return { channels, alpha: alpha || undefined };
}

export function parseHex(input: string): Rgba | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1];
  if (!digits) return null;
  const expand = (value: string): number =>
    parseInt(value.length === 1 ? `${value}${value}` : value, 16);
  if (digits.length <= 4) {
    return {
      r: expand(digits[0] ?? "0"),
      g: expand(digits[1] ?? "0"),
      b: expand(digits[2] ?? "0"),
      a: digits.length === 4 ? expand(digits[3] ?? "f") / 255 : 1,
    };
  }
  return {
    r: expand(digits.slice(0, 2)),
    g: expand(digits.slice(2, 4)),
    b: expand(digits.slice(4, 6)),
    a: digits.length === 8 ? expand(digits.slice(6, 8)) / 255 : 1,
  };
}

function parseRgbFunction(body: string): Rgba | null {
  const split = splitColorBody(body);
  if (!split) return null;
  let alpha = split.alpha;
  const channels = [...split.channels];
  if (alpha === undefined && channels.length === 4) alpha = channels.pop();
  if (channels.length !== 3) return null;
  const r = parseRgbChannel(channels[0] ?? "");
  const g = parseRgbChannel(channels[1] ?? "");
  const b = parseRgbChannel(channels[2] ?? "");
  const a = parseAlpha(alpha);
  if (r === null || g === null || b === null || a === null) return null;
  return { r, g, b, a };
}

function parseHslFunction(body: string): Rgba | null {
  const split = splitColorBody(body);
  if (!split) return null;
  let alpha = split.alpha;
  const channels = [...split.channels];
  if (alpha === undefined && channels.length === 4) alpha = channels.pop();
  if (channels.length !== 3) return null;
  const h = parseHue(channels[0] ?? "");
  const s = parsePercent(channels[1] ?? "");
  const l = parsePercent(channels[2] ?? "");
  const a = parseAlpha(alpha);
  if (h === null || s === null || l === null || a === null) return null;
  return hslToRgb(h, s / 100, l / 100, a);
}

function parseHsvFunction(body: string): Rgba | null {
  const split = splitColorBody(body);
  if (!split) return null;
  let alpha = split.alpha;
  const channels = [...split.channels];
  if (alpha === undefined && channels.length === 4) alpha = channels.pop();
  if (channels.length !== 3) return null;
  const h = parseHue(channels[0] ?? "");
  const s = parsePercent(channels[1] ?? "");
  const v = parsePercent(channels[2] ?? "");
  const a = parseAlpha(alpha);
  if (h === null || s === null || v === null || a === null) return null;
  return hsvToRgb(h, s / 100, v / 100, a);
}

function parseOklchFunction(body: string): Rgba | null {
  const split = splitColorBody(body);
  if (!split || split.channels.length !== 3) return null;
  const rawL = (split.channels[0] ?? "").trim();
  const rawC = (split.channels[1] ?? "").trim();
  const rawH = split.channels[2] ?? "";

  const lValue = rawL.endsWith("%")
    ? parseNumber(rawL.slice(0, -1))
    : parseNumber(rawL);
  if (lValue === null) return null;
  const l = rawL.endsWith("%") ? lValue / 100 : lValue;
  const c = parseNumber(rawC);
  const h = parseHue(rawH);
  const a = parseAlpha(split.alpha);
  if (c === null || h === null || a === null) return null;
  return oklchToRgb(clamp(l, 0, 1), clamp(c, 0, 0.5), h, a);
}

/**
 * Parses hex, rgb(), hsl(), hsv()/hsb(), and oklch() values. Returns null when
 * the value is not one of the supported formats.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith("#") || /^[0-9a-f]{3,8}$/i.test(value)) {
    return parseHex(value);
  }
  const match = /^([a-z]+)\((.*)\)$/i.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").toLowerCase();
  const body = match[2] ?? "";
  switch (name) {
    case "rgb":
    case "rgba":
      return parseRgbFunction(body);
    case "hsl":
    case "hsla":
      return parseHslFunction(body);
    case "hsv":
    case "hsva":
    case "hsb":
    case "hsba":
      return parseHsvFunction(body);
    case "oklch":
      return parseOklchFunction(body);
    default:
      return null;
  }
}

export function rgbToHsl(color: Rgba): Hsla {
  const r = clamp(color.r, 0, 255) / 255;
  const g = clamp(color.g, 0, 255) / 255;
  const b = clamp(color.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  return { h: round(h, 1), s: round(s * 100, 1), l: round(l * 100, 1), a: color.a };
}

function hueToChannel(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number, a = 1): Rgba {
  const hue = normalizeHue(h) / 360;
  const saturation = clamp(s, 0, 1);
  const lightness = clamp(l, 0, 1);
  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return { r: channel, g: channel, b: channel, a: clamp(a, 0, 1) };
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueToChannel(p, q, hue + 1 / 3) * 255,
    g: hueToChannel(p, q, hue) * 255,
    b: hueToChannel(p, q, hue - 1 / 3) * 255,
    a: clamp(a, 0, 1),
  };
}

export function rgbToHsv(color: Rgba): Hsva {
  const r = clamp(color.r, 0, 255) / 255;
  const g = clamp(color.g, 0, 255) / 255;
  const b = clamp(color.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  return {
    h: round(normalizeHue(h), 1),
    s: round((max === 0 ? 0 : delta / max) * 100, 1),
    v: round(max * 100, 1),
    a: color.a,
  };
}

export function hsvToRgb(h: number, s: number, v: number, a = 1): Rgba {
  const hue = normalizeHue(h) / 60;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const index = Math.floor(hue) % 6;
  const fraction = hue - Math.floor(hue);
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  let r = value;
  let g = t;
  let b = p;
  if (index === 1) [r, g, b] = [q, value, p];
  else if (index === 2) [r, g, b] = [p, value, t];
  else if (index === 3) [r, g, b] = [p, q, value];
  else if (index === 4) [r, g, b] = [t, p, value];
  else if (index === 5) [r, g, b] = [value, p, q];
  return { r: r * 255, g: g * 255, b: b * 255, a: clamp(a, 0, 1) };
}

function srgbToLinear(channel: number): number {
  const value = clamp(channel, 0, 255) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp(value * 255, 0, 255);
}

export function rgbToOklch(color: Rgba): Oklcha {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const aAxis = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.sqrt(aAxis * aAxis + bAxis * bAxis);
  const hue = normalizeHue((Math.atan2(bAxis, aAxis) * 180) / Math.PI);
  return {
    l: round(lightness, 4),
    c: round(chroma, 4),
    h: round(hue, 1),
    a: color.a,
  };
}

export function oklchToRgb(l: number, c: number, h: number, a = 1): Rgba {
  const hue = (normalizeHue(h) * Math.PI) / 180;
  const aAxis = c * Math.cos(hue);
  const bAxis = c * Math.sin(hue);
  const lRoot = l + 0.3963377774 * aAxis + 0.2158037573 * bAxis;
  const mRoot = l - 0.1055613458 * aAxis - 0.0638541728 * bAxis;
  const sRoot = l - 0.0894841775 * aAxis - 1.291485548 * bAxis;
  const lCube = lRoot ** 3;
  const mCube = mRoot ** 3;
  const sCube = sRoot ** 3;
  const linR = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const linG = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const linB = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube;
  return {
    r: linearToSrgb(linR),
    g: linearToSrgb(linG),
    b: linearToSrgb(linB),
    a: clamp(a, 0, 1),
  };
}

export function formatHex(color: Rgba, includeAlpha = true): string {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  const base = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  const alpha = clamp(color.a, 0, 1);
  if (!includeAlpha || alpha >= 1) return base;
  return `${base}${channel(alpha * 255)}`;
}

export function formatRgb(color: Rgba): string {
  const r = Math.round(clamp(color.r, 0, 255));
  const g = Math.round(clamp(color.g, 0, 255));
  const b = Math.round(clamp(color.b, 0, 255));
  if (color.a >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${trimmedNumber(clamp(color.a, 0, 1), 3)})`;
}

export function formatHsl(color: Rgba): string {
  const hsl = rgbToHsl(color);
  const prefix = color.a >= 1 ? "hsl" : "hsla";
  const alpha = color.a >= 1 ? "" : `, ${trimmedNumber(clamp(color.a, 0, 1), 3)}`;
  return `${prefix}(${trimmedNumber(hsl.h, 1)}, ${trimmedNumber(hsl.s, 1)}%, ${trimmedNumber(hsl.l, 1)}%${alpha})`;
}

export function formatHsv(color: Rgba): string {
  const hsv = rgbToHsv(color);
  const prefix = color.a >= 1 ? "hsv" : "hsva";
  const alpha = color.a >= 1 ? "" : `, ${trimmedNumber(clamp(color.a, 0, 1), 3)}`;
  return `${prefix}(${trimmedNumber(hsv.h, 1)}, ${trimmedNumber(hsv.s, 1)}%, ${trimmedNumber(hsv.v, 1)}%${alpha})`;
}

export function formatOklch(color: Rgba): string {
  const oklch = rgbToOklch(color);
  const alpha = color.a >= 1 ? "" : ` / ${trimmedNumber(clamp(color.a, 0, 1), 3)}`;
  return `oklch(${trimmedNumber(oklch.l * 100, 1)}% ${trimmedNumber(oklch.c, 4)} ${trimmedNumber(oklch.h, 1)}${alpha})`;
}

export function compositeOver(foreground: Rgba, background: Rgba): Rgba {
  const fgAlpha = clamp(foreground.a, 0, 1);
  const bgAlpha = clamp(background.a, 0, 1);
  const alpha = fgAlpha + bgAlpha * (1 - fgAlpha);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const blend = (fg: number, bg: number): number =>
    (fg * fgAlpha + bg * bgAlpha * (1 - fgAlpha)) / alpha;
  return {
    r: blend(foreground.r, background.r),
    g: blend(foreground.g, background.g),
    b: blend(foreground.b, background.b),
    a: alpha,
  };
}

export function relativeLuminance(color: Rgba): number {
  return (
    0.2126 * srgbToLinear(color.r) +
    0.7152 * srgbToLinear(color.g) +
    0.0722 * srgbToLinear(color.b)
  );
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(background: Rgba): "#000000" | "#ffffff" {
  const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  return contrastRatio(background, black) >= contrastRatio(background, white)
    ? "#000000"
    : "#ffffff";
}

export interface WcagLevels {
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
}

export function wcagLevels(ratio: number): WcagLevels {
  return {
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}

/* ----------------------------------------------------------------- shadows */

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
}

export function shadowLayerToCss(layer: ShadowLayer): string {
  assertFinite(layer.x, "Horizontal offset");
  assertFinite(layer.y, "Vertical offset");
  assertFinite(layer.blur, "Blur radius");
  assertFinite(layer.spread, "Spread radius");
  assertFinite(layer.opacity, "Opacity");
  if (layer.blur < 0) throw new Error("Blur radius cannot be negative.");
  if (layer.opacity < 0 || layer.opacity > 100) {
    throw new Error("Opacity must be between 0 and 100.");
  }
  const base = parseColor(layer.color);
  if (!base) throw new Error(`Invalid shadow color "${layer.color}".`);
  const color: Rgba = { ...base, a: clamp(base.a * (layer.opacity / 100), 0, 1) };
  const parts = [
    layer.inset ? "inset" : "",
    `${trimmedNumber(layer.x, 2)}px`,
    `${trimmedNumber(layer.y, 2)}px`,
    `${trimmedNumber(layer.blur, 2)}px`,
    `${trimmedNumber(layer.spread, 2)}px`,
    formatRgb(color),
  ].filter(Boolean);
  return parts.join(" ");
}

export function boxShadowValue(layers: ShadowLayer[]): string {
  if (layers.length === 0) throw new Error("Add at least one shadow layer.");
  return layers.map(shadowLayerToCss).join(", ");
}

export function boxShadowCss(layers: ShadowLayer[], selector = ".shadow"): string {
  return `${selector} {\n  box-shadow: ${boxShadowValue(layers)};\n}`;
}

/* ---------------------------------------------------------------- gradients */

export type GradientType = "linear" | "radial";

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientConfig {
  type: GradientType;
  angle: number;
  shape: "ellipse" | "circle";
  positionX: number;
  positionY: number;
  stops: GradientStop[];
}

function gradientStopsCss(stops: GradientStop[]): string[] {
  if (stops.length < 2) throw new Error("Add at least two color stops.");
  return stops
    .map((stop, index) => {
      assertFinite(stop.position, "Stop position");
      if (stop.position < 0 || stop.position > 100) {
        throw new Error("Stop positions must be between 0% and 100%.");
      }
      const color = parseColor(stop.color);
      if (!color) throw new Error(`Invalid stop color "${stop.color}".`);
      return {
        index,
        position: stop.position,
        text: `${formatHex(color)} ${trimmedNumber(stop.position, 2)}%`,
      };
    })
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((stop) => stop.text);
}

export function gradientToCss(config: GradientConfig): string {
  const stops = gradientStopsCss(config.stops);
  if (config.type === "linear") {
    assertFinite(config.angle, "Angle");
    return `linear-gradient(${trimmedNumber(normalizeHue(config.angle), 2)}deg, ${stops.join(", ")})`;
  }
  assertFinite(config.positionX, "Horizontal position");
  assertFinite(config.positionY, "Vertical position");
  if (
    config.positionX < 0 ||
    config.positionX > 100 ||
    config.positionY < 0 ||
    config.positionY > 100
  ) {
    throw new Error("Radial position must be between 0% and 100%.");
  }
  return `radial-gradient(${config.shape} at ${trimmedNumber(config.positionX, 2)}% ${trimmedNumber(config.positionY, 2)}%, ${stops.join(", ")})`;
}

export function gradientCss(config: GradientConfig, selector = ".gradient"): string {
  return `${selector} {\n  background-image: ${gradientToCss(config)};\n}`;
}

/* ---------------------------------------------------------------- minifier */

const NO_SPACE_AFTER = new Set(["{", "}", ";", ":", ",", "(", ">"]);
const NO_SPACE_BEFORE = new Set(["{", "}", ";", ":", ",", ")", ">"]);
const IDENT_CHAR = /[a-z0-9_-]/i;

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";
}

function scanString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) return index + 1;
    index += 1;
  }
  throw new Error("Unterminated string. Add the closing quote.");
}

function scanUrl(source: string, openParen: number): number {
  let depth = 1;
  let index = openParen + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = scanString(source, index);
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  throw new Error("Unterminated url(). Add the closing parenthesis.");
}

/**
 * Removes comments and collapses incidental whitespace. Strings and unquoted
 * url() contents are copied verbatim, and spaces around calc() operators are
 * kept so expressions stay valid.
 */
export function minifyCss(source: string): string {
  let output = "";
  let pendingSpace = false;
  let index = 0;

  const flushSpace = (next: string): void => {
    if (!pendingSpace) return;
    pendingSpace = false;
    if (!output) return;
    const previous = output[output.length - 1] ?? "";
    if (NO_SPACE_AFTER.has(previous) || NO_SPACE_BEFORE.has(next)) return;
    output += " ";
  };

  while (index < source.length) {
    const char = source[index] ?? "";

    if (isWhitespace(char)) {
      pendingSpace = true;
      index += 1;
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) throw new Error("Unterminated comment. Add the closing */.");
      pendingSpace = true;
      index = end + 2;
      continue;
    }

    if (char === '"' || char === "'") {
      flushSpace(char);
      const end = scanString(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }

    if (char === "\\") {
      flushSpace(char);
      output += source.slice(index, index + 2);
      index += 2;
      continue;
    }

    const isUrlFunction =
      (char === "u" || char === "U") &&
      source.slice(index, index + 4).toLowerCase() === "url(" &&
      !IDENT_CHAR.test(output[output.length - 1] ?? "");
    if (isUrlFunction) {
      flushSpace(char);
      const end = scanUrl(source, index + 3);
      output += source.slice(index, end);
      index = end;
      continue;
    }

    flushSpace(char);
    output += char;
    index += 1;
  }

  return output.trim();
}

/* --------------------------------------------------------------- px and rem */

export type LengthDirection = "px-to-rem" | "rem-to-px";

export interface LengthRow {
  input: string;
  px: number;
  rem: number;
}

export interface LengthBatchResult {
  rows: LengthRow[];
  errors: string[];
}

export interface ParsedLength {
  value: number;
  unit: "px" | "rem" | "unitless";
}

function assertBaseFontSize(base: number): void {
  if (!Number.isFinite(base) || base <= 0) {
    throw new Error("Base font size must be a positive number.");
  }
}

export function pxToRem(px: number, base: number): number {
  assertFinite(px, "Pixel value");
  assertBaseFontSize(base);
  return round(px / base, 4);
}

export function remToPx(rem: number, base: number): number {
  assertFinite(rem, "Rem value");
  assertBaseFontSize(base);
  return round(rem * base, 4);
}

export function parseLengthToken(token: string): ParsedLength | null {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(px|rem)?$/i.exec(token.trim());
  if (!match || !match[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase();
  return { value, unit: unit === "px" || unit === "rem" ? unit : "unitless" };
}

export function formatLength(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(round(value, 4));
}

export function convertLengthBatch(
  text: string,
  base: number,
  direction: LengthDirection,
): LengthBatchResult {
  const rows: LengthRow[] = [];
  const errors: string[] = [];
  if (!Number.isFinite(base) || base <= 0) {
    return { rows, errors: ["Base font size must be a positive number."] };
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > 500) {
    return { rows, errors: ["Limit each batch to 500 values."] };
  }
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed = parseLengthToken(trimmed);
    if (!parsed) {
      errors.push(`Line ${index + 1}: "${trimmed}" is not a px or rem value.`);
      return;
    }
    let px: number;
    if (parsed.unit === "rem") px = remToPx(parsed.value, base);
    else if (parsed.unit === "px") px = round(parsed.value, 4);
    else if (direction === "px-to-rem") px = round(parsed.value, 4);
    else px = remToPx(parsed.value, base);
    rows.push({ input: trimmed, px, rem: round(px / base, 4) });
  });
  return { rows, errors };
}

/* ---------------------------------------------------------- border radius */

export type RadiusCorners = readonly [number, number, number, number];

export interface BorderRadiusConfig {
  uniform: boolean;
  horizontal: RadiusCorners;
  vertical: RadiusCorners;
  elliptical: boolean;
}

function radiusToken(value: number): string {
  assertFinite(value, "Radius");
  if (value < 0) throw new Error("Radii cannot be negative.");
  return `${formatLength(value)}px`;
}

export function borderRadiusValue(config: BorderRadiusConfig): string {
  if (config.uniform) return radiusToken(config.horizontal[0]);
  const horizontal = config.horizontal.map(radiusToken).join(" ");
  if (!config.elliptical) return horizontal;
  const vertical = config.vertical.map(radiusToken).join(" ");
  return `${horizontal} / ${vertical}`;
}

export function borderRadiusCss(
  config: BorderRadiusConfig,
  selector = ".radius",
): string {
  return `${selector} {\n  border-radius: ${borderRadiusValue(config)};\n}`;
}

/* ----------------------------------------------------------- flex and grid */

export type FlexGridDisplay = "flex" | "grid";

export interface FlexGridConfig {
  display: FlexGridDisplay;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: number;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridAutoFlow: string;
  justifyItems: string;
  itemGrow: number;
  itemShrink: number;
  itemBasis: string;
  alignSelf: string;
  justifySelf: string;
  order: number;
}

export const DEFAULT_FLEX_GRID_CONFIG: FlexGridConfig = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  alignContent: "stretch",
  gap: 16,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gridTemplateRows: "auto",
  gridAutoFlow: "row",
  justifyItems: "stretch",
  itemGrow: 1,
  itemShrink: 1,
  itemBasis: "auto",
  alignSelf: "auto",
  justifySelf: "auto",
  order: 0,
};

const UNSAFE_CSS = /[;{}<>]/;

export function validateCssValue(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} cannot be empty.`;
  if (trimmed.length > 120) return `${label} must be 120 characters or fewer.`;
  if (UNSAFE_CSS.test(trimmed) || trimmed.includes("/*")) {
    return `${label} cannot contain ; { } < > or comments.`;
  }
  return null;
}

export interface FlexGridResult {
  css: string;
  errors: string[];
}

export function buildFlexGridCss(config: FlexGridConfig): FlexGridResult {
  const errors: string[] = [];
  if (!Number.isFinite(config.gap) || config.gap < 0) {
    errors.push("Gap must be zero or greater.");
  }
  if (!Number.isFinite(config.itemGrow) || config.itemGrow < 0) {
    errors.push("Item grow must be zero or greater.");
  }
  if (!Number.isFinite(config.itemShrink) || config.itemShrink < 0) {
    errors.push("Item shrink must be zero or greater.");
  }
  if (!Number.isFinite(config.order)) errors.push("Item order must be a number.");

  const templateError = validateCssValue(config.gridTemplateColumns, "Grid columns");
  const rowsError = validateCssValue(config.gridTemplateRows, "Grid rows");
  const basisError = validateCssValue(config.itemBasis, "Item basis");
  if (templateError) errors.push(templateError);
  if (rowsError) errors.push(rowsError);
  if (basisError) errors.push(basisError);
  if (errors.length > 0) return { css: "", errors };

  const container: string[] = [`display: ${config.display};`];
  if (config.display === "flex") {
    container.push(`flex-direction: ${config.flexDirection};`);
    container.push(`flex-wrap: ${config.flexWrap};`);
    container.push(`justify-content: ${config.justifyContent};`);
    container.push(`align-items: ${config.alignItems};`);
    container.push(`align-content: ${config.alignContent};`);
  } else {
    container.push(`grid-template-columns: ${config.gridTemplateColumns.trim()};`);
    container.push(`grid-template-rows: ${config.gridTemplateRows.trim()};`);
    container.push(`grid-auto-flow: ${config.gridAutoFlow};`);
    container.push(`justify-items: ${config.justifyItems};`);
    container.push(`align-items: ${config.alignItems};`);
  }
  container.push(`gap: ${formatLength(config.gap)}px;`);

  const item = [
    `flex: ${formatLength(config.itemGrow)} ${formatLength(config.itemShrink)} ${config.itemBasis.trim()};`,
    `align-self: ${config.alignSelf};`,
    `justify-self: ${config.justifySelf};`,
    `order: ${Math.trunc(config.order)};`,
  ];

  const css = [
    ".container {",
    ...container.map((line) => `  ${line}`),
    "}",
    "",
    ".item {",
    ...item.map((line) => `  ${line}`),
    "}",
    "",
  ].join("\n");

  return { css, errors };
}

/* --------------------------------------------------------------- tailwind */

export type TailwindCategory =
  | "layout"
  | "spacing"
  | "typography"
  | "color"
  | "borders"
  | "effects"
  | "flex-grid";

export interface TailwindUtility {
  className: string;
  category: TailwindCategory;
  description: string;
  css: string;
  keywords?: string[];
}

export interface TailwindCategoryInfo {
  id: TailwindCategory;
  label: string;
}

export const TAILWIND_CATEGORIES: TailwindCategoryInfo[] = [
  { id: "layout", label: "Layout" },
  { id: "flex-grid", label: "Flexbox & Grid" },
  { id: "spacing", label: "Spacing" },
  { id: "typography", label: "Typography" },
  { id: "color", label: "Color" },
  { id: "borders", label: "Borders" },
  { id: "effects", label: "Effects" },
];

function scoreUtility(utility: TailwindUtility, query: string): number {
  const className = utility.className.toLowerCase();
  const description = utility.description.toLowerCase();
  const css = utility.css.toLowerCase();
  const keywords = (utility.keywords ?? []).map((keyword) => keyword.toLowerCase());
  if (className === query) return 120;
  if (className.startsWith(query)) return 100;
  if (className.includes(query)) return 80;
  if (keywords.some((keyword) => keyword === query)) return 70;
  if (keywords.some((keyword) => keyword.startsWith(query))) return 55;
  if (description.includes(query)) return 40;
  if (keywords.some((keyword) => keyword.includes(query))) return 30;
  if (css.includes(query)) return 15;
  return 0;
}

export function searchTailwindUtilities(
  utilities: TailwindUtility[],
  query: string,
  category: TailwindCategory | "all" = "all",
): TailwindUtility[] {
  const normalized = query.trim().toLowerCase();
  return utilities
    .filter((utility) => category === "all" || utility.category === category)
    .map((utility) => ({
      utility,
      score: normalized ? scoreUtility(utility, normalized) : 1,
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.utility.className.localeCompare(b.utility.className),
    )
    .map((entry) => entry.utility);
}
