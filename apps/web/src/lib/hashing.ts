import { hmac } from "@noble/hashes/hmac.js";
import { md5, ripemd160, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { sha3_256, sha3_512 } from "@noble/hashes/sha3.js";
import type { CHash } from "@noble/hashes/utils.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export type HashAlgorithm =
  | "md5"
  | "sha1"
  | "sha224"
  | "sha256"
  | "sha384"
  | "sha512"
  | "sha3-256"
  | "sha3-512"
  | "ripemd160";

export interface HashAlgorithmInfo {
  id: HashAlgorithm;
  label: string;
  bits: number;
  weak?: boolean;
  fn: CHash;
}

export const HASH_ALGORITHMS: HashAlgorithmInfo[] = [
  { id: "md5", label: "MD5", bits: 128, weak: true, fn: md5 },
  { id: "sha1", label: "SHA-1", bits: 160, weak: true, fn: sha1 },
  { id: "sha224", label: "SHA-224", bits: 224, fn: sha224 },
  { id: "sha256", label: "SHA-256", bits: 256, fn: sha256 },
  { id: "sha384", label: "SHA-384", bits: 384, fn: sha384 },
  { id: "sha512", label: "SHA-512", bits: 512, fn: sha512 },
  { id: "sha3-256", label: "SHA3-256", bits: 256, fn: sha3_256 },
  { id: "sha3-512", label: "SHA3-512", bits: 512, fn: sha3_512 },
  { id: "ripemd160", label: "RIPEMD-160", bits: 160, weak: true, fn: ripemd160 },
];

export const hashAlgorithmById = new Map(HASH_ALGORITHMS.map((item) => [item.id, item]));

export function hashBytes(algorithm: HashAlgorithm, input: Uint8Array): Uint8Array {
  const info = hashAlgorithmById.get(algorithm);
  if (!info) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  return info.fn(input);
}

export function hashText(algorithm: HashAlgorithm, input: string): string {
  return bytesToHex(hashBytes(algorithm, new TextEncoder().encode(input)));
}

export function hmacBytes(
  algorithm: HashAlgorithm,
  key: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  const info = hashAlgorithmById.get(algorithm);
  if (!info) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  return hmac(info.fn, key, message);
}

export function hmacHex(algorithm: HashAlgorithm, key: string, message: string): string {
  return bytesToHex(hmacBytes(algorithm, new TextEncoder().encode(key), new TextEncoder().encode(message)));
}
