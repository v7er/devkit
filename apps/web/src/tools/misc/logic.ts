import { compare, diff, inc, parse, satisfies, validRange } from "semver";

/* ------------------------------------------------------------------ */
/* Semantic versions                                                   */
/* ------------------------------------------------------------------ */

export type BumpType = "major" | "minor" | "patch";

export interface VersionDetails {
  raw: string;
  normalized: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  build: string;
}

export interface VersionReport {
  details: VersionDetails | null;
  error: string;
}

export function inspectVersion(input: string): VersionReport {
  const raw = input.trim();
  if (!raw) return { details: null, error: "Enter a version such as 1.4.2." };

  const parsed = parse(raw);
  if (!parsed) {
    return {
      details: null,
      error: `“${raw}” is not a semantic version. Use MAJOR.MINOR.PATCH, optionally with -prerelease and +build.`,
    };
  }

  return {
    details: {
      raw,
      normalized: parsed.version,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease.join("."),
      build: parsed.build.join("."),
    },
    error: "",
  };
}

export type VersionRelation = "lower" | "equal" | "higher";

export interface CompareReport {
  relation: VersionRelation | null;
  difference: string | null;
  error: string;
}

export function compareVersions(a: string, b: string): CompareReport {
  const first = inspectVersion(a);
  const second = inspectVersion(b);
  if (!first.details) return { relation: null, difference: null, error: first.error };
  if (!second.details) return { relation: null, difference: null, error: second.error };

  const order = compare(first.details.normalized, second.details.normalized);
  return {
    relation: order < 0 ? "lower" : order > 0 ? "higher" : "equal",
    difference: diff(first.details.normalized, second.details.normalized),
    error: "",
  };
}

export interface RangeReport {
  satisfied: boolean | null;
  error: string;
}

export function checkRange(version: string, range: string): RangeReport {
  const trimmedRange = range.trim();
  if (!trimmedRange) return { satisfied: null, error: "Enter a range such as >=1.2.0 <2.0.0." };

  const trimmedVersion = version.trim();
  if (!trimmedVersion) return { satisfied: null, error: "Enter a version to test against the range." };

  const parsedVersion = parse(trimmedVersion);
  if (!parsedVersion) {
    return { satisfied: null, error: `“${trimmedVersion}” is not a semantic version.` };
  }

  if (!validRange(trimmedRange)) {
    return { satisfied: null, error: `“${trimmedRange}” is not a valid range.` };
  }

  try {
    return { satisfied: satisfies(parsedVersion, trimmedRange), error: "" };
  } catch (error) {
    return {
      satisfied: null,
      error: error instanceof Error ? error.message : "Could not evaluate this range.",
    };
  }
}

export interface BumpReport {
  next: string | null;
  error: string;
}

export function bumpVersion(version: string, release: BumpType): BumpReport {
  const report = inspectVersion(version);
  if (!report.details) return { next: null, error: report.error };

  const next = inc(report.details.normalized, release);
  if (!next) return { next: null, error: `Could not increment this version's ${release} component.` };
  return { next, error: "" };
}

/* ------------------------------------------------------------------ */
/* Storage sizes                                                       */
/* ------------------------------------------------------------------ */

export type SizeKind = "bytes" | "bits";
export type SizeBase = 1000 | 1024;

export interface SizeUnit {
  id: string;
  label: string;
  name: string;
  kind: SizeKind;
  base: SizeBase;
  exponent: number;
  /** Bytes represented by one of this unit. */
  factor: number;
}

const BYTE_PREFIXES = ["", "k", "M", "G", "T", "P", "E"];
const SI_BYTE_NAMES = [
  "byte",
  "kilobyte",
  "megabyte",
  "gigabyte",
  "terabyte",
  "petabyte",
  "exabyte",
];
const IEC_PREFIXES = ["", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei"];
const IEC_BYTE_NAMES = [
  "byte",
  "kibibyte",
  "mebibyte",
  "gibibyte",
  "tebibyte",
  "pebibyte",
  "exbibyte",
];
const SI_BIT_NAMES = [
  "bit",
  "kilobit",
  "megabit",
  "gigabit",
  "terabit",
  "petabit",
  "exabit",
];
const IEC_BIT_NAMES = [
  "bit",
  "kibibit",
  "mebibit",
  "gibibit",
  "tebibit",
  "pebibit",
  "exbibit",
];

function buildUnits(
  kind: SizeKind,
  base: SizeBase,
  prefixes: string[],
  names: string[],
  idPrefix: string,
): SizeUnit[] {
  return prefixes.map((prefix, exponent) => {
    const label = kind === "bytes" ? `${prefix}B` : `${prefix}bit`;
    return {
      id: `${idPrefix}${label}`,
      label,
      name: names[exponent] ?? label,
      kind,
      base,
      exponent,
      factor: (base ** exponent) / (kind === "bits" ? 8 : 1),
    };
  });
}

export const SIZE_UNITS: SizeUnit[] = [
  ...buildUnits("bytes", 1000, BYTE_PREFIXES, SI_BYTE_NAMES, "si:"),
  ...buildUnits("bytes", 1024, IEC_PREFIXES, IEC_BYTE_NAMES, "iec:"),
  ...buildUnits("bits", 1000, BYTE_PREFIXES, SI_BIT_NAMES, "sibit:"),
  ...buildUnits("bits", 1024, IEC_PREFIXES, IEC_BIT_NAMES, "iecbit:"),
];

const UNIT_ALIASES: Record<string, SizeUnit> = (() => {
  const map: Record<string, SizeUnit> = {};
  for (const unit of SIZE_UNITS) {
    for (const key of [unit.label.toLowerCase(), unit.name, `${unit.name}s`]) {
      if (!map[key]) map[key] = unit;
    }
  }
  map.b = SIZE_UNITS[0] as SizeUnit;
  map.byte = SIZE_UNITS[0] as SizeUnit;
  map.bytes = SIZE_UNITS[0] as SizeUnit;
  return map;
})();

export function findSizeUnit(text: string): SizeUnit | undefined {
  return UNIT_ALIASES[text.trim().toLowerCase()];
}

const SIZE_PATTERN = /^([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)?$/i;

/** Parse a human size such as `1.5 GB`, `512 MiB`, or `8 bit`. Returns bytes. */
export function parseSize(input: string): number {
  const text = input.trim();
  if (!text) throw new Error("Enter a size such as 1.5 GB.");

  const match = SIZE_PATTERN.exec(text);
  if (!match) {
    throw new Error(`“${text}” is not a size. Use a number and an optional unit, such as 1.5 GB.`);
  }

  const amountText = (match[1] ?? "").replace(/,/g, "");
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) throw new Error(`“${text}” does not contain a finite number.`);
  if (amount < 0) throw new Error("Size must be zero or greater.");

  const unitText = match[2];
  const unit = unitText ? findSizeUnit(unitText) : SIZE_UNITS[0];
  if (!unit) {
    throw new Error(`Unknown unit “${unitText}”. Try B, kB, MB, GB, KiB, MiB, GiB, or bit units.`);
  }

  return amount * unit.factor;
}

export function formatQuantity(value: number, maximumFractionDigits = 6): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e21 || abs < 1e-9) {
    return value.toExponential(Math.min(Math.max(maximumFractionDigits, 2), 12));
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export type ConversionSystem = "SI bytes" | "IEC bytes" | "SI bits" | "IEC bits";

export interface ConversionRow {
  system: ConversionSystem;
  unit: string;
  name: string;
  value: string;
}

const SYSTEM_BY_UNIT = new Map<string, ConversionSystem>();

for (const unit of SIZE_UNITS) {
  const prefix = unit.id.slice(0, unit.id.indexOf(":"));
  const system: ConversionSystem =
    prefix === "si"
      ? "SI bytes"
      : prefix === "iec"
        ? "IEC bytes"
        : prefix === "sibit"
          ? "SI bits"
          : "IEC bits";
  SYSTEM_BY_UNIT.set(unit.id, system);
}

export function convertBytes(bytes: number, maximumFractionDigits = 6): ConversionRow[] {
  return SIZE_UNITS.map((unit) => ({
    system: SYSTEM_BY_UNIT.get(unit.id) ?? "SI bytes",
    unit: unit.label,
    name: unit.name,
    value: formatQuantity(bytes / unit.factor, maximumFractionDigits),
  }));
}

export function formatBestSize(
  bytes: number,
  system: "si" | "iec",
  maximumFractionDigits = 2,
): string {
  const units = SIZE_UNITS.filter(
    (unit) => unit.kind === "bytes" && unit.base === (system === "si" ? 1000 : 1024),
  );
  let chosen = units[0];
  for (const unit of units) {
    if (chosen && Math.abs(bytes) >= unit.factor) chosen = unit;
  }
  if (!chosen) return "—";
  return `${formatQuantity(bytes / chosen.factor, maximumFractionDigits)} ${chosen.label}`;
}

export interface BatchSizeRow {
  input: string;
  bytes: number | null;
  si: string;
  iec: string;
  error: string;
}

export function parseSizeBatch(text: string, maximumFractionDigits = 2): BatchSizeRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        const bytes = parseSize(line);
        return {
          input: line,
          bytes,
          si: formatBestSize(bytes, "si", maximumFractionDigits),
          iec: formatBestSize(bytes, "iec", maximumFractionDigits),
          error: "",
        };
      } catch (error) {
        return {
          input: line,
          bytes: null,
          si: "",
          iec: "",
          error: error instanceof Error ? error.message : "Could not parse this size.",
        };
      }
    });
}

/* ------------------------------------------------------------------ */
/* ASCII table                                                         */
/* ------------------------------------------------------------------ */

export type AsciiKind = "control" | "space" | "printable";

export interface AsciiRow {
  code: number;
  hex: string;
  binary: string;
  char: string;
  name: string;
  kind: AsciiKind;
}

const CONTROL_NAMES: Record<number, string> = {
  0: "Null",
  1: "Start of Heading",
  2: "Start of Text",
  3: "End of Text",
  4: "End of Transmission",
  5: "Enquiry",
  6: "Acknowledge",
  7: "Bell",
  8: "Backspace",
  9: "Horizontal Tab",
  10: "Line Feed",
  11: "Vertical Tab",
  12: "Form Feed",
  13: "Carriage Return",
  14: "Shift Out",
  15: "Shift In",
  16: "Data Link Escape",
  17: "Device Control 1 (XON)",
  18: "Device Control 2",
  19: "Device Control 3 (XOFF)",
  20: "Device Control 4",
  21: "Negative Acknowledge",
  22: "Synchronous Idle",
  23: "End of Transmission Block",
  24: "Cancel",
  25: "End of Medium",
  26: "Substitute",
  27: "Escape",
  28: "File Separator",
  29: "Group Separator",
  30: "Record Separator",
  31: "Unit Separator",
  127: "Delete",
};

const PRINTABLE_NAMES: Record<number, string> = {
  32: "Space",
  33: "Exclamation mark",
  34: "Quotation mark",
  35: "Number sign",
  36: "Dollar sign",
  37: "Percent sign",
  38: "Ampersand",
  39: "Apostrophe",
  40: "Left parenthesis",
  41: "Right parenthesis",
  42: "Asterisk",
  43: "Plus sign",
  44: "Comma",
  45: "Hyphen-minus",
  46: "Full stop",
  47: "Solidus (slash)",
  58: "Colon",
  59: "Semicolon",
  60: "Less-than sign",
  61: "Equals sign",
  62: "Greater-than sign",
  63: "Question mark",
  64: "Commercial at",
  91: "Left square bracket",
  92: "Reverse solidus (backslash)",
  93: "Right square bracket",
  94: "Circumflex accent",
  95: "Low line (underscore)",
  96: "Grave accent",
  123: "Left curly bracket",
  124: "Vertical line",
  125: "Right curly bracket",
  126: "Tilde",
};

function asciiName(code: number): string {
  if (CONTROL_NAMES[code]) return CONTROL_NAMES[code];
  if (code >= 48 && code <= 57) return `Digit ${String.fromCharCode(code)}`;
  if (code >= 65 && code <= 90) return `Latin capital letter ${String.fromCharCode(code)}`;
  if (code >= 97 && code <= 122) return `Latin small letter ${String.fromCharCode(code)}`;
  return PRINTABLE_NAMES[code] ?? "Printable character";
}

function caretLabel(code: number): string {
  if (code === 127) return "^?";
  if (code < 32) return `^${String.fromCharCode(code + 64)}`;
  if (code === 32) return "␠";
  return String.fromCharCode(code);
}

export const ASCII_ROWS: AsciiRow[] = Array.from({ length: 128 }, (_, code) => ({
  code,
  hex: code.toString(16).toUpperCase().padStart(2, "0"),
  binary: code.toString(2).padStart(8, "0"),
  char: caretLabel(code),
  name: asciiName(code),
  kind: code < 32 || code === 127 ? "control" : code === 32 ? "space" : "printable",
}));

export function filterAsciiRows(query: string): AsciiRow[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return ASCII_ROWS;

  const decimal = /^\d{1,3}$/.test(trimmed) ? Number(trimmed) : null;
  if (decimal !== null && decimal >= 0 && decimal <= 127) {
    return ASCII_ROWS.filter((row) => row.code === decimal);
  }

  const hex = /^0x([0-9a-f]{1,2})$/.exec(trimmed)?.[1] ?? null;
  if (hex !== null) {
    return ASCII_ROWS.filter((row) => row.hex.toLowerCase() === hex);
  }

  return ASCII_ROWS.filter((row) =>
    [row.name, row.char, row.binary, row.hex, String(row.code)]
      .join(" ")
      .toLowerCase()
      .includes(trimmed),
  );
}

export interface LatinNote {
  range: string;
  title: string;
  description: string;
}

export const LATIN1_NOTES: LatinNote[] = [
  {
    range: "0x80–0x9F",
    title: "C1 control block",
    description:
      "ASCII ends at 0x7F. These codes are control characters in ISO-8859-1; Windows-1252 fills the same bytes with curly quotes, dashes, and the euro sign, so the byte alone does not identify the character.",
  },
  {
    range: "0xA0–0xFF",
    title: "Latin-1 supplement",
    description:
      "Printable accented letters, currency, and symbols. Their Unicode code points are identical to the Latin-1 byte values.",
  },
  {
    range: "0xA0",
    title: "No-break space",
    description:
      "Looks like a space but prevents a line break. It is not the same character as U+0020 and often breaks naive text parsing.",
  },
  {
    range: "0xAD",
    title: "Soft hyphen",
    description:
      "An invisible optional hyphenation hint. It is frequent in copied web text and usually should be stripped before processing.",
  },
];

export interface LatinSample {
  code: number;
  char: string;
  name: string;
}

export const LATIN1_SAMPLES: LatinSample[] = [
  { code: 0xa9, char: "©", name: "Copyright sign" },
  { code: 0xae, char: "®", name: "Registered sign" },
  { code: 0xb0, char: "°", name: "Degree sign" },
  { code: 0xb1, char: "±", name: "Plus-minus sign" },
  { code: 0xb5, char: "µ", name: "Micro sign" },
  { code: 0xbd, char: "½", name: "Vulgar fraction one half" },
  { code: 0xc0, char: "À", name: "Latin capital letter A with grave" },
  { code: 0xe9, char: "é", name: "Latin small letter e with acute" },
  { code: 0xf1, char: "ñ", name: "Latin small letter n with tilde" },
  { code: 0xf7, char: "÷", name: "Division sign" },
  { code: 0xff, char: "ÿ", name: "Latin small letter y with diaeresis" },
];

/* ------------------------------------------------------------------ */
/* License recommendations                                             */
/* ------------------------------------------------------------------ */

export type LicenseId = "MIT" | "Apache-2.0" | "GPL-3.0" | "MPL-2.0" | "Unlicense";
export type AttributionAnswer = "require" | "optional";
export type PatentAnswer = "important" | "not-important";
export type CopyleftAnswer = "allow-proprietary" | "share-alike" | "must-share";
export type SimplicityAnswer = "simple" | "thorough";

export interface LicenseAnswers {
  attribution: AttributionAnswer;
  patent: PatentAnswer;
  copyleft: CopyleftAnswer;
  simplicity: SimplicityAnswer;
}

export interface LicenseInfo {
  id: LicenseId;
  name: string;
  summary: string;
  permissions: string[];
  conditions: string[];
  link: string;
}

export const LICENSE_ORDER: LicenseId[] = [
  "MIT",
  "Apache-2.0",
  "GPL-3.0",
  "MPL-2.0",
  "Unlicense",
];

export const LICENSES: Record<LicenseId, LicenseInfo> = {
  MIT: {
    id: "MIT",
    name: "MIT License",
    summary:
      "A short permissive license. Anyone may use, modify, and redistribute the code, including in closed-source products, as long as the copyright notice and license text are kept.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Keep the copyright notice and license text"],
    link: "https://opensource.org/license/mit",
  },
  "Apache-2.0": {
    id: "Apache-2.0",
    name: "Apache License 2.0",
    summary:
      "A permissive license with an explicit patent grant and a trademark carve-out. Downstream users must keep notices and state significant changes.",
    permissions: ["Commercial use", "Modification", "Distribution", "Patent use"],
    conditions: ["Keep notices and license text", "State significant changes", "Include a NOTICE file if one exists"],
    link: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  "GPL-3.0": {
    id: "GPL-3.0",
    name: "GNU General Public License v3.0",
    summary:
      "A strong copyleft license. Anyone who distributes the software or a derivative must release the whole work under the GPL and provide the corresponding source.",
    permissions: ["Commercial use", "Modification", "Distribution", "Patent use"],
    conditions: ["Disclose source", "Same license for derivatives", "Keep notices", "State changes"],
    link: "https://www.gnu.org/licenses/gpl-3.0.html",
  },
  "MPL-2.0": {
    id: "MPL-2.0",
    name: "Mozilla Public License 2.0",
    summary:
      "File-level copyleft. Modified files must stay under the MPL, but they can be combined with closed-source files in a larger work. Includes a patent grant.",
    permissions: ["Commercial use", "Modification", "Distribution", "Patent use"],
    conditions: ["Disclose source of modified MPL files", "Keep notices", "Same license for modified files"],
    link: "https://www.mozilla.org/en-US/MPL/2.0/",
  },
  Unlicense: {
    id: "Unlicense",
    name: "The Unlicense",
    summary:
      "Dedicates the work to the public domain and waives all conditions. Anyone may use it for any purpose with no attribution requirement.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["None, though keeping the notice is polite"],
    link: "https://unlicense.org/",
  },
};

const BASE_SCORES: Record<LicenseId, number> = {
  MIT: 2,
  "Apache-2.0": 2,
  "GPL-3.0": 1,
  "MPL-2.0": 1,
  Unlicense: 1,
};

export interface LicenseRecommendation {
  recommended: LicenseId;
  ranked: Array<{ id: LicenseId; score: number }>;
  reasons: string[];
}

export function recommendLicense(answers: LicenseAnswers): LicenseRecommendation {
  const scores: Record<LicenseId, number> = { ...BASE_SCORES };
  const add = (id: LicenseId, delta: number) => {
    scores[id] += delta;
  };
  const reasons: string[] = [];

  if (answers.attribution === "require") {
    add("MIT", 3);
    add("Apache-2.0", 3);
    add("MPL-2.0", 2);
    add("GPL-3.0", 1);
    add("Unlicense", -6);
    reasons.push("You want credit kept, so the public-domain Unlicense is ruled out.");
  } else {
    add("MIT", 1);
    add("Unlicense", 4);
    add("Apache-2.0", -1);
    reasons.push("Attribution is optional, which makes a public-domain dedication possible.");
  }

  if (answers.patent === "important") {
    add("Apache-2.0", 4);
    add("GPL-3.0", 2);
    add("MPL-2.0", 1);
    add("MIT", -1);
    add("Unlicense", -2);
    reasons.push("Apache-2.0, MPL-2.0, and GPL-3.0 include explicit patent grants.");
  } else {
    add("MIT", 1);
    add("Unlicense", 1);
    reasons.push("A patent grant is not a priority, so shorter licenses remain viable.");
  }

  if (answers.copyleft === "must-share") {
    add("GPL-3.0", 6);
    add("MPL-2.0", 2);
    add("MIT", -4);
    add("Apache-2.0", -4);
    add("Unlicense", -5);
    reasons.push("Requiring derivatives to stay open points to strong copyleft (GPL-3.0).");
  } else if (answers.copyleft === "share-alike") {
    add("MPL-2.0", 7);
    add("GPL-3.0", 2);
    add("MIT", -1);
    add("Apache-2.0", -1);
    add("Unlicense", -3);
    reasons.push("File-level sharing obligations match MPL-2.0.");
  } else {
    add("MIT", 3);
    add("Apache-2.0", 3);
    add("Unlicense", 2);
    add("MPL-2.0", -2);
    add("GPL-3.0", -5);
    reasons.push("Allowing closed-source derivatives rules out copyleft licenses.");
  }

  if (answers.simplicity === "simple") {
    add("MIT", 3);
    add("Unlicense", 3);
    add("Apache-2.0", -1);
    add("MPL-2.0", -1);
    add("GPL-3.0", -2);
    reasons.push("You asked for short, plain terms; MIT and the Unlicense fit best.");
  } else {
    add("Apache-2.0", 2);
    add("GPL-3.0", 1);
    add("MPL-2.0", 1);
    add("Unlicense", -1);
    reasons.push("You prefer explicit terms covering patents, notices, and modifications.");
  }

  const ranked = LICENSE_ORDER.map((id) => ({ id, score: scores[id] })).sort(
    (a, b) => b.score - a.score || LICENSE_ORDER.indexOf(a.id) - LICENSE_ORDER.indexOf(b.id),
  );

  return { recommended: ranked[0]?.id ?? "MIT", ranked, reasons };
}

/* ------------------------------------------------------------------ */
/* QR payloads                                                         */
/* ------------------------------------------------------------------ */

export interface WifiOptions {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

export function escapeWifiValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([;,:"])/g, "\\$1")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function buildWifiPayload(options: WifiOptions): string {
  const ssid = options.ssid.trim();
  if (!ssid) throw new Error("Enter the network name (SSID).");
  if (options.security !== "nopass" && !options.password) {
    throw new Error("Enter the Wi-Fi password or choose an open network.");
  }

  const parts = [`T:${options.security}`, `S:${escapeWifiValue(ssid)}`];
  if (options.security !== "nopass") parts.push(`P:${escapeWifiValue(options.password)}`);
  if (options.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export type PayloadKind = "URL" | "Wi-Fi" | "vCard" | "Email" | "Phone" | "Text";

export function describePayload(data: string): PayloadKind {
  const trimmed = data.trim();
  if (/^WIFI:/i.test(trimmed)) return "Wi-Fi";
  if (/^BEGIN:VCARD/i.test(trimmed)) return "vCard";
  if (/^mailto:/i.test(trimmed)) return "Email";
  if (/^tel:/i.test(trimmed)) return "Phone";
  if (/^https?:\/\//i.test(trimmed)) return "URL";
  return "Text";
}

/* ------------------------------------------------------------------ */
/* Browser and platform detection                                      */
/* ------------------------------------------------------------------ */

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
}

export function detectBrowser(userAgent: string): BrowserInfo {
  const patterns: Array<{ name: string; engine: string; pattern: RegExp }> = [
    { name: "Edge", engine: "Blink", pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
    { name: "Opera", engine: "Blink", pattern: /OPR\/([\d.]+)/ },
    { name: "Chrome", engine: "Blink", pattern: /CriOS\/([\d.]+)/ },
    { name: "Chrome", engine: "Blink", pattern: /Chrome\/([\d.]+)/ },
    { name: "Firefox", engine: "Gecko", pattern: /FxiOS\/([\d.]+)/ },
    { name: "Firefox", engine: "Gecko", pattern: /Firefox\/([\d.]+)/ },
    { name: "Safari", engine: "WebKit", pattern: /Version\/([\d.]+).*Safari/ },
  ];

  for (const candidate of patterns) {
    const match = candidate.pattern.exec(userAgent);
    if (match?.[1]) {
      const engine = candidate.name === "Chrome" && /CriOS/.test(userAgent) ? "WebKit" : candidate.engine;
      return { name: candidate.name, version: match[1], engine };
    }
  }

  return { name: "Unknown", version: "—", engine: "Unknown" };
}

export function detectPlatform(userAgent: string): string {
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown";
}

/* ------------------------------------------------------------------ */
/* Keyboard modifiers                                                  */
/* ------------------------------------------------------------------ */

export interface ModifierState {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export function formatModifiers(state: ModifierState): string {
  const active: string[] = [];
  if (state.ctrlKey) active.push("Ctrl");
  if (state.altKey) active.push("Alt");
  if (state.shiftKey) active.push("Shift");
  if (state.metaKey) active.push("Meta");
  return active.length > 0 ? active.join(" + ") : "None";
}

export function describeKeyLocation(location: number): string {
  switch (location) {
    case 1:
      return "Left";
    case 2:
      return "Right";
    case 3:
      return "Numpad";
    default:
      return "Standard";
  }
}

/* ------------------------------------------------------------------ */
/* Clipboard history                                                   */
/* ------------------------------------------------------------------ */

export interface ClipboardEntry {
  id: string;
  text: string;
  addedAt: number;
}

export const MAX_CLIPBOARD_ENTRIES = 50;

export function parseHistory(raw: string | null): ClipboardEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const entries: ClipboardEntry[] = [];
    for (const item of value) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { text?: unknown }).text === "string" &&
        typeof (item as { addedAt?: unknown }).addedAt === "number"
      ) {
        const candidate = item as ClipboardEntry;
        if (candidate.text.length > 0) entries.push(candidate);
      }
    }
    return entries.slice(0, MAX_CLIPBOARD_ENTRIES);
  } catch {
    return [];
  }
}

export function appendHistory(entries: ClipboardEntry[], entry: ClipboardEntry): ClipboardEntry[] {
  const withoutDuplicate = entries.filter((item) => item.text !== entry.text);
  return [entry, ...withoutDuplicate].slice(0, MAX_CLIPBOARD_ENTRIES);
}
