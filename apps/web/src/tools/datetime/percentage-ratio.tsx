import { useMemo, useState } from "react";
import { Alert, Badge, CopyButton, Field, Input, Panel, Segmented, ToolGrid, ToolStack } from "@/components/ui";
import {
  RatioError,
  parseRatioParts,
  percentChange,
  percentOf,
  simplifyRatio,
  splitByRatio,
} from "./logic";

type Mode = "percent" | "change" | "ratio" | "parts";

const DECIMAL_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

function numberFromInput(text: string, label: string): number {
  const trimmed = text.trim();
  if (!trimmed) throw new RatioError(`Enter a ${label.toLowerCase()}.`);
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new RatioError(`${label} must be a number.`);
  return value;
}

interface Detail {
  label: string;
  value: string;
}

interface Outcome {
  error: string;
  headline: string;
  badge: string;
  details: Detail[];
}

const EMPTY_OUTCOME: Outcome = { error: "", headline: "", badge: "", details: [] };

export default function PercentageRatioTool() {
  const [mode, setMode] = useState<Mode>("percent");
  const [percent, setPercent] = useState("15");
  const [value, setValue] = useState("200");
  const [from, setFrom] = useState("50");
  const [to, setTo] = useState("75");
  const [ratioInput, setRatioInput] = useState("1920:1080");
  const [total, setTotal] = useState("100");
  const [partsInput, setPartsInput] = useState("3:2:1");

  const outcome = useMemo<Outcome>(() => {
    try {
      if (mode === "percent") {
        const p = numberFromInput(percent, "Percent");
        const v = numberFromInput(value, "Value");
        const amount = percentOf(p, v);
        return {
          error: "",
          headline: DECIMAL_FORMATTER.format(amount),
          badge: `${DECIMAL_FORMATTER.format(p)}% of ${DECIMAL_FORMATTER.format(v)}`,
          details: [
            { label: "Calculation", value: `(${p} / 100) × ${v}` },
            { label: "Rounded", value: DECIMAL_FORMATTER.format(Math.round(amount)) },
          ],
        };
      }

      if (mode === "change") {
        const start = numberFromInput(from, "Starting value");
        const end = numberFromInput(to, "Ending value");
        const change = percentChange(start, end);
        return {
          error: "",
          headline: `${change >= 0 ? "+" : ""}${DECIMAL_FORMATTER.format(change)}%`,
          badge: change >= 0 ? "Increase" : "Decrease",
          details: [
            { label: "Absolute change", value: DECIMAL_FORMATTER.format(end - start) },
            { label: "Multiplier", value: `${DECIMAL_FORMATTER.format(end / start)}×` },
            {
              label: "Reverse change",
              value: end === 0 ? "undefined" : `${DECIMAL_FORMATTER.format(((start - end) / Math.abs(end)) * 100)}%`,
            },
          ],
        };
      }

      if (mode === "ratio") {
        const parsed = parseRatioParts(ratioInput);
        if (parsed.length !== 2) throw new RatioError("Simplify exactly two values, such as 16:9.");
        const simplified = simplifyRatio(parsed[0], parsed[1]);
        const text = `${simplified.left}:${simplified.right}`;
        return {
          error: "",
          headline: text,
          badge: "Simplified ratio",
          details: [
            { label: "Decimal", value: DECIMAL_FORMATTER.format(simplified.left / simplified.right) },
            { label: "Inverse", value: `${simplified.right}:${simplified.left}` },
            { label: "As percentage", value: `${DECIMAL_FORMATTER.format((simplified.left / simplified.right) * 100)}%` },
          ],
        };
      }

      const totalValue = numberFromInput(total, "Total");
      const parts = parseRatioParts(partsInput);
      const amounts = splitByRatio(totalValue, parts);
      const sum = parts.reduce((acc, part) => acc + part, 0);
      return {
        error: "",
        headline: amounts.map((amount) => DECIMAL_FORMATTER.format(amount)).join(" · "),
        badge: `${parts.length}-way split of ${DECIMAL_FORMATTER.format(totalValue)}`,
        details: amounts.map((amount, index) => ({
          label: `Part ${index + 1} · ${DECIMAL_FORMATTER.format((parts[index] / sum) * 100)}%`,
          value: DECIMAL_FORMATTER.format(amount),
        })),
      };
    } catch (error) {
      return {
        ...EMPTY_OUTCOME,
        error: error instanceof Error ? error.message : "Could not compute that value",
      };
    }
  }, [from, mode, partsInput, percent, ratioInput, to, total, value]);

  return (
    <ToolStack>
      <Segmented
        label="Calculation"
        value={mode}
        onChange={setMode}
        options={[
          { value: "percent", label: "Percent of" },
          { value: "change", label: "Change" },
          { value: "ratio", label: "Ratio" },
          { value: "parts", label: "Parts" },
        ]}
      />

      <ToolGrid>
        <Panel title="Inputs" description="Decimals are accepted; results are rounded only for display.">
          <div className="space-y-3">
            {mode === "percent" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Percent" htmlFor="percent-input">
                  <Input
                    id="percent-input"
                    className="font-mono"
                    value={percent}
                    onChange={(event) => setPercent(event.target.value)}
                    inputMode="decimal"
                    aria-label="Percent"
                  />
                </Field>
                <Field label="Of value" htmlFor="percent-value">
                  <Input
                    id="percent-value"
                    className="font-mono"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    inputMode="decimal"
                    aria-label="Value"
                  />
                </Field>
              </div>
            ) : null}

            {mode === "change" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor="change-from">
                  <Input
                    id="change-from"
                    className="font-mono"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    inputMode="decimal"
                    aria-label="Starting value"
                  />
                </Field>
                <Field label="To" htmlFor="change-to">
                  <Input
                    id="change-to"
                    className="font-mono"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    inputMode="decimal"
                    aria-label="Ending value"
                  />
                </Field>
              </div>
            ) : null}

            {mode === "ratio" ? (
              <Field
                label="Ratio"
                htmlFor="ratio-input"
                hint="For aspect ratios or any pair of positive numbers, decimals included."
              >
                <Input
                  id="ratio-input"
                  className="font-mono"
                  value={ratioInput}
                  onChange={(event) => setRatioInput(event.target.value)}
                  placeholder="1920:1080"
                  aria-label="Ratio to simplify"
                />
              </Field>
            ) : null}

            {mode === "parts" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Total" htmlFor="parts-total">
                  <Input
                    id="parts-total"
                    className="font-mono"
                    value={total}
                    onChange={(event) => setTotal(event.target.value)}
                    inputMode="decimal"
                    aria-label="Total to split"
                  />
                </Field>
                <Field label="Ratio" htmlFor="parts-ratio" hint="For example 3:2:1.">
                  <Input
                    id="parts-ratio"
                    className="font-mono"
                    value={partsInput}
                    onChange={(event) => setPartsInput(event.target.value)}
                    aria-label="Ratio for splitting"
                  />
                </Field>
              </div>
            ) : null}

            <p className="text-xs text-faint">
              {mode === "percent"
                ? "Percent of multiplies the value by the percentage."
                : mode === "change"
                  ? "Change uses the starting value as the baseline; a zero baseline is undefined."
                  : mode === "ratio"
                    ? "Ratios are reduced with the greatest common divisor."
                    : "The total is divided in proportion to the ratio values."}
            </p>
          </div>
        </Panel>

        <Panel title="Result" flush>
          <div className="space-y-3 p-4">
            {outcome.error ? (
              <Alert tone="danger" title="Invalid input">
                {outcome.error}
              </Alert>
            ) : (
              <>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="accent">{outcome.badge}</Badge>
                    <CopyButton value={outcome.headline} size="icon" label="Copy result" />
                  </div>
                  <p className="mt-2 break-all font-mono text-2xl font-semibold text-text">
                    {outcome.headline}
                  </p>
                </div>

                <div className="space-y-2">
                  {outcome.details.map((detail) => (
                    <div key={detail.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted">{detail.label}</span>
                      <span className="font-mono text-xs text-text">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
