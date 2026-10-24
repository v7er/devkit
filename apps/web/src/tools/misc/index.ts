import { lazyTool } from "../lazy";
import type { ToolDefinition } from "../types";

export const miscTools: ToolDefinition[] = [
  {
    id: "qr-generator",
    name: "QR Code Generator",
    description:
      "Generate QR codes for text, URLs, and Wi-Fi networks with custom size, colors, and error correction.",
    category: "misc",
    keywords: ["qr", "qrcode", "wifi", "url", "barcode", "png", "svg"],
    component: lazyTool(() => import("./qr-generator")),
  },
  {
    id: "qr-reader",
    name: "QR Code Reader",
    description:
      "Decode a QR code from an image file and inspect the payload, version, and dimensions.",
    category: "misc",
    keywords: ["qr", "qrcode", "decode", "scan", "image", "jsqr"],
    component: lazyTool(() => import("./qr-reader")),
  },
  {
    id: "semver",
    name: "SemVer Calculator",
    description:
      "Validate, compare, range-check, and increment semantic versions with clear explanations.",
    category: "misc",
    keywords: ["version", "compare", "range", "increment", "bump", "package"],
    component: lazyTool(() => import("./semver")),
  },
  {
    id: "ascii-table",
    name: "ASCII Table",
    description:
      "Browse and search the 0–127 ASCII table with decimal, hex, binary, and control names.",
    category: "misc",
    keywords: ["ascii", "character", "code", "hex", "binary", "control"],
    component: lazyTool(() => import("./ascii-table")),
  },
  {
    id: "dpr",
    name: "Device Pixel Ratio",
    description:
      "Inspect live viewport size, device pixel ratio, screen resolution, and zoom estimates.",
    category: "misc",
    keywords: ["pixel", "ratio", "viewport", "screen", "zoom", "resolution", "hidpi"],
    component: lazyTool(() => import("./dpr")),
  },
  {
    id: "storage-converter",
    name: "Storage Size Converter",
    description:
      "Convert between bytes and bits using SI and IEC units, with precise values and batch input.",
    category: "misc",
    keywords: ["bytes", "bits", "size", "si", "iec", "gib", "mb", "converter"],
    component: lazyTool(() => import("./storage-converter")),
  },
  {
    id: "license-selector",
    name: "License Selector",
    description:
      "Answer four questions to find a fitting open-source license among five common options.",
    category: "misc",
    keywords: ["license", "open source", "mit", "apache", "gpl", "mpl", "unlicense"],
    component: lazyTool(() => import("./license-selector")),
  },
  {
    id: "system-info",
    name: "System Information",
    description:
      "Read browser, platform, hardware, locale, screen, and WebGL details with safe fallbacks.",
    category: "misc",
    keywords: ["browser", "platform", "hardware", "screen", "locale", "webgl", "cpu"],
    component: lazyTool(() => import("./system-info")),
  },
  {
    id: "keycode",
    name: "Keycode Inspector",
    description:
      "Capture keydown and keyup events to inspect key, code, keyCode, and modifiers.",
    category: "misc",
    keywords: ["keyboard", "key", "code", "event", "modifier", "shortcut"],
    component: lazyTool(() => import("./keycode")),
  },
  {
    id: "clipboard-history",
    name: "Clipboard History",
    description:
      "Keep an explicit, searchable clipboard snippet history in local storage.",
    category: "misc",
    keywords: ["clipboard", "snippets", "history", "paste", "copy", "local"],
    component: lazyTool(() => import("./clipboard-history")),
  },
];
