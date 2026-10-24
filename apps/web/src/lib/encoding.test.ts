import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  binaryToBytes,
  bytesToBase64,
  bytesToBinary,
  decodeBase32,
  decodeBase58,
  decodeBase64,
  decodeBinary,
  decodeHex,
  encodeBase32,
  encodeBase58,
  encodeBase64,
  encodeBinary,
  encodeHex,
  escapeHtml,
  hexToBytes,
  unescapeHtml,
} from "./encoding";

describe("base64", () => {
  it("round-trips UTF-8 text", () => {
    const source = "Hello, devkit! 👋 日本語";
    const encoded = encodeBase64(source);
    expect(encoded).toBe(bytesToBase64(new TextEncoder().encode(source)));
    expect(decodeBase64(encoded)).toBe(source);
  });

  it("supports the URL-safe alphabet and missing padding", () => {
    const encoded = encodeBase64("subjects?_d=1", true);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBase64(encoded)).toBe("subjects?_d=1");
  });

  it("rejects invalid input", () => {
    expect(() => base64ToBytes("abc$")).toThrow(/not valid Base64/);
    expect(() => base64ToBytes("a")).toThrow(/length/);
  });
});

describe("hex and binary", () => {
  it("converts both directions", () => {
    expect(encodeHex("ABC")).toBe("414243");
    expect(decodeHex("0x41 42 43")).toBe("ABC");
    expect(encodeBinary("A")).toBe("01000001");
    expect(decodeBinary("01000001")).toBe("A");
  });

  it("validates input", () => {
    expect(() => hexToBytes("abc")).toThrow(/even number/);
    expect(() => hexToBytes("zz")).toThrow(/hexadecimal/);
    expect(() => binaryToBytes("0101")).toThrow(/multiple of 8/);
  });

  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(bytesToBinary(bytes)).toBe("00000000 00000001 01111111 10000000 11111111");
    expect(Array.from(binaryToBytes(bytesToBinary(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("base32 and base58", () => {
  it("round-trips values including leading zero bytes", () => {
    const bytes = new TextEncoder().encode("devkit tools 123");
    expect(new TextDecoder().decode(decodeBase32(encodeBase32(bytes)))).toBe("devkit tools 123");

    const withZeros = new Uint8Array([0, 0, 1, 2, 3, 255]);
    expect(Array.from(decodeBase58(encodeBase58(withZeros)))).toEqual(Array.from(withZeros));
  });

  it("rejects unknown alphabets", () => {
    expect(() => decodeBase32("INVALID!")).toThrow(/Invalid Base32/);
    expect(() => decodeBase58("0OIl")).toThrow(/Invalid Base58/);
  });
});

describe("html entities", () => {
  it("escapes and restores markup", () => {
    const source = '<a href="/">Tom & Jerry</a>';
    const escaped = escapeHtml(source);
    expect(escaped).toBe("&lt;a href=&quot;/&quot;&gt;Tom &amp; Jerry&lt;/a&gt;");
    expect(unescapeHtml(escaped)).toBe(source);
  });

  it("decodes named and numeric entities", () => {
    expect(unescapeHtml("&copy; &#169; &#xA9; &unknown;")).toBe("© © © &unknown;");
  });
});
