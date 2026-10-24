import { useMemo, useState } from "react";
import { Link2, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  CodeOutput,
  CopyButton,
  EmptyState,
  Field,
  Panel,
  Segmented,
  Slider,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { slugifyLines, type SlugSeparator } from "./logic";

const SAMPLE = [
  "Café del Mar — 25th Anniversary",
  "Straße & Æther",
  "Déjà Vu: A Résumé",
  "Hello,   World!",
  "  Leading and trailing spaces  ",
].join("\n");

const SEPARATORS: Array<{ value: SlugSeparator; label: string }> = [
  { value: "-", label: "Hyphen" },
  { value: "_", label: "Underscore" },
  { value: "", label: "None" },
];

const MAPPING_LIMIT = 200;

export default function SlugGeneratorTool() {
  const [input, setInput] = useState(SAMPLE);
  const [separator, setSeparator] = useState<SlugSeparator>("-");
  const [lowercase, setLowercase] = useState(true);
  const [maxLength, setMaxLength] = useState(60);

  const result = useMemo(
    () => slugifyLines(input, { separator, lowercase, maxLength }),
    [input, lowercase, maxLength, separator],
  );

  const visibleMappings = result.slugs.slice(0, MAPPING_LIMIT);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Input"
          description="Each non-empty line becomes one slug."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Lines">
              <TextArea
                mono
                rows={12}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={"My first blog post\nCafé del Mar"}
                aria-label="Text to convert to slugs"
              />
            </Field>
            <Segmented
              label="Separator"
              value={separator}
              onChange={setSeparator}
              options={SEPARATORS}
            />
            <Toggle
              label="Lowercase"
              description="Useful for URLs; turn it off to keep the original casing."
              checked={lowercase}
              onChange={setLowercase}
            />
            <Slider
              label="Maximum length"
              value={maxLength}
              min={0}
              max={100}
              onChange={setMaxLength}
              format={(value) => (value === 0 ? "No limit" : `${value} chars`)}
            />
            <p className="text-xs text-faint">
              Accents and ligatures are transliterated (ß → ss, æ → ae), then punctuation and
              emoji collapse into the selected separator.
            </p>
          </div>
        </Panel>

        <Panel
          title="Slugs"
          description="Line breaks separate bulk results."
          actions={
            <>
              <Badge tone="accent">{formatNumber(result.slugs.length)} slugs</Badge>
              <CopyButton value={result.output} label="Copy all" />
            </>
          }
        >
          {result.slugs.length === 0 ? (
            <EmptyState
              icon={<Link2 className="size-5" aria-hidden />}
              title="No slugs generated"
              description="Enter at least one line containing letters or numbers."
            />
          ) : (
            <CodeOutput
              value={result.output}
              language="slugs"
              filename="slugs.txt"
              maxHeight={420}
            />
          )}
        </Panel>
      </ToolGrid>

      {result.slugs.length > 0 ? (
        <Panel
          title="Line mapping"
          description="Shows which source line produced each slug."
          actions={
            result.slugs.length > MAPPING_LIMIT ? (
              <Badge>First {MAPPING_LIMIT}</Badge>
            ) : undefined
          }
        >
          <div className="max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="border-b border-line px-3 py-2 font-semibold">Source</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Slug</th>
                </tr>
              </thead>
              <tbody>
                {visibleMappings.map((entry, index) => (
                  <tr key={`${entry.line}-${index}`} className="border-b border-line last:border-0">
                    <td className="max-w-[50%] break-all px-3 py-1.5 text-muted">{entry.line}</td>
                    <td className="break-all px-3 py-1.5 font-mono text-text">{entry.slug}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.slugs.length > MAPPING_LIMIT ? (
            <p className="mt-2 text-xs text-faint">
              Showing the first {MAPPING_LIMIT} of {formatNumber(result.slugs.length)} mappings. The
              copied output includes every slug.
            </p>
          ) : null}
        </Panel>
      ) : null}
    </ToolStack>
  );
}
