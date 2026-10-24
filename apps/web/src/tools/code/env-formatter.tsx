import { useMemo, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Panel,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatEnv } from "./logic";

const SAMPLE = `# App configuration
PORT=3000
NAME=Ada Lovelace # author
DATABASE_URL=postgres://localhost/devkit
DEBUG=false
`;

export default function EnvFormatterTool() {
  const [source, setSource] = useState(SAMPLE);
  const [sortKeys, setSortKeys] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [quoteValues, setQuoteValues] = useState(false);
  const [preserveComments, setPreserveComments] = useState(true);
  const [exportPrefix, setExportPrefix] = useState(false);

  const result = useMemo(
    () => formatEnv(source, { sortKeys, dedupe, quoteValues, preserveComments, exportPrefix }),
    [dedupe, exportPrefix, preserveComments, quoteValues, sortKeys, source],
  );

  const hardIssues = result.issues.filter((issue) => issue.kind !== "duplicate");
  const shownIssues = result.issues.slice(0, 10);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title=".env input"
          description="Keys are parsed line by line; quoted values and inline comments are recognized."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSource(SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="Environment file" htmlFor="env-source">
              <TextArea
                id="env-source"
                mono
                rows={18}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={"PORT=3000\nNAME=devkit"}
                aria-label="Environment file contents"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Sort keys"
                description="Alphabetical order for stable diffs."
                checked={sortKeys}
                onChange={setSortKeys}
              />
              <Toggle
                label="Remove duplicates"
                description="Keep the last value for each key."
                checked={dedupe}
                onChange={setDedupe}
              />
              <Toggle
                label="Quote values"
                description="Quote values containing spaces or symbols."
                checked={quoteValues}
                onChange={setQuoteValues}
              />
              <Toggle
                label="Preserve comments"
                description="Keep standalone and inline comments."
                checked={preserveComments}
                onChange={setPreserveComments}
              />
              <Toggle
                label="Add export prefix"
                description="Write export KEY=value for shell sourcing."
                checked={exportPrefix}
                onChange={setExportPrefix}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Formatted output" description="Valid entries are kept even when other lines report problems.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{result.keyCount} keys</Badge>
              {result.duplicateKeys.length > 0 ? (
                <Badge tone="warning">{result.duplicateKeys.length} duplicate</Badge>
              ) : null}
              {hardIssues.length > 0 ? <Badge tone="warning">{hardIssues.length} invalid</Badge> : null}
            </div>

            {hardIssues.length > 0 ? (
              <Alert tone="danger" title="Some lines could not be parsed">
                <ul className="list-disc space-y-1 pl-4">
                  {shownIssues
                    .filter((issue) => issue.kind !== "duplicate")
                    .map((issue) => (
                      <li key={`${issue.kind}-${issue.line}`}>{issue.message}</li>
                    ))}
                </ul>
              </Alert>
            ) : result.issues.length > 0 ? (
              <Alert tone="warning" title="Duplicate keys detected">
                <ul className="list-disc space-y-1 pl-4">
                  {shownIssues.map((issue) => (
                    <li key={`${issue.kind}-${issue.line}`}>{issue.message}</li>
                  ))}
                </ul>
                {result.issues.length > shownIssues.length ? (
                  <p className="mt-1">And {result.issues.length - shownIssues.length} more.</p>
                ) : null}
              </Alert>
            ) : source.trim() ? (
              <Alert tone="success">No duplicate keys or invalid names found.</Alert>
            ) : (
              <Alert tone="info">Paste an environment file to format it.</Alert>
            )}

            <CodeOutput
              value={result.output}
              language="dotenv"
              filename=".env"
              placeholder="Formatted environment variables appear here"
              maxHeight={440}
            />

            {result.keys.length > 0 ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted">
                  <FileText className="size-3.5" aria-hidden />
                  Keys
                </p>
                <p className="mt-1 break-words font-mono text-xs leading-relaxed text-faint">
                  {result.keys.join(", ")}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
