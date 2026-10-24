const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_YEAR = 365.2425 * MS_PER_DAY;
const MS_PER_MONTH = MS_PER_YEAR / 12;

const MAX_DATE_MS = 8_640_000_000_000_000;

/* -------------------------------------------------------------------------- */
/* Timestamps                                                                  */
/* -------------------------------------------------------------------------- */

export class TimestampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimestampError";
  }
}

export type TimestampUnit = "seconds" | "milliseconds" | "microseconds" | "nanoseconds";
export type TimestampInputKind = TimestampUnit | "date";

export interface ParsedTimestamp {
  milliseconds: number;
  kind: TimestampInputKind;
}

export function detectTimestampUnit(digits: number): TimestampUnit | null {
  if (digits <= 10) return "seconds";
  if (digits <= 13) return "milliseconds";
  if (digits <= 16) return "microseconds";
  if (digits <= 19) return "nanoseconds";
  return null;
}

export function parseTimestampInput(raw: string): ParsedTimestamp {
  const text = raw.trim();
  if (!text) throw new TimestampError("Enter a timestamp or a date.");

  if (text.toLowerCase() === "now") {
    return { milliseconds: Date.now(), kind: "milliseconds" };
  }

  const numeric = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!numeric) {
    const parsed = Date.parse(text);
    if (Number.isNaN(parsed)) {
      throw new TimestampError(
        "Could not read that date. Use a Unix timestamp or an ISO 8601 value such as 2024-05-01T12:00:00Z.",
      );
    }
    return { milliseconds: parsed, kind: "date" };
  }

  const sign = numeric[1] === "-" ? -1 : 1;
  const digits = numeric[2].replace(/^0+(?=\d)/, "");
  const fraction = numeric[3] ?? "";
  const unit = detectTimestampUnit(digits.length);
  if (!unit) {
    throw new TimestampError("That number is too long to be a Unix timestamp.");
  }

  const integer = Number(digits);
  const fractional = fraction ? Number(`0.${fraction}`) : 0;
  let milliseconds: number;
  switch (unit) {
    case "seconds":
      milliseconds = (integer + fractional) * MS_PER_SECOND;
      break;
    case "milliseconds":
      milliseconds = integer + fractional;
      break;
    case "microseconds":
      milliseconds = (integer + fractional) / 1_000;
      break;
    case "nanoseconds":
      milliseconds = (integer + fractional) / 1_000_000;
      break;
  }

  milliseconds = sign * Math.trunc(milliseconds);
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > MAX_DATE_MS) {
    throw new TimestampError("That timestamp is outside the range JavaScript dates can represent.");
  }

  return { milliseconds, kind: unit };
}

export function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

/* -------------------------------------------------------------------------- */
/* Time zones                                                                  */
/* -------------------------------------------------------------------------- */

const FALLBACK_TIME_ZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Warsaw",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const supported = intl.supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) {
      return ["UTC", ...supported.filter((zone) => zone !== "UTC")];
    }
  } catch {
    // Fall through to the curated list.
  }
  return [...FALLBACK_TIME_ZONES];
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export interface ZoneTime {
  zone: string;
  date: string;
  time: string;
  weekday: string;
  offset: string;
  offsetMinutes: number;
  abbreviation: string;
}

function zoneParts(ms: number, zone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(ms))) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return parts;
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function zoneOffsetMinutes(ms: number, zone: string): number {
  const parts = zoneParts(ms, zone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE);
}

export function zoneAbbreviation(ms: number, zone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    });
    const name = formatter.formatToParts(new Date(ms)).find((part) => part.type === "timeZoneName");
    return name?.value ?? zone;
  } catch {
    return zone;
  }
}

export function formatInZone(ms: number, zone: string): ZoneTime {
  const parts = zoneParts(ms, zone);
  const offsetMinutes = zoneOffsetMinutes(ms, zone);
  return {
    zone,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekday: parts.weekday ?? "",
    offset: formatOffset(offsetMinutes),
    offsetMinutes,
    abbreviation: zoneAbbreviation(ms, zone),
  };
}

export function zoneOffsetDifferenceMinutes(ms: number, zone: string, other: string): number {
  return zoneOffsetMinutes(ms, zone) - zoneOffsetMinutes(ms, other);
}

export function zoneDateDifference(ms: number, zone: string, baseZone: string): number {
  const zoneDate = formatInZone(ms, zone).date;
  const baseDate = formatInZone(ms, baseZone).date;
  const zoneDay = Date.parse(`${zoneDate}T00:00:00Z`);
  const baseDay = Date.parse(`${baseDate}T00:00:00Z`);
  return Math.round((zoneDay - baseDay) / MS_PER_DAY);
}

export function toDateTimeLocalValue(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDateTimeLocalValue(value: string): number | null {
  if (!value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/* -------------------------------------------------------------------------- */
/* Date differences                                                            */
/* -------------------------------------------------------------------------- */

export interface InstantDifference {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  negative: boolean;
}

export function differenceBetweenInstants(startMs: number, endMs: number): InstantDifference {
  const delta = endMs - startMs;
  const absolute = Math.abs(delta);
  return {
    milliseconds: absolute,
    seconds: absolute / MS_PER_SECOND,
    minutes: absolute / MS_PER_MINUTE,
    hours: absolute / MS_PER_HOUR,
    days: absolute / MS_PER_DAY,
    weeks: absolute / MS_PER_WEEK,
    negative: delta < 0,
  };
}

export interface CalendarBreakdown {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  negative: boolean;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function dateParts(ms: number): DateParts {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addMonthsClamped(parts: DateParts, months: number): number {
  const total = parts.year * 12 + parts.month + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(parts.day, daysInMonth(year, month));
  return Date.UTC(
    year,
    month,
    day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

export function calendarBreakdown(startMs: number, endMs: number): CalendarBreakdown {
  const negative = endMs < startMs;
  const fromMs = Math.min(startMs, endMs);
  const toMs = Math.max(startMs, endMs);
  const from = dateParts(fromMs);
  const to = dateParts(toMs);

  let totalMonths = (to.year - from.year) * 12 + (to.month - from.month);
  let anchor = addMonthsClamped(from, totalMonths);
  if (anchor > toMs) {
    totalMonths -= 1;
    anchor = addMonthsClamped(from, totalMonths);
  }

  let remaining = toMs - anchor;
  const days = Math.floor(remaining / MS_PER_DAY);
  remaining -= days * MS_PER_DAY;
  const hours = Math.floor(remaining / MS_PER_HOUR);
  remaining -= hours * MS_PER_HOUR;
  const minutes = Math.floor(remaining / MS_PER_MINUTE);
  remaining -= minutes * MS_PER_MINUTE;
  const seconds = Math.floor(remaining / MS_PER_SECOND);
  const milliseconds = remaining - seconds * MS_PER_SECOND;

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    negative,
  };
}

function utcDayNumber(ms: number): number {
  const date = new Date(ms);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);
}

/**
 * Counts Monday–Friday days between two instants. By default the start day counts
 * and the end day does not, which matches elapsed business days.
 */
export function countBusinessDays(startMs: number, endMs: number, includeEndDay = false): number {
  if (Math.abs(endMs - startMs) < MS_PER_SECOND) return 0;
  const negative = endMs < startMs;
  const start = utcDayNumber(Math.min(startMs, endMs));
  const last = utcDayNumber(Math.max(startMs, endMs)) - (includeEndDay ? 0 : 1);
  let count = 0;
  for (let day = start; day <= last; day += 1) {
    const weekday = new Date(day * MS_PER_DAY).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return negative ? -count : count;
}

/* -------------------------------------------------------------------------- */
/* Duration parsing                                                            */
/* -------------------------------------------------------------------------- */

export class DurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DurationError";
  }
}

const UNIT_MILLISECONDS: Record<string, number> = {
  ms: 1,
  msec: 1,
  msecs: 1,
  millisecond: 1,
  milliseconds: 1,
  s: MS_PER_SECOND,
  sec: MS_PER_SECOND,
  secs: MS_PER_SECOND,
  second: MS_PER_SECOND,
  seconds: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  min: MS_PER_MINUTE,
  mins: MS_PER_MINUTE,
  minute: MS_PER_MINUTE,
  minutes: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  hr: MS_PER_HOUR,
  hrs: MS_PER_HOUR,
  hour: MS_PER_HOUR,
  hours: MS_PER_HOUR,
  d: MS_PER_DAY,
  day: MS_PER_DAY,
  days: MS_PER_DAY,
  w: MS_PER_WEEK,
  week: MS_PER_WEEK,
  weeks: MS_PER_WEEK,
  mo: MS_PER_MONTH,
  month: MS_PER_MONTH,
  months: MS_PER_MONTH,
  y: MS_PER_YEAR,
  yr: MS_PER_YEAR,
  yrs: MS_PER_YEAR,
  year: MS_PER_YEAR,
  years: MS_PER_YEAR,
};

function parseIsoDuration(text: string): number | null {
  const match =
    /^([+-])?P(?=\d|T\d)(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      text,
    );
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const [, , years, months, weeks, days, hours, minutes, seconds] = match;
  const total =
    Number(years ?? 0) * MS_PER_YEAR +
    Number(months ?? 0) * MS_PER_MONTH +
    Number(weeks ?? 0) * MS_PER_WEEK +
    Number(days ?? 0) * MS_PER_DAY +
    Number(hours ?? 0) * MS_PER_HOUR +
    Number(minutes ?? 0) * MS_PER_MINUTE +
    Number(seconds ?? 0) * MS_PER_SECOND;
  return sign * total;
}

/**
 * Accepts `2h 30m`, `1.5 days`, `2 hours and 15 minutes`, `01:30:00`,
 * ISO 8601 durations, and bare seconds.
 */
export function parseDuration(raw: string): number {
  const text = raw.trim();
  if (!text) throw new DurationError("Enter a duration such as 2h 30m or 90s.");

  const iso = parseIsoDuration(text);
  if (iso !== null) return iso;

  const clock = /^([+-]?)(\d+):([0-5]?\d)(?::([0-5]?\d)(?:\.(\d{1,3}))?)?$/.exec(text);
  if (clock) {
    const sign = clock[1] === "-" ? -1 : 1;
    const a = Number(clock[2]);
    const b = Number(clock[3]);
    const c = clock[4] !== undefined ? Number(clock[4]) : null;
    const fraction = clock[5] ? Number(clock[5].padEnd(3, "0")) : 0;
    const total =
      c === null
        ? (a * 60 + b) * MS_PER_SECOND
        : a * MS_PER_HOUR + b * MS_PER_MINUTE + c * MS_PER_SECOND + fraction;
    return sign * total;
  }

  const bare = /^([+-]?\d+(?:\.\d+)?)$/.exec(text);
  if (bare) return Number(bare[1]) * MS_PER_SECOND;

  let sign = 1;
  let rest = text.toLowerCase().replace(/,/g, " ");
  if (rest.startsWith("+")) rest = rest.slice(1).trim();
  else if (rest.startsWith("-")) {
    sign = -1;
    rest = rest.slice(1).trim();
  }

  let total = 0;
  let matched = false;
  while (rest.length > 0) {
    const token = /^(\d+(?:\.\d+)?)\s*([a-z]+)/.exec(rest);
    if (!token) {
      throw new DurationError(
        `Could not read "${rest}". Use formats like 2h 30m, 1.5 days, PT2H30M, or 90s.`,
      );
    }
    const unit = UNIT_MILLISECONDS[token[2]];
    if (unit === undefined) {
      throw new DurationError(`"${token[2]}" is not a known unit. Try ms, s, m, h, d, w, mo, or y.`);
    }
    total += Number(token[1]) * unit;
    matched = true;
    rest = rest.slice(token[0].length).trim();
    if (rest.startsWith("and ")) rest = rest.slice(4).trim();
  }

  if (!matched) throw new DurationError("No duration value was found.");
  if (!Number.isFinite(total)) throw new DurationError("That duration is too large.");
  return sign * total;
}

export interface DurationBreakdown {
  negative: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalMilliseconds: number;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  totalWeeks: number;
}

export function breakDownDuration(value: number): DurationBreakdown {
  if (!Number.isFinite(value)) throw new DurationError("Duration must be a finite number.");
  const negative = value < 0;
  let remaining = Math.round(Math.abs(value));
  const days = Math.floor(remaining / MS_PER_DAY);
  remaining -= days * MS_PER_DAY;
  const hours = Math.floor(remaining / MS_PER_HOUR);
  remaining -= hours * MS_PER_HOUR;
  const minutes = Math.floor(remaining / MS_PER_MINUTE);
  remaining -= minutes * MS_PER_MINUTE;
  const seconds = Math.floor(remaining / MS_PER_SECOND);
  remaining -= seconds * MS_PER_SECOND;
  const absolute = Math.abs(value);
  return {
    negative,
    days,
    hours,
    minutes,
    seconds,
    milliseconds: remaining,
    totalMilliseconds: absolute,
    totalSeconds: absolute / MS_PER_SECOND,
    totalMinutes: absolute / MS_PER_MINUTE,
    totalHours: absolute / MS_PER_HOUR,
    totalDays: absolute / MS_PER_DAY,
    totalWeeks: absolute / MS_PER_WEEK,
  };
}

export function formatDurationHuman(value: number, maxUnits = 3): string {
  const parts = breakDownDuration(value);
  if (Math.round(parts.totalMilliseconds) === 0) return "0s";
  const chunks: string[] = [];
  if (parts.days) chunks.push(`${parts.days}d`);
  if (parts.hours) chunks.push(`${parts.hours}h`);
  if (parts.minutes) chunks.push(`${parts.minutes}m`);
  if (parts.seconds) chunks.push(`${parts.seconds}s`);
  if (parts.milliseconds) chunks.push(`${parts.milliseconds}ms`);
  const shown = chunks.slice(0, maxUnits) ?? [];
  return `${parts.negative ? "-" : ""}${shown.join(" ") || "0s"}`;
}

export function formatDurationClock(value: number): string {
  const parts = breakDownDuration(value);
  const hours = parts.days * 24 + parts.hours;
  const base = `${String(hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`;
  const suffix = parts.milliseconds ? `.${String(parts.milliseconds).padStart(3, "0")}` : "";
  return `${parts.negative ? "-" : ""}${base}${suffix}`;
}

export function formatDurationIso(value: number): string {
  const parts = breakDownDuration(value);
  const secondsLabel = Number.isInteger(parts.seconds + parts.milliseconds / MS_PER_SECOND)
    ? String(parts.seconds)
    : String(Number((parts.seconds + parts.milliseconds / MS_PER_SECOND).toFixed(3)));
  const datePart = parts.days ? `P${parts.days}D` : "P";
  const timeChunks: string[] = [];
  if (parts.hours) timeChunks.push(`${parts.hours}H`);
  if (parts.minutes) timeChunks.push(`${parts.minutes}M`);
  if (Number(secondsLabel) !== 0 || timeChunks.length === 0) timeChunks.push(`${secondsLabel}S`);
  return `${parts.negative ? "-" : ""}${datePart}${timeChunks.length ? `T${timeChunks.join("")}` : ""}`;
}

/* -------------------------------------------------------------------------- */
/* Number bases                                                                */
/* -------------------------------------------------------------------------- */

export const BASE_MIN = 2;
export const BASE_MAX = 36;

export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseError";
  }
}

function assertBase(base: number): void {
  if (!Number.isInteger(base) || base < BASE_MIN || base > BASE_MAX) {
    throw new BaseError(`Base must be an integer between ${BASE_MIN} and ${BASE_MAX}.`);
  }
}

function digitValue(character: string): number {
  const code = character.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 87;
  if (code >= 65 && code <= 90) return code - 55;
  return -1;
}

export function parseIntegerInBase(
  raw: string,
  base: number,
  options: { allowNegative?: boolean } = {},
): bigint {
  assertBase(base);
  let text = raw.trim().replace(/[\s_]/g, "");
  if (!text) throw new BaseError("Enter a number.");

  let sign = 1;
  if (text.startsWith("+")) text = text.slice(1);
  else if (text.startsWith("-")) {
    if (options.allowNegative === false) {
      throw new BaseError("Negative values are not allowed here.");
    }
    sign = -1;
    text = text.slice(1);
  }
  if (!text) throw new BaseError("Enter digits after the sign.");

  const lower = text.toLowerCase();
  if (lower.startsWith("0x") || lower.startsWith("0o") || lower.startsWith("0b")) {
    const prefixBase = lower.startsWith("0x") ? 16 : lower.startsWith("0o") ? 8 : 2;
    if (prefixBase !== base) {
      throw new BaseError(`The ${lower.slice(0, 2)} prefix does not match base ${base}.`);
    }
    text = text.slice(2);
    if (!text) throw new BaseError("Enter digits after the prefix.");
  }

  let value = 0n;
  const bigBase = BigInt(base);
  for (const character of text) {
    const digit = digitValue(character);
    if (digit < 0 || digit >= base) {
      throw new BaseError(
        `"${character}" is not a digit in base ${base}. Valid digits are 0–${(base - 1).toString(36).toUpperCase()}.`,
      );
    }
    value = value * bigBase + BigInt(digit);
  }
  return sign === -1 ? -value : value;
}

export interface ParseIntegerResult {
  value: bigint;
  base: number;
}

export function parseIntegerAuto(raw: string): ParseIntegerResult {
  const text = raw.trim().replace(/[\s_]/g, "");
  if (!text) throw new BaseError("Enter a number.");
  const unsigned = text.replace(/^[+-]/, "").toLowerCase();
  if (unsigned.startsWith("0x")) return { value: parseIntegerInBase(text, 16), base: 16 };
  if (unsigned.startsWith("0o")) return { value: parseIntegerInBase(text, 8), base: 8 };
  if (unsigned.startsWith("0b")) return { value: parseIntegerInBase(text, 2), base: 2 };
  return { value: parseIntegerInBase(text, 10), base: 10 };
}

export interface FormatIntegerOptions {
  uppercase?: boolean;
  groupSize?: number;
  prefix?: boolean;
}

function digitsForBase(value: bigint, base: number): string {
  if (value === 0n) return "0";
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  let remaining = value;
  let output = "";
  const bigBase = BigInt(base);
  while (remaining > 0n) {
    output = digits[Number(remaining % bigBase)] + output;
    remaining /= bigBase;
  }
  return output;
}

export function formatIntegerInBase(
  value: bigint,
  base: number,
  options: FormatIntegerOptions = {},
): string {
  assertBase(base);
  const negative = value < 0n;
  const digits = digitsForBase(negative ? -value : value, base);
  const cased = options.uppercase ? digits.toUpperCase() : digits;
  const groupSize = options.groupSize ?? 0;
  let grouped = cased;
  if (groupSize > 1) {
    const chunks: string[] = [];
    for (let end = cased.length; end > 0; end -= groupSize) {
      chunks.unshift(cased.slice(Math.max(0, end - groupSize), end));
    }
    grouped = chunks.join(" ");
  }
  const prefix = options.prefix
    ? base === 16
      ? "0x"
      : base === 8
        ? "0o"
        : base === 2
          ? "0b"
          : ""
    : "";
  return `${negative ? "-" : ""}${prefix}${grouped}`;
}

export function integerBitLength(value: bigint): number {
  const absolute = value < 0n ? -value : value;
  return absolute === 0n ? 1 : absolute.toString(2).length;
}

/* -------------------------------------------------------------------------- */
/* Bitwise                                                                     */
/* -------------------------------------------------------------------------- */

export type BitWidth = 8 | 16 | 32 | 64;
export type BitwiseOperation = "and" | "or" | "xor" | "not" | "shl" | "shr";

export interface BitwiseResult {
  unsigned: bigint;
  signed: bigint;
  binary: string;
  hex: string;
  octal: string;
  popcount: number;
}

export function widthMask(width: BitWidth): bigint {
  return (1n << BigInt(width)) - 1n;
}

export function toUnsigned(value: bigint, width: BitWidth): bigint {
  return value & widthMask(width);
}

export function toSigned(value: bigint, width: BitWidth): bigint {
  const masked = toUnsigned(value, width);
  const signBit = 1n << BigInt(width - 1);
  return masked & signBit ? masked - (1n << BigInt(width)) : masked;
}

export function formatBinary(value: bigint, width: BitWidth, groupSize = 4): string {
  const binary = toUnsigned(value, width).toString(2).padStart(width, "0");
  if (groupSize <= 1) return binary;
  const chunks: string[] = [];
  for (let index = 0; index < binary.length; index += groupSize) {
    chunks.push(binary.slice(index, index + groupSize));
  }
  return chunks.join(" ");
}

function popcount(value: bigint): number {
  let remaining = value < 0n ? -value : value;
  let count = 0;
  while (remaining > 0n) {
    count += Number(remaining & 1n);
    remaining >>= 1n;
  }
  return count;
}

export function computeBitwise(
  operation: BitwiseOperation,
  left: bigint,
  right: bigint,
  width: BitWidth,
): BitwiseResult {
  const a = toUnsigned(left, width);
  const b = toUnsigned(right, width);
  let result: bigint;

  switch (operation) {
    case "and":
      result = a & b;
      break;
    case "or":
      result = a | b;
      break;
    case "xor":
      result = a ^ b;
      break;
    case "not":
      result = widthMask(width) ^ a;
      break;
    case "shl":
      if (b >= BigInt(width)) {
        throw new RangeError(`Shift amount must be between 0 and ${width - 1} for ${width}-bit values.`);
      }
      if (b < 0n) throw new RangeError("Shift amount cannot be negative.");
      result = (a << b) & widthMask(width);
      break;
    case "shr":
      if (b >= BigInt(width)) {
        throw new RangeError(`Shift amount must be between 0 and ${width - 1} for ${width}-bit values.`);
      }
      if (b < 0n) throw new RangeError("Shift amount cannot be negative.");
      result = a >> b;
      break;
  }

  const unsigned = toUnsigned(result, width);
  return {
    unsigned,
    signed: toSigned(result, width),
    binary: formatBinary(result, width),
    hex: formatIntegerInBase(unsigned, 16, { uppercase: true }),
    octal: formatIntegerInBase(unsigned, 8),
    popcount: popcount(unsigned),
  };
}

/* -------------------------------------------------------------------------- */
/* Percentages and ratios                                                      */
/* -------------------------------------------------------------------------- */

export class RatioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatioError";
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RatioError(`${label} must be a finite number.`);
}

export function percentOf(percent: number, value: number): number {
  assertFinite(percent, "Percent");
  assertFinite(value, "Value");
  return (percent / 100) * value;
}

export function percentChange(from: number, to: number): number {
  assertFinite(from, "Starting value");
  assertFinite(to, "Ending value");
  if (from === 0) throw new RatioError("Percent change is undefined when the starting value is zero.");
  return ((to - from) / Math.abs(from)) * 100;
}

function decimalPlaces(value: number): number {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

export function simplifyRatio(a: number, b: number): { left: number; right: number } {
  assertFinite(a, "First value");
  assertFinite(b, "Second value");
  if (a <= 0 || b <= 0) throw new RatioError("Ratio values must be greater than zero.");
  const scale = 10 ** Math.min(6, Math.max(decimalPlaces(a), decimalPlaces(b)));
  const left = Math.round(a * scale);
  const right = Math.round(b * scale);
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    throw new RatioError("Those values are too precise to simplify as a ratio.");
  }
  const divisor = greatestCommonDivisor(left, right);
  return { left: left / divisor, right: right / divisor };
}

export function parseRatioParts(raw: string): number[] {
  const text = raw.trim();
  if (!text) throw new RatioError("Enter a ratio such as 16:9 or 3:2:1.");
  const parts = text.split(/[:,/]/).map((part) => Number(part.trim()));
  if (parts.length < 2) throw new RatioError("A ratio needs at least two values separated by colons.");
  for (const part of parts) {
    if (!Number.isFinite(part)) throw new RatioError("Every ratio value must be a number.");
    if (part <= 0) throw new RatioError("Every ratio value must be greater than zero.");
  }
  return parts;
}

export function splitByRatio(total: number, parts: number[]): number[] {
  assertFinite(total, "Total");
  if (parts.length === 0) throw new RatioError("Add at least one ratio value.");
  for (const part of parts) {
    if (!Number.isFinite(part) || part < 0) {
      throw new RatioError("Ratio values must be zero or greater.");
    }
  }
  const sum = parts.reduce((acc, part) => acc + part, 0);
  if (sum <= 0) throw new RatioError("The ratio values cannot all be zero.");
  return parts.map((part) => (total * part) / sum);
}

/* -------------------------------------------------------------------------- */
/* Matrices                                                                    */
/* -------------------------------------------------------------------------- */

export class MatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatrixError";
  }
}

function dimensions(matrix: number[][]): string {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  return `${rows}×${columns}`;
}

function assertRectangular(matrix: number[][]): void {
  if (matrix.length === 0) throw new MatrixError("A matrix needs at least one row.");
  const width = matrix[0]?.length ?? 0;
  if (width === 0) throw new MatrixError("A matrix needs at least one column.");
  for (const row of matrix) {
    if (row.length !== width) {
      throw new MatrixError("Every row must have the same number of values.");
    }
    for (const value of row) {
      if (!Number.isFinite(value)) throw new MatrixError("Matrix values must be finite numbers.");
    }
  }
}

function assertSquare(matrix: number[][]): void {
  assertRectangular(matrix);
  if (matrix.length !== (matrix[0]?.length ?? 0)) {
    throw new MatrixError(`This operation needs a square matrix; this one is ${dimensions(matrix)}.`);
  }
}

export function parseMatrix(raw: string): number[][] {
  const text = raw.trim();
  if (!text) throw new MatrixError("Enter matrix values, one row per line.");
  const rows = text
    .split(/\n|;/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  if (rows.length === 0) throw new MatrixError("Enter at least one row of numbers.");

  const matrix = rows.map((row, index) => {
    const tokens = row.split(/[\s,]+/).filter((token) => token.length > 0);
    if (tokens.length === 0) throw new MatrixError(`Row ${index + 1} is empty.`);
    return tokens.map((token) => {
      const value = Number(token);
      if (!Number.isFinite(value)) {
        throw new MatrixError(`"${token}" in row ${index + 1} is not a number.`);
      }
      return value;
    });
  });

  assertRectangular(matrix);
  return matrix;
}

export function addMatrices(a: number[][], b: number[][]): number[][] {
  assertRectangular(a);
  assertRectangular(b);
  if (a.length !== b.length || a[0].length !== b[0].length) {
    throw new MatrixError(`Cannot add a ${dimensions(a)} matrix to a ${dimensions(b)} matrix.`);
  }
  return a.map((row, r) => row.map((value, c) => value + b[r][c]));
}

export function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  assertRectangular(a);
  assertRectangular(b);
  if (a[0].length !== b.length) {
    throw new MatrixError(
      `Cannot multiply a ${dimensions(a)} matrix by a ${dimensions(b)} matrix: the first matrix needs as many columns as the second has rows.`,
    );
  }
  return a.map((row) =>
    b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)),
  );
}

export function transposeMatrix(matrix: number[][]): number[][] {
  assertRectangular(matrix);
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

export function determinant(matrix: number[][]): number {
  assertSquare(matrix);
  const size = matrix.length;
  if (size === 1) return matrix[0][0];
  const working = matrix.map((row) => [...row]);
  let result = 1;
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(working[row][pivot]) > Math.abs(working[best][pivot])) best = row;
    }
    if (Math.abs(working[best][pivot]) < 1e-12) return 0;
    if (best !== pivot) {
      [working[pivot], working[best]] = [working[best], working[pivot]];
      result *= -1;
    }
    const pivotValue = working[pivot][pivot];
    result *= pivotValue;
    for (let row = pivot + 1; row < size; row += 1) {
      const factor = working[row][pivot] / pivotValue;
      for (let column = pivot; column < size; column += 1) {
        working[row][column] -= factor * working[pivot][column];
      }
    }
  }
  return result;
}

export function inverseMatrix(matrix: number[][]): number[][] {
  assertSquare(matrix);
  const size = matrix.length;
  const working = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, column) => (column === index ? 1 : 0)),
  ]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(working[row][pivot]) > Math.abs(working[best][pivot])) best = row;
    }
    if (Math.abs(working[best][pivot]) < 1e-12) {
      throw new MatrixError("This matrix is singular, so it has no inverse.");
    }
    if (best !== pivot) [working[pivot], working[best]] = [working[best], working[pivot]];

    const pivotValue = working[pivot][pivot];
    for (let column = 0; column < size * 2; column += 1) {
      working[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = working[row][pivot];
      if (factor === 0) continue;
      for (let column = 0; column < size * 2; column += 1) {
        working[row][column] -= factor * working[pivot][column];
      }
    }
  }

  return working.map((row) => row.slice(size).map((value) => (Math.abs(value) < 1e-12 ? 0 : value)));
}

export function formatMatrix(matrix: number[][]): string {
  assertRectangular(matrix);
  const cells = matrix.map((row) =>
    row.map((value) => {
      const rounded = Number(value.toPrecision(10));
      return String(Object.is(rounded, -0) ? 0 : rounded);
    }),
  );
  const widths = cells[0].map((_, column) =>
    Math.max(...cells.map((row) => row[column].length)),
  );
  return cells.map((row) => row.map((value, index) => value.padStart(widths[index])).join("  ")).join("\n");
}

export function matrixDimensions(matrix: number[][]): { rows: number; columns: number } {
  return { rows: matrix.length, columns: matrix[0]?.length ?? 0 };
}

/* -------------------------------------------------------------------------- */
/* Random numbers                                                              */
/* -------------------------------------------------------------------------- */

export type RandomSource = () => number;

export class RandomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RandomError";
  }
}

export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function cryptoRandomSource(): RandomSource {
  return () => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 4_294_967_296;
  };
}

export function seedFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  let hash = 2_166_136_261;
  for (let index = 0; index < trimmed.length; index += 1) {
    hash ^= trimmed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function assertIntegerRange(min: number, max: number): void {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RandomError("Bounds must be whole numbers within the safe integer range.");
  }
  if (min > max) throw new RandomError("The minimum cannot be greater than the maximum.");
}

export function randomInteger(source: RandomSource, min: number, max: number): number {
  assertIntegerRange(min, max);
  const span = max - min + 1;
  if (!Number.isSafeInteger(span)) throw new RandomError("That range is too large.");
  return min + Math.floor(source() * span);
}

export function randomFloat(source: RandomSource, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RandomError("Bounds must be finite numbers.");
  }
  if (min >= max) throw new RandomError("The minimum must be less than the maximum.");
  return min + source() * (max - min);
}

export function randomUniqueIntegers(
  source: RandomSource,
  min: number,
  max: number,
  count: number,
): number[] {
  assertIntegerRange(min, max);
  if (!Number.isInteger(count) || count < 1) {
    throw new RandomError("Count must be a whole number of at least 1.");
  }
  const span = max - min + 1;
  if (count > span) {
    throw new RandomError(`Cannot pick ${count} unique values from a range of ${span}.`);
  }
  if (count > 10_000) throw new RandomError("Ask for at most 10,000 unique values at a time.");

  const seen = new Set<number>();
  while (seen.size < count) {
    seen.add(randomInteger(source, min, max));
  }
  return [...seen];
}

export function randomDecimalPlaces(source: RandomSource, min: number, max: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RandomError("Count must be a whole number of at least 1.");
  }
  if (count > 10_000) throw new RandomError("Ask for at most 10,000 values at a time.");
  return Array.from({ length: count }, () => randomFloat(source, min, max));
}
