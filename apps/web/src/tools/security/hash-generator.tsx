import { useMemo, useState } from "react";
import { AlertTriangle, Fingerprint, KeyRound, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Panel,
  Select,
  TextArea,
  Toggle,
  ToolStack,
  CopyButton,
} from "@/components/ui";
import { bytesToBase64, bytesToHex } from "@/lib/encoding";
import {
  HASH_ALGORITHMS,
  hashAlgorithmById,
  hashBytes,
  hmacBytes,
  type HashAlgorithm,
} from "@/lib/hashing";

type OutputEncoding = "hex" | "base64";

const SAMPLE = "The quick brown fox jumps over the lazy dog";

export default function HashGeneratorTool() {
  const [input, setInput] = useState(SAMPLE);
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("sha256");
  const [encoding, setEncoding] = useState<OutputEncoding>("hex");
  const [hmacMode, setHmacMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [upperCase, setUpperCase] = useState(false);

  const result = useMemo(() => {
    try {
      const message = new TextEncoder().encode(input);
      const digest = hmacMode
        ? hmacBytes(algorithm, new TextEncoder().encode(secret), message)
        : hashBytes(algorithm, message);
      const value =
        encoding === "hex"
          ? bytesToHex(digest, "", upperCase)
          : bytesToBase64(digest);
      return { value, error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not compute the digest",
      };
    }
  }, [algorithm, encoding, hmacMode, input, secret, upperCase]);

  const info = hashAlgorithmById.get(algorithm);

  return (
    <ToolStack>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Message"
          description="Text is hashed as UTF-8 bytes. Nothing is uploaded."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <TextArea
              mono
              rows={10}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Text to hash…"
              aria-label="Message to hash"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Algorithm"
                value={algorithm}
                onChange={(value) => setAlgorithm(value as HashAlgorithm)}
                options={HASH_ALGORITHMS.map((item) => ({
                  value: item.id,
                  label: `${item.label} · ${item.bits} bit${item.weak ? " (legacy)" : ""}`,
                }))}
              />
              <Select
                label="Output encoding"
                value={encoding}
                onChange={(value) => setEncoding(value as OutputEncoding)}
                options={[
                  { value: "hex", label: "Hexadecimal" },
                  { value: "base64", label: "Base64" },
                ]}
              />
            </div>
            <Toggle
              label="Uppercase hex"
              checked={upperCase}
              onChange={setUpperCase}
            />
            <Toggle
              label="HMAC mode"
              description="Key the hash with a shared secret."
              checked={hmacMode}
              onChange={setHmacMode}
            />
            {hmacMode ? (
              <Field label="Secret key" hint="The key is used as UTF-8 bytes.">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    placeholder="Shared secret"
                    autoComplete="off"
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm text-text placeholder:text-faint hover:border-line-strong focus:border-accent/70"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Generate a random secret"
                    title="Generate a random secret"
                    onClick={() => {
                      const bytes = crypto.getRandomValues(new Uint8Array(32));
                      setSecret(bytesToHex(bytes));
                    }}
                  >
                    <KeyRound className="size-4" aria-hidden />
                  </Button>
                </div>
              </Field>
            ) : null}
            {info?.weak ? (
              <Alert tone="warning" title="Legacy algorithm">
                {info.label} is useful for checksums and compatibility. Use SHA-256 or stronger
                for new security work.
              </Alert>
            ) : null}
          </div>
        </Panel>

        <Panel
          title={hmacMode ? "HMAC digest" : "Digest"}
          description={`${info?.label ?? algorithm} · ${encoding === "hex" ? "hex" : "base64"}`}
          flush
        >
          <div className="space-y-3 p-4">
            {result.error ? (
              <Alert tone="danger" title="Hash failed">
                {result.error}
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Fingerprint className="size-4 shrink-0 text-accent" aria-hidden />
                    <code className="break-all font-mono text-xs text-text">{result.value}</code>
                  </div>
                  <CopyButton value={result.value} />
                </div>
                <CodeOutput
                  value={result.value}
                  language={encoding}
                  filename={`${algorithm}${hmacMode ? "-hmac" : ""}.txt`}
                  maxHeight={160}
                />
              </>
            )}
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <AlertTriangle className="size-3.5" aria-hidden />
                About digests
              </p>
              <p className="mt-1 text-xs leading-relaxed text-faint">
                Hashes are one-way. This tool computes them in memory only, so sensitive input
                never leaves the tab. MD5, SHA-1, and RIPEMD-160 are shown for compatibility
                checks.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </ToolStack>
  );
}
