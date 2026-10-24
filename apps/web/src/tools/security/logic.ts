import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToText,
  hexToBytes,
  textToBytes,
} from "@/lib/encoding";
import { hashBytes, hmacBytes, type HashAlgorithm } from "@/lib/hashing";

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const output = new Uint8Array(first.length + second.length);
  output.set(first, 0);
  output.set(second, first.length);
  return output;
}

/* JWT decoding */

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  signingInput: string;
  signatureHex: string;
  segments: string[];
}

function parseJwtSegment(segment: string, label: string): Record<string, unknown> {
  if (!segment) throw new Error(`The ${label} segment is empty`);
  let text: string;
  try {
    text = bytesToText(base64ToBytes(segment), true);
  } catch {
    throw new Error(`The ${label} segment is not valid Base64URL`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`The ${label} segment is not valid JSON`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`The ${label} segment must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function decodeJwt(token: string): DecodedJwt {
  const trimmed = token.trim().replace(/^bearer\s+/i, "");
  if (!trimmed) throw new Error("Paste a JWT to decode");
  const segments = trimmed.split(".");
  if (segments.length !== 3) {
    throw new Error("A JWT must have three dot-separated segments (header.payload.signature)");
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const header = parseJwtSegment(headerSegment, "header");
  const payload = parseJwtSegment(payloadSegment, "payload");
  let signatureHex = "";
  if (signatureSegment) {
    try {
      signatureHex = bytesToHex(base64ToBytes(signatureSegment));
    } catch {
      throw new Error("The signature segment is not valid Base64URL");
    }
  }
  return {
    header,
    payload,
    signature: signatureSegment,
    signingInput: `${headerSegment}.${payloadSegment}`,
    signatureHex,
    segments,
  };
}

export const REGISTERED_CLAIM_LABELS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expiration time",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
};

export type ClaimState = "valid" | "expired" | "not-yet-valid" | "unknown";

export interface ClaimRow {
  key: string;
  label: string;
  value: string;
  registered: boolean;
  state: ClaimState;
  time: string;
}

const TIME_CLAIMS = new Set(["exp", "nbf", "iat"]);

export function claimValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
}

export function describeClaims(
  payload: Record<string, unknown>,
  nowMs = Date.now(),
): ClaimRow[] {
  return Object.keys(payload)
    .sort((first, second) => {
      const firstRegistered = first in REGISTERED_CLAIM_LABELS;
      const secondRegistered = second in REGISTERED_CLAIM_LABELS;
      if (firstRegistered !== secondRegistered) return firstRegistered ? -1 : 1;
      return first.localeCompare(second);
    })
    .map((key) => {
      const value = payload[key];
      const numeric = typeof value === "number" && Number.isFinite(value);
      let state: ClaimState = "unknown";
      let time = "";
      if (numeric && TIME_CLAIMS.has(key)) {
        const date = new Date(value * 1000);
        if (Number.isNaN(date.getTime())) {
          time = "Invalid date";
        } else {
          time = date.toISOString();
          if (key === "exp") state = value * 1000 <= nowMs ? "expired" : "valid";
          else state = value * 1000 > nowMs ? "not-yet-valid" : "valid";
        }
      }
      return {
        key,
        label: REGISTERED_CLAIM_LABELS[key] ?? key,
        value: claimValue(value),
        registered: key in REGISTERED_CLAIM_LABELS,
        state,
        time,
      };
    });
}

export function jwtTimeState(seconds: unknown, nowMs = Date.now()): ClaimState {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "unknown";
  return seconds * 1000 <= nowMs ? "expired" : "valid";
}

/* HMAC */

export type HmacKeyEncoding = "text" | "hex" | "base64";
export type DigestEncoding = "hex" | "base64";

export function decodeHmacKey(input: string, encoding: HmacKeyEncoding): Uint8Array {
  if (!input) throw new Error("Enter a key");
  if (encoding === "text") return textToBytes(input);
  let bytes: Uint8Array;
  if (encoding === "hex") {
    bytes = hexToBytes(input);
  } else {
    try {
      bytes = base64ToBytes(input);
    } catch {
      throw new Error("The key is not valid Base64");
    }
  }
  if (bytes.length === 0) throw new Error("The key decodes to zero bytes");
  return bytes;
}

export function hmacDigest(
  algorithm: HashAlgorithm,
  key: Uint8Array,
  message: string,
  encoding: DigestEncoding,
): string {
  const digest = hmacBytes(algorithm, key, textToBytes(message));
  return encoding === "hex" ? bytesToHex(digest) : bytesToBase64(digest);
}

/* Bcrypt */

export const BCRYPT_MIN_COST = 4;
export const BCRYPT_MAX_COST = 15;

export function validateBcryptCost(cost: number): string {
  if (!Number.isInteger(cost) || cost < BCRYPT_MIN_COST || cost > BCRYPT_MAX_COST) {
    return `Cost must be a whole number between ${BCRYPT_MIN_COST} and ${BCRYPT_MAX_COST}`;
  }
  return "";
}

export function bcryptCostHint(cost: number): string {
  if (cost >= 14) return `Cost ${cost} runs 2^${cost} rounds and can take several seconds.`;
  if (cost >= 12) return `Cost ${cost} is slow by design and may take around a second.`;
  if (cost < 10) return `Cost ${cost} is below common practice; use 10 or higher for new hashes.`;
  return `Cost ${cost} runs 2^${cost} rounds.`;
}

export function validateBcryptPassword(password: string): string {
  if (!password) return "Enter a password";
  if (textToBytes(password).length > 72) {
    return "Bcrypt uses only the first 72 bytes; shorten the password";
  }
  return "";
}

export interface BcryptHashInfo {
  version: string;
  cost: number;
}

export function describeBcryptHash(hash: string): BcryptHashInfo {
  const match = /^\$2([abxy])\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(hash.trim());
  if (!match) throw new Error("This does not look like a bcrypt hash");
  return { version: `2${match[1]}`, cost: Number(match[2]) };
}

/* UUID and ULID */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function uuidV4FromBytes(bytes: Uint8Array): string {
  if (bytes.length < 16) throw new Error("A UUID v4 needs 16 random bytes");
  const value = bytes.slice(0, 16);
  value[6] = (value[6] & 0x0f) | 0x40;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = bytesToHex(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export function generateUuidV4(): string {
  return uuidV4FromBytes(crypto.getRandomValues(new Uint8Array(16)));
}

export function parseUuid(value: string): Uint8Array {
  const normalized = value
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/[{}]/g, "")
    .replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(normalized)) {
    throw new Error("Namespace must be a 32-digit hexadecimal UUID");
  }
  return hexToBytes(normalized);
}

export interface UuidFormatOptions {
  uppercase?: boolean;
  braces?: boolean;
  hyphens?: boolean;
}

export function formatUuid(value: string, options: UuidFormatOptions = {}): string {
  const hex = bytesToHex(parseUuid(value), "", options.uppercase);
  const grouped =
    options.hyphens === false
      ? hex
      : `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
          16,
          20,
        )}-${hex.slice(20)}`;
  return options.braces ? `{${grouped}}` : grouped;
}

export function uuidV5(namespace: string, name: string): string {
  if (!name) throw new Error("Enter a name to hash");
  const namespaceBytes = parseUuid(namespace);
  const digest = hashBytes("sha1", concatBytes(namespaceBytes, textToBytes(name))).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(bytesToHex(digest));
}

export function ulidFromBytes(timeMs: number, random: Uint8Array): string {
  if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs >= 2 ** 48) {
    throw new Error("ULID time must fit in 48 bits");
  }
  if (random.length < 10) throw new Error("A ULID needs 10 random bytes");
  let time = "";
  for (let index = 0; index < 10; index += 1) {
    time += CROCKFORD[Math.floor(timeMs / 32 ** (9 - index)) % 32];
  }
  let randomness = "";
  for (let index = 0; index < 16; index += 1) {
    const bit = index * 5;
    const byteIndex = Math.floor(bit / 8);
    const shift = 8 - (bit % 8) - 5;
    const value =
      shift >= 0
        ? (random[byteIndex] >> shift) & 31
        : ((random[byteIndex] << -shift) | (random[byteIndex + 1] >> (8 + shift))) & 31;
    randomness += CROCKFORD[value];
  }
  return time + randomness;
}

export function generateUlid(nowMs = Date.now()): string {
  return ulidFromBytes(nowMs, crypto.getRandomValues(new Uint8Array(10)));
}

export function formatUlid(value: string, uppercase = true): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(normalized)) {
    throw new Error("A ULID must be 26 Crockford Base32 characters");
  }
  return uppercase ? normalized : normalized.toLowerCase();
}

/* PEM */

export function derToPem(input: ArrayBuffer | Uint8Array, label: string): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length === 0) throw new Error("Cannot encode an empty key");
  const base64 = bytesToBase64(bytes);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export interface ParsedPem {
  label: string;
  der: Uint8Array;
}

export function parsePem(input: string): ParsedPem {
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(input.trim());
  if (!match) throw new Error("No PEM block found; include the BEGIN and END markers");
  const label = match[1];
  let der: Uint8Array;
  try {
    der = base64ToBytes(match[2]);
  } catch {
    throw new Error(`The ${label} block does not contain valid Base64`);
  }
  if (der.length === 0) throw new Error(`The ${label} block is empty`);
  return { label, der };
}

export function pemToDer(input: string): Uint8Array {
  return parsePem(input).der;
}

/* Password generation */

export const PASSWORD_CLASSES = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

const AMBIGUOUS_CHARACTERS = new Set("Il1O0o|`'\"");

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export type RandomSource = (size: number) => Uint8Array;

export const cryptoRandom: RandomSource = (size) =>
  crypto.getRandomValues(new Uint8Array(size));

function selectedPools(options: PasswordOptions): string[] {
  const pools: string[] = [];
  const add = (enabled: boolean, characters: string) => {
    if (!enabled) return;
    const pool = Array.from(characters)
      .filter((character) => !options.excludeAmbiguous || !AMBIGUOUS_CHARACTERS.has(character))
      .join("");
    if (!pool) throw new Error("A selected character class has no characters left");
    pools.push(pool);
  };
  add(options.lowercase, PASSWORD_CLASSES.lowercase);
  add(options.uppercase, PASSWORD_CLASSES.uppercase);
  add(options.digits, PASSWORD_CLASSES.digits);
  add(options.symbols, PASSWORD_CLASSES.symbols);
  if (pools.length === 0) throw new Error("Select at least one character class");
  return pools;
}

export function passwordAlphabet(options: PasswordOptions): string {
  return selectedPools(options).join("");
}

export function passwordEntropyBits(length: number, alphabetSize: number): number {
  if (length <= 0 || alphabetSize <= 1) return 0;
  return length * Math.log2(alphabetSize);
}

export function passwordStrengthLabel(bits: number): string {
  if (bits < 40) return "Weak";
  if (bits < 60) return "Fair";
  if (bits < 80) return "Strong";
  return "Very strong";
}

export function validatePasswordOptions(options: PasswordOptions): string {
  if (!Number.isInteger(options.length) || options.length < 4 || options.length > 128) {
    return "Length must be a whole number between 4 and 128";
  }
  if (
    !options.lowercase &&
    !options.uppercase &&
    !options.digits &&
    !options.symbols
  ) {
    return "Select at least one character class";
  }
  return "";
}

function randomInt(maxExclusive: number, random: RandomSource): number {
  if (maxExclusive <= 1) return 0;
  const limit = 256 - (256 % maxExclusive);
  let byte = 256;
  while (byte >= limit) {
    const buffer = random(1);
    if (buffer.length === 0) throw new Error("Random source returned no bytes");
    byte = buffer[0];
  }
  return byte % maxExclusive;
}

export function generatePassword(
  options: PasswordOptions,
  random: RandomSource = cryptoRandom,
): string {
  const validation = validatePasswordOptions(options);
  if (validation) throw new Error(validation);
  const pools = selectedPools(options);
  const alphabet = pools.join("");
  const characters: string[] = [];
  for (const pool of pools) {
    characters.push(pool[randomInt(pool.length, random)]);
  }
  while (characters.length < options.length) {
    characters.push(alphabet[randomInt(alphabet.length, random)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1, random);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}

export function generatePasswords(
  options: PasswordOptions,
  count: number,
  random: RandomSource = cryptoRandom,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 25) {
    throw new Error("Bulk count must be a whole number between 1 and 25");
  }
  return Array.from({ length: count }, () => generatePassword(options, random));
}

/* AES envelope */

export type AesAlgorithm = "AES-GCM" | "AES-CBC";

export interface AesEnvelope {
  v: 1;
  alg: AesAlgorithm;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ct: string;
}

export const AES_ITERATIONS_MIN = 10_000;
export const AES_ITERATIONS_MAX = 2_000_000;
export const AES_DEFAULT_ITERATIONS = 210_000;

export function validateAesIterations(iterations: number): string {
  if (
    !Number.isInteger(iterations) ||
    iterations < AES_ITERATIONS_MIN ||
    iterations > AES_ITERATIONS_MAX
  ) {
    return `Iterations must be between ${AES_ITERATIONS_MIN.toLocaleString("en-US")} and ${AES_ITERATIONS_MAX.toLocaleString("en-US")}`;
  }
  return "";
}

export function aesIvLength(algorithm: AesAlgorithm): number {
  return algorithm === "AES-GCM" ? 12 : 16;
}

export function encodeAesEnvelope(envelope: AesEnvelope): string {
  return bytesToBase64(textToBytes(JSON.stringify(envelope)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeAesEnvelope(input: string): AesEnvelope {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a Base64 payload to decrypt");
  let text: string;
  try {
    text = bytesToText(base64ToBytes(trimmed), true);
  } catch {
    throw new Error("The payload is not valid Base64");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The payload is not a devkit AES envelope");
  }
  if (!isRecord(value)) throw new Error("The AES envelope must be a JSON object");
  if (value.v !== 1) throw new Error("Unsupported AES envelope version");
  if (value.alg !== "AES-GCM" && value.alg !== "AES-CBC") {
    throw new Error("The envelope names an unsupported AES mode");
  }
  if (value.kdf !== "PBKDF2-SHA256") throw new Error("The envelope names an unsupported key derivation");
  if (typeof value.iterations !== "number") {
    throw new Error("The envelope is missing the PBKDF2 iteration count");
  }
  const iterationError = validateAesIterations(value.iterations);
  if (iterationError) throw new Error(iterationError);
  const saltValue = value.salt;
  const ivValue = value.iv;
  const ctValue = value.ct;
  if (typeof saltValue !== "string" || !saltValue) {
    throw new Error("The envelope is missing its salt");
  }
  if (typeof ivValue !== "string" || !ivValue) {
    throw new Error("The envelope is missing its initialization vector");
  }
  if (typeof ctValue !== "string" || !ctValue) {
    throw new Error("The envelope is missing its ciphertext");
  }
  const salt = decodeEnvelopeField(saltValue, "salt");
  const iv = decodeEnvelopeField(ivValue, "initialization vector");
  const ct = decodeEnvelopeField(ctValue, "ciphertext");
  if (salt.length < 8 || salt.length > 64) {
    throw new Error("The envelope salt must be between 8 and 64 bytes");
  }
  if (iv.length < 8 || iv.length > 16) {
    throw new Error("The envelope initialization vector must be between 8 and 16 bytes");
  }
  if (ct.length === 0) throw new Error("The envelope ciphertext is empty");
  return {
    v: 1,
    alg: value.alg,
    kdf: "PBKDF2-SHA256",
    iterations: value.iterations,
    salt: saltValue,
    iv: ivValue,
    ct: ctValue,
  };
}

function decodeEnvelopeField(value: string, label: string): Uint8Array {
  try {
    return base64ToBytes(value);
  } catch {
    throw new Error(`The envelope ${label} is not valid Base64`);
  }
}

/* Random bytes */

export const RANDOM_BYTES_MAX = 65_536;

export type RandomBytesEncoding = "hex" | "base64" | "decimal";

export function parseRandomByteSize(input: string): number {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error("Size must be a whole number of bytes");
  const size = Number(trimmed);
  if (!Number.isSafeInteger(size) || size < 1 || size > RANDOM_BYTES_MAX) {
    throw new Error(`Size must be between 1 and ${RANDOM_BYTES_MAX.toLocaleString("en-US")} bytes`);
  }
  return size;
}

export function generateRandomBytes(size: number): Uint8Array {
  if (!Number.isInteger(size) || size < 1 || size > RANDOM_BYTES_MAX) {
    throw new Error(`Size must be between 1 and ${RANDOM_BYTES_MAX.toLocaleString("en-US")} bytes`);
  }
  const output = new Uint8Array(size);
  const chunk = 65_536;
  for (let offset = 0; offset < size; offset += chunk) {
    output.set(crypto.getRandomValues(new Uint8Array(Math.min(chunk, size - offset))), offset);
  }
  return output;
}

export function formatRandomBytes(
  bytes: Uint8Array,
  encoding: RandomBytesEncoding,
  uppercase = false,
): string {
  if (encoding === "hex") return bytesToHex(bytes, "", uppercase);
  if (encoding === "base64") return bytesToBase64(bytes);
  return Array.from(bytes).join(" ");
}

/* X.509 / ASN.1 */

interface Asn1Element {
  tagClass: number;
  constructed: boolean;
  tag: number;
  contentStart: number;
  contentEnd: number;
}

function readAsn1(bytes: Uint8Array, offset: number): Asn1Element {
  if (offset >= bytes.length) throw new Error("Unexpected end of DER data");
  const first = bytes[offset];
  const tagClass = first >> 6;
  const constructed = (first & 0x20) !== 0;
  const tag = first & 0x1f;
  if (tag === 0x1f) throw new Error("High-tag-number ASN.1 elements are not supported");
  let cursor = offset + 1;
  if (cursor >= bytes.length) throw new Error("Truncated ASN.1 length");
  const firstLength = bytes[cursor];
  cursor += 1;
  let length: number;
  if (firstLength < 0x80) {
    length = firstLength;
  } else {
    const count = firstLength & 0x7f;
    if (count === 0) throw new Error("Indefinite ASN.1 lengths are not supported");
    if (count > 4) throw new Error("ASN.1 length is too large");
    if (cursor + count > bytes.length) throw new Error("Truncated ASN.1 length");
    length = 0;
    for (let index = 0; index < count; index += 1) {
      length = length * 256 + bytes[cursor];
      cursor += 1;
    }
  }
  if (cursor + length > bytes.length) throw new Error("ASN.1 element extends past the end of the data");
  return { tagClass, constructed, tag, contentStart: cursor, contentEnd: cursor + length };
}

function asn1Children(bytes: Uint8Array, element: Asn1Element): Asn1Element[] {
  const children: Asn1Element[] = [];
  let offset = element.contentStart;
  while (offset < element.contentEnd) {
    const child = readAsn1(bytes, offset);
    if (child.contentEnd > element.contentEnd) {
      throw new Error("ASN.1 child extends past its parent");
    }
    children.push(child);
    offset = child.contentEnd;
  }
  return children;
}

function elementBytes(bytes: Uint8Array, element: Asn1Element): Uint8Array {
  return bytes.subarray(element.contentStart, element.contentEnd);
}

function expectUniversal(element: Asn1Element, tag: number, label: string): void {
  if (element.tagClass !== 0 || element.tag !== tag) {
    throw new Error(`Expected ${label} in the certificate`);
  }
}

function decodeAsn1String(bytes: Uint8Array, element: Asn1Element): string {
  const value = elementBytes(bytes, element);
  if (element.tag === 0x1e) {
    let output = "";
    for (let index = 0; index + 1 < value.length; index += 2) {
      output += String.fromCharCode((value[index] << 8) | value[index + 1]);
    }
    return output;
  }
  if (element.tag === 0x14) {
    return Array.from(value, (byte) => String.fromCharCode(byte)).join("");
  }
  if ([0x0c, 0x13, 0x16, 0x1a].includes(element.tag)) {
    return bytesToText(value);
  }
  return bytesToHex(value);
}

function decodeOid(bytes: Uint8Array, element: Asn1Element): string {
  expectUniversal(element, 0x06, "an object identifier");
  const value = elementBytes(bytes, element);
  if (value.length === 0) throw new Error("Empty ASN.1 object identifier");
  const arcs: number[] = [];
  let current = 0;
  let inProgress = false;
  for (const byte of value) {
    current = current * 128 + (byte & 0x7f);
    inProgress = (byte & 0x80) !== 0;
    if (!inProgress) {
      arcs.push(current);
      current = 0;
    }
  }
  if (inProgress) throw new Error("Truncated ASN.1 object identifier");
  const first = arcs[0];
  const arc0 = first < 40 ? 0 : first < 80 ? 1 : 2;
  return [arc0, first - arc0 * 40, ...arcs.slice(1)].join(".");
}

function decodeInteger(bytes: Uint8Array, element: Asn1Element): bigint {
  expectUniversal(element, 0x02, "an integer");
  const value = elementBytes(bytes, element);
  if (value.length === 0) throw new Error("Empty ASN.1 integer");
  let result = 0n;
  for (const byte of value) result = (result << 8n) | BigInt(byte);
  if ((value[0] & 0x80) !== 0) result -= 1n << BigInt(value.length * 8);
  return result;
}

const NAME_ATTRIBUTES: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.4": "SN",
  "2.5.4.5": "serialNumber",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.42": "GN",
  "0.9.2342.19200300.100.1.25": "DC",
  "1.2.840.113549.1.9.1": "emailAddress",
};

function parseName(bytes: Uint8Array, sequence: Asn1Element): string {
  expectUniversal(sequence, 0x10, "a distinguished name");
  const parts: string[] = [];
  for (const rdn of asn1Children(bytes, sequence)) {
    expectUniversal(rdn, 0x11, "a relative distinguished name");
    const values: string[] = [];
    for (const attribute of asn1Children(bytes, rdn)) {
      expectUniversal(attribute, 0x10, "a name attribute");
      const pair = asn1Children(bytes, attribute);
      if (pair.length < 2) throw new Error("Incomplete name attribute");
      const oid = decodeOid(bytes, pair[0]);
      values.push(`${NAME_ATTRIBUTES[oid] ?? oid}=${decodeAsn1String(bytes, pair[1])}`);
    }
    parts.push(values.join("+"));
  }
  return parts.join(", ");
}

function parseAsn1Time(bytes: Uint8Array, element: Asn1Element): Date {
  const text = bytesToText(elementBytes(bytes, element), true);
  let match: RegExpExecArray | null;
  let year: number;
  if (element.tag === 0x17) {
    match = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?(Z|[+-]\d{4})$/.exec(text);
    if (!match) throw new Error("Unrecognized ASN.1 UTC time");
    const shortYear = Number(match[1]);
    year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
  } else if (element.tag === 0x18) {
    match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?(Z|[+-]\d{4})?$/.exec(text);
    if (!match) throw new Error("Unrecognized ASN.1 generalized time");
    year = Number(match[1]);
  } else {
    throw new Error("Expected a certificate time value");
  }
  const zone = match[7] ?? "Z";
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    offsetMinutes = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
  }
  const date = new Date(
    Date.UTC(
      year,
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? "0"),
    ) -
      offsetMinutes * 60_000,
  );
  if (Number.isNaN(date.getTime())) throw new Error("Invalid certificate time");
  return date;
}

const SIGNATURE_ALGORITHMS: Record<string, string> = {
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
};

const PUBLIC_KEY_ALGORITHMS: Record<string, string> = {
  "1.2.840.113549.1.1.1": "RSA",
  "1.2.840.10045.2.1": "EC",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
  "1.2.840.10040.4.1": "DSA",
};

const NAMED_CURVES: Record<string, string> = {
  "1.2.840.10045.3.1.7": "P-256",
  "1.3.132.0.34": "P-384",
  "1.3.132.0.35": "P-521",
  "1.3.132.0.10": "secp256k1",
};

const EXTENSION_NAMES: Record<string, string> = {
  "2.5.29.14": "Subject Key Identifier",
  "2.5.29.15": "Key Usage",
  "2.5.29.17": "Subject Alternative Name",
  "2.5.29.19": "Basic Constraints",
  "2.5.29.31": "CRL Distribution Points",
  "2.5.29.32": "Certificate Policies",
  "2.5.29.35": "Authority Key Identifier",
  "2.5.29.37": "Extended Key Usage",
  "1.3.6.1.5.5.7.1.1": "Authority Information Access",
};

function parseAlgorithmIdentifier(bytes: Uint8Array, element: Asn1Element): string {
  expectUniversal(element, 0x10, "an algorithm identifier");
  const children = asn1Children(bytes, element);
  if (children.length === 0) throw new Error("Empty algorithm identifier");
  const oid = decodeOid(bytes, children[0]);
  return SIGNATURE_ALGORITHMS[oid] ?? PUBLIC_KEY_ALGORITHMS[oid] ?? oid;
}

function formatIpv6(bytes: Uint8Array): string {
  const groups: number[] = [];
  for (let index = 0; index < 16; index += 2) {
    groups.push((bytes[index] << 8) | bytes[index + 1]);
  }
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length; ) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    if (end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  const parts = groups.map((group) => group.toString(16));
  if (bestLength < 2) return parts.join(":");
  return `${parts.slice(0, bestStart).join(":")}::${parts.slice(bestStart + bestLength).join(":")}`;
}

function parseGeneralNames(bytes: Uint8Array, octet: Asn1Element): string[] {
  const sequence = readAsn1(bytes, octet.contentStart);
  expectUniversal(sequence, 0x10, "a subject alternative name sequence");
  if (sequence.contentEnd > octet.contentEnd) {
    throw new Error("Subject alternative name extends past its extension");
  }
  const names: string[] = [];
  for (const name of asn1Children(bytes, sequence)) {
    if (name.tagClass !== 2) continue;
    const value = elementBytes(bytes, name);
    if (name.tag === 1) names.push(`email:${bytesToText(value, true)}`);
    else if (name.tag === 2) names.push(`DNS:${bytesToText(value, true)}`);
    else if (name.tag === 6) names.push(`URI:${bytesToText(value, true)}`);
    else if (name.tag === 7) {
      names.push(`IP:${value.length === 4 ? Array.from(value).join(".") : formatIpv6(value)}`);
    } else if (name.tag === 8) {
      names.push(`RID:${decodeOid(bytes, name)}`);
    } else if (name.tag === 4 && name.constructed) {
      const inner = asn1Children(bytes, name)[0];
      if (inner) names.push(`DirName:${parseName(bytes, inner)}`);
    }
  }
  return names;
}

interface ParsedKey {
  algorithm: string;
  details: string;
}

function parsePublicKey(bytes: Uint8Array, spki: Asn1Element): ParsedKey {
  expectUniversal(spki, 0x10, "a subject public key info sequence");
  const children = asn1Children(bytes, spki);
  if (children.length < 2) throw new Error("Incomplete subject public key info");
  expectUniversal(children[0], 0x10, "a public key algorithm identifier");
  const algorithmChildren = asn1Children(bytes, children[0]);
  if (algorithmChildren.length === 0) throw new Error("Empty public key algorithm identifier");
  const oid = decodeOid(bytes, algorithmChildren[0]);
  const algorithm = PUBLIC_KEY_ALGORITHMS[oid] ?? oid;
  expectUniversal(children[1], 0x03, "a public key bit string");
  const bitString = elementBytes(bytes, children[1]);
  if (bitString.length < 2) throw new Error("Empty subject public key");
  if (algorithm === "RSA") {
    const keySequence = readAsn1(bytes, children[1].contentStart + 1);
    expectUniversal(keySequence, 0x10, "an RSA public key sequence");
    const modulus = asn1Children(bytes, keySequence)[0];
    if (!modulus) throw new Error("RSA public key is missing its modulus");
    const modulusBytes = elementBytes(bytes, modulus);
    let bits = modulusBytes.length * 8;
    for (const byte of modulusBytes) {
      if (byte === 0) {
        bits -= 8;
        continue;
      }
      let leading = 0;
      for (let value = byte; (value & 0x80) === 0; value <<= 1) leading += 1;
      bits -= leading;
      break;
    }
    return { algorithm, details: `RSA ${bits} bits` };
  }
  if (algorithm === "EC") {
    const curveOid =
      algorithmChildren.length > 1 ? decodeOid(bytes, algorithmChildren[1]) : "";
    const curve = NAMED_CURVES[curveOid] ?? curveOid;
    return { algorithm, details: curve ? `EC ${curve}` : "EC (unnamed curve)" };
  }
  return { algorithm, details: algorithm };
}

export interface CertificateInfo {
  version: string;
  serialNumber: string;
  serialDecimal: string;
  signatureAlgorithm: string;
  issuer: string;
  subject: string;
  notBefore: Date;
  notAfter: Date;
  validity: "valid" | "expired" | "not-yet-valid";
  subjectAltNames: string[];
  publicKeyAlgorithm: string;
  publicKeyDetails: string;
  isCa: boolean | null;
  extensions: string[];
}

export function certificateValidityState(
  notBefore: Date,
  notAfter: Date,
  nowMs = Date.now(),
): "valid" | "expired" | "not-yet-valid" {
  if (nowMs < notBefore.getTime()) return "not-yet-valid";
  if (nowMs > notAfter.getTime()) return "expired";
  return "valid";
}

function certificateDer(input: string | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 0) throw new Error("Paste a PEM or Base64 certificate");
    const prefix = bytesToText(input.subarray(0, Math.min(input.length, 16))).trim();
    if (prefix.startsWith("-----BEGIN")) return pemToDer(bytesToText(input, true));
    return input;
  }
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a PEM or Base64 certificate");
  if (trimmed.includes("-----BEGIN")) return pemToDer(trimmed);
  try {
    return base64ToBytes(trimmed);
  } catch {
    throw new Error("Certificate must be PEM or Base64-encoded DER");
  }
}

export function parseCertificate(
  input: string | Uint8Array,
  nowMs = Date.now(),
): CertificateInfo {
  const bytes = certificateDer(input);
  const certificate = readAsn1(bytes, 0);
  expectUniversal(certificate, 0x10, "an X.509 certificate sequence");
  const certificateChildren = asn1Children(bytes, certificate);
  if (certificateChildren.length !== 3) {
    throw new Error("This data is not an X.509 certificate");
  }
  const [tbs, outerAlgorithm, signatureValue] = certificateChildren;
  expectUniversal(tbs, 0x10, "a TBSCertificate");
  expectUniversal(outerAlgorithm, 0x10, "a signature algorithm");
  expectUniversal(signatureValue, 0x03, "a signature value");
  const signatureAlgorithm = parseAlgorithmIdentifier(bytes, outerAlgorithm);

  const fields = asn1Children(bytes, tbs);
  let cursor = 0;
  let version = "v1";
  if (fields[0] && fields[0].tagClass === 2 && fields[0].tag === 0) {
    const versionElement = asn1Children(bytes, fields[0])[0];
    if (!versionElement) throw new Error("Empty certificate version");
    version = `v${Number(decodeInteger(bytes, versionElement)) + 1}`;
    cursor += 1;
  }
  const serialElement = fields[cursor];
  const tbsAlgorithm = fields[cursor + 1];
  const issuerElement = fields[cursor + 2];
  const validityElement = fields[cursor + 3];
  const subjectElement = fields[cursor + 4];
  const keyElement = fields[cursor + 5];
  if (
    !serialElement ||
    !tbsAlgorithm ||
    !issuerElement ||
    !validityElement ||
    !subjectElement ||
    !keyElement
  ) {
    throw new Error("The certificate is missing required fields");
  }
  const serial = decodeInteger(bytes, serialElement);
  if (serial < 0n) throw new Error("Negative certificate serial numbers are not supported");
  const serialHex = bytesToHex(elementBytes(bytes, serialElement), "", true);
  parseAlgorithmIdentifier(bytes, tbsAlgorithm);

  const validityChildren = asn1Children(bytes, validityElement);
  if (validityChildren.length < 2) throw new Error("The certificate validity is incomplete");
  const notBefore = parseAsn1Time(bytes, validityChildren[0]);
  const notAfter = parseAsn1Time(bytes, validityChildren[1]);

  const key = parsePublicKey(bytes, keyElement);

  let subjectAltNames: string[] = [];
  let isCa: boolean | null = null;
  const extensionNames: string[] = [];
  for (const field of fields.slice(cursor + 6)) {
    if (field.tagClass !== 2 || field.tag !== 3) continue;
    const sequence = asn1Children(bytes, field)[0];
    if (!sequence) continue;
    for (const extension of asn1Children(bytes, sequence)) {
      expectUniversal(extension, 0x10, "an extension");
      const parts = asn1Children(bytes, extension);
      if (parts.length < 2) continue;
      const oid = decodeOid(bytes, parts[0]);
      const value = parts[parts.length - 1];
      expectUniversal(value, 0x04, "an extension value");
      extensionNames.push(EXTENSION_NAMES[oid] ?? oid);
      if (oid === "2.5.29.17") subjectAltNames = parseGeneralNames(bytes, value);
      if (oid === "2.5.29.19") {
        const basic = asn1Children(bytes, readAsn1(bytes, value.contentStart))[0];
        isCa = false;
        if (basic) {
          const first = asn1Children(bytes, basic)[0];
          if (first && first.tag === 0x01) isCa = elementBytes(bytes, first)[0] !== 0;
        }
      }
    }
  }

  return {
    version,
    serialNumber: serialHex,
    serialDecimal: serial.toString(),
    signatureAlgorithm,
    issuer: parseName(bytes, issuerElement),
    subject: parseName(bytes, subjectElement),
    notBefore,
    notAfter,
    validity: certificateValidityState(notBefore, notAfter, nowMs),
    subjectAltNames,
    publicKeyAlgorithm: key.algorithm,
    publicKeyDetails: key.details,
    isCa,
    extensions: extensionNames,
  };
}
