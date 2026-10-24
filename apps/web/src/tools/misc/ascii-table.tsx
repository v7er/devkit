import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  Input,
  Panel,
  Segmented,
  ToolStack,
} from "@/components/ui";
import { LATIN1_NOTES, LATIN1_SAMPLES, filterAsciiRows } from "./logic";

type Filter = "all" | "control" | "printable";

export default function AsciiTableTool() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const matches = filterAsciiRows(query);
    if (filter === "all") return matches;
    return matches.filter((row) =>
      filter === "control" ? row.kind === "control" : row.kind !== "control",
    );
  }, [filter, query]);

  return (
    <ToolStack>
      <Panel
        title="ASCII 0–127"
        description="Decimal, hexadecimal, binary, and the character name for every ASCII code."
        actions={<Badge>{rows.length} shown</Badge>}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field
              label="Search"
              hint="Try 65, 0x41, 01000001, “tab”, “brace”, or a character such as @."
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by code or name"
                aria-label="Search ASCII table"
              />
            </Field>
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "control", label: "Controls" },
                { value: "printable", label: "Printable" },
              ]}
            />
          </div>

          <div className="max-h-[560px] overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-2 text-faint">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Dec</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Hex</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Binary</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Char</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code} className="border-t border-line/70 hover:bg-surface-2/60">
                    <td className="px-3 py-1.5 font-mono text-muted">{row.code}</td>
                    <td className="px-3 py-1.5 font-mono text-muted">0x{row.hex}</td>
                    <td className="px-3 py-1.5 font-mono text-faint">{row.binary}</td>
                    <td
                      className={
                        row.kind === "control"
                          ? "px-3 py-1.5 font-mono text-faint"
                          : "px-3 py-1.5 font-mono text-text"
                      }
                    >
                      {row.char}
                    </td>
                    <td className="px-3 py-1.5 text-text">{row.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Search className="size-5" aria-hidden />}
                title="No matching codes"
                description="ASCII only has 128 codes. Try a decimal code from 0 to 127, a hex value, or part of a name."
              />
            ) : null}
          </div>

          <p className="text-xs text-faint">
            Control characters are shown in caret notation (<span className="font-mono">^I</span>{" "}
            is tab, <span className="font-mono">^?</span> is delete). The space is shown as{" "}
            <span className="font-mono">␠</span>.
          </p>
        </div>
      </Panel>

      <Panel
        title="Extended Latin-1 notes"
        description="Codes 128–255 are not ASCII. These notes cover the ISO-8859-1 supplement."
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {LATIN1_NOTES.map((note) => (
              <div key={note.range} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-accent">{note.range}</span>
                  <span className="text-xs font-semibold text-text">{note.title}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{note.description}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">Sample Latin-1 characters</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LATIN1_SAMPLES.map((sample) => (
                <div
                  key={sample.code}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5"
                >
                  <span className="w-6 shrink-0 text-center font-mono text-sm text-text">
                    {sample.char}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    0x{sample.code.toString(16).toUpperCase().padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted">{sample.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Alert tone="warning" title="“ASCII” is often used loosely">
            Text labelled ASCII sometimes contains Windows-1252 bytes (curly quotes, dashes, €) in
            the 128–159 range, or is really UTF-8. The table above stops at 127; use a byte view to
            inspect anything higher.
          </Alert>
        </div>
      </Panel>
    </ToolStack>
  );
}
