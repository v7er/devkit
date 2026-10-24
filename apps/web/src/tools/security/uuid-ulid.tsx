import { useState } from "react";
import { Fingerprint, Layers, Sparkles } from "lucide-react";
import {
  Alert,
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
  errorMessage,
  formatUlid,
  formatUuid,
  generateUlid,
  generateUuidV4,
  uuidV5,
} from "./logic";

type Mode = "uuid-v4" | "uuid-v5" | "ulid";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const MAX_COUNT = 100;

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "uuid-v4", label: "UUID v4" },
  { value: "uuid-v5", label: "UUID v5" },
  { value: "ulid", label: "ULID" },
];

export default function UuidUlidTool() {
  const [mode, setMode] = useState<Mode>("uuid-v4");
  const [count, setCount] = useState("5");
  const [namespace, setNamespace] = useState(DNS_NAMESPACE);
  const [name, setName] = useState("www.example.com");
  const [uppercase, setUppercase] = useState(false);
  const [braces, setBraces] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState("");

  function changeMode(next: Mode) {
    setMode(next);
    setValues([]);
    setError("");
  }

  function parseCount(): number {
    const trimmed = count.trim();
    if (!/^\d+$/.test(trimmed)) throw new Error("Count must be a whole number");
    const value = Number(trimmed);
    if (value < 1 || value > MAX_COUNT) {
      throw new Error(`Count must be between 1 and ${MAX_COUNT}`);
    }
    return value;
  }

  function handleGenerate() {
    try {
      let generated: string[];
      if (mode === "uuid-v5") {
        generated = [uuidV5(namespace, name)];
      } else {
        const total = parseCount();
        generated = Array.from({ length: total }, () =>
          mode === "uuid-v4" ? generateUuidV4() : generateUlid(),
        );
      }
      setValues(generated);
      setError("");
    } catch (caught) {
      setValues([]);
      setError(errorMessage(caught, "Could not generate an identifier"));
    }
  }

  function renderValue(value: string): string {
    if (mode === "ulid") return formatUlid(value, uppercase);
    return formatUuid(value, { uppercase, braces, hyphens });
  }

  const output = values.map(renderValue).join("\n");
  const isUuid = mode !== "ulid";

  return (
    <ToolGrid>
      <Panel
        title="Generator"
        description="Identifiers come from Web Crypto randomness or the UUID v5 SHA-1 namespace rule."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setValues([])} disabled={!values.length}>
            Clear
          </Button>
        }
      >
        <div className="space-y-3">
          <Segmented label="Type" value={mode} onChange={changeMode} options={MODE_OPTIONS} />

          {mode === "uuid-v5" ? (
            <>
              <Field label="Namespace" hint="A UUID used as the v5 hashing namespace.">
                <Input
                  value={namespace}
                  onChange={(event) => setNamespace(event.target.value)}
                  placeholder={DNS_NAMESPACE}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="UUID v5 namespace"
                />
              </Field>
              <Field label="Name" hint="The same namespace and name always produce the same UUID.">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="www.example.com"
                  autoComplete="off"
                  aria-label="UUID v5 name"
                />
              </Field>
              <Alert tone="info" title="Deterministic output">
                UUID v5 hashes the namespace and name. It is reproducible, so it is not suitable
                for secrets.
              </Alert>
            </>
          ) : (
            <Field label="Count" hint={`Generate between 1 and ${MAX_COUNT} identifiers.`}>
              <Input
                type="number"
                min={1}
                max={MAX_COUNT}
                value={count}
                onChange={(event) => setCount(event.target.value)}
                aria-label="Identifier count"
              />
            </Field>
          )}

          <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
            <Toggle
              checked={uppercase}
              onChange={setUppercase}
              label="Uppercase"
              description="Render hexadecimal or Base32 letters in upper case."
            />
            {isUuid ? (
              <>
                <Toggle
                  checked={hyphens}
                  onChange={setHyphens}
                  label="Hyphens"
                  description="Group the UUID into 8-4-4-4-12 segments."
                />
                <Toggle
                  checked={braces}
                  onChange={setBraces}
                  label="Braces"
                  description="Wrap each UUID in curly braces."
                />
              </>
            ) : null}
          </div>

          <Button variant="primary" onClick={handleGenerate}>
            <Sparkles className="size-4" aria-hidden />
            Generate
          </Button>

          {error ? (
            <Alert tone="danger" title="Cannot generate">
              {error}
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Output"
        description={values.length ? `${values.length} generated` : "Nothing generated yet"}
        flush
      >
        <div className="space-y-3 p-4">
          {values.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  <Fingerprint className="size-3" aria-hidden />
                  {mode === "ulid" ? "ULID" : mode === "uuid-v4" ? "UUID v4" : "UUID v5"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  <Layers className="size-3" aria-hidden />
                  {values.length} {values.length === 1 ? "value" : "values"}
                </span>
              </div>
              <CodeOutput
                value={output}
                language={mode === "ulid" ? "ulid" : "uuid"}
                filename={`${mode}.txt`}
                maxHeight={420}
              />
              <p className="text-xs leading-relaxed text-faint">
                {mode === "ulid"
                  ? "ULIDs sort by time: the first 10 characters encode milliseconds since the Unix epoch, and the rest is random."
                  : "UUID v4 values are random. UUID v5 values are derived from the namespace and name and do not change."}
              </p>
            </>
          ) : (
            <EmptyState
              icon={<Fingerprint className="size-6" aria-hidden />}
              title="No identifiers yet"
              description="Choose a type and select Generate to create values locally."
            />
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
