import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  CodeOutput,
  Field,
  Input,
  InlineRow,
  Panel,
  ToolGrid,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { calculateSubnet, type SubnetResult } from "./logic";

type SubnetState = { ok: true; value: SubnetResult } | { ok: false; error: string };

function parseSubnet(input: string): SubnetState {
  try {
    return { ok: true, value: calculateSubnet(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not calculate this subnet.",
    };
  }
}

export default function SubnetCalculatorTool() {
  const [input, setInput] = useState("192.168.1.0/24");
  const state = useMemo(() => parseSubnet(input), [input]);

  return (
    <ToolGrid>
      <Panel
        title="IPv4 CIDR block"
        description="Enter a network address and prefix length. Host bits are masked off."
      >
        <div className="space-y-3">
          <Field
            label="CIDR block"
            hint="IPv4 only. Example: 10.0.0.0/8 or 203.0.113.42/26."
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="192.168.1.0/24"
              aria-label="IPv4 CIDR block"
              className="font-mono"
              spellCheck={false}
            />
          </Field>
          {state.ok ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone={state.value.scope === "Public" ? "accent" : "neutral"}>
                {state.value.scope}
              </Badge>
              <span>
                /{state.value.prefix} · {formatNumber(state.value.totalAddresses)} addresses ·{" "}
                {state.value.hostBits} host bits
              </span>
            </div>
          ) : (
            <Alert tone="danger" title="Invalid CIDR block">
              {state.error}
            </Alert>
          )}
          <div className="rounded-lg border border-line bg-surface-2/40 p-3 text-xs leading-relaxed text-faint">
            Usable hosts exclude the network and broadcast addresses. A /31 is treated as a
            point-to-point link with two usable addresses; a /32 has one.
          </div>
        </div>
      </Panel>

      <Panel
        title="Calculated range"
        description={state.ok ? `Result for ${state.value.input}` : "Fix the input to see results."}
      >
        {state.ok ? (
          <div className="space-y-4">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <InlineRow label="Network">{state.value.network}</InlineRow>
              <InlineRow label="Broadcast">{state.value.broadcast}</InlineRow>
              <InlineRow label="Subnet mask">{state.value.mask}</InlineRow>
              <InlineRow label="Wildcard">{state.value.wildcard}</InlineRow>
              <InlineRow label="First usable">{state.value.firstUsable}</InlineRow>
              <InlineRow label="Last usable">{state.value.lastUsable}</InlineRow>
              <InlineRow label="Usable hosts">{formatNumber(state.value.usableCount)}</InlineRow>
              <InlineRow label="Total addresses">{formatNumber(state.value.totalAddresses)}</InlineRow>
            </div>
            <CodeOutput
              value={`Mask     ${state.value.maskBinary}\nNetwork  ${state.value.networkBinary}`}
              language="binary"
              maxHeight={120}
            />
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-faint">
            Network, broadcast, mask, wildcard, host range, and binary views appear here.
          </div>
        )}
      </Panel>
    </ToolGrid>
  );
}
