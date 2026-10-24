import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  CopyButton,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  computeBitwise,
  formatBinary,
  parseIntegerAuto,
  toSigned,
  toUnsigned,
  type BitWidth,
  type BitwiseOperation,
} from "./logic";

const OPERATIONS: Array<{ value: BitwiseOperation; label: string }> = [
  { value: "and", label: "AND (A & B)" },
  { value: "or", label: "OR (A | B)" },
  { value: "xor", label: "XOR (A ^ B)" },
  { value: "not", label: "NOT (~A)" },
  { value: "shl", label: "Shift left (A << B)" },
  { value: "shr", label: "Shift right (A >> B)" },
];

const WIDTHS: Array<{ value: string; label: string }> = [
  { value: "8", label: "8-bit" },
  { value: "16", label: "16-bit" },
  { value: "32", label: "32-bit" },
  { value: "64", label: "64-bit" },
];

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <p className="mt-0.5 break-all font-mono text-sm text-text">{value}</p>
      </div>
      <CopyButton value={value} size="icon" label={`Copy ${label.toLowerCase()}`} />
    </div>
  );
}

export default function BitwiseTool() {
  const [leftInput, setLeftInput] = useState("0b1100");
  const [rightInput, setRightInput] = useState("0b1010");
  const [operation, setOperation] = useState<BitwiseOperation>("and");
  const [widthValue, setWidthValue] = useState("8");

  const analysis = useMemo(() => {
    try {
      const width = Number(widthValue) as BitWidth;
      const left = parseIntegerAuto(leftInput).value;
      const right = parseIntegerAuto(rightInput).value;
      const result = computeBitwise(operation, left, right, width);
      return {
        error: "",
        width,
        left,
        right,
        result,
        leftBinary: formatBinary(left, width),
        rightBinary: formatBinary(right, width),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not compute this operation",
        width: Number(widthValue) as BitWidth,
        left: 0n,
        right: 0n,
        result: null,
        leftBinary: "",
        rightBinary: "",
      };
    }
  }, [leftInput, operation, rightInput, widthValue]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Operands" description="Values are masked to the selected width before the operation.">
          <div className="space-y-4">
            <Select
              label="Operation"
              value={operation}
              onChange={(value) => setOperation(value as BitwiseOperation)}
              options={OPERATIONS}
            />
            <Segmented
              label="Width"
              value={widthValue}
              onChange={setWidthValue}
              options={WIDTHS}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Operand A" htmlFor="bitwise-a">
                <Input
                  id="bitwise-a"
                  className="font-mono"
                  value={leftInput}
                  onChange={(event) => setLeftInput(event.target.value)}
                  placeholder="0b1100"
                  spellCheck={false}
                  aria-label="Operand A"
                />
              </Field>
              <Field label="Operand B" htmlFor="bitwise-b">
                <Input
                  id="bitwise-b"
                  className="font-mono"
                  value={rightInput}
                  onChange={(event) => setRightInput(event.target.value)}
                  placeholder="0b1010"
                  spellCheck={false}
                  aria-label="Operand B"
                />
              </Field>
            </div>
            <p className="text-xs text-faint">
              Accepts decimal or 0x / 0o / 0b literals. Operand B is the shift count for shifts
              and is ignored by NOT.
            </p>
          </div>
        </Panel>

        <Panel
          title="Result"
          description="Unsigned and two's-complement signed readings of the same bits."
          actions={<Badge tone="accent">{analysis.width}-bit</Badge>}
          flush
        >
          <div className="space-y-3 p-4">
            {analysis.error ? (
              <Alert tone="danger" title="Invalid operands">
                {analysis.error}
              </Alert>
            ) : null}

            {analysis.result ? (
              <>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                      Binary
                    </p>
                    <CopyButton
                      value={analysis.result.binary}
                      size="icon"
                      label="Copy binary result"
                    />
                  </div>
                  <p className="mt-1 break-all font-mono text-lg text-text">
                    {analysis.result.binary}
                  </p>
                </div>

                <div className="space-y-2">
                  <ValueRow label="Hexadecimal" value={`0x${analysis.result.hex}`} />
                  <ValueRow label="Octal" value={`0o${analysis.result.octal}`} />
                  <ValueRow
                    label="Unsigned decimal"
                    value={analysis.result.unsigned.toString()}
                  />
                  <ValueRow label="Signed decimal" value={analysis.result.signed.toString()} />
                  <ValueRow label="Set bits" value={String(analysis.result.popcount)} />
                  <ValueRow
                    label="Operand A bits"
                    value={`${analysis.leftBinary} (${toSigned(toUnsigned(analysis.left, analysis.width), analysis.width).toString()})`}
                  />
                  <ValueRow
                    label="Operand B bits"
                    value={`${analysis.rightBinary} (${toSigned(toUnsigned(analysis.right, analysis.width), analysis.width).toString()})`}
                  />
                </div>

                <Alert tone="info">
                  Shift counts run from 0 to {analysis.width - 1}; wider shifts are rejected rather
                  than silently wrapping.
                </Alert>
              </>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
