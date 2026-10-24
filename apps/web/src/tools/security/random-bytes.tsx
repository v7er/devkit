import { useState } from "react";
import { Dices, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  EmptyState,
  Field,
  Input,
  Panel,
  Segmented,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import {
  RANDOM_BYTES_MAX,
  errorMessage,
  formatRandomBytes,
  generateRandomBytes,
  parseRandomByteSize,
  type RandomBytesEncoding,
} from "./logic";

const ENCODING_OPTIONS: Array<{ value: RandomBytesEncoding; label: string }> = [
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
  { value: "decimal", label: "Decimal" },
];

export default function RandomBytesTool() {
  const [size, setSize] = useState("32");
  const [encoding, setEncoding] = useState<RandomBytesEncoding>("hex");
  const [uppercase, setUppercase] = useState(false);
  const [output, setOutput] = useState("");
  const [byteCount, setByteCount] = useState(0);
  const [error, setError] = useState("");

  function handleGenerate() {
    try {
      const count = parseRandomByteSize(size);
      setOutput(formatRandomBytes(generateRandomBytes(count), encoding, uppercase));
      setByteCount(count);
      setError("");
    } catch (caught) {
      setOutput("");
      setByteCount(0);
      setError(errorMessage(caught, "Could not generate random bytes"));
    }
  }

  return (
    <ToolGrid>
      <Panel title="Settings" description="Source: crypto.getRandomValues, seeded by the OS.">
        <div className="space-y-3">
          <Field
            label="Size"
            hint={`Between 1 and ${RANDOM_BYTES_MAX.toLocaleString("en-US")} bytes.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={RANDOM_BYTES_MAX}
              value={size}
              onChange={(event) => setSize(event.target.value)}
              aria-label="Number of random bytes"
            />
          </Field>

          <Segmented
            label="Output encoding"
            value={encoding}
            onChange={(value) => {
              setEncoding(value);
              setOutput("");
              setError("");
            }}
            options={ENCODING_OPTIONS}
          />

          {encoding === "hex" ? (
            <Toggle
              checked={uppercase}
              onChange={(checked) => {
                setUppercase(checked);
                setOutput("");
              }}
              label="Uppercase hex"
              description="Render A–F in upper case."
            />
          ) : null}

          <Button variant="primary" onClick={handleGenerate}>
            <Sparkles className="size-4" aria-hidden />
            Generate bytes
          </Button>

          {error ? (
            <Alert tone="danger" title="Cannot generate">
              {error}
            </Alert>
          ) : null}

          <Alert tone="info" title="Cryptographic randomness">
            The browser fills the buffer from its secure random source. These bytes are suitable for
            keys, salts, and nonces when the requested size matches the algorithm.
          </Alert>

          <p className="text-xs leading-relaxed text-faint">
            Decimal output separates every byte with a space. Hex and Base64 outputs are continuous
            and ready to copy.
          </p>
        </div>
      </Panel>

      <Panel
        title="Output"
        description={output ? `${byteCount} bytes · ${encoding}` : "Nothing generated yet"}
        flush
      >
        <div className="space-y-3 p-4">
          {output ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{byteCount * 8} bits</Badge>
                <Badge tone="neutral">{encoding}</Badge>
                <Badge tone="neutral">{output.length} characters</Badge>
              </div>
              <CodeOutput
                value={output}
                language={encoding}
                filename={`random-${byteCount}-bytes.txt`}
                maxHeight={420}
              />
            </>
          ) : (
            <EmptyState
              icon={<Dices className="size-6" aria-hidden />}
              title="No bytes yet"
              description="Choose a size and encoding, then generate values from the OS random source."
            />
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
