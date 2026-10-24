const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  dagger: "†",
  permil: "‰",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  check: "✓",
  cross: "✗",
  star: "☆",
  hearts: "♥",
  spades: "♠",
  clubs: "♣",
  diams: "♦",
};

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes: Uint8Array, fatal = false): string {
  return new TextDecoder("utf-8", { fatal }).decode(bytes);
}

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  const encoded = btoa(binary);
  return urlSafe ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : encoded;
}

export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const unpadded = normalized.replace(/=+$/, "");
  if (unpadded.length % 4 === 1) {
    throw new Error("Invalid Base64 length");
  }
  const padded = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, "=");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) {
    throw new Error("Input contains characters that are not valid Base64");
  }
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("Input is not valid Base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64(text: string, urlSafe = false): string {
  return bytesToBase64(textToBytes(text), urlSafe);
}

export function decodeBase64(text: string): string {
  return bytesToText(base64ToBytes(text), true);
}

export function bytesToHex(bytes: Uint8Array, separator = "", upperCase = false): string {
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(separator);
  return upperCase ? value.toUpperCase() : value;
}

export function hexToBytes(input: string): Uint8Array {
  const normalized = input.replace(/0x/gi, "").replace(/[\s,:_-]+/g, "");
  if (!normalized) return new Uint8Array();
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error("Input contains characters that are not hexadecimal");
  }
  if (normalized.length % 2 !== 0) {
    throw new Error("Hex input must contain an even number of digits");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function encodeHex(text: string, separator = "", upperCase = false): string {
  return bytesToHex(textToBytes(text), separator, upperCase);
}

export function decodeHex(input: string): string {
  return bytesToText(hexToBytes(input), true);
}

export function bytesToBinary(bytes: Uint8Array, separator = " "): string {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, "0")).join(separator);
}

export function binaryToBytes(input: string): Uint8Array {
  const normalized = input.replace(/[^01]/g, "");
  if (!normalized) return new Uint8Array();
  if (normalized.length % 8 !== 0) {
    throw new Error("Binary input must contain a multiple of 8 bits");
  }
  const bytes = new Uint8Array(normalized.length / 8);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 8, index * 8 + 8), 2);
  }
  return bytes;
}

export function encodeBinary(text: string, separator = " "): string {
  return bytesToBinary(textToBytes(text), separator);
}

export function decodeBinary(input: string): string {
  return bytesToText(binaryToBytes(input), true);
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input: string): Uint8Array {
  const normalized = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error(`Invalid Base32 character: ${character}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let output = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    output += BASE58_ALPHABET[0];
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    output += BASE58_ALPHABET[digits[index]];
  }
  return output;
}

export function decodeBase58(input: string): Uint8Array {
  const normalized = input.trim();
  if (!normalized) return new Uint8Array();
  const bytes: number[] = [0];
  for (const character of normalized) {
    const value = BASE58_ALPHABET.indexOf(character);
    if (value < 0) throw new Error(`Invalid Base58 character: ${character}`);
    let carry = value;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const character of normalized) {
    if (character !== BASE58_ALPHABET[0]) break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

const STANDARD_HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string, encodeAll = false): string {
  return text.replace(encodeAll ? /[\s\S]/g : /[&<>"']/g, (character) => {
    if (STANDARD_HTML_ESCAPES[character]) return STANDARD_HTML_ESCAPES[character];
    if (encodeAll && character.codePointAt(0)! > 127) {
      return `&#${character.codePointAt(0)};`;
    }
    return character;
  });
}

export function unescapeHtml(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function encodeUrlComponent(text: string): string {
  return encodeURIComponent(text);
}

export function decodeUrlComponent(text: string): string {
  return decodeURIComponent(text.replace(/\+/g, " "));
}
