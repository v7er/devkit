import { describe, expect, it } from "vitest";
import {
  BaseError,
  DurationError,
  MatrixError,
  RandomError,
  RatioError,
  TimestampError,
  addMatrices,
  breakDownDuration,
  calendarBreakdown,
  computeBitwise,
  countBusinessDays,
  cryptoRandomSource,
  detectTimestampUnit,
  determinant,
  differenceBetweenInstants,
  formatBinary,
  formatDurationClock,
  formatDurationHuman,
  formatDurationIso,
  formatInZone,
  formatIntegerInBase,
  formatMatrix,
  formatOffset,
  integerBitLength,
  inverseMatrix,
  isValidTimeZone,
  listTimeZones,
  mulberry32,
  multiplyMatrices,
  parseDuration,
  parseIntegerAuto,
  parseIntegerInBase,
  parseMatrix,
  parseRatioParts,
  parseTimestampInput,
  percentChange,
  percentOf,
  randomFloat,
  randomInteger,
  randomUniqueIntegers,
  seedFromText,
  simplifyRatio,
  splitByRatio,
  toSigned,
  toUnsigned,
  transposeMatrix,
  zoneOffsetMinutes,
} from "./logic";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("timestamp parsing", () => {
  it("detects units by digit count", () => {
    expect(detectTimestampUnit(10)).toBe("seconds");
    expect(detectTimestampUnit(11)).toBe("milliseconds");
    expect(detectTimestampUnit(13)).toBe("milliseconds");
    expect(detectTimestampUnit(16)).toBe("microseconds");
    expect(detectTimestampUnit(19)).toBe("nanoseconds");
    expect(detectTimestampUnit(20)).toBeNull();
  });

  it("reads seconds, milliseconds, microseconds, and nanoseconds", () => {
    expect(parseTimestampInput("1714550400")).toEqual({
      milliseconds: 1_714_550_400_000,
      kind: "seconds",
    });
    expect(parseTimestampInput("1714550400000")).toEqual({
      milliseconds: 1_714_550_400_000,
      kind: "milliseconds",
    });
    expect(parseTimestampInput("1714550400000000").milliseconds).toBe(1_714_550_400_000);
    expect(parseTimestampInput("1714550400000000000").milliseconds).toBe(1_714_550_400_000);
  });

  it("keeps leading zeros from changing the detected unit", () => {
    expect(parseTimestampInput("0001714550400")).toEqual({
      milliseconds: 1_714_550_400_000,
      kind: "seconds",
    });
  });

  it("parses ISO date strings", () => {
    const parsed = parseTimestampInput("2024-05-01T12:00:00Z");
    expect(parsed.kind).toBe("date");
    expect(parsed.milliseconds).toBe(Date.UTC(2024, 4, 1, 12));
  });

  it("supports negative timestamps", () => {
    expect(parseTimestampInput("-86400").milliseconds).toBe(-86_400_000);
  });

  it("rejects empty, unreadable, and out-of-range input", () => {
    expect(() => parseTimestampInput("  ")).toThrow(TimestampError);
    expect(() => parseTimestampInput("not a date")).toThrow(TimestampError);
    expect(() => parseTimestampInput("99999999999999999999")).toThrow(TimestampError);
  });
});

describe("time zones", () => {
  it("formats an instant in a zone with the correct offset", () => {
    const winter = formatInZone(Date.UTC(2024, 0, 15, 12, 0, 0), "America/New_York");
    expect(winter.date).toBe("2024-01-15");
    expect(winter.time).toBe("07:00:00");
    expect(winter.offset).toBe("-05:00");
    expect(winter.offsetMinutes).toBe(-300);

    const summer = formatInZone(Date.UTC(2024, 6, 15, 12, 0, 0), "America/New_York");
    expect(summer.time).toBe("08:00:00");
    expect(summer.offset).toBe("-04:00");
    expect(summer.offsetMinutes).toBe(-240);
  });

  it("is DST-aware across the spring transition", () => {
    const before = zoneOffsetMinutes(Date.UTC(2024, 2, 10, 6, 59), "America/New_York");
    const after = zoneOffsetMinutes(Date.UTC(2024, 2, 10, 7, 0), "America/New_York");
    expect(before).toBe(-300);
    expect(after).toBe(-240);
  });

  it("handles half-hour and UTC offsets", () => {
    expect(formatInZone(Date.UTC(2024, 0, 1, 0, 0, 0), "Asia/Kolkata").offset).toBe("+05:30");
    expect(formatInZone(Date.UTC(2024, 0, 1, 0, 0, 0), "UTC").time).toBe("00:00:00");
  });

  it("formats offsets and validates zones", () => {
    expect(formatOffset(330)).toBe("+05:30");
    expect(formatOffset(-300)).toBe("-05:00");
    expect(formatOffset(0)).toBe("+00:00");
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(listTimeZones()).toContain("UTC");
  });
});

describe("date differences", () => {
  it("splits total elapsed time into units", () => {
    const diff = differenceBetweenInstants(Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 3, 12));
    expect(diff.days).toBe(2.5);
    expect(diff.hours).toBe(60);
    expect(diff.minutes).toBe(3600);
    expect(diff.seconds).toBe(216_000);
    expect(diff.negative).toBe(false);
    expect(differenceBetweenInstants(Date.UTC(2024, 0, 3), Date.UTC(2024, 0, 1)).negative).toBe(true);
  });

  it("builds a calendar breakdown", () => {
    const result = calendarBreakdown(
      Date.UTC(2020, 0, 15, 10, 30, 0),
      Date.UTC(2022, 3, 20, 12, 45, 30),
    );
    expect(result).toMatchObject({
      years: 2,
      months: 3,
      days: 5,
      hours: 2,
      minutes: 15,
      seconds: 30,
      negative: false,
    });
  });

  it("clamps month ends instead of inventing days", () => {
    const result = calendarBreakdown(Date.UTC(2024, 0, 31, 10), Date.UTC(2024, 2, 1, 9, 30));
    expect(result).toMatchObject({ years: 0, months: 1, days: 0, hours: 23, minutes: 30 });
  });

  it("handles leap-day anniversaries", () => {
    const result = calendarBreakdown(Date.UTC(2020, 1, 29), Date.UTC(2021, 1, 28));
    expect(result).toMatchObject({ years: 1, months: 0, days: 0 });
  });

  it("marks reversed ranges", () => {
    expect(calendarBreakdown(Date.UTC(2024, 0, 2), Date.UTC(2024, 0, 1)).negative).toBe(true);
  });

  it("counts business days, excluding weekends and the end day by default", () => {
    const monday = Date.UTC(2024, 0, 1);
    const nextMonday = monday + 7 * DAY;
    expect(countBusinessDays(monday, nextMonday)).toBe(5);
    expect(countBusinessDays(monday, nextMonday, true)).toBe(6);
    expect(countBusinessDays(Date.UTC(2024, 0, 6), Date.UTC(2024, 0, 7))).toBe(0);
    expect(countBusinessDays(nextMonday, monday)).toBe(-5);
  });
});

describe("duration parsing", () => {
  it("parses unit tokens", () => {
    expect(parseDuration("2h 30m")).toBe(2 * HOUR + 30 * 60_000);
    expect(parseDuration("1.5 days")).toBe(1.5 * DAY);
    expect(parseDuration("2 hours and 15 minutes")).toBe(2 * HOUR + 15 * 60_000);
    expect(parseDuration("250ms")).toBe(250);
    expect(parseDuration("1w 2d")).toBe(9 * DAY);
  });

  it("parses bare seconds and clock notation", () => {
    expect(parseDuration("90")).toBe(90_000);
    expect(parseDuration("1:30")).toBe(90_000);
    expect(parseDuration("01:30:00")).toBe(1.5 * HOUR);
    expect(parseDuration("1:30:00.500")).toBe(1.5 * HOUR + 500);
  });

  it("parses ISO 8601 durations", () => {
    expect(parseDuration("PT1H30M")).toBe(1.5 * HOUR);
    expect(parseDuration("P1DT2H")).toBe(DAY + 2 * HOUR);
    expect(parseDuration("PT0.5S")).toBe(500);
    expect(parseDuration("P2W")).toBe(14 * DAY);
    expect(parseDuration("-PT30S")).toBe(-30_000);
  });

  it("rejects malformed input", () => {
    expect(() => parseDuration("")).toThrow(DurationError);
    expect(() => parseDuration("soon")).toThrow(DurationError);
    expect(() => parseDuration("2 lightyears")).toThrow(DurationError);
    expect(() => parseDuration("P")).toThrow(DurationError);
    expect(() => parseDuration("1:75")).toThrow(DurationError);
  });

  it("breaks durations into parts and formats them", () => {
    const breakdown = breakDownDuration(DAY + HOUR + 60_000 + 1_000 + 1);
    expect(breakdown).toMatchObject({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      milliseconds: 1,
    });
    expect(breakdown.totalHours).toBeCloseTo(25.0169, 3);
    expect(formatDurationHuman(DAY + HOUR + 60_000)).toBe("1d 1h 1m");
    expect(formatDurationClock(1.5 * HOUR + 500)).toBe("01:30:00.500");
    expect(formatDurationIso(DAY + HOUR + 60_000 + 1_500)).toBe("P1DT1H1M1.5S");
    expect(formatDurationIso(0)).toBe("PT0S");
    expect(formatDurationHuman(-90_000)).toBe("-1m 30s");
    expect(parseDuration(formatDurationIso(DAY + 12_345))).toBeCloseTo(DAY + 12_345, 3);
  });
});

describe("number bases", () => {
  it("parses integers in any base", () => {
    expect(parseIntegerInBase("1111", 2)).toBe(15n);
    expect(parseIntegerInBase("ff", 16)).toBe(255n);
    expect(parseIntegerInBase("0xFF", 16)).toBe(255n);
    expect(parseIntegerInBase("-0b1010", 2)).toBe(-10n);
    expect(parseIntegerInBase("1_000", 10)).toBe(1000n);
    expect(parseIntegerInBase("z", 36)).toBe(35n);
  });

  it("detects prefixes automatically", () => {
    expect(parseIntegerAuto("0x10")).toEqual({ value: 16n, base: 16 });
    expect(parseIntegerAuto("0o17")).toEqual({ value: 15n, base: 8 });
    expect(parseIntegerAuto("-0b11")).toEqual({ value: -3n, base: 2 });
    expect(parseIntegerAuto("42")).toEqual({ value: 42n, base: 10 });
  });

  it("rejects bad digits, prefixes, and bases", () => {
    expect(() => parseIntegerInBase("2", 2)).toThrow(BaseError);
    expect(() => parseIntegerInBase("0x10", 10)).toThrow(BaseError);
    expect(() => parseIntegerInBase("", 10)).toThrow(BaseError);
    expect(() => parseIntegerInBase("-", 10)).toThrow(BaseError);
    expect(() => parseIntegerInBase("-1", 10, { allowNegative: false })).toThrow(BaseError);
    expect(() => parseIntegerInBase("1", 37)).toThrow(BaseError);
    expect(() => parseIntegerInBase("1", 1)).toThrow(BaseError);
  });

  it("formats values with case, grouping, and prefixes", () => {
    expect(formatIntegerInBase(255n, 16, { uppercase: true, prefix: true })).toBe("0xFF");
    expect(formatIntegerInBase(255n, 2, { groupSize: 4 })).toBe("1111 1111");
    expect(formatIntegerInBase(255n, 2, { prefix: true })).toBe("0b11111111");
    expect(formatIntegerInBase(-255n, 16, { uppercase: true })).toBe("-FF");
    expect(formatIntegerInBase(0n, 10)).toBe("0");
    expect(integerBitLength(0n)).toBe(1);
    expect(integerBitLength(255n)).toBe(8);
    expect(integerBitLength(-256n)).toBe(9);
  });
});

describe("bitwise operations", () => {
  it("masks to the selected width", () => {
    expect(toUnsigned(-1n, 8)).toBe(255n);
    expect(toSigned(255n, 8)).toBe(-1n);
    expect(toSigned(127n, 8)).toBe(127n);
    expect(toUnsigned(0x1ffn, 8)).toBe(0xffn);
  });

  it("computes logical operations", () => {
    expect(computeBitwise("and", 12n, 10n, 8)).toMatchObject({
      unsigned: 8n,
      signed: 8n,
      binary: "0000 1000",
    });
    expect(computeBitwise("or", 12n, 10n, 8).unsigned).toBe(14n);
    expect(computeBitwise("xor", 12n, 10n, 8).unsigned).toBe(6n);
    expect(computeBitwise("not", 0n, 0n, 8)).toMatchObject({ unsigned: 255n, signed: -1n });
    expect(computeBitwise("not", 0n, 0n, 8).popcount).toBe(8);
  });

  it("handles shifts and 64-bit values", () => {
    expect(computeBitwise("shl", 1n, 4n, 8).unsigned).toBe(16n);
    expect(computeBitwise("shr", 16n, 4n, 8).unsigned).toBe(1n);
    expect(computeBitwise("shl", 0x80n, 1n, 8).unsigned).toBe(0n);
    expect(computeBitwise("not", 0n, 0n, 64).unsigned).toBe(18_446_744_073_709_551_615n);
  });

  it("rejects out-of-range shifts", () => {
    expect(() => computeBitwise("shl", 1n, 8n, 8)).toThrow(RangeError);
    expect(() => computeBitwise("shr", 1n, 16n, 16)).toThrow(RangeError);
  });

  it("formats binary with padding and grouping", () => {
    expect(formatBinary(5n, 8)).toBe("0000 0101");
    expect(formatBinary(5n, 8, 0)).toBe("00000101");
    expect(formatBinary(0n, 16, 8)).toBe("00000000 00000000");
  });
});

describe("percentages and ratios", () => {
  it("computes percentages", () => {
    expect(percentOf(25, 200)).toBe(50);
    expect(percentOf(-10, 50)).toBe(-5);
    expect(percentChange(50, 75)).toBe(50);
    expect(percentChange(80, 60)).toBe(-25);
    expect(() => percentChange(0, 5)).toThrow(RatioError);
  });

  it("simplifies ratios including decimals", () => {
    expect(simplifyRatio(1920, 1080)).toEqual({ left: 16, right: 9 });
    expect(simplifyRatio(0.5, 0.25)).toEqual({ left: 2, right: 1 });
    expect(simplifyRatio(7, 3)).toEqual({ left: 7, right: 3 });
    expect(() => simplifyRatio(0, 3)).toThrow(RatioError);
    expect(() => simplifyRatio(Number.POSITIVE_INFINITY, 3)).toThrow(RatioError);
  });

  it("parses ratios and splits totals", () => {
    expect(parseRatioParts("16:9")).toEqual([16, 9]);
    expect(parseRatioParts("3:2:1")).toEqual([3, 2, 1]);
    expect(parseRatioParts(" 4 / 3 ")).toEqual([4, 3]);
    expect(() => parseRatioParts("")).toThrow(RatioError);
    expect(() => parseRatioParts("4")).toThrow(RatioError);
    expect(() => parseRatioParts("4:x")).toThrow(RatioError);
    expect(() => parseRatioParts("4:0")).toThrow(RatioError);
    expect(splitByRatio(100, [3, 2])).toEqual([60, 40]);
    expect(() => splitByRatio(100, [0, 0])).toThrow(RatioError);
  });
});

describe("matrix operations", () => {
  it("parses rows separated by newlines, commas, or semicolons", () => {
    expect(parseMatrix("1 2\n3 4")).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(parseMatrix("1, 2; 3, 4")).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("rejects ragged and non-numeric input", () => {
    expect(() => parseMatrix("")).toThrow(MatrixError);
    expect(() => parseMatrix("1 2\n3")).toThrow(MatrixError);
    expect(() => parseMatrix("1 two")).toThrow(MatrixError);
  });

  it("adds, multiplies, and transposes", () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = [
      [5, 6],
      [7, 8],
    ];
    expect(addMatrices(a, b)).toEqual([
      [6, 8],
      [10, 12],
    ]);
    expect(multiplyMatrices(a, b)).toEqual([
      [19, 22],
      [43, 50],
    ]);
    expect(transposeMatrix(a)).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(() => addMatrices(a, [[1]])).toThrow(MatrixError);
    expect(() => multiplyMatrices([[1, 2, 3]], [[1, 2]])).toThrow(MatrixError);
  });

  it("computes determinants", () => {
    expect(determinant([[1, 2], [3, 4]])).toBeCloseTo(-2);
    expect(determinant([[1, 0, 0], [0, 2, 0], [0, 0, 3]])).toBeCloseTo(6);
    expect(determinant([[1, 2], [2, 4]])).toBe(0);
    expect(() => determinant([[1, 2, 3]])).toThrow(MatrixError);
  });

  it("inverts square matrices and rejects singular ones", () => {
    const inverse = inverseMatrix([
      [4, 7],
      [2, 6],
    ]);
    expect(inverse[0][0]).toBeCloseTo(0.6);
    expect(inverse[0][1]).toBeCloseTo(-0.7);
    expect(inverse[1][0]).toBeCloseTo(-0.2);
    expect(inverse[1][1]).toBeCloseTo(0.4);
    expect(() => inverseMatrix([[1, 2], [2, 4]])).toThrow(MatrixError);
  });

  it("formats matrices in aligned columns", () => {
    expect(formatMatrix([[1, 20], [300, 4]])).toBe("  1  20\n300   4");
  });
});

describe("random numbers", () => {
  it("produces reproducible mulberry32 sequences", () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    const sequence = [first(), first(), first()];
    expect(sequence).toEqual([second(), second(), second()]);
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(mulberry32(7)()).not.toBe(mulberry32(8)());
  });

  it("honours integer bounds", () => {
    expect(randomInteger(() => 0, 5, 10)).toBe(5);
    expect(randomInteger(() => 0.999999, 5, 10)).toBe(10);
    expect(() => randomInteger(() => 0.5, 10, 5)).toThrow(RandomError);
    expect(() => randomInteger(() => 0.5, 1.5, 5)).toThrow(RandomError);
  });

  it("produces floats and unique integers", () => {
    expect(randomFloat(() => 0.5, 10, 20)).toBe(15);
    expect(() => randomFloat(() => 0.5, 20, 20)).toThrow(RandomError);
    const unique = randomUniqueIntegers(mulberry32(1), 1, 50, 20);
    expect(unique).toHaveLength(20);
    expect(new Set(unique).size).toBe(20);
    expect(unique.every((value) => value >= 1 && value <= 50)).toBe(true);
    expect(() => randomUniqueIntegers(mulberry32(1), 1, 5, 6)).toThrow(RandomError);
    expect(() => randomUniqueIntegers(mulberry32(1), 1, 100, 0)).toThrow(RandomError);
  });

  it("derives stable seeds from text", () => {
    expect(seedFromText("devkit")).toBe(seedFromText("devkit"));
    expect(seedFromText("devkit")).not.toBe(seedFromText("devkit2"));
    expect(seedFromText("42")).toBe(42);
    expect(seedFromText("")).toBe(0);
  });

  it("reads random values from the crypto source", () => {
    const source = cryptoRandomSource();
    const value = source();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
