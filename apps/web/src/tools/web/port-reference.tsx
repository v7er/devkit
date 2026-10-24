import { useMemo, useState } from "react";
import { Badge, EmptyState, Input, Panel, Segmented, ToolStack } from "@/components/ui";
import { filterPorts } from "./logic";

type ProtocolFilter = "all" | "tcp" | "udp";

export default function PortReferenceTool() {
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState<ProtocolFilter>("all");

  const results = useMemo(() => filterPorts(query, protocol), [query, protocol]);

  return (
    <ToolStack>
      <Panel
        title="Port Reference"
        description="Common TCP and UDP ports, with search by number, service, or purpose."
      >
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 443, postgres, mail, minecraft…"
            aria-label="Search ports and services"
          />
          <Segmented<ProtocolFilter>
            label="Transport"
            value={protocol}
            onChange={setProtocol}
            options={[
              { value: "all", label: "All" },
              { value: "tcp", label: "TCP" },
              { value: "udp", label: "UDP" },
            ]}
          />
        </div>
      </Panel>

      <Panel
        title={`${results.length} ${results.length === 1 ? "port" : "ports"}`}
        description="Well-known assignments; servers can be configured to use other ports."
        flush
      >
        {results.length === 0 ? (
          <EmptyState
            title="No ports match"
            description="Try a port number such as 22, a service such as dns, or switch the transport filter."
          />
        ) : (
          <ul className="divide-y divide-line">
            {results.map((entry) => (
              <li
                key={`${entry.port}-${entry.protocol}`}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-5"
              >
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text">{entry.port}</span>
                  <Badge tone={entry.protocol === "both" ? "accent" : "neutral"}>
                    {entry.protocol === "both" ? "TCP/UDP" : entry.protocol}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-text">{entry.service}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-faint">{entry.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ToolStack>
  );
}
