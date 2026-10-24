import { describe, expect, it } from "vitest";
import { bytesToBase64, bytesToHex } from "@/lib/encoding";
import {
  AES_DEFAULT_ITERATIONS,
  aesIvLength,
  bcryptCostHint,
  certificateValidityState,
  decodeAesEnvelope,
  decodeHmacKey,
  decodeJwt,
  describeBcryptHash,
  describeClaims,
  derToPem,
  encodeAesEnvelope,
  formatRandomBytes,
  formatUlid,
  formatUuid,
  generatePasswords,
  generateRandomBytes,
  hmacDigest,
  jwtTimeState,
  parseCertificate,
  parsePem,
  parseRandomByteSize,
  parseUuid,
  passwordAlphabet,
  passwordEntropyBits,
  passwordStrengthLabel,
  ulidFromBytes,
  uuidV4FromBytes,
  uuidV5,
  validateAesIterations,
  validateBcryptCost,
  validateBcryptPassword,
  validatePasswordOptions,
  type AesEnvelope,
  type PasswordOptions,
} from "./logic";

const encoder = new TextEncoder();

function base64Url(text: string): string {
  return bytesToBase64(encoder.encode(text), true);
}

describe("decodeJwt", () => {
  const header = base64Url('{"alg":"HS256","typ":"JWT"}');
  const payload = base64Url('{"sub":"1234567890","name":"Ada","iat":1516239022}');
  const token = `${header}.${payload}.c2lnbmF0dXJl`;

  it("decodes the header, payload, and signature", () => {
    const decoded = decodeJwt(token);
    expect(decoded.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decoded.payload.name).toBe("Ada");
    expect(decoded.signature).toBe("c2lnbmF0dXJl");
    expect(decoded.signatureHex).toBe(bytesToHex(encoder.encode("signature")));
    expect(decoded.signingInput).toBe(`${header}.${payload}`);
  });

  it("accepts a Bearer prefix and an empty signature", () => {
    const decoded = decodeJwt(`Bearer ${header}.${payload}.`);
    expect(decoded.signature).toBe("");
    expect(decoded.signatureHex).toBe("");
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeJwt("")).toThrow("Paste a JWT");
    expect(() => decodeJwt("a.b")).toThrow("three dot-separated segments");
    expect(() => decodeJwt(`${header}.${base64Url("not json")}.sig`)).toThrow(
      "payload segment is not valid JSON",
    );
    expect(() => decodeJwt(`${base64Url("[]")}.${payload}.sig`)).toThrow(
      "header segment must be a JSON object",
    );
    expect(() => decodeJwt(`${header}.${payload}.!!!`)).toThrow(
      "signature segment is not valid Base64URL",
    );
  });
});

describe("describeClaims", () => {
  const now = Date.UTC(2025, 0, 1);
  const nowSeconds = now / 1000;

  it("orders registered claims first and reports time states", () => {
    const rows = describeClaims(
      {
        custom: "value",
        iat: nowSeconds - 3600,
        nbf: nowSeconds + 60,
        exp: nowSeconds - 60,
        iss: "devkit",
      },
      now,
    );
    expect(rows.map((row) => row.key)).toEqual(["exp", "iat", "iss", "nbf", "custom"]);
    expect(rows[0].state).toBe("expired");
    expect(rows[1].state).toBe("valid");
    expect(rows[2].label).toBe("Issuer");
    expect(rows[3].state).toBe("not-yet-valid");
    expect(rows[4].state).toBe("unknown");
    expect(rows[0].time).toBe("2024-12-31T23:59:00.000Z");
  });

  it("marks unusable timestamps as unknown", () => {
    const rows = describeClaims({ exp: "soon" }, now);
    expect(rows[0].state).toBe("unknown");
    expect(rows[0].time).toBe("");
  });

  it("reports expiration from a numeric claim", () => {
    expect(jwtTimeState(nowSeconds - 1, now)).toBe("expired");
    expect(jwtTimeState(nowSeconds + 1, now)).toBe("valid");
    expect(jwtTimeState(undefined, now)).toBe("unknown");
  });
});

describe("HMAC", () => {
  it("matches RFC 4231 test case 2 with SHA-256", () => {
    const key = decodeHmacKey("Jefe", "text");
    expect(hmacDigest("sha256", key, "what do ya want for nothing?", "hex")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("decodes text, hex, and Base64 keys", () => {
    expect(Array.from(decodeHmacKey("key", "text"))).toEqual([107, 101, 121]);
    expect(Array.from(decodeHmacKey("0a ff", "hex"))).toEqual([10, 255]);
    expect(Array.from(decodeHmacKey("AAEC", "base64"))).toEqual([0, 1, 2]);
  });

  it("rejects empty and malformed keys", () => {
    expect(() => decodeHmacKey("", "text")).toThrow("Enter a key");
    expect(() => decodeHmacKey("zz", "hex")).toThrow("not hexadecimal");
    expect(() => decodeHmacKey("!!!!", "base64")).toThrow("not valid Base64");
    expect(() => decodeHmacKey("00", "hex")).not.toThrow();
  });
});

describe("bcrypt helpers", () => {
  it("validates costs", () => {
    expect(validateBcryptCost(10)).toBe("");
    expect(validateBcryptCost(4)).toBe("");
    expect(validateBcryptCost(3)).toMatch("between 4 and 15");
    expect(validateBcryptCost(16)).toMatch("between 4 and 15");
    expect(validateBcryptCost(10.5)).toMatch("whole number");
    expect(bcryptCostHint(14)).toContain("several seconds");
    expect(bcryptCostHint(9)).toContain("below common practice");
  });

  it("enforces the 72-byte password limit", () => {
    expect(validateBcryptPassword("a".repeat(72))).toBe("");
    expect(validateBcryptPassword("a".repeat(73))).toContain("72 bytes");
    expect(validateBcryptPassword("é".repeat(37))).toContain("72 bytes");
    expect(validateBcryptPassword("")).toBe("Enter a password");
  });

  it("parses the version and cost from a hash", () => {
    const hash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    expect(describeBcryptHash(hash)).toEqual({ version: "2b", cost: 10 });
    expect(() => describeBcryptHash("$2b$10$short")).toThrow("does not look like a bcrypt hash");
  });
});

describe("UUID and ULID", () => {
  it("formats a v4 UUID from bytes with version and variant bits", () => {
    const uuid = uuidV4FromBytes(new Uint8Array(16));
    expect(uuid).toBe("00000000-0000-4000-8000-000000000000");
    expect(() => uuidV4FromBytes(new Uint8Array(15))).toThrow("16 random bytes");
  });

  it("generates the known UUID v5 vector for a DNS name", () => {
    expect(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
    expect(() => uuidV5("not-a-uuid", "name")).toThrow("32-digit hexadecimal UUID");
    expect(() => uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "")).toThrow(
      "Enter a name",
    );
  });

  it("parses and reformats UUIDs", () => {
    const bytes = parseUuid("{6BA7B810-9DAD-11D1-80B4-00C04FD430C8}");
    expect(bytes).toHaveLength(16);
    const value = formatUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8", {
      uppercase: true,
      braces: true,
      hyphens: false,
    });
    expect(value).toBe("{6BA7B8109DAD11D180B400C04FD430C8}");
    expect(() => parseUuid("1234")).toThrow("32-digit hexadecimal UUID");
  });

  it("encodes ULIDs from time and random bytes", () => {
    expect(ulidFromBytes(0, new Uint8Array(10))).toBe("00000000000000000000000000");
    expect(ulidFromBytes(1469918176385, new Uint8Array(10))).toBe(
      "01ARYZ6S410000000000000000",
    );
    expect(ulidFromBytes(0, new Uint8Array(10).fill(0xff))).toBe(
      "0000000000ZZZZZZZZZZZZZZZZ",
    );
    expect(() => ulidFromBytes(-1, new Uint8Array(10))).toThrow("48 bits");
    expect(() => ulidFromBytes(0, new Uint8Array(9))).toThrow("10 random bytes");
  });

  it("formats ULIDs and rejects invalid values", () => {
    const ulid = "01aryz6s41tsv4rrffq69g5fav";
    expect(formatUlid(ulid, true)).toBe("01ARYZ6S41TSV4RRFFQ69G5FAV");
    expect(formatUlid(ulid, false)).toBe(ulid);
    expect(() => formatUlid("nope")).toThrow("26 Crockford");
  });
});

describe("PEM helpers", () => {
  it("round-trips DER through PEM with wrapped lines", () => {
    const der = new Uint8Array(100).map((_, index) => index);
    const pem = derToPem(der, "PUBLIC KEY");
    expect(pem.startsWith("-----BEGIN PUBLIC KEY-----\n")).toBe(true);
    expect(pem.endsWith("\n-----END PUBLIC KEY-----")).toBe(true);
    for (const line of pem.split("\n").slice(1, -1)) {
      expect(line.length).toBeLessThanOrEqual(64);
    }
    expect(Array.from(parsePem(pem).der)).toEqual(Array.from(der));
    expect(parsePem(pem).label).toBe("PUBLIC KEY");
  });

  it("rejects malformed PEM blocks", () => {
    expect(() => parsePem("not pem")).toThrow("No PEM block");
    expect(() =>
      parsePem("-----BEGIN PUBLIC KEY-----\n!!!!\n-----END PUBLIC KEY-----"),
    ).toThrow("valid Base64");
    expect(() =>
      parsePem("-----BEGIN PUBLIC KEY-----\nAQID\n-----END PRIVATE KEY-----"),
    ).toThrow("No PEM block");
  });
});

function passwordOptions(overrides: Partial<PasswordOptions> = {}): PasswordOptions {
  return {
    length: 16,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
    ...overrides,
  };
}

describe("password generation", () => {
  it("builds the selected alphabet and removes ambiguous characters", () => {
    expect(passwordAlphabet(passwordOptions({ symbols: false }))).toContain("a");
    expect(passwordAlphabet(passwordOptions({ symbols: false, excludeAmbiguous: true }))).not.toMatch(
      /[Il1O0o|]/,
    );
    expect(() =>
      passwordAlphabet(
        passwordOptions({ lowercase: false, uppercase: false, digits: false, symbols: false }),
      ),
    ).toThrow("at least one character class");
  });

  it("generates passwords with every selected class and the right length", () => {
    const [password] = generatePasswords(passwordOptions({ length: 24 }), 1);
    expect(password).toHaveLength(24);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("honours the ambiguous exclusion and bulk count", () => {
    const options = passwordOptions({
      length: 64,
      excludeAmbiguous: true,
      symbols: false,
    });
    const passwords = generatePasswords(options, 3);
    expect(passwords).toHaveLength(3);
    for (const password of passwords) {
      expect(password).toHaveLength(64);
      expect(password).not.toMatch(/[Il1O0o|`'"]/);
    }
    expect(() => generatePasswords(options, 0)).toThrow("between 1 and 25");
  });

  it("validates length and class choices", () => {
    expect(validatePasswordOptions(passwordOptions())).toBe("");
    expect(validatePasswordOptions(passwordOptions({ length: 3 }))).toContain("between 4 and 128");
    expect(
      validatePasswordOptions(
        passwordOptions({ lowercase: false, uppercase: false, digits: false, symbols: false }),
      ),
    ).toBe("Select at least one character class");
  });

  it("estimates entropy and labels strength", () => {
    expect(passwordEntropyBits(20, 94)).toBeCloseTo(131.09, 1);
    expect(passwordEntropyBits(0, 94)).toBe(0);
    expect(passwordStrengthLabel(30)).toBe("Weak");
    expect(passwordStrengthLabel(50)).toBe("Fair");
    expect(passwordStrengthLabel(70)).toBe("Strong");
    expect(passwordStrengthLabel(90)).toBe("Very strong");
  });
});

function exampleEnvelope(): AesEnvelope {
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: AES_DEFAULT_ITERATIONS,
    salt: bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
    iv: bytesToBase64(new Uint8Array(12).fill(7)),
    ct: bytesToBase64(new Uint8Array([9, 8, 7])),
  };
}

describe("AES envelope", () => {
  it("round-trips an envelope through Base64", () => {
    const envelope = exampleEnvelope();
    expect(decodeAesEnvelope(encodeAesEnvelope(envelope))).toEqual(envelope);
  });

  it("validates the AES mode helpers", () => {
    expect(aesIvLength("AES-GCM")).toBe(12);
    expect(aesIvLength("AES-CBC")).toBe(16);
    expect(validateAesIterations(210_000)).toBe("");
    expect(validateAesIterations(1_000)).toContain("between");
  });

  it("rejects malformed payloads", () => {
    expect(() => decodeAesEnvelope("")).toThrow("Paste a Base64 payload");
    expect(() => decodeAesEnvelope("!!!!")).toThrow("not valid Base64");
    expect(() => decodeAesEnvelope(bytesToBase64(encoder.encode("not json")))).toThrow(
      "not a devkit AES envelope",
    );
  });

  it("rejects unsupported or incomplete envelopes", () => {
    const encode = (value: unknown) => bytesToBase64(encoder.encode(JSON.stringify(value)));
    expect(() => decodeAesEnvelope(encode({ v: 2 }))).toThrow("Unsupported AES envelope");
    expect(() =>
      decodeAesEnvelope(encode({ ...exampleEnvelope(), alg: "AES-ECB" })),
    ).toThrow("unsupported AES mode");
    expect(() =>
      decodeAesEnvelope(encode({ ...exampleEnvelope(), kdf: "scrypt" })),
    ).toThrow("unsupported key derivation");
    expect(() => decodeAesEnvelope(encode({ ...exampleEnvelope(), salt: "" }))).toThrow(
      "missing its salt",
    );
    expect(() =>
      decodeAesEnvelope(encode({ ...exampleEnvelope(), iv: bytesToBase64(new Uint8Array(2)) })),
    ).toThrow("initialization vector must be between 8 and 16");
  });
});

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIICZDCCAgqgAwIBAgIUCkNvhfSrSx+KRR47xfbXNVGqjdQwCgYIKoZIzj0EAwIw
eTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNh
biBGcmFuY2lzY28xFDASBgNVBAoMC0RldmtpdCBUZXN0MREwDwYDVQQLDAhTZWN1
cml0eTEUMBIGA1UEAwwLZGV2a2l0LnRlc3QwHhcNMjYxMDI0MDQzNTUxWhcNMzYx
MDIxMDQzNTUxWjB5MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEW
MBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEUMBIGA1UECgwLRGV2a2l0IFRlc3QxETAP
BgNVBAsMCFNlY3VyaXR5MRQwEgYDVQQDDAtkZXZraXQudGVzdDBZMBMGByqGSM49
AgEGCCqGSM49AwEHA0IABCPDWXj1hCe6WnebzncCgxzjvNvqCQG0cf82Mg7H3eiG
Qacll8cg1bSM88XtdW7KH6Zks1dgN6YckcKxLT+8+e6jcDBuMB0GA1UdDgQWBBTW
hUNFujc3K+hkMeeLBBiO7g80OzA/BgNVHREEODA2ggtkZXZraXQudGVzdIIPd3d3
LmRldmtpdC50ZXN0hwR/AAABgRB0ZXN0QGRldmtpdC50ZXN0MAwGA1UdEwEB/wQC
MAAwCgYIKoZIzj0EAwIDSAAwRQIhAKEWKWYZk0T/bcq19+EnyqEQ+RGTLQJHHObF
tlrSVn5aAiAVNcPGaPCq5ffNWuSbd0tpC6HBRpVOh5Lz9Teud9c/WA==
-----END CERTIFICATE-----`;

describe("X.509 certificate decoding", () => {
  const now = Date.UTC(2027, 0, 1);

  it("decodes the supported fields from PEM", () => {
    const info = parseCertificate(TEST_CERTIFICATE, now);
    expect(info.version).toBe("v3");
    expect(info.serialNumber).toBe("0A436F85F4AB4B1F8A451E3BC5F6D73551AA8DD4");
    expect(info.serialDecimal).toBe("58593772683054210278922478124914955080329498068");
    expect(info.signatureAlgorithm).toBe("ecdsa-with-SHA256");
    expect(info.subject).toBe("C=US, ST=California, L=San Francisco, O=Devkit Test, OU=Security, CN=devkit.test");
    expect(info.issuer).toBe(info.subject);
    expect(info.notBefore.toISOString()).toBe("2026-10-24T04:35:51.000Z");
    expect(info.notAfter.toISOString()).toBe("2036-10-21T04:35:51.000Z");
    expect(info.validity).toBe("valid");
    expect(info.publicKeyAlgorithm).toBe("EC");
    expect(info.publicKeyDetails).toBe("EC P-256");
    expect(info.isCa).toBe(false);
    expect(info.subjectAltNames).toEqual([
      "DNS:devkit.test",
      "DNS:www.devkit.test",
      "IP:127.0.0.1",
      "email:test@devkit.test",
    ]);
    expect(info.extensions).toContain("Subject Alternative Name");
    expect(info.extensions).toContain("Basic Constraints");
  });

  it("accepts Base64 DER", () => {
    const base64 = TEST_CERTIFICATE.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    expect(parseCertificate(base64, now).subject).toContain("CN=devkit.test");
  });

  it("reports expired and not-yet-valid windows", () => {
    expect(parseCertificate(TEST_CERTIFICATE, Date.UTC(2040, 0, 1)).validity).toBe("expired");
    expect(parseCertificate(TEST_CERTIFICATE, Date.UTC(2020, 0, 1)).validity).toBe(
      "not-yet-valid",
    );
    expect(
      certificateValidityState(new Date(now - 1000), new Date(now + 1000), now),
    ).toBe("valid");
    expect(certificateValidityState(new Date(now - 2000), new Date(now - 1000), now)).toBe(
      "expired",
    );
  });

  it("rejects data that is not a certificate", () => {
    expect(() => parseCertificate("")).toThrow("Paste a PEM");
    expect(() => parseCertificate("not base64 !!!")).toThrow("PEM or Base64");
    expect(() => parseCertificate(bytesToBase64(new Uint8Array([0x30, 0x00])))).toThrow(
      "not an X.509 certificate",
    );
  });
});

describe("random bytes", () => {
  it("parses sizes within bounds", () => {
    expect(parseRandomByteSize("32")).toBe(32);
    expect(() => parseRandomByteSize("0")).toThrow("between 1");
    expect(() => parseRandomByteSize("abc")).toThrow("whole number");
    expect(() => parseRandomByteSize("65537")).toThrow("between 1");
  });

  it("formats bytes in each output encoding", () => {
    const bytes = new Uint8Array([0, 255, 16]);
    expect(formatRandomBytes(bytes, "hex")).toBe("00ff10");
    expect(formatRandomBytes(bytes, "hex", true)).toBe("00FF10");
    expect(formatRandomBytes(bytes, "base64")).toBe("AP8Q");
    expect(formatRandomBytes(bytes, "decimal")).toBe("0 255 16");
  });

  it("generates the requested number of random bytes", () => {
    expect(generateRandomBytes(32)).toHaveLength(32);
    expect(generateRandomBytes(65_536)).toHaveLength(65_536);
    expect(() => generateRandomBytes(0)).toThrow("between 1");
    expect(generateRandomBytes(16)).not.toEqual(new Uint8Array(16));
  });
});
