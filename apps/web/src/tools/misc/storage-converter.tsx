import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Slider,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  convertBytes,
  formatQuantity,
  parseSize,
  parseSizeBatch,
  type ConversionSystem,
} from "./logic";

const SYSTEMS: ConversionSystem[] = ["SI bytes", "IEC bytes", "SI bits", "IEC bits"];

interface ParsedSize {
  bytes: number | null;
  error: string;
}

export default function StorageConverterTool() {
  const [input, setInput] = useState("1.5 GiB");
  const [precision, setPrecision] = useState(6);
  const [batch, setBatch] = useState("512 MB\n1.5 GiB\n8 bit\n1,000,000 B");

  const parsed = useMemo<ParsedSize>(() => {
    try {
      return { bytes: parseSize(input), error: "" };
    } catch (error) {
      return {
        bytes: null,
        error: error instanceof Error ? error.message : "Could not parse this size.",
      };
    }
  }, [input]);

  const rows = useMemo(
    () => (parsed.bytes === null ? [] : convertBytes(parsed.bytes, precision)),
    [parsed.bytes, precision],
  );

  const summary = useMemo(
    () => rows.map((row) => `${row.value} ${row.unit} (${row.system})`).join("\n"),
    [rows],
  );

  const batchRows = useMemo(() => parseSizeBatch(batch, precision), [batch, precision]);
  const batchErrors = batchRows.filter((row) => row.error).length;

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Size"
          description="One value in bytes or bits. SI uses powers of 1000; IEC uses powers of 1024."
        >
          <div className="space-y-4">
            <Field
              label="Value"
              hint="Examples: 1500 MB, 1.5 GiB, 8 bit, 2,000,000 B, 1e9 bytes."
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="1.5 GiB"
                aria-label="Size to convert"
                className="font-mono"
                spellCheck={false}
              />
            </Field>

            <Slider
              label="Decimal places"
              value={precision}
              min={0}
              max={12}
              onChange={setPrecision}
            />

            {parsed.error ? (
              <Alert tone="danger" title="Invalid size">
                {parsed.error}
              </Alert>
            ) : parsed.bytes !== null ? (
              <Alert tone="success" title="Parsed value">
                {formatQuantity(parsed.bytes, 12)} bytes. This number is exact when the input is a
                whole number of bytes; bit inputs are divided by 8.
              </Alert>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Conversions"
          description="Every unit uses the same value, shown with the chosen precision."
          actions={
            <CopyButton value={summary} label="Copy all" disabled={rows.length === 0} />
          }
        >
          {parsed.bytes === null ? (
            <EmptyState
              title="Nothing to convert"
              description="Fix the size on the left to see SI and IEC conversions."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {SYSTEMS.map((system) => (
                <div key={system} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted">{system}</p>
                  <dl className="mt-2 space-y-1.5">
                    {rows
                      .filter((row) => row.system === system)
                      .map((row) => (
                        <div key={row.unit} className="flex items-baseline justify-between gap-3">
                          <dt className="font-mono text-[12px] text-faint">{row.unit}</dt>
                          <dd className="break-all text-right font-mono text-xs text-text">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </ToolGrid>

      <Panel
        title="Batch conversion"
        description="One size per line. Invalid lines are reported without stopping the rest."
        actions={
          <Badge>
            {batchRows.length} {batchRows.length === 1 ? "line" : "lines"}
            {batchErrors > 0 ? ` · ${batchErrors} invalid` : ""}
          </Badge>
        }
      >
        <div className="space-y-3">
          <Field
            label="Sizes"
            hint="Parsed against the same unit table. Blank lines are ignored."
          >
            <TextArea
              mono
              rows={5}
              value={batch}
              onChange={(event) => setBatch(event.target.value)}
              aria-label="Sizes to convert, one per line"
            />
          </Field>

          {batchErrors > 0 ? (
            <Alert tone="warning" title={`${batchErrors} line${batchErrors === 1 ? "" : "s"} could not be parsed`}>
              Check the highlighted rows. Each line needs a number and an optional known unit.
            </Alert>
          ) : null}

          {batchRows.length === 0 ? (
            <EmptyState
              title="No sizes entered"
              description="Add one size per line to build a conversion table."
            />
          ) : (
            <div className="overflow-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-surface-2 text-faint">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Input</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Bytes</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Best SI</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Best IEC</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((row, index) => (
                    <tr
                      key={`${row.input}-${index}`}
                      className={row.error ? "border-t border-line/70 bg-danger-soft/40" : "border-t border-line/70"}
                    >
                      <td className="px-3 py-2 font-mono text-text">{row.input}</td>
                      <td className="px-3 py-2 font-mono text-muted">
                        {row.bytes === null ? "—" : formatQuantity(row.bytes, precision)}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted">{row.si || "—"}</td>
                      <td className="px-3 py-2 font-mono text-muted">{row.iec || "—"}</td>
                      <td className={row.error ? "px-3 py-2 text-danger" : "px-3 py-2 text-faint"}>
                        {row.error || "Parsed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Alert tone="info" title="SI and IEC are different on purpose">
            A kilobyte (kB) is 1000 bytes; a kibibyte (KiB) is 1024 bytes. Disk vendors usually use
            SI, while operating systems often show IEC values labelled with SI names.
          </Alert>
        </div>
      </Panel>
    </ToolStack>
  );
}
