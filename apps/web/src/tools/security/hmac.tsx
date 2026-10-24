import { useMemo, useState } from "react";
import { Fingerprint, KeyRound, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { bytesToHex } from "@/lib/encoding";
import { HASH_ALGORITHMS, hashAlgorithmById, type HashAlgorithm } from "@/lib/hashing";
import { decodeHmacKey, hmacDigest, type DigestEncoding, type HmacKeyEncoding } from "./logic";

const SAMPLE = "The quick brown fox jumps over the lazy dog";

export default function HmacTool() {
  const [message, setMessage] = useState(SAMPLE);
  const [key, setKey] = useState("");
  const [keyEncoding, setKeyEncoding] = useState<HmacKeyEncoding>("text");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("sha256");
  const [output, setOutput] = useState<DigestEncoding>("hex");

  const result = useMemo(() => {
    if (!key) return { value: "", error: "" };
    try {
      const keyBytes = decodeHmacKey(key, keyEncoding);
      return { value: hmacDigest(algorithm, keyBytes, message, output), error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not compute the HMAC",
      };
    }
  }, [algorithm, key, keyEncoding, message, output]);

  const info = hashAlgorithmById.get(algorithm);

  return (
    <ToolGrid>
      <Panel
        title="Message and key"
        description="The key is read in the chosen encoding. Nothing leaves the browser."
      >
        <div className="space-y-3">
          <Field label="Message">
            <TextArea
              mono
              rows={8}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message to authenticate…"
              aria-label="Message to authenticate"
            />
          </Field>

          <Field
            label="Key"
            hint={
              keyEncoding === "hex"
                ? "Whitespace, colons, and hyphens are ignored."
                : keyEncoding === "base64"
                  ? "Standard and URL-safe Base64 are accepted."
                  : "Text is encoded as UTF-8 bytes."
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setKey(bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
                  setKeyEncoding("hex");
                }}
              >
                <KeyRound className="size-3.5" aria-hidden />
                Random key
              </Button>
            }
          >
            <Input
              type="text"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={keyEncoding === "text" ? "Shared secret" : "Encoded key"}
              autoComplete="off"
              spellCheck={false}
              aria-label="HMAC key"
            />
          </Field>

          <Segmented
            label="Key encoding"
            value={keyEncoding}
            onChange={(value) => setKeyEncoding(value)}
            options={[
              { value: "text", label: "Text" },
              { value: "hex", label: "Hex" },
              { value: "base64", label: "Base64" },
            ]}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Hash algorithm"
              value={algorithm}
              onChange={(value) => setAlgorithm(value as HashAlgorithm)}
              options={HASH_ALGORITHMS.map((item) => ({
                value: item.id,
                label: `${item.label} · ${item.bits} bit`,
              }))}
            />
            <Select
              label="Output encoding"
              value={output}
              onChange={(value) => setOutput(value as DigestEncoding)}
              options={[
                { value: "hex", label: "Hexadecimal" },
                { value: "base64", label: "Base64" },
              ]}
            />
          </div>

          {info?.weak ? (
            <Alert tone="warning" title="Legacy algorithm">
              {info.label} is kept for compatibility. Prefer SHA-256 or stronger for new systems.
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="HMAC"
        description={`${info?.label ?? algorithm} · ${output === "hex" ? "hex" : "base64"}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setMessage(SAMPLE)}>
            <Sparkles className="size-3.5" aria-hidden />
            Sample
          </Button>
        }
      >
        <div className="space-y-3">
          {result.error ? (
            <Alert tone="danger" title="Key error">
              {result.error}
            </Alert>
          ) : null}
          {!key ? (
            <Alert tone="info" title="Enter a key">
              HMAC needs a shared key. Use a random key for real systems and keep it out of logs.
            </Alert>
          ) : null}
          <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Fingerprint className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <code className="min-w-0 break-all font-mono text-xs text-text">
              {result.value || "Output appears here"}
            </code>
          </div>
          <CodeOutput
            value={result.value}
            language={output}
            filename={`hmac-${algorithm}.txt`}
            maxHeight={220}
          />
          <p className="text-xs leading-relaxed text-faint">
            HMAC authenticates a message with a shared key. Anyone with the key can compute the
            same value, so distribute it over a trusted channel.
          </p>
        </div>
      </Panel>
    </ToolGrid>
  );
}
