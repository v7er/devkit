import { describe, expect, it } from "vitest";
import { base64ToBytes, textToBytes } from "@/lib/encoding";
import {
  compressToBase64,
  compressionSupported,
  convertBase,
  decodeBinaryText,
  decodeHexText,
  decodeHtmlEntities,
  decodeUrl,
  decompressFromBase64,
  domainToAscii,
  domainToUnicode,
  encodeBinaryText,
  encodeHexText,
  encodeHtmlEntities,
  encodeUrl,
  morseTimeline,
  morseToText,
  morseUnitMs,
  parseBinaryBytes,
  parseHexBytes,
  punycodeDecode,
  punycodeEncode,
  textToMorse,
} from "./logic";

describe("URL encoding", () => {
  it("percent-encodes components and decodes them", () => {
    expect(encodeUrl("a b&c=1/日本", { scope: "component", plusSpaces: false })).toBe(
      "a%20b%26c%3D1%2F%E6%97%A5%E6%9C%AC",
    );
    expect(decodeUrl("a%20b%26c%3D1%2F%E6%97%A5%E6%9C%AC", { scope: "component", plusSpaces: false })).toBe(
      "a b&c=1/日本",
    );
  });

  it("keeps URL structure in whole-URL mode", () => {
    const source = "https://example.com/a b?q=x&y=日本";
    const encoded = encodeUrl(source, { scope: "url", plusSpaces: false });
    expect(encoded).toBe("https://example.com/a%20b?q=x&y=%E6%97%A5%E6%9C%AC");
    expect(decodeUrl(encoded, { scope: "url", plusSpaces: false })).toBe(source);
  });

  it("converts spaces to plus signs and back when requested", () => {
    expect(encodeUrl("hello world", { scope: "component", plusSpaces: true })).toBe("hello+world");
    expect(decodeUrl("hello+world", { scope: "component", plusSpaces: true })).toBe("hello world");
    expect(decodeUrl("hello+world", { scope: "component", plusSpaces: false })).toBe("hello+world");
  });

  it("reports malformed escapes", () => {
    expect(() => decodeUrl("100%", { scope: "component", plusSpaces: false })).toThrow(
      /malformed percent-encoding/,
    );
    expect(() => decodeUrl("%E6%97", { scope: "url", plusSpaces: false })).toThrow(
      /malformed percent-encoding/,
    );
  });
});

describe("HTML entities", () => {
  it("encodes special characters with named or numeric references", () => {
    const source = `Tom & "Jerry" <b>it's</b>`;
    expect(encodeHtmlEntities(source, { style: "named", encodeAll: false })).toBe(
      "Tom &amp; &quot;Jerry&quot; &lt;b&gt;it&apos;s&lt;/b&gt;",
    );
    expect(encodeHtmlEntities(source, { style: "numeric", encodeAll: false })).toBe(
      "Tom &#38; &#34;Jerry&#34; &#60;b&#62;it&#39;s&#60;/b&#62;",
    );
  });

  it("encodes non-ASCII characters only when encode-all is on", () => {
    expect(encodeHtmlEntities("© café", { style: "named", encodeAll: false })).toBe("© café");
    expect(encodeHtmlEntities("© café", { style: "named", encodeAll: true })).toBe(
      "&copy; caf&#233;",
    );
    expect(encodeHtmlEntities("© café", { style: "numeric", encodeAll: true })).toBe(
      "&#169; caf&#233;",
    );
  });

  it("decodes named, decimal, and hexadecimal references", () => {
    expect(decodeHtmlEntities("&copy; caf&#233; &#x1F600; &amp;lt;")).toBe("© café 😀 &lt;");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeHtmlEntities("&unknown; &#xZZ;")).toBe("&unknown; &#xZZ;");
  });

  it("rejects invalid code points", () => {
    expect(() => decodeHtmlEntities("&#0;")).toThrow(/not a valid Unicode code point/);
    expect(() => decodeHtmlEntities("&#xD800;")).toThrow(/not a valid Unicode code point/);
    expect(() => decodeHtmlEntities("&#1114112;")).toThrow(/not a valid Unicode code point/);
  });
});

describe("hex and binary text", () => {
  it("encodes text with separators and uppercase", () => {
    expect(encodeHexText("Hz", { separator: "space", upperCase: true })).toEqual({
      value: "48 7A",
      byteCount: 2,
    });
    expect(encodeHexText("日", { separator: "colon" }).value).toBe("e6:97:a5");
    expect(encodeHexText("Hi", { separator: "newline" }).value).toBe("48\n69");
  });

  it("parses common hex separators and prefixes", () => {
    expect(decodeHexText("0x48, 0x69")).toEqual({ value: "Hi", byteCount: 2 });
    expect(decodeHexText("E6 97 A5")).toEqual({ value: "日", byteCount: 3 });
    expect(parseHexBytes("48-69").length).toBe(2);
  });

  it("rejects invalid hex", () => {
    expect(() => parseHexBytes("4g")).toThrow(/not hexadecimal/);
    expect(() => parseHexBytes("abc")).toThrow(/even number of digits/);
    expect(() => decodeHexText("ff")).toThrow(/not valid UTF-8/);
  });

  it("encodes and decodes binary in 8-bit groups", () => {
    expect(encodeBinaryText("A", "space")).toEqual({ value: "01000001", byteCount: 1 });
    expect(encodeBinaryText("Hi", "none").value).toBe("0100100001101001");
    expect(decodeBinaryText("0b01001000 0b01101001")).toEqual({ value: "Hi", byteCount: 2 });
    expect(decodeBinaryText("01001000,01101001").value).toBe("Hi");
  });

  it("rejects invalid binary", () => {
    expect(() => parseBinaryBytes("01000002")).toThrow(/not 0 or 1/);
    expect(() => parseBinaryBytes("0100000")).toThrow(/multiple of 8 bits/);
    expect(() => decodeBinaryText("11111111")).toThrow(/not valid UTF-8/);
  });
});

describe("Morse code", () => {
  it("encodes letters, digits, and punctuation", () => {
    expect(textToMorse("SOS help")).toBe("... --- ... / .... . .-.. .--.");
    expect(textToMorse("Help!")).toBe(".... . .-.. .--. -.-.--");
    expect(textToMorse("123")).toBe(".---- ..--- ...--");
  });

  it("decodes Morse back to uppercase text", () => {
    expect(morseToText(".... . .-.. .-.. --- / .-- --- .-. .-.. -..")).toBe("HELLO WORLD");
    expect(morseToText(textToMorse("a/b"))).toBe("A/B");
  });

  it("reports unsupported characters and sequences", () => {
    expect(() => textToMorse("héllo")).toThrow(/No Morse code for: É/);
    expect(() => morseToText(".-.-")).toThrow(/Unrecognized Morse sequence/);
    expect(() => morseToText(".- / / -...")).toThrow(/empty word separator/);
  });

  it("builds a timing timeline at the requested speed", () => {
    expect(morseUnitMs(20)).toBe(60);
    expect(morseUnitMs(1)).toBe(240);
    expect(morseUnitMs(200)).toBe(20);

    expect(morseTimeline(".-", 20)).toEqual([
      { startMs: 0, durationMs: 60, tone: true },
      { startMs: 60, durationMs: 60, tone: false },
      { startMs: 120, durationMs: 180, tone: true },
    ]);

    const words = morseTimeline(".- / -...", 20);
    expect(words).toHaveLength(11);
    const last = words[words.length - 1];
    expect(last.startMs + last.durationMs).toBe(1260);
    expect(() => morseTimeline(".-.-", 20)).toThrow(/Unrecognized Morse sequence/);
  });
});

describe("gzip and deflate", () => {
  const supported = compressionSupported();
  const source = "Hello, devkit! 日本語 — repeat ".repeat(20);

  it.skipIf(!supported)("round-trips text through gzip", async () => {
    const compressed = await compressToBase64(source, "gzip");
    expect(compressed.value).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(compressed.inputBytes).toBe(textToBytes(source).length);
    expect(compressed.outputBytes).toBeLessThan(compressed.inputBytes);
    const magic = base64ToBytes(compressed.value);
    expect([magic[0], magic[1]]).toEqual([0x1f, 0x8b]);

    const restored = await decompressFromBase64(compressed.value, "gzip");
    expect(restored.value).toBe(source);
    expect(restored.inputBytes).toBe(compressed.outputBytes);
    expect(restored.outputBytes).toBe(compressed.inputBytes);
  });

  it.skipIf(!supported)("round-trips text through zlib-wrapped deflate", async () => {
    const compressed = await compressToBase64(source, "deflate");
    const raw = base64ToBytes(compressed.value);
    expect(raw[0]).toBe(0x78);
    await expect(decompressFromBase64(compressed.value, "deflate")).resolves.toMatchObject({
      value: source,
    });
  });

  it.skipIf(!supported)("handles empty input", async () => {
    const compressed = await compressToBase64("", "gzip");
    await expect(decompressFromBase64(compressed.value, "gzip")).resolves.toMatchObject({
      value: "",
      outputBytes: 0,
    });
  });

  it.skipIf(!supported)("reports invalid transport and corrupt streams", async () => {
    await expect(decompressFromBase64("not base64!", "gzip")).rejects.toThrow(/Base64/);
    await expect(decompressFromBase64("AAAA", "gzip")).rejects.toThrow(/not a valid gzip stream/);
    const compressed = await compressToBase64("payload", "gzip");
    await expect(decompressFromBase64(compressed.value, "deflate")).rejects.toThrow(
      /not a valid deflate stream/,
    );
  });
});

describe("Punycode and domains", () => {
  it("implements RFC 3492 encoding and decoding", () => {
    expect(punycodeEncode("münchen")).toBe("mnchen-3ya");
    expect(punycodeDecode("mnchen-3ya")).toBe("münchen");
    expect(punycodeEncode("例え")).toBe("r8jz45g");
    expect(punycodeDecode("r8jz45g")).toBe("例え");
    expect(punycodeEncode("テスト")).toBe("zckzah");
    expect(punycodeDecode("zckzah")).toBe("テスト");
  });

  it("converts every label in a domain", () => {
    expect(domainToAscii("münchen.de")).toBe("xn--mnchen-3ya.de");
    expect(domainToAscii("例え.テスト")).toBe("xn--r8jz45g.xn--zckzah");
    expect(domainToAscii("MÜNCHEN.DE.")).toBe("xn--mnchen-3ya.de.");
    expect(domainToUnicode("xn--mnchen-3ya.de")).toBe("münchen.de");
    expect(domainToUnicode("xn--r8jz45g.xn--zckzah")).toBe("例え.テスト");
    expect(domainToUnicode("xn--mnchen-3ya.de.")).toBe("münchen.de.");
  });

  it("is stable for plain ASCII domains and canonical Punycode", () => {
    expect(domainToAscii("example.com")).toBe("example.com");
    expect(domainToUnicode("example.com")).toBe("example.com");
    expect(domainToAscii("xn--bcher-kva.example")).toBe("xn--bcher-kva.example");
  });

  it("validates domains", () => {
    expect(() => domainToAscii("")).toThrow(/Enter a domain name/);
    expect(() => domainToAscii("a..b")).toThrow(/empty labels/);
    expect(() => domainToAscii("-abc.com")).toThrow(/start or end with a hyphen/);
    expect(() => domainToAscii("abc-.com")).toThrow(/start or end with a hyphen/);
    expect(() => domainToAscii("exa mple.com")).toThrow(/cannot contain spaces/);
    expect(() => domainToAscii("😀.com")).toThrow(/not allowed in a domain label/);
    expect(() => domainToUnicode("xn--")).toThrow(/just "xn--"/);
    expect(() => domainToAscii("xn--")).toThrow(/just "xn--"/);
    expect(() => domainToAscii(`${"a".repeat(64)}.com`)).toThrow(/longer than 63 characters/);
    expect(() => domainToAscii(`${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}`)).toThrow(
      /longer than 253 characters/,
    );
    expect(() => punycodeDecode("münchen")).toThrow(/ASCII/);
    expect(() => punycodeDecode("mnchen-3y!")).toThrow(/Invalid Punycode digit/);
  });
});

describe("Base32 and Base58", () => {
  it("encodes and decodes text", () => {
    expect(convertBase("foo", { alphabet: "base32", direction: "encode", kind: "text" })).toEqual({
      value: "MZXW6",
      byteCount: 3,
    });
    expect(convertBase("MZXW6", { alphabet: "base32", direction: "decode", kind: "text" })).toEqual({
      value: "foo",
      byteCount: 3,
    });
    expect(convertBase("hello world", { alphabet: "base58", direction: "encode", kind: "text" })).toEqual({
      value: "StV1DL6CwTryKyV",
      byteCount: 11,
    });
    expect(convertBase("StV1DL6CwTryKyV", { alphabet: "base58", direction: "decode", kind: "text" })).toEqual({
      value: "hello world",
      byteCount: 11,
    });
  });

  it("encodes and decodes hex", () => {
    expect(convertBase("48656c6c6f", { alphabet: "base32", direction: "encode", kind: "hex" })).toEqual({
      value: "JBSWY3DP",
      byteCount: 5,
    });
    expect(convertBase("JBSWY3DP", { alphabet: "base32", direction: "decode", kind: "hex" })).toEqual({
      value: "48656c6c6f",
      byteCount: 5,
    });
    const encoded = convertBase("000102ff", { alphabet: "base58", direction: "encode", kind: "hex" });
    expect(encoded.byteCount).toBe(4);
    expect(convertBase(encoded.value, { alphabet: "base58", direction: "decode", kind: "hex" })).toEqual({
      value: "000102ff",
      byteCount: 4,
    });
  });

  it("rejects invalid alphabets, hex, and UTF-8", () => {
    expect(() => convertBase("0", { alphabet: "base32", direction: "decode", kind: "text" })).toThrow(
      /Invalid Base32/,
    );
    expect(() => convertBase("0", { alphabet: "base58", direction: "decode", kind: "text" })).toThrow(
      /Invalid Base58/,
    );
    expect(() => convertBase("zz", { alphabet: "base32", direction: "encode", kind: "hex" })).toThrow(
      /hexadecimal/,
    );
    const invalidUtf8 = convertBase("ff", { alphabet: "base32", direction: "encode", kind: "hex" });
    expect(() =>
      convertBase(invalidUtf8.value, { alphabet: "base32", direction: "decode", kind: "text" }),
    ).toThrow(/not valid UTF-8/);
  });
});
