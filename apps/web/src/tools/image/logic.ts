import { base64ToBytes, bytesToBase64 } from "@/lib/encoding";

/** Hard limits that keep canvas allocation bounded on all tools. */
export const MAX_CANVAS_DIMENSION = 8192;
export const MAX_CANVAS_PIXELS = 36_000_000;
export const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BASE64_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_SVG_BYTES = 5 * 1024 * 1024;

export interface Dimensions {
  width: number;
  height: number;
}

export type ImageFormat = "png" | "jpeg" | "webp" | "avif";

export const IMAGE_FORMATS: Array<{ value: ImageFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
];

export function isLossyFormat(format: ImageFormat): boolean {
  return format !== "png";
}

export function mimeForFormat(format: ImageFormat): { mime: string; extension: string } {
  switch (format) {
    case "png":
      return { mime: "image/png", extension: "png" };
    case "jpeg":
      return { mime: "image/jpeg", extension: "jpg" };
    case "webp":
      return { mime: "image/webp", extension: "webp" };
    case "avif":
      return { mime: "image/avif", extension: "avif" };
  }
}

export function extensionForMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/svg+xml") return "svg";
  if (normalized === "image/tiff") return "tiff";
  const match = /^image\/([a-z0-9.+-]+)$/.exec(normalized);
  return match ? match[1] : "bin";
}

export function fileBaseName(filename: string): string {
  const withoutPath = filename.split(/[\\/]/).pop() ?? filename;
  return withoutPath.replace(/\.[^.]*$/, "") || "image";
}

export function withExtension(filename: string, extension: string): string {
  return `${fileBaseName(filename)}.${extension}`;
}

export function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Parses a user-entered pixel value. Returns null for blanks and invalid numbers. */
export function parseDimension(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isPositiveInt(value) ? value : null;
}

export function validateCanvasSize(width: number, height: number): string | null {
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    return "Width and height must be positive whole numbers.";
  }
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    return `Each dimension is capped at ${MAX_CANVAS_DIMENSION} px.`;
  }
  if (width * height > MAX_CANVAS_PIXELS) {
    return `The output is too large. Keep the canvas under ${MAX_CANVAS_PIXELS.toLocaleString()} pixels.`;
  }
  return null;
}

export function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
  allowUpscale = false,
): Dimensions {
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    throw new Error("Source dimensions must be positive.");
  }
  if (!isPositiveInt(maxWidth) || !isPositiveInt(maxHeight)) {
    throw new Error("Target dimensions must be positive.");
  }
  if (!allowUpscale && width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function fitToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
  allowUpscale = false,
): Dimensions {
  if (!isPositiveInt(width) || !isPositiveInt(height) || !isPositiveInt(maxEdge)) {
    throw new Error("Image and maximum edge must be positive.");
  }
  const longest = Math.max(width, height);
  if (!allowUpscale && longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function scaleByPercent(width: number, height: number, percent: number): Dimensions {
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    throw new Error("Source dimensions must be positive.");
  }
  if (!Number.isFinite(percent) || percent <= 0) {
    throw new Error("Percentage must be greater than zero.");
  }
  return {
    width: Math.max(1, Math.round((width * percent) / 100)),
    height: Math.max(1, Math.round((height * percent) / 100)),
  };
}

export function containRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (
    !isPositiveInt(sourceWidth) ||
    !isPositiveInt(sourceHeight) ||
    !isPositiveInt(targetWidth) ||
    !isPositiveInt(targetHeight)
  ) {
    throw new Error("Dimensions must be positive.");
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.min(targetWidth, Math.max(1, Math.round(sourceWidth * scale)));
  const height = Math.min(targetHeight, Math.max(1, Math.round(sourceHeight * scale)));
  return {
    x: Math.max(0, Math.floor((targetWidth - width) / 2)),
    y: Math.max(0, Math.floor((targetHeight - height) / 2)),
    width,
    height,
  };
}

export function savingsPercent(originalBytes: number, outputBytes: number): number {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) return 0;
  if (!Number.isFinite(outputBytes) || outputBytes < 0) return 0;
  return ((originalBytes - outputBytes) / originalBytes) * 100;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}%`;
}

// ---------------------------------------------------------------------------
// Crop math. Crop areas are normalized to the unit square.
// ---------------------------------------------------------------------------

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampCropArea(area: CropArea): CropArea {
  const x = clamp01(Number.isFinite(area.x) ? area.x : 0);
  const y = clamp01(Number.isFinite(area.y) ? area.y : 0);
  const width = clamp01(Number.isFinite(area.width) ? area.width : 0);
  const height = clamp01(Number.isFinite(area.height) ? area.height : 0);
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

export function centerCrop(aspect: number | null): CropArea {
  if (aspect === null) return { x: 0, y: 0, width: 1, height: 1 };
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error("Aspect ratio must be greater than zero.");
  }
  let width = 1;
  let height = 1;
  if (aspect >= 1) {
    height = 1 / aspect;
  } else {
    width = aspect;
  }
  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
}

/** Builds a crop rectangle from a drag between two normalized points. */
export function cropFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  aspect: number | null,
): CropArea {
  const startX = clamp01(start.x);
  const startY = clamp01(start.y);
  const endX = clamp01(end.x);
  const endY = clamp01(end.y);
  let width = Math.abs(endX - startX);
  let height = Math.abs(endY - startY);

  if (aspect !== null) {
    if (!Number.isFinite(aspect) || aspect <= 0) {
      throw new Error("Aspect ratio must be greater than zero.");
    }
    width = Math.max(width, height * aspect);
    height = width / aspect;
    const maxWidth = endX < startX ? startX : 1 - startX;
    const maxHeight = endY < startY ? startY : 1 - startY;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspect;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
  }

  return clampCropArea({
    x: endX < startX ? startX - width : startX,
    y: endY < startY ? startY - height : startY,
    width,
    height,
  });
}

export function cropPixels(area: CropArea, sourceWidth: number, sourceHeight: number): CropPixels {
  if (!isPositiveInt(sourceWidth) || !isPositiveInt(sourceHeight)) {
    throw new Error("Source dimensions must be positive.");
  }
  const normalized = clampCropArea(area);
  if (normalized.width <= 0 || normalized.height <= 0) {
    throw new Error("Select a crop area first.");
  }
  let x = Math.min(sourceWidth - 1, Math.max(0, Math.round(normalized.x * sourceWidth)));
  let y = Math.min(sourceHeight - 1, Math.max(0, Math.round(normalized.y * sourceHeight)));
  let width = Math.max(1, Math.round(normalized.width * sourceWidth));
  let height = Math.max(1, Math.round(normalized.height * sourceHeight));
  width = Math.min(width, sourceWidth - x);
  height = Math.min(height, sourceHeight - y);
  if (width < 1 || height < 1) throw new Error("The crop area is outside the image.");
  x = Math.max(0, x);
  y = Math.max(0, y);
  return { x, y, width, height };
}

export function cropFromPixels(
  rect: CropPixels,
  sourceWidth: number,
  sourceHeight: number,
): CropArea {
  if (!isPositiveInt(sourceWidth) || !isPositiveInt(sourceHeight)) {
    throw new Error("Source dimensions must be positive.");
  }
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new Error("Crop width and height must be greater than zero.");
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > sourceWidth || rect.y + rect.height > sourceHeight) {
    throw new Error("The crop rectangle must stay inside the image.");
  }
  return {
    x: rect.x / sourceWidth,
    y: rect.y / sourceHeight,
    width: rect.width / sourceWidth,
    height: rect.height / sourceHeight,
  };
}

// ---------------------------------------------------------------------------
// Placeholder text sizing.
// ---------------------------------------------------------------------------

export function placeholderFontSize(width: number, height: number, labelLength: number): number {
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    throw new Error("Placeholder dimensions must be positive.");
  }
  const characters = Math.max(1, labelLength);
  const byWidth = width / Math.max(2, characters * 0.58);
  const byHeight = height * 0.3;
  return Math.max(8, Math.min(360, Math.floor(Math.min(byWidth, byHeight))));
}

// ---------------------------------------------------------------------------
// SVG optimization. Uses the XML DOM so path data and attribute values are
// never rewritten by string regular expressions.
// ---------------------------------------------------------------------------

export interface SvgOptimizeStats {
  comments: number;
  metadata: number;
  editorNodes: number;
  editorAttributes: number;
  whitespaceNodes: number;
}

export interface SvgOptimizeResult {
  output: string;
  stats: SvgOptimizeStats;
}

const EDITOR_PREFIXES = ["inkscape", "sodipodi", "sketch", "figma", "adobe", "serif"];
const TEXT_WHITESPACE_ELEMENTS = new Set([
  "text",
  "tspan",
  "textpath",
  "style",
  "script",
  "title",
  "desc",
]);

function isEditorName(name: string): boolean {
  const lower = name.toLowerCase();
  return EDITOR_PREFIXES.some(
    (prefix) =>
      lower === prefix ||
      lower === `xmlns:${prefix}` ||
      lower.startsWith(`${prefix}:`),
  );
}

function preservesWhitespace(element: Element | null): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.getAttribute("xml:space") === "preserve") return true;
    current = current.parentElement;
  }
  return false;
}

export function optimizeSvg(source: string): SvgOptimizeResult {
  if (!source.trim()) {
    throw new Error("Load or paste an SVG document first.");
  }
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.localName.toLowerCase() === "parsererror" || document.querySelector("parsererror")) {
    throw new Error("This text is not valid SVG/XML. Check unclosed tags and broken attributes.");
  }
  if (root.localName.toLowerCase() !== "svg") {
    throw new Error("This document is valid XML but its root element is not <svg>.");
  }

  const stats: SvgOptimizeStats = {
    comments: 0,
    metadata: 0,
    editorNodes: 0,
    editorAttributes: 0,
    whitespaceNodes: 0,
  };

  const comments = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  const commentNodes: Comment[] = [];
  while (comments.nextNode()) commentNodes.push(comments.currentNode as Comment);
  for (const node of commentNodes) {
    node.remove();
    stats.comments += 1;
  }

  const instructions = document.createTreeWalker(document, NodeFilter.SHOW_PROCESSING_INSTRUCTION);
  const instructionNodes: ProcessingInstruction[] = [];
  while (instructions.nextNode()) instructionNodes.push(instructions.currentNode as ProcessingInstruction);
  for (const node of instructionNodes) node.remove();

  const elements = Array.from(document.getElementsByTagName("*"));
  for (const element of elements) {
    if (!element.parentNode) continue;
    const local = element.localName.toLowerCase();
    if (local === "metadata") {
      element.remove();
      stats.metadata += 1;
      continue;
    }
    if (isEditorName(local) || isEditorName(element.nodeName)) {
      element.remove();
      stats.editorNodes += 1;
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (isEditorName(attribute.name)) {
        element.removeAttributeNode(attribute);
        stats.editorAttributes += 1;
      }
    }
  }

  const textNodes = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  const whitespace: Text[] = [];
  while (textNodes.nextNode()) {
    const node = textNodes.currentNode as Text;
    const parent = node.parentElement;
    if (
      parent &&
      node.data.trim() === "" &&
      !TEXT_WHITESPACE_ELEMENTS.has(parent.localName.toLowerCase()) &&
      !preservesWhitespace(parent)
    ) {
      whitespace.push(node);
    }
  }
  for (const node of whitespace) {
    node.remove();
    stats.whitespaceNodes += 1;
  }

  let output = new XMLSerializer().serializeToString(document);
  output = output.replace(/^<\?xml[^>]*\?>\s*/i, "").trim();
  return { output, stats };
}

// ---------------------------------------------------------------------------
// Palette quantization (median cut).
// ---------------------------------------------------------------------------

export interface PaletteColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  count: number;
  percentage: number;
}

interface RgbPoint {
  r: number;
  g: number;
  b: number;
}

interface ColorBox {
  points: RgbPoint[];
  ranges: [number, number, number];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function boxFor(points: RgbPoint[]): ColorBox {
  const ranges: [number, number, number] = [0, 0, 0];
  for (let channel = 0; channel < 3; channel += 1) {
    let min = 255;
    let max = 0;
    for (const point of points) {
      const value = channel === 0 ? point.r : channel === 1 ? point.g : point.b;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    ranges[channel] = max - min;
  }
  return { points, ranges };
}

function channelValue(point: RgbPoint, channel: number): number {
  return channel === 0 ? point.r : channel === 1 ? point.g : point.b;
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] {
  let channel = 0;
  if (box.ranges[1] > box.ranges[channel]) channel = 1;
  if (box.ranges[2] > box.ranges[channel]) channel = 2;
  const sorted = [...box.points].sort(
    (a, b) => channelValue(a, channel) - channelValue(b, channel),
  );
  const middle = Math.floor(sorted.length / 2);
  return [boxFor(sorted.slice(0, middle)), boxFor(sorted.slice(middle))];
}

export function quantizePalette(
  pixels: Uint8ClampedArray,
  colorCount: number,
): PaletteColor[] {
  if (pixels.length % 4 !== 0) {
    throw new Error("Pixel data must be RGBA (four bytes per pixel).");
  }
  if (!Number.isInteger(colorCount) || colorCount < 2 || colorCount > 32) {
    throw new Error("Choose between 2 and 32 colors.");
  }

  const points: RgbPoint[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    points.push({ r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] });
  }
  if (points.length === 0) {
    throw new Error("This image has no visible pixels to sample.");
  }

  const boxes: ColorBox[] = [boxFor(points)];
  while (boxes.length < colorCount) {
    let target = -1;
    let widestRange = 0;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      const range = Math.max(...box.ranges);
      if (box.points.length > 1 && range > widestRange) {
        widestRange = range;
        target = index;
      }
    }
    if (target < 0) break;
    const [left, right] = splitBox(boxes[target]);
    boxes.splice(target, 1, left, right);
  }

  const merged = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (const box of boxes) {
    if (box.points.length === 0) continue;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const point of box.points) {
      r += point.r;
      g += point.g;
      b += point.b;
    }
    const count = box.points.length;
    const red = Math.round(r / count);
    const green = Math.round(g / count);
    const blue = Math.round(b / count);
    const hex = rgbToHex(red, green, blue);
    const current = merged.get(hex);
    if (current) {
      current.count += count;
    } else {
      merged.set(hex, { r: red, g: green, b: blue, count });
    }
  }

  const total = points.length;
  return [...merged.entries()]
    .map(([hex, color]) => ({
      hex,
      r: color.r,
      g: color.g,
      b: color.b,
      count: color.count,
      percentage: (color.count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
}

// ---------------------------------------------------------------------------
// ICO container construction.
// ---------------------------------------------------------------------------

export interface IcoImage {
  size: number;
  png: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function buildIco(images: IcoImage[]): Uint8Array {
  if (images.length === 0) {
    throw new Error("At least one image is required for an ICO file.");
  }
  if (images.length > 255) {
    throw new Error("ICO files support at most 255 images.");
  }
  const headerSize = 6 + images.length * 16;
  let total = headerSize;
  for (const image of images) {
    if (!isPositiveInt(image.size) || image.size > 256) {
      throw new Error("ICO images must be between 1 and 256 pixels.");
    }
    if (image.png.length < 8) {
      throw new Error("ICO image data is empty.");
    }
    for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
      if (image.png[index] !== PNG_SIGNATURE[index]) {
        throw new Error("ICO images must be PNG encoded.");
      }
    }
    total += image.png.length;
  }

  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let offset = headerSize;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    view.setUint8(entry, image.size === 256 ? 0 : image.size);
    view.setUint8(entry + 1, image.size === 256 ? 0 : image.size);
    view.setUint8(entry + 2, 0);
    view.setUint8(entry + 3, 0);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, image.png.length, true);
    view.setUint32(entry + 12, offset, true);
    bytes.set(image.png, offset);
    offset += image.png.length;
  });

  return bytes;
}

// ---------------------------------------------------------------------------
// Image Base64 parsing and MIME detection.
// ---------------------------------------------------------------------------

export interface DetectedImageType {
  mime: string;
  extension: string;
}

export interface ParsedImageBase64 {
  bytes: Uint8Array;
  base64: string;
  dataUrl: string;
  mime: string;
  extension: string;
  declaredMime: string | null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (offset + signature.length > bytes.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let result = "";
  const end = Math.min(bytes.length, start + length);
  for (let index = start; index < end; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

export function detectImageMime(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, PNG_SIGNATURE)) return { mime: "image/png", extension: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", extension: "gif" };
  if (startsWith(bytes, [0x42, 0x4d])) return { mime: "image/bmp", extension: "bmp" };
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return { mime: "image/x-icon", extension: "ico" };
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { mime: "image/tiff", extension: "tiff" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", extension: "avif" };
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { mime: "image/heic", extension: "heic" };
    }
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 1024));
  const withoutBom = text.replace(/^\uFEFF/, "").trimStart();
  if (
    /^<svg[\s>]/i.test(withoutBom) ||
    /^<\?xml[\s\S]*?<svg[\s>]/i.test(withoutBom)
  ) {
    return { mime: "image/svg+xml", extension: "svg" };
  }
  return null;
}

export function parseImageBase64(
  input: string,
  maxBytes = MAX_BASE64_IMAGE_BYTES,
): ParsedImageBase64 {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste Base64 data or a data URL first.");
  }

  let payload = trimmed;
  let declaredMime: string | null = null;
  if (/^data:/i.test(trimmed)) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) throw new Error("This data URL is missing its comma and payload.");
    const metadata = trimmed.slice(5, comma);
    const parts = metadata.split(";");
    declaredMime = (parts[0] || "text/plain").toLowerCase();
    if (!parts.some((part) => part.toLowerCase() === "base64")) {
      throw new Error("Only base64-encoded data URLs are supported.");
    }
    payload = trimmed.slice(comma + 1);
  }

  const bytes = base64ToBytes(payload);
  if (bytes.length === 0) throw new Error("The Base64 payload is empty.");
  if (bytes.length > maxBytes) {
    throw new Error(`The decoded image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  }
  const detected = detectImageMime(bytes);
  if (!detected) {
    throw new Error("The decoded bytes are not a recognized image format.");
  }
  const base64 = bytesToBase64(bytes);
  return {
    bytes,
    base64,
    dataUrl: `data:${detected.mime};base64,${base64}`,
    mime: detected.mime,
    extension: detected.extension,
    declaredMime,
  };
}

// ---------------------------------------------------------------------------
// JPEG APP1 EXIF parser.
// ---------------------------------------------------------------------------

export interface ExifEntry {
  group: string;
  label: string;
  value: string;
  tag: number;
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
}

export interface ExifResult {
  hasExif: boolean;
  entries: ExifEntry[];
  gps: GpsCoordinates | null;
  orientation: number | null;
  note: string;
}

interface RationalValue {
  n: number;
  d: number;
}

type ExifValue = string | number[] | RationalValue[];

interface TiffContext {
  bytes: Uint8Array;
  view: DataView;
  tiffStart: number;
  tiffLength: number;
  little: boolean;
}

interface IfdResult {
  values: Map<number, ExifValue>;
}

const TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

function readU16(context: TiffContext, offset: number): number {
  if (offset < context.tiffStart || offset + 2 > context.tiffStart + context.tiffLength) {
    throw new Error("EXIF offset is outside the segment.");
  }
  return context.view.getUint16(offset, context.little);
}

function readU32(context: TiffContext, offset: number): number {
  if (offset < context.tiffStart || offset + 4 > context.tiffStart + context.tiffLength) {
    throw new Error("EXIF offset is outside the segment.");
  }
  return context.view.getUint32(offset, context.little);
}

function readValue(
  context: TiffContext,
  entryOffset: number,
  type: number,
  count: number,
): ExifValue | null {
  const size = TYPE_SIZES[type];
  if (!size || count <= 0 || count > 4096) return null;
  const total = size * count;
  if (total > context.tiffLength) return null;
  const dataOffset =
    total <= 4 ? entryOffset + 8 : context.tiffStart + readU32(context, entryOffset + 8);
  if (
    dataOffset < context.tiffStart ||
    dataOffset + total > context.tiffStart + context.tiffLength
  ) {
    return null;
  }

  if (type === 2) {
    const raw = context.bytes.subarray(dataOffset, dataOffset + count);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    return decoded.replace(/\0[\s\S]*$/, "").trim();
  }

  const values: number[] = [];
  const rationals: RationalValue[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = dataOffset + index * size;
    switch (type) {
      case 1:
      case 7:
        values.push(context.bytes[position]);
        break;
      case 6:
        values.push(context.view.getInt8(position));
        break;
      case 3:
        values.push(context.view.getUint16(position, context.little));
        break;
      case 8:
        values.push(context.view.getInt16(position, context.little));
        break;
      case 4:
        values.push(context.view.getUint32(position, context.little));
        break;
      case 9:
        values.push(context.view.getInt32(position, context.little));
        break;
      case 11:
        values.push(context.view.getFloat32(position, context.little));
        break;
      case 12:
        values.push(context.view.getFloat64(position, context.little));
        break;
      case 5:
        rationals.push({
          n: context.view.getUint32(position, context.little),
          d: context.view.getUint32(position + 4, context.little),
        });
        break;
      case 10:
        rationals.push({
          n: context.view.getInt32(position, context.little),
          d: context.view.getInt32(position + 4, context.little),
        });
        break;
      default:
        return null;
    }
  }
  return rationals.length > 0 ? rationals : values;
}

function readIfd(context: TiffContext, offset: number, visited: Set<number>): IfdResult {
  if (!Number.isInteger(offset) || offset < 0 || offset + 2 > context.tiffLength) {
    throw new Error("EXIF IFD offset is invalid.");
  }
  const absolute = context.tiffStart + offset;
  if (visited.has(absolute)) throw new Error("EXIF IFD loop detected.");
  visited.add(absolute);

  const count = readU16(context, absolute);
  if (count > 512) throw new Error("EXIF IFD has too many entries.");
  const entriesStart = absolute + 2;
  if (entriesStart + count * 12 > context.tiffStart + context.tiffLength) {
    throw new Error("EXIF IFD entries exceed the segment.");
  }

  const values = new Map<number, ExifValue>();
  for (let index = 0; index < count; index += 1) {
    const entryOffset = entriesStart + index * 12;
    const tag = readU16(context, entryOffset);
    const type = readU16(context, entryOffset + 2);
    const valueCount = readU32(context, entryOffset + 4);
    const value = readValue(context, entryOffset, type, valueCount);
    if (value !== null) values.set(tag, value);
  }
  return { values };
}

function findExifSegment(bytes: Uint8Array): { start: number; length: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let markerOffset = offset;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset + 1 >= bytes.length) break;
    const marker = bytes[markerOffset];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[markerOffset + 1] << 8) | bytes[markerOffset + 2];
    if (length < 2) break;
    const segmentEnd = markerOffset + 1 + length;
    if (segmentEnd > bytes.length) break;
    if (
      marker === 0xe1 &&
      length >= 8 &&
      ascii(bytes, markerOffset + 3, 6) === "Exif\0\0"
    ) {
      return {
        start: markerOffset + 9,
        length: length - 8,
      };
    }
    offset = segmentEnd;
  }
  return null;
}

export function describeOrientation(value: number): string {
  switch (value) {
    case 1:
      return "Normal";
    case 2:
      return "Mirrored horizontally";
    case 3:
      return "Rotated 180°";
    case 4:
      return "Mirrored vertically";
    case 5:
      return "Mirrored horizontally and rotated 270°";
    case 6:
      return "Rotated 90° clockwise";
    case 7:
      return "Mirrored horizontally and rotated 90°";
    case 8:
      return "Rotated 270° clockwise";
    default:
      return "Unknown";
  }
}

function firstNumber(value: ExifValue | undefined): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  return typeof first === "number" && Number.isFinite(first) ? first : null;
}

function firstRatio(value: ExifValue | undefined): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (typeof first === "number") return Number.isFinite(first) ? first : null;
  return first.d === 0 ? null : first.n / first.d;
}

function decimal(value: number, digits = 2): string {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function stringValue(value: ExifValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: ExifValue | undefined, suffix = ""): string | null {
  const number = firstNumber(value);
  return number === null ? null : `${number}${suffix}`;
}

function ratioValue(value: ExifValue | undefined, suffix: string, digits = 1): string | null {
  const number = firstRatio(value);
  return number === null ? null : `${decimal(number, digits)}${suffix}`;
}

function exposureTime(value: ExifValue | undefined): string | null {
  const seconds = firstRatio(value);
  if (seconds === null || seconds <= 0) return null;
  if (seconds >= 1) return `${decimal(seconds, 2)} s`;
  const denominator = Math.round(1 / seconds);
  return `1/${denominator} s`;
}

const EXPOSURE_PROGRAMS: Record<number, string> = {
  0: "Not defined",
  1: "Manual",
  2: "Program",
  3: "Aperture priority",
  4: "Shutter priority",
  5: "Creative program",
  6: "Action program",
  7: "Portrait mode",
  8: "Landscape mode",
};

const METERING_MODES: Record<number, string> = {
  0: "Unknown",
  1: "Average",
  2: "Center-weighted average",
  3: "Spot",
  4: "Multi-spot",
  5: "Pattern",
  6: "Partial",
  255: "Other",
};

interface TagSpec {
  tag: number;
  group: string;
  label: string;
  format: (value: ExifValue) => string | null;
}

const IFD0_SPECS: TagSpec[] = [
  { tag: 0x0100, group: "Image", label: "Pixel width", format: (value) => numberValue(value, " px") },
  { tag: 0x0101, group: "Image", label: "Pixel height", format: (value) => numberValue(value, " px") },
  { tag: 0x0112, group: "Image", label: "Orientation", format: (value) => {
    const number = firstNumber(value);
    return number === null ? null : `${describeOrientation(number)} (${number})`;
  } },
  { tag: 0x010f, group: "Camera", label: "Make", format: (value) => stringValue(value) },
  { tag: 0x0110, group: "Camera", label: "Model", format: (value) => stringValue(value) },
  { tag: 0x0131, group: "Camera", label: "Software", format: (value) => stringValue(value) },
  { tag: 0x0132, group: "Dates", label: "File date", format: (value) => stringValue(value) },
];

const EXIF_SPECS: TagSpec[] = [
  { tag: 0x9003, group: "Dates", label: "Captured", format: (value) => stringValue(value) },
  { tag: 0x9004, group: "Dates", label: "Digitized", format: (value) => stringValue(value) },
  { tag: 0x829a, group: "Exposure", label: "Exposure time", format: exposureTime },
  { tag: 0x829d, group: "Exposure", label: "Aperture", format: (value) => {
    const number = firstRatio(value);
    return number === null || number <= 0 ? null : `f/${decimal(number, 1)}`;
  } },
  { tag: 0x8827, group: "Exposure", label: "ISO", format: (value) => numberValue(value) },
  { tag: 0x9204, group: "Exposure", label: "Exposure bias", format: (value) => {
    const number = firstRatio(value);
    if (number === null) return null;
    return `${number > 0 ? "+" : ""}${decimal(number, 2)} EV`;
  } },
  { tag: 0x920a, group: "Exposure", label: "Focal length", format: (value) => ratioValue(value, " mm") },
  { tag: 0xa405, group: "Exposure", label: "35 mm equivalent", format: (value) => numberValue(value, " mm") },
  { tag: 0x8822, group: "Exposure", label: "Exposure program", format: (value) => {
    const number = firstNumber(value);
    return number === null ? null : EXPOSURE_PROGRAMS[number] ?? `Program ${number}`;
  } },
  { tag: 0x9209, group: "Exposure", label: "Flash", format: (value) => {
    const number = firstNumber(value);
    if (number === null) return null;
    return number & 1 ? "Fired" : "Did not fire";
  } },
  { tag: 0x9207, group: "Exposure", label: "Metering mode", format: (value) => {
    const number = firstNumber(value);
    return number === null ? null : METERING_MODES[number] ?? `Mode ${number}`;
  } },
  { tag: 0xa403, group: "Exposure", label: "White balance", format: (value) => {
    const number = firstNumber(value);
    return number === null ? null : number === 1 ? "Manual" : "Auto";
  } },
  { tag: 0xa402, group: "Exposure", label: "Exposure mode", format: (value) => {
    const number = firstNumber(value);
    if (number === null) return null;
    return number === 1 ? "Manual" : number === 2 ? "Auto bracket" : "Auto";
  } },
  { tag: 0xa001, group: "Image", label: "Color space", format: (value) => {
    const number = firstNumber(value);
    if (number === null) return null;
    return number === 1 ? "sRGB" : number === 2 ? "Adobe RGB" : number === 65535 ? "Uncalibrated" : `Color space ${number}`;
  } },
  { tag: 0xa002, group: "Image", label: "EXIF pixel width", format: (value) => numberValue(value, " px") },
  { tag: 0xa003, group: "Image", label: "EXIF pixel height", format: (value) => numberValue(value, " px") },
  { tag: 0xa434, group: "Camera", label: "Lens", format: (value) => stringValue(value) },
];

const GPS_SPECS: TagSpec[] = [
  { tag: 0x0001, group: "GPS", label: "Latitude ref", format: (value) => stringValue(value) },
  { tag: 0x0002, group: "GPS", label: "Latitude", format: (value) => dmsValue(value) },
  { tag: 0x0003, group: "GPS", label: "Longitude ref", format: (value) => stringValue(value) },
  { tag: 0x0004, group: "GPS", label: "Longitude", format: (value) => dmsValue(value) },
  { tag: 0x0005, group: "GPS", label: "Altitude ref", format: (value) => {
    const number = firstNumber(value);
    return number === null ? null : number === 1 ? "Below sea level" : "Above sea level";
  } },
  { tag: 0x0006, group: "GPS", label: "Altitude", format: (value) => ratioValue(value, " m", 1) },
  { tag: 0x0007, group: "GPS", label: "GPS time", format: (value) => timeValue(value) },
  { tag: 0x001d, group: "GPS", label: "GPS date", format: (value) => stringValue(value) },
];

function dmsValue(value: ExifValue): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parts = value.slice(0, 3).map((part) => {
    if (typeof part === "number") return part;
    return part.d === 0 ? Number.NaN : part.n / part.d;
  });
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const [degrees = 0, minutes = 0, seconds = 0] = parts;
  return `${decimal(degrees, 0)}° ${decimal(minutes, 0)}′ ${decimal(seconds, 2)}″`;
}

function timeValue(value: ExifValue): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parts = value.slice(0, 3).map((part) => {
    if (typeof part === "number") return part;
    return part.d === 0 ? Number.NaN : part.n / part.d;
  });
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.floor(minutes)).padStart(2, "0")}:${String(Math.floor(seconds)).padStart(2, "0")}`;
}

function collectEntries(
  specs: TagSpec[],
  values: Map<number, ExifValue>,
  output: ExifEntry[],
): void {
  for (const spec of specs) {
    const value = values.get(spec.tag);
    if (value === undefined) continue;
    const formatted = spec.format(value);
    if (formatted !== null && formatted !== "") {
      output.push({ group: spec.group, label: spec.label, value: formatted, tag: spec.tag });
    }
  }
}

function degreesFrom(value: ExifValue | undefined): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parts = value.slice(0, 3).map((part) => {
    if (typeof part === "number") return part;
    return part.d === 0 ? Number.NaN : part.n / part.d;
  });
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const [degrees = 0, minutes = 0, seconds = 0] = parts;
  return degrees + minutes / 60 + seconds / 3600;
}

function buildGps(values: Map<number, ExifValue>): GpsCoordinates | null {
  const latitude = degreesFrom(values.get(0x0002));
  const longitude = degreesFrom(values.get(0x0004));
  if (latitude === null || longitude === null) return null;
  const latitudeRef = stringValue(values.get(0x0001))?.toUpperCase() ?? "";
  const longitudeRef = stringValue(values.get(0x0003))?.toUpperCase() ?? "";
  let altitude = firstRatio(values.get(0x0006));
  if (altitude !== null && firstNumber(values.get(0x0005)) === 1) altitude = -altitude;
  return {
    latitude: latitudeRef === "S" ? -latitude : latitude,
    longitude: longitudeRef === "W" ? -longitude : longitude,
    altitude,
  };
}

export function parseExif(input: ArrayBuffer | Uint8Array): ExifResult {
  const bytes = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input);
  const empty: ExifResult = {
    hasExif: false,
    entries: [],
    gps: null,
    orientation: null,
    note: "",
  };

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { ...empty, note: "Not a JPEG file. EXIF parsing reads JPEG APP1 segments." };
  }

  const segment = findExifSegment(bytes);
  if (!segment) {
    return {
      ...empty,
      note: "No EXIF APP1 segment found. The image has no embedded EXIF metadata.",
    };
  }

  try {
    if (segment.length < 8) throw new Error("EXIF segment is too short.");
    const tiffStart = segment.start;
    const tiffLength = segment.length;
    const byteOrder = ascii(bytes, tiffStart, 2);
    if (byteOrder !== "II" && byteOrder !== "MM") {
      throw new Error("EXIF byte order is invalid.");
    }
    const little = byteOrder === "II";
    const context: TiffContext = {
      bytes,
      view: new DataView(bytes.buffer),
      tiffStart,
      tiffLength,
      little,
    };
    if (readU16(context, tiffStart + 2) !== 42) {
      throw new Error("EXIF TIFF header is invalid.");
    }
    const ifdOffset = readU32(context, tiffStart + 4);
    const visited = new Set<number>();
    const ifd0 = readIfd(context, ifdOffset, visited).values;

    const exifValues = new Map<number, ExifValue>();
    const gpsValues = new Map<number, ExifValue>();
    const exifPointer = firstNumber(ifd0.get(0x8769));
    if (exifPointer !== null) {
      for (const [tag, value] of readIfd(context, exifPointer, visited).values) {
        exifValues.set(tag, value);
      }
    }
    const gpsPointer = firstNumber(ifd0.get(0x8825));
    if (gpsPointer !== null) {
      for (const [tag, value] of readIfd(context, gpsPointer, visited).values) {
        gpsValues.set(tag, value);
      }
    }

    const entries: ExifEntry[] = [];
    collectEntries(IFD0_SPECS, ifd0, entries);
    collectEntries(EXIF_SPECS, exifValues, entries);
    collectEntries(GPS_SPECS, gpsValues, entries);

    const orientation = firstNumber(ifd0.get(0x0112));
    return {
      hasExif: true,
      entries,
      gps: buildGps(gpsValues),
      orientation,
      note:
        entries.length > 0
          ? "Decoded locally from the JPEG APP1 segment. EXIF values are untrusted until verified."
          : "An EXIF segment was found but it contains no recognized fields.",
    };
  } catch {
    return {
      ...empty,
      note: "The EXIF segment is present but malformed, so its values could not be read.",
    };
  }
}
