import { useMemo, useState } from "react";
import {
  Alert,
  EmptyState,
  Field,
  Panel,
  Segmented,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { NumberField } from "./fields";
import {
  convertLengthBatch,
  formatLength,
  type LengthDirection,
} from "./logic";

const SAMPLE = "16px\n24px\n32px\n1.5rem";

export default function PxRemTool() {
  const [base, setBase] = useState(16);
  const [direction, setDirection] = useState<LengthDirection>("px-to-rem");
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(
    () => convertLengthBatch(input, base, direction),
    [input, base, direction],
  );
  const summary = Number.isFinite(base) && base > 0
    ? `${result.rows.length} converted ${result.rows.length === 1 ? "value" : "values"} at a ${formatLength(base)}px root.`
    : "Enter a positive base font size to convert values.";

  return (
    <ToolGrid>
      <Panel title="Conversion" description="Convert one value per line in either direction.">
        <div className="space-y-4">
          <NumberField
            label="Base font size"
            value={base}
            min={1}
            step={0.5}
            onChange={setBase}
            hint="Root font size in pixels; 16 is the browser default."
          />

          <Segmented<LengthDirection>
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "px-to-rem", label: "px → rem" },
              { value: "rem-to-px", label: "rem → px" },
            ]}
          />

          <Field
            label="Values"
            hint="Accepts px and rem suffixes. Unitless values follow the selected direction."
          >
            <TextArea
              mono
              rows={12}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={"16\n24px\n1.5rem"}
              aria-label="Values to convert"
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Results"
        description={summary}
      >
        <div className="space-y-3">
          {result.errors.length > 0 ? (
            <Alert tone="danger" title="Some values could not be converted">
              <ul className="list-disc pl-4">
                {result.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {result.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
                  <tr>
                    <th className="px-3 py-2">Input</th>
                    <th className="px-3 py-2">px</th>
                    <th className="px-3 py-2">rem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-xs text-text">
                  {result.rows.map((row, index) => (
                    <tr key={`${row.input}-${index}`}>
                      <td className="px-3 py-2 text-muted">{row.input}</td>
                      <td className="px-3 py-2">{formatLength(row.px)}</td>
                      <td className="px-3 py-2">{formatLength(row.rem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : result.errors.length === 0 ? (
            <EmptyState
              title="No values yet"
              description="Enter px or rem values to build the conversion table."
            />
          ) : null}
        </div>
      </Panel>
    </ToolGrid>
  );
}
