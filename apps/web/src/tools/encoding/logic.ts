import {
  base64ToBytes,
  bytesToBase64,
  bytesToBinary,
  bytesToHex,
  bytesToText,
  decodeBase32,
  decodeBase58,
  encodeBase32,
  encodeBase58,
  hexToBytes,
  textToBytes,
} from "@/lib/encoding";

/* URL encoding */

export type UrlScope = "component" | "url";

export interface UrlOptions {
  scope: UrlScope;
  plusSpaces: boolean;
}

export function encodeUrl(text: string, options: UrlOptions): string {
  try {
    const encoded = options.scope === "component" ? encodeURIComponent(text) : encodeURI(text);
    return options.plusSpaces ? encoded.replace(/%20/g, "+") : encoded;
  } catch {
    throw new Error("Text contains an unpaired surrogate and cannot be encoded as UTF-8.");
  }
}

export function decodeUrl(text: string, options: UrlOptions): string {
  const prepared = options.plusSpaces ? text.replace(/\+/g, " ") : text;
  try {
    return options.scope === "component" ? decodeURIComponent(prepared) : decodeURI(prepared);
  } catch {
    throw new Error("Input contains malformed percent-encoding, such as a stray % or an incomplete escape.");
  }
}

/* HTML entities */

export type HtmlEntityStyle = "named" | "numeric";

const NAMED_ENTITY_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", "\u00a0"],
  ["copy", "©"],
  ["reg", "®"],
  ["trade", "™"],
  ["hellip", "…"],
  ["mdash", "—"],
  ["ndash", "–"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["laquo", "«"],
  ["raquo", "»"],
  ["middot", "·"],
  ["bull", "•"],
  ["deg", "°"],
  ["plusmn", "±"],
  ["times", "×"],
  ["divide", "÷"],
  ["euro", "€"],
  ["pound", "£"],
  ["yen", "¥"],
  ["cent", "¢"],
  ["sect", "§"],
  ["para", "¶"],
  ["dagger", "†"],
  ["permil", "‰"],
  ["frac12", "½"],
  ["frac14", "¼"],
  ["frac34", "¾"],
  ["larr", "←"],
  ["rarr", "→"],
  ["uarr", "↑"],
  ["darr", "↓"],
  ["harr", "↔"],
  ["check", "✓"],
  ["cross", "✗"],
  ["star", "☆"],
  ["hearts", "♥"],
  ["spades", "♠"],
  ["clubs", "♣"],
  ["diams", "♦"],
];

const NAME_BY_CHARACTER = new Map<string, string>(
  NAMED_ENTITY_PAIRS.map(([name, character]) => [character, name]),
);
const CHARACTER_BY_NAME = new Map<string, string>(NAMED_ENTITY_PAIRS);

const HTML_SPECIAL_CHARACTERS = new Set(["&", "<", ">", '"', "'"]);

export function encodeHtmlEntities(
  text: string,
  options: { style: HtmlEntityStyle; encodeAll: boolean },
): string {
  let output = "";
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const name = NAME_BY_CHARACTER.get(character);
    if (HTML_SPECIAL_CHARACTERS.has(character)) {
      output +=
        options.style === "named" && name ? `&${name};` : `&#${codePoint};`;
      continue;
    }
    if (options.encodeAll && codePoint > 127) {
      output += options.style === "named" && name ? `&${name};` : `&#${codePoint};`;
      continue;
    }
    output += character;
  }
  return output;
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g,
    (match: string, body: string) => {
      if (body.startsWith("#")) {
        const hexadecimal = body[1] === "x" || body[1] === "X";
        const codePoint = Number.parseInt(hexadecimal ? body.slice(2) : body.slice(1), hexadecimal ? 16 : 10);
        if (
          !Number.isFinite(codePoint) ||
          codePoint === 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          throw new Error(`Character reference "${match}" is not a valid Unicode code point.`);
        }
        return String.fromCodePoint(codePoint);
      }
      return CHARACTER_BY_NAME.get(body) ?? match;
    },
  );
}

/* Hex and binary text */

export type SeparatorOption = "none" | "space" | "colon" | "hyphen" | "newline";

export function separatorValue(option: SeparatorOption): string {
  switch (option) {
    case "space":
      return " ";
    case "colon":
      return ":";
    case "hyphen":
      return "-";
    case "newline":
      return "\n";
    case "none":
      return "";
  }
}

export interface TextConversion {
  value: string;
  byteCount: number;
}

export function encodeHexText(
  text: string,
  options: { separator?: SeparatorOption; upperCase?: boolean } = {},
): TextConversion {
  const bytes = textToBytes(text);
  return {
    value: bytesToHex(bytes, separatorValue(options.separator ?? "none"), options.upperCase ?? false),
    byteCount: bytes.length,
  };
}

export function parseHexBytes(input: string): Uint8Array {
  const normalized = input.replace(/0x/gi, "").replace(/[\s,:_-]+/g, "");
  if (!normalized) return new Uint8Array();
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error("Input contains characters that are not hexadecimal.");
  }
  if (normalized.length % 2 !== 0) {
    throw new Error(`Hex input must contain an even number of digits (got ${normalized.length}).`);
  }
  return hexToBytes(normalized);
}

export function decodeHexText(input: string): TextConversion {
  const bytes = parseHexBytes(input);
  try {
    return { value: bytesToText(bytes, true), byteCount: bytes.length };
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8. Check the hex values.");
  }
}

export function encodeBinaryText(
  text: string,
  separator: SeparatorOption = "space",
): TextConversion {
  const bytes = textToBytes(text);
  return { value: bytesToBinary(bytes, separatorValue(separator)), byteCount: bytes.length };
}

export function parseBinaryBytes(input: string): Uint8Array {
  const normalized = input.replace(/0b/gi, "").replace(/[\s,_]+/g, "");
  if (!normalized) return new Uint8Array();
  const invalid = normalized.match(/[^01]/);
  if (invalid) {
    throw new Error(`Binary input contains "${invalid[0]}", which is not 0 or 1.`);
  }
  if (normalized.length % 8 !== 0) {
    throw new Error(`Binary input must contain a multiple of 8 bits (got ${normalized.length}).`);
  }
  const bytes = new Uint8Array(normalized.length / 8);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 8, index * 8 + 8), 2);
  }
  return bytes;
}

export function decodeBinaryText(input: string): TextConversion {
  const bytes = parseBinaryBytes(input);
  try {
    return { value: bytesToText(bytes, true), byteCount: bytes.length };
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8. Check the 8-bit groups.");
  }
}

/* Morse code */

const MORSE_ALPHABET: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
};

const MORSE_BY_SEQUENCE = new Map(
  Object.entries(MORSE_ALPHABET).map(([character, sequence]) => [sequence, character]),
);

export function textToMorse(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const unknown = new Set<string>();
  const encodedWords = words.map((word) =>
    Array.from(word.toUpperCase())
      .map((character) => {
        const sequence = MORSE_ALPHABET[character];
        if (!sequence) unknown.add(character);
        return sequence ?? "";
      })
      .filter(Boolean)
      .join(" "),
  );
  if (unknown.size > 0) {
    throw new Error(`No Morse code for: ${Array.from(unknown).join(" ")}`);
  }
  return encodedWords.join(" / ");
}

export function morseToText(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s*[/|]\s*/);
  if (words.some((word) => !word.trim())) {
    throw new Error("Morse input contains an empty word separator.");
  }
  const unknown: string[] = [];
  const decoded = words
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((sequence) => {
          const character = MORSE_BY_SEQUENCE.get(sequence);
          if (character === undefined) unknown.push(sequence);
          return character ?? "";
        })
        .join(""),
    )
    .join(" ");
  if (unknown.length > 0) {
    throw new Error(`Unrecognized Morse sequence: ${unknown.join(", ")}`);
  }
  return decoded;
}

export interface MorseSegment {
  startMs: number;
  durationMs: number;
  tone: boolean;
}

export function morseUnitMs(wpm: number): number {
  return 1200 / Math.min(60, Math.max(5, wpm));
}

export function morseTimeline(morse: string, wpm: number): MorseSegment[] {
  const trimmed = morse.trim();
  if (!trimmed) return [];
  const unit = morseUnitMs(wpm);
  const segments: MorseSegment[] = [];
  let cursor = 0;
  const words = trimmed.split(/\s*[/|]\s*/);
  if (words.some((word) => !word.trim())) {
    throw new Error("Morse input contains an empty word separator.");
  }
  words.forEach((word, wordIndex) => {
    const letters = word.trim().split(/\s+/);
    letters.forEach((letter, letterIndex) => {
      if (!MORSE_BY_SEQUENCE.has(letter)) {
        throw new Error(`Unrecognized Morse sequence: ${letter}`);
      }
      const elements = Array.from(letter);
      elements.forEach((element, elementIndex) => {
        const duration = (element === "." ? 1 : 3) * unit;
        segments.push({ startMs: cursor, durationMs: duration, tone: true });
        cursor += duration;
        if (elementIndex < elements.length - 1) {
          segments.push({ startMs: cursor, durationMs: unit, tone: false });
          cursor += unit;
        }
      });
      if (letterIndex < letters.length - 1) {
        segments.push({ startMs: cursor, durationMs: 3 * unit, tone: false });
        cursor += 3 * unit;
      }
    });
    if (wordIndex < words.length - 1) {
      segments.push({ startMs: cursor, durationMs: 7 * unit, tone: false });
      cursor += 7 * unit;
    }
  });
  return segments;
}

/* Gzip and deflate */

export type GzipFormat = "gzip" | "deflate";

export function compressionSupported(): boolean {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

async function readAll(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function transformBytes(
  bytes: Uint8Array,
  format: GzipFormat,
  direction: "compress" | "decompress",
): Promise<Uint8Array> {
  if (!compressionSupported()) {
    throw new Error("This browser does not provide CompressionStream and DecompressionStream.");
  }
  const stream =
    direction === "compress"
      ? new CompressionStream(format)
      : new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  const writePromise = (async () => {
    const chunk = new Uint8Array(bytes.byteLength);
    chunk.set(bytes);
    await writer.write(chunk);
    await writer.close();
  })();
  const [output] = await Promise.all([readAll(stream.readable), writePromise]);
  return output;
}

export interface GzipResult {
  value: string;
  inputBytes: number;
  outputBytes: number;
}

export async function compressToBase64(text: string, format: GzipFormat): Promise<GzipResult> {
  const input = textToBytes(text);
  const compressed = await transformBytes(input, format, "compress");
  return {
    value: bytesToBase64(compressed),
    inputBytes: input.length,
    outputBytes: compressed.length,
  };
}

export async function decompressFromBase64(
  base64: string,
  format: GzipFormat,
): Promise<GzipResult> {
  if (!compressionSupported()) {
    throw new Error("This browser does not provide CompressionStream and DecompressionStream.");
  }
  const compressed = base64ToBytes(base64);
  let decompressed: Uint8Array;
  try {
    decompressed = await transformBytes(compressed, format, "decompress");
  } catch {
    throw new Error(`Could not decompress. The input is not a valid ${format} stream.`);
  }
  let text: string;
  try {
    text = bytesToText(decompressed, true);
  } catch {
    throw new Error("Decompressed bytes are not valid UTF-8 text.");
  }
  return {
    value: text,
    inputBytes: compressed.length,
    outputBytes: decompressed.length,
  };
}

/* Punycode (RFC 3492) and domains */

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = "-";
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let value = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  value += Math.floor(value / numPoints);
  let k = 0;
  while (value > ((BASE - T_MIN) * T_MAX) >> 1) {
    value = Math.floor(value / (BASE - T_MIN));
    k += BASE;
  }
  return Math.floor(k + ((BASE - T_MIN + 1) * value) / (value + SKEW));
}

function digitToBasic(digit: number): number {
  return digit + 22 + 75 * (digit < 26 ? 1 : 0);
}

function basicToDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 22;
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97;
  return BASE;
}

function isSurrogate(codePoint: number): boolean {
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

export function punycodeEncode(input: string): string {
  const codePoints: number[] = [];
  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) throw new Error("Input contains an invalid character.");
    codePoints.push(codePoint);
  }
  const output: number[] = [];
  for (const codePoint of codePoints) {
    if (codePoint < 0x80) output.push(codePoint);
  }
  const basicLength = output.length;
  let handled = basicLength;
  if (basicLength > 0) output.push(DELIMITER.charCodeAt(0));

  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;

  while (handled < codePoints.length) {
    let next = Number.POSITIVE_INFINITY;
    for (const codePoint of codePoints) {
      if (codePoint >= n && codePoint < next) next = codePoint;
    }
    if (!Number.isFinite(next)) throw new Error("Input contains an invalid Unicode code point.");
    if (next - n > Math.floor((MAX_SAFE - delta) / (handled + 1))) {
      throw new Error("Input is too large to encode as Punycode.");
    }
    delta += (next - n) * (handled + 1);
    n = next;

    for (const codePoint of codePoints) {
      if (codePoint < n) {
        delta += 1;
        if (delta > MAX_SAFE) throw new Error("Input is too large to encode as Punycode.");
      }
      if (codePoint === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const threshold = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
          if (q < threshold) break;
          output.push(digitToBasic(threshold + ((q - threshold) % (BASE - threshold))));
          q = Math.floor((q - threshold) / (BASE - threshold));
        }
        output.push(digitToBasic(q));
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled += 1;
      }
    }
    delta += 1;
    n += 1;
  }

  return String.fromCharCode(...output);
}

export function punycodeDecode(input: string): string {
  if (!input) return "";
  for (const character of input) {
    if (character.charCodeAt(0) >= 0x80) {
      throw new Error("Punycode input must contain only ASCII characters.");
    }
  }

  const output: number[] = [];
  let basic = input.lastIndexOf(DELIMITER);
  if (basic < 0) basic = 0;
  if (basic > 0) {
    for (let index = 0; index < basic; index += 1) {
      output.push(input.charCodeAt(index));
    }
  }

  let index = basic > 0 ? basic + 1 : 0;
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;

  while (index < input.length) {
    const previous = i;
    let weight = 1;
    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) {
        throw new Error("Invalid Punycode: the input ends inside a code point.");
      }
      const digit = basicToDigit(input.charCodeAt(index));
      index += 1;
      if (digit >= BASE) {
        throw new Error(`Invalid Punycode digit "${input[index - 1]}".`);
      }
      if (digit > Math.floor((MAX_SAFE - i) / weight)) {
        throw new Error("Punycode input is too large to decode.");
      }
      i += digit * weight;
      const threshold = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < threshold) break;
      if (weight > Math.floor(MAX_SAFE / (BASE - threshold))) {
        throw new Error("Punycode input is too large to decode.");
      }
      weight *= BASE - threshold;
    }
    const length = output.length + 1;
    bias = adapt(i - previous, length, previous === 0);
    n += Math.floor(i / length);
    i %= length;
    if (n > 0x10ffff || isSurrogate(n)) {
      throw new Error("Punycode decodes to an invalid Unicode code point.");
    }
    output.splice(i, 0, n);
    i += 1;
  }

  return String.fromCodePoint(...output);
}

const UNICODE_DOTS = /[\u3002\uff0e\uff61]/g;
const LABEL_PATTERN = /^[\p{L}\p{N}\p{M}-]+$/u;
const SINGLE_LABEL_CHARACTER = /^[\p{L}\p{N}\p{M}-]$/u;

function normalizeDomain(input: string): string {
  const trimmed = input.trim().replace(UNICODE_DOTS, ".");
  if (!trimmed) throw new Error("Enter a domain name.");
  if (/\s/.test(trimmed)) throw new Error("Domain names cannot contain spaces.");
  return trimmed.toLowerCase();
}

function validateUnicodeLabel(label: string): void {
  if (!label) throw new Error("Domain names cannot contain empty labels.");
  if (label.startsWith("-") || label.endsWith("-")) {
    throw new Error(`Label "${label}" cannot start or end with a hyphen.`);
  }
  if (!LABEL_PATTERN.test(label)) {
    const invalid = Array.from(label).find(
      (character) => !SINGLE_LABEL_CHARACTER.test(character),
    );
    throw new Error(
      invalid
        ? `Label "${label}" contains "${invalid}", which is not allowed in a domain label.`
        : `Label "${label}" contains an unsupported character.`,
    );
  }
}

function splitDomain(domain: string): { labels: string[]; trailingDot: boolean } {
  const trailingDot = domain.endsWith(".");
  const body = trailingDot ? domain.slice(0, -1) : domain;
  return { labels: body.split("."), trailingDot };
}

function joinDomain(labels: string[], trailingDot: boolean): string {
  const value = labels.join(".");
  if (value.replace(/\.$/, "").length > 253) {
    throw new Error("Domain name is longer than 253 characters.");
  }
  return trailingDot ? `${value}.` : value;
}

export function domainToAscii(domain: string): string {
  const normalized = normalizeDomain(domain);
  const { labels, trailingDot } = splitDomain(normalized);
  const asciiLabels = labels.map((label) => {
    if (!label) throw new Error("Domain names cannot contain empty labels.");
    if (label.startsWith("xn--")) {
      if (label.length === 4) throw new Error('A label cannot be just "xn--".');
      const decoded = punycodeDecode(label.slice(4));
      validateUnicodeLabel(decoded);
      if (`xn--${punycodeEncode(decoded)}` !== label) {
        throw new Error(`Label "${label}" is not canonical Punycode.`);
      }
      return label;
    }
    validateUnicodeLabel(label);
    const needsPunycode = [...label].some((char) => (char.codePointAt(0) ?? 0) > 0x7f);
    const ascii = needsPunycode ? `xn--${punycodeEncode(label)}` : label;
    if (ascii.length > 63) {
      throw new Error(`Label "${label}" is longer than 63 characters once encoded.`);
    }
    return ascii;
  });
  return joinDomain(asciiLabels, trailingDot);
}

export function domainToUnicode(domain: string): string {
  const normalized = normalizeDomain(domain);
  const { labels, trailingDot } = splitDomain(normalized);
  const unicodeLabels = labels.map((label) => {
    if (!label) throw new Error("Domain names cannot contain empty labels.");
    if (!label.startsWith("xn--")) {
      validateUnicodeLabel(label);
      return label;
    }
    const encoded = label.slice(4);
    if (!encoded) throw new Error('A label cannot be just "xn--".');
    if (!/^[a-z0-9-]+$/.test(encoded)) {
      throw new Error(`Label "${label}" contains characters that are not valid Punycode.`);
    }
    const decoded = punycodeDecode(encoded);
    validateUnicodeLabel(decoded);
    return decoded;
  });
  return joinDomain(unicodeLabels, trailingDot);
}

/* Base32 and Base58 */

export type BaseAlphabet = "base32" | "base58";
export type BaseDirection = "encode" | "decode";
export type BaseKind = "text" | "hex";

export interface BaseResult {
  value: string;
  byteCount: number;
}

export function convertBase(
  input: string,
  options: { alphabet: BaseAlphabet; direction: BaseDirection; kind: BaseKind },
): BaseResult {
  if (!input.trim()) return { value: "", byteCount: 0 };

  if (options.direction === "encode") {
    const bytes = options.kind === "hex" ? hexToBytes(input) : textToBytes(input);
    return {
      value: options.alphabet === "base32" ? encodeBase32(bytes) : encodeBase58(bytes),
      byteCount: bytes.length,
    };
  }

  const bytes =
    options.alphabet === "base32" ? decodeBase32(input) : decodeBase58(input);
  if (options.kind === "hex") {
    return { value: bytesToHex(bytes), byteCount: bytes.length };
  }
  try {
    return { value: bytesToText(bytes, true), byteCount: bytes.length };
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8 text. Switch the output to hex to inspect them.");
  }
}
