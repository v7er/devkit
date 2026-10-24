import { describe, expect, it } from "vitest";
import {
  ASCII_ROWS,
  MAX_CLIPBOARD_ENTRIES,
  appendHistory,
  bumpVersion,
  buildWifiPayload,
  checkRange,
  compareVersions,
  convertBytes,
  describeKeyLocation,
  describePayload,
  detectBrowser,
  detectPlatform,
  escapeWifiValue,
  filterAsciiRows,
  formatBestSize,
  formatModifiers,
  formatQuantity,
  inspectVersion,
  parseHistory,
  parseSize,
  parseSizeBatch,
  recommendLicense,
} from "./logic";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("semver helpers", () => {
  it("parses a valid version and its components", () => {
    expect(inspectVersion("1.2.3")).toEqual({
      error: "",
      details: {
        raw: "1.2.3",
        normalized: "1.2.3",
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "",
        build: "",
      },
    });
  });

  it("keeps prerelease identifiers and normalizes a leading v", () => {
    const report = inspectVersion("v2.0.0-rc.1+build.5");
    expect(report.error).toBe("");
    expect(report.details?.normalized).toBe("2.0.0-rc.1");
    expect(report.details?.prerelease).toBe("rc.1");
    expect(report.details?.build).toBe("build.5");
  });

  it("rejects incomplete and empty versions", () => {
    expect(inspectVersion("1.2").details).toBeNull();
    expect(inspectVersion("1.2").error).toContain("not a semantic version");
    expect(inspectVersion("  ").details).toBeNull();
  });

  it("compares versions by precedence, not by text", () => {
    expect(compareVersions("1.2.3", "1.10.0")).toMatchObject({
      relation: "lower",
      difference: "minor",
      error: "",
    });
    expect(compareVersions("1.2.3", "1.2.3")).toMatchObject({
      relation: "equal",
      difference: null,
    });
    expect(compareVersions("2.0.0", "1.9.9").relation).toBe("higher");
    expect(compareVersions("nope", "1.0.0").error).toContain("not a semantic version");
  });

  it("checks ranges and reports invalid ranges", () => {
    expect(checkRange("1.5.0", "^1.2.0")).toEqual({ satisfied: true, error: "" });
    expect(checkRange("2.0.0", ">=1.0.0 <2.0.0").satisfied).toBe(false);
    expect(checkRange("1.5.0", "not a range").error).toContain("not a valid range");
    expect(checkRange("1.5.0", "").error).toContain("Enter a range");
  });

  it("increments major, minor, and patch", () => {
    expect(bumpVersion("1.2.3", "major").next).toBe("2.0.0");
    expect(bumpVersion("1.2.3", "minor").next).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "patch").next).toBe("1.2.4");
    expect(bumpVersion("1.2", "patch").next).toBeNull();
    expect(bumpVersion("1.2", "patch").error).toContain("not a semantic version");
  });
});

describe("storage sizes", () => {
  it("parses SI, IEC, and bit units", () => {
    expect(parseSize("1.5 GB")).toBe(1_500_000_000);
    expect(parseSize("1 GiB")).toBe(1_073_741_824);
    expect(parseSize("8 bit")).toBe(1);
    expect(parseSize("2,048 KiB")).toBe(2_097_152);
    expect(parseSize("1.5e3 MB")).toBe(1_500_000_000);
    expect(parseSize("1.5")).toBe(1.5);
  });

  it("rejects malformed, negative, and unknown-unit sizes", () => {
    expect(() => parseSize("")).toThrow(/Enter a size/);
    expect(() => parseSize("-5 MB")).toThrow(/zero or greater/);
    expect(() => parseSize("5 XB")).toThrow(/Unknown unit/);
    expect(() => parseSize("about two gigs")).toThrow(/not a size/);
  });

  it("converts bytes across every unit family", () => {
    const rows = convertBytes(1500);
    expect(rows.find((row) => row.system === "SI bytes" && row.unit === "kB")?.value).toBe("1.5");
    expect(rows.find((row) => row.system === "IEC bytes" && row.unit === "KiB")?.value).toBe(
      "1.464844",
    );
    expect(rows.find((row) => row.system === "SI bits" && row.unit === "kbit")?.value).toBe("12");
    expect(rows.find((row) => row.system === "IEC bits" && row.unit === "bit")?.value).toBe(
      "12,000",
    );
  });

  it("formats the best-fitting unit and high precision values", () => {
    expect(formatBestSize(1500, "si")).toBe("1.5 kB");
    expect(formatBestSize(1500, "iec")).toBe("1.46 KiB");
    expect(formatBestSize(0, "si")).toBe("0 B");
    expect(formatQuantity(1 / 1024, 10)).toBe("0.0009765625");
  });

  it("parses a batch and keeps per-line errors", () => {
    const rows = parseSizeBatch("512 MB\n\noops\n1 GiB");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.si).toBe("512 MB");
    expect(rows[1]?.error).toContain("not a size");
    expect(rows[2]?.bytes).toBe(1_073_741_824);
  });
});

describe("ASCII table", () => {
  it("covers all 128 ASCII codes", () => {
    expect(ASCII_ROWS).toHaveLength(128);
    expect(ASCII_ROWS[0]).toMatchObject({ char: "^@", name: "Null", kind: "control" });
    expect(ASCII_ROWS[9]).toMatchObject({ name: "Horizontal Tab", hex: "09", binary: "00001001" });
    expect(ASCII_ROWS[65]).toMatchObject({ char: "A", name: "Latin capital letter A" });
    expect(ASCII_ROWS[127]).toMatchObject({ char: "^?", name: "Delete", kind: "control" });
  });

  it("searches by decimal, hex, name, and symbol", () => {
    expect(filterAsciiRows("65").map((row) => row.code)).toEqual([65]);
    expect(filterAsciiRows("0x41").map((row) => row.code)).toEqual([65]);
    expect(filterAsciiRows("tab").map((row) => row.code)).toContain(9);
    expect(filterAsciiRows("@").map((row) => row.code)).toContain(64);
    expect(filterAsciiRows("zzzz")).toEqual([]);
  });
});

describe("license recommendations", () => {
  it("recommends Apache-2.0 when attribution and patents matter with permissive use", () => {
    const result = recommendLicense({
      attribution: "require",
      patent: "important",
      copyleft: "allow-proprietary",
      simplicity: "simple",
    });
    expect(result.recommended).toBe("Apache-2.0");
    expect(result.ranked).toHaveLength(5);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("recommends GPL-3.0 when derivatives must stay open", () => {
    const result = recommendLicense({
      attribution: "require",
      patent: "not-important",
      copyleft: "must-share",
      simplicity: "thorough",
    });
    expect(result.recommended).toBe("GPL-3.0");
  });

  it("recommends MPL-2.0 for file-level sharing obligations", () => {
    const result = recommendLicense({
      attribution: "require",
      patent: "important",
      copyleft: "share-alike",
      simplicity: "thorough",
    });
    expect(result.recommended).toBe("MPL-2.0");
  });

  it("recommends the Unlicense when attribution is optional", () => {
    const result = recommendLicense({
      attribution: "optional",
      patent: "not-important",
      copyleft: "allow-proprietary",
      simplicity: "simple",
    });
    expect(result.recommended).toBe("Unlicense");
  });

  it("recommends MIT for a simple permissive default", () => {
    const result = recommendLicense({
      attribution: "require",
      patent: "not-important",
      copyleft: "allow-proprietary",
      simplicity: "simple",
    });
    expect(result.recommended).toBe("MIT");
  });
});

describe("QR payloads", () => {
  it("builds a Wi-Fi payload and escapes reserved characters", () => {
    expect(
      buildWifiPayload({
        ssid: "Cafe;Guest",
        password: "pa:ss",
        security: "WPA",
      }),
    ).toBe("WIFI:T:WPA;S:Cafe\\;Guest;P:pa\\:ss;;");
  });

  it("omits the password for open networks and marks hidden networks", () => {
    expect(
      buildWifiPayload({ ssid: "Open", password: "", security: "nopass", hidden: true }),
    ).toBe("WIFI:T:nopass;S:Open;H:true;;");
  });

  it("rejects a missing SSID or password", () => {
    expect(() => buildWifiPayload({ ssid: "", password: "x", security: "WPA" })).toThrow(/SSID/);
    expect(() => buildWifiPayload({ ssid: "Net", password: "", security: "WPA" })).toThrow(
      /password/,
    );
  });

  it("escapes backslashes and newlines", () => {
    expect(escapeWifiValue("a\\b\nc")).toBe("a\\\\b\\nc");
  });

  it("classifies payloads", () => {
    expect(describePayload("https://example.com")).toBe("URL");
    expect(describePayload("WIFI:T:WPA;S:Net;;")).toBe("Wi-Fi");
    expect(describePayload("BEGIN:VCARD")).toBe("vCard");
    expect(describePayload("mailto:a@b.c")).toBe("Email");
    expect(describePayload("plain text")).toBe("Text");
  });
});

describe("environment helpers", () => {
  it("detects browsers and engines from a user agent", () => {
    expect(detectBrowser(CHROME_UA)).toEqual({
      name: "Chrome",
      version: "126.0.0.0",
      engine: "Blink",
    });
    expect(
      detectBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      ),
    ).toEqual({ name: "Safari", version: "17.4", engine: "WebKit" });
    expect(detectBrowser("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0")).toEqual(
      { name: "Firefox", version: "127.0", engine: "Gecko" },
    );
    expect(detectBrowser("Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0").name).toBe(
      "Edge",
    );
    expect(detectBrowser("curl/8.0")).toEqual({ name: "Unknown", version: "—", engine: "Unknown" });
  });

  it("detects the platform from a user agent", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iOS");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
    expect(detectPlatform(CHROME_UA)).toBe("macOS");
    expect(detectPlatform("Mozilla/5.0 (X11; CrOS x86_64)")).toBe("ChromeOS");
    expect(detectPlatform("SomethingElse")).toBe("Unknown");
  });

  it("formats modifiers and key locations", () => {
    expect(
      formatModifiers({ ctrlKey: true, shiftKey: true, altKey: false, metaKey: false }),
    ).toBe("Ctrl + Shift");
    expect(formatModifiers({ ctrlKey: false, shiftKey: false, altKey: false, metaKey: false })).toBe(
      "None",
    );
    expect(describeKeyLocation(3)).toBe("Numpad");
    expect(describeKeyLocation(0)).toBe("Standard");
  });
});

describe("clipboard history", () => {
  it("reads valid stored entries and drops malformed ones", () => {
    const raw = JSON.stringify([
      { id: "a", text: "hello", addedAt: 1 },
      { id: "b", text: 42, addedAt: 2 },
      { id: "c", text: "world" },
    ]);
    expect(parseHistory(raw)).toEqual([{ id: "a", text: "hello", addedAt: 1 }]);
    expect(parseHistory("{not json")).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });

  it("deduplicates and caps history entries", () => {
    const entry = { id: "1", text: "first", addedAt: 1 };
    const entries = appendHistory([entry], { id: "2", text: "first", addedAt: 2 });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("2");

    const many = Array.from({ length: MAX_CLIPBOARD_ENTRIES }, (_, index) => ({
      id: String(index),
      text: `entry ${index}`,
      addedAt: index,
    }));
    const capped = appendHistory(many, { id: "new", text: "newest", addedAt: 99 });
    expect(capped).toHaveLength(MAX_CLIPBOARD_ENTRIES);
    expect(capped[0]?.text).toBe("newest");
  });
});
