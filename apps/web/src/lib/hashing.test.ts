import { describe, expect, it } from "vitest";
import { HASH_ALGORITHMS, hashText, hmacHex } from "./hashing";

describe("hashText", () => {
  it("matches published test vectors", () => {
    expect(hashText("sha256", "abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashText("sha1", "abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(hashText("md5", "abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(hashText("sha512", "abc")).toHaveLength(128);
    expect(hashText("sha3-256", "abc")).toHaveLength(64);
  });

  it("exposes a label and size for every algorithm", () => {
    for (const algorithm of HASH_ALGORITHMS) {
      expect(algorithm.label).toBeTruthy();
      expect(algorithm.bits).toBeGreaterThan(0);
    }
  });
});

describe("hmacHex", () => {
  it("matches the RFC 4231 test vector", () => {
    expect(
      hmacHex(
        "sha256",
        "Jefe",
        "what do ya want for nothing?",
      ),
    ).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });
});
