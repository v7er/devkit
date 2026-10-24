import { useMemo, useState } from "react";
import { Alert, Badge, CopyButton, Field, Input, Panel, Select, Toggle, ToolGrid, ToolStack } from "@/components/ui";
import { formatIntegerInBase, integerBitLength, parseIntegerInBase } from "./logic";

const BASE_NAMES: Record<number, string> = {
  2: "Binary",
  8: "Octal",
  10: "Decimal",
  16: "Hexadecimal",
  36: "Base 36",
};

const BASE_OPTIONS = Array.from({ length: 35 }, (_, index) => {
  const base = index + 2;
  return { value: String(base), label: BASE_NAMES[base] ?? `Base ${base}` };
});

const GROUP_OPTIONS = [
  { value: "0", label: "No grouping" },
  { value: "4", label: "Groups of 4" },
  { value: "8", label: "Groups of 8" },
];

export default function BaseConverterTool() {
  const [input, setInput] = useState("255");
  const [fromBase, setFromBase] = useState("10");
  const [groupSize, setGroupSize] = useState("0");
  const [uppercase, setUppercase] = useState(false);
  const [allowNegative, setAllowNegative] = useState(true);

  const analysis = useMemo(() => {
    try {
      const base = Number(fromBase);
      const value = parseIntegerInBase(input, base, { allowNegative });
      const groups = new Set([2, 8, 10, 16, base]);
      const rows = [...groups]
        .sort((a, b) => a - b)
        .map((rowBase) => ({
          base: rowBase,
          label: BASE_NAMES[rowBase] ?? `Base ${rowBase}`,
          value: formatIntegerInBase(value, rowBase, {
            uppercase,
            groupSize: Number(groupSize),
            prefix: rowBase === 2 || rowBase === 8 || rowBase === 16,
          }),
        }));
      return { rows, error: "", bits: integerBitLength(value) };
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : "Could not convert this number",
        bits: 0,
      };
    }
  }, [allowNegative, fromBase, groupSize, input, uppercase]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Number" description="Digits 0–9 and a–z, with optional 0x, 0o, or 0b prefixes.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
              <Field label="Value" htmlFor="base-input" hint="Spaces and underscores are ignored.">
                <Input
                  id="base-input"
                  className="font-mono"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="255 or 0xFF"
                  spellCheck={false}
                  aria-label="Number to convert"
                />
              </Field>
              <Select
                label="Input base"
                value={fromBase}
                onChange={setFromBase}
                options={BASE_OPTIONS}
              />
            </div>

            <Select label="Digit grouping" value={groupSize} onChange={setGroupSize} options={GROUP_OPTIONS} />

            <div className="space-y-3 border-t border-line pt-3">
              <Toggle
                label="Uppercase digits"
                description="Show A–Z instead of a–z for bases above 10."
                checked={uppercase}
                onChange={setUppercase}
              />
              <Toggle
                label="Allow negative values"
                description="A leading minus sign keeps its sign in every base."
                checked={allowNegative}
                onChange={setAllowNegative}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="Conversions"
          description={
            analysis.error
              ? "Fix the input to see conversions."
              : `Bit length: ${analysis.bits} · sign-aware BigInt math`
          }
          flush
        >
          <div className="space-y-3 p-4">
            {analysis.error ? (
              <Alert tone="danger" title="Invalid number">
                {analysis.error}
              </Alert>
            ) : null}
            {analysis.rows.length > 0 ? (
              <div className="space-y-2">
                {analysis.rows.map((row) => (
                  <div
                    key={row.base}
                    className="flex items-start justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                        {row.label}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-sm text-text">{row.value}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {row.base === Number(fromBase) ? <Badge tone="accent">Input</Badge> : null}
                      <CopyButton
                        value={row.value}
                        size="icon"
                        variant="ghost"
                        label={`Copy ${row.label} value`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : !analysis.error ? (
              <p className="text-sm text-faint">Enter a number to see it in other bases.</p>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
