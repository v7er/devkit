import { useState } from "react";
import { ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { hexToBytes, textToBytes } from "@/lib/encoding";
import { copyBytes, decodeJwt, errorMessage, pemToDer, type DecodedJwt } from "./logic";

type JwtAlgorithm = "HS256" | "HS384" | "HS512" | "RS256" | "ES256";

const HMAC_HASHES = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
} as const;

const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiJkZW1vLXVzZXIiLCJpc3MiOiJkZXZraXQiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0." +
  "ph1W8sxUDD_wezdIV6iHLPF3AG9gGS_qe6YGsLYVuUo";
const SAMPLE_SECRET = "devkit-demo-secret";

function isHmacAlgorithm(
  algorithm: JwtAlgorithm,
): algorithm is keyof typeof HMAC_HASHES {
  return algorithm === "HS256" || algorithm === "HS384" || algorithm === "HS512";
}

async function verifySignature(
  token: DecodedJwt,
  algorithm: JwtAlgorithm,
  secret: string,
  publicKey: string,
): Promise<boolean> {
  if (!token.signature) {
    throw new Error("The token has no signature; unsigned tokens cannot be verified");
  }
  const signature = copyBytes(hexToBytes(token.signatureHex));
  if (signature.length === 0) {
    throw new Error("The token has an empty signature");
  }
  const data = copyBytes(textToBytes(token.signingInput));

  if (isHmacAlgorithm(algorithm)) {
    if (!secret) throw new Error("Enter the shared secret used to sign the token");
    const key = await crypto.subtle.importKey(
      "raw",
      copyBytes(textToBytes(secret)),
      { name: "HMAC", hash: HMAC_HASHES[algorithm] },
      false,
      ["verify"],
    );
    return crypto.subtle.verify("HMAC", key, signature, data);
  }

  if (!publicKey.trim()) {
    throw new Error("Paste the issuer's public key in PEM format");
  }
  const der = copyBytes(pemToDer(publicKey));
  if (algorithm === "RS256") {
    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        "spki",
        der,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    } catch {
      throw new Error("Could not read the public key. Paste an SPKI PEM key for RS256.");
    }
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  }

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "spki",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new Error("Could not read the public key. Paste an SPKI P-256 key for ES256.");
  }
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, data);
}

export default function JwtVerifyTool() {
  const [token, setToken] = useState("");
  const [algorithm, setAlgorithm] = useState<JwtAlgorithm>("HS256");
  const [secret, setSecret] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [result, setResult] = useState<{ valid: boolean; algorithm: JwtAlgorithm } | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const hmac = isHmacAlgorithm(algorithm);

  async function handleVerify() {
    setError("");
    setResult(null);

    let decoded: DecodedJwt;
    try {
      decoded = decodeJwt(token);
    } catch (caught) {
      setError(errorMessage(caught, "Could not decode the token"));
      return;
    }

    const declared = decoded.header.alg;
    if (typeof declared === "string" && declared !== algorithm) {
      setError(
        `The token header declares ${declared}, but this verifier is set to ${algorithm}. Select the matching algorithm.`,
      );
      return;
    }

    setRunning(true);
    try {
      const valid = await verifySignature(decoded, algorithm, secret, publicKey);
      setResult({ valid, algorithm });
    } catch (caught) {
      setError(errorMessage(caught, "Could not verify the signature"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Token and key"
        description="Signature checks use Web Crypto in this tab."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setToken(SAMPLE_TOKEN);
              setAlgorithm("HS256");
              setSecret(SAMPLE_SECRET);
              setPublicKey("");
              setResult(null);
              setError("");
            }}
          >
            <Sparkles className="size-3.5" aria-hidden />
            Sample
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="JWT" hint="The header, payload, and signature must be unchanged.">
            <TextArea
              mono
              rows={9}
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                setResult(null);
                setError("");
              }}
              placeholder="eyJhbGciOi…"
              aria-label="JWT to verify"
            />
          </Field>

          <Select
            label="Verification algorithm"
            value={algorithm}
            onChange={(value) => {
              setAlgorithm(value as JwtAlgorithm);
              setResult(null);
              setError("");
            }}
            options={[
              { value: "HS256", label: "HS256 · HMAC SHA-256" },
              { value: "HS384", label: "HS384 · HMAC SHA-384" },
              { value: "HS512", label: "HS512 · HMAC SHA-512" },
              { value: "RS256", label: "RS256 · RSA PKCS#1 SHA-256" },
              { value: "ES256", label: "ES256 · ECDSA P-256 SHA-256" },
            ]}
          />

          {hmac ? (
            <Field
              label="Shared secret"
              hint="The same secret bytes the issuer used. Do not paste production secrets into shared machines."
            >
              <Input
                type="password"
                value={secret}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setResult(null);
                  setError("");
                }}
                placeholder="HMAC secret"
                autoComplete="off"
                spellCheck={false}
                aria-label="HMAC shared secret"
              />
            </Field>
          ) : (
            <Field
              label="Public key"
              hint="SPKI PEM, for example -----BEGIN PUBLIC KEY-----."
            >
              <TextArea
                mono
                rows={8}
                value={publicKey}
                onChange={(event) => {
                  setPublicKey(event.target.value);
                  setResult(null);
                  setError("");
                }}
                placeholder={"-----BEGIN PUBLIC KEY-----\n…"}
                aria-label="Public key PEM"
              />
            </Field>
          )}

          <Button variant="primary" onClick={handleVerify} disabled={running}>
            <ShieldCheck className="size-4" aria-hidden />
            {running ? "Verifying…" : "Verify signature"}
          </Button>

          {running ? <Spinner label="Checking the signature" /> : null}

          {error ? (
            <Alert tone="danger" title="Verification error">
              {error}
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel title="Result" description="Signature only; claims need separate checks">
        <div className="space-y-3">
          {result ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{result.algorithm}</Badge>
                <Badge tone={result.valid ? "accent" : "warning"}>
                  {result.valid ? "signature valid" : "signature invalid"}
                </Badge>
              </div>
              {result.valid ? (
                <Alert tone="success" title="Signature is valid">
                  The signature matches the token and the supplied key.
                </Alert>
              ) : (
                <Alert tone="danger" title="Signature is invalid">
                  The signature does not match the token and the supplied key.
                </Alert>
              )}
              <p className="text-xs leading-relaxed text-faint">
                A valid signature proves that the key holder signed these exact bytes. It does not
                establish that the issuer is trustworthy, and it does not check expiration,
                audience, or revocation. Validate the claims in the application that consumes the
                token.
              </p>
            </>
          ) : (
            <EmptyState
              icon={<ShieldX className="size-6" aria-hidden />}
              title="No verification yet"
              description="Paste a token, choose the algorithm, and supply the secret or public key."
            />
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
