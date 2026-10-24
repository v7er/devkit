import { useState } from "react";
import { Dices } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  ToolGrid,
  ToolStack,
  Toggle,
} from "@/components/ui";
import {
  cryptoRandomSource,
  mulberry32,
  randomFloat,
  randomInteger,
  randomUniqueIntegers,
  seedFromText,
  type RandomSource,
} from "./logic";

type Mode = "integer" | "float";

const MODES: Array<{ value: Mode; label: string }> = [
  { value: "integer", label: "Integers" },
  { value: "float", label: "Floats" },
];

const PLACES_OPTIONS = [
  { value: "0", label: "0 decimals" },
  { value: "1", label: "1 decimal" },
  { value: "2", label: "2 decimals" },
  { value: "3", label: "3 decimals" },
  { value: "4", label: "4 decimals" },
  { value: "6", label: "6 decimals" },
];

interface Generated {
  values: string[];
  error: string;
}

const EMPTY_GENERATED: Generated = { values: [], error: "" };

function parseBound(text: string, label: string, integer: boolean): number {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`Enter a ${label.toLowerCase()}.`);
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`The ${label.toLowerCase()} must be a finite number.`);
  if (integer && !Number.isSafeInteger(value)) {
    throw new Error(`The ${label.toLowerCase()} must be a whole number.`);
  }
  return value;
}

function parseCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Enter how many values to generate.");
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Count must be a whole number of at least 1.");
  }
  return value;
}

export default function RandomNumberTool() {
  const [mode, setMode] = useState<Mode>("integer");
  const [minInput, setMinInput] = useState("1");
  const [maxInput, setMaxInput] = useState("100");
  const [countInput, setCountInput] = useState("5");
  const [precision, setPrecision] = useState("2");
  const [unique, setUnique] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState("devkit");
  const [generated, setGenerated] = useState<Generated>(EMPTY_GENERATED);

  function generate() {
    try {
      const integer = mode === "integer";
      const min = parseBound(minInput, "Minimum", integer);
      const max = parseBound(maxInput, "Maximum", integer);
      const count = parseCount(countInput);
      const places = Number(precision);

      if (integer && unique && max - min + 1 < count) {
        throw new Error(`Cannot pick ${count} unique values from a range of ${max - min + 1}.`);
      }

      const source: RandomSource = seeded ? mulberry32(seedFromText(seed)) : cryptoRandomSource();
      const values = integer
        ? unique
          ? randomUniqueIntegers(source, min, max, count)
          : Array.from({ length: count }, () => randomInteger(source, min, max))
        : Array.from({ length: count }, () => randomFloat(source, min, max));

      const formatted = values.map((value) => (integer ? String(value) : value.toFixed(places)));
      setGenerated({ values: formatted, error: "" });
    } catch (error) {
      setGenerated({
        values: [],
        error: error instanceof Error ? error.message : "Could not generate values",
      });
    }
  }

  const integer = mode === "integer";
  const output = generated.values.join("\n");

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Settings" description="Uniform values from the range you choose.">
          <div className="space-y-4">
            <Segmented label="Kind" value={mode} onChange={setMode} options={MODES} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum" htmlFor="random-min">
                <Input
                  id="random-min"
                  inputMode="decimal"
                  value={minInput}
                  onChange={(event) => setMinInput(event.target.value)}
                />
              </Field>
              <Field
                label="Maximum"
                htmlFor="random-max"
                hint={integer ? "Inclusive." : "Exclusive for floats."}
              >
                <Input
                  id="random-max"
                  inputMode="decimal"
                  value={maxInput}
                  onChange={(event) => setMaxInput(event.target.value)}
                />
              </Field>
            </div>

            <Field label="How many values" htmlFor="random-count">
              <Input
                id="random-count"
                inputMode="numeric"
                value={countInput}
                onChange={(event) => setCountInput(event.target.value)}
              />
            </Field>

            {integer ? (
              <Toggle
                checked={unique}
                onChange={setUnique}
                label="Unique values"
                description="Never repeat a value inside one batch."
              />
            ) : (
              <Select
                label="Decimal places"
                value={precision}
                onChange={setPrecision}
                options={PLACES_OPTIONS}
              />
            )}

            <Toggle
              checked={seeded}
              onChange={setSeeded}
              label="Seeded generator"
              description="The same seed and settings always produce the same sequence."
            />

            {seeded ? (
              <Field
                label="Seed"
                htmlFor="random-seed"
                hint="Any text; numbers are used directly as a 32-bit seed."
              >
                <Input
                  id="random-seed"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
              </Field>
            ) : null}

            <Button variant="primary" onClick={generate} className="w-full">
              <Dices className="size-4" aria-hidden />
              Generate
            </Button>
          </div>
        </Panel>

        <Panel title="Results" description="One value per line.">
          <div className="space-y-3">
            {generated.error ? <Alert tone="danger">{generated.error}</Alert> : null}

            {!seeded ? (
              <Alert tone="info">
                Values come from <code className="font-mono">crypto.getRandomValues</code>, so
                they are suitable for tokens and test fixtures. They are not a substitute for a
                password manager.
              </Alert>
            ) : (
              <Alert tone="warning">
                A seeded sequence is reproducible and therefore predictable. Use it for tests and
                simulations, not for secrets.
              </Alert>
            )}

            <CodeOutput
              value={output}
              placeholder="Press Generate to draw values"
              language={integer ? "integers" : "floats"}
              filename="random-values.txt"
              maxHeight={320}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
