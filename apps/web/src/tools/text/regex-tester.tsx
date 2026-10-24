import { useMemo, useState } from "react";
import { Regex, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import {
  detectReDoS,
  highlightMatches,
  runRegex,
  runRegexReplace,
  REGEX_FLAGS,
} from "./logic";

const SAMPLE_PATTERN = String.raw`\b(?<user>[\w.+-]+)@(?<domain>[\w-]+\.[\w.-]+)\b`;
const SAMPLE_TEXT = `Contact ada@example.com or grace@navy.mil for access.
Escalate to ops@devkit.local if the reply takes longer than 24h.
Order IDs look like DEV-1042, DEV-1043.`;

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState(SAMPLE_PATTERN);
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [replacement, setReplacement] = useState("$<user> [$<domain>]");

  const result = useMemo(() => runRegex(pattern, flags, text), [flags, pattern, text]);
  const replaced = useMemo(
    () => runRegexReplace(pattern, flags, text, replacement),
    [flags, pattern, replacement, text],
  );
  const risk = useMemo(() => detectReDoS(pattern), [pattern]);
  const segments = useMemo(
    () => highlightMatches(text, result.matches),
    [result.matches, text],
  );

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Pattern"
          description="Tested locally with the browser's regular expression engine."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPattern(SAMPLE_PATTERN);
                setFlags("gi");
                setText(SAMPLE_TEXT);
              }}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Expression" hint="Slashes are optional; paste the pattern only.">
              <Input
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                placeholder="\\b\\w+@\\w+\\.\\w+\\b"
                aria-label="Regular expression"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
            <Field label="Flags" hint={`Supported: ${REGEX_FLAGS.split("").join(" ")}`}>
              <Input
                value={flags}
                onChange={(event) => setFlags(event.target.value.replace(/\s/g, ""))}
                placeholder="gim"
                aria-label="Regular expression flags"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
            <Field label="Test text">
              <TextArea
                mono
                rows={12}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste text to search"
                aria-label="Test text"
              />
            </Field>
            <Field label="Replacement" hint="Use $1, $&, or $<name> for capture groups.">
              <Input
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                aria-label="Replacement pattern"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Matches"
          description="Capture groups are numbered from 1."
          actions={
            <Badge tone={result.matches.length > 0 ? "accent" : "neutral"}>
              {formatNumber(result.matches.length)} found
            </Badge>
          }
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid expression">
                {result.error}
              </Alert>
            ) : null}
            {risk ? (
              <Alert tone="warning" title="Possible catastrophic backtracking">
                {risk} Check the timing below before using this pattern on untrusted input.
              </Alert>
            ) : null}
            {result.elapsedMs > 100 ? (
              <Alert tone="warning" title="Slow pattern">
                Matching took {result.elapsedMs.toFixed(1)} ms on this input. Simplify nested
                quantifiers if the interface feels unresponsive.
              </Alert>
            ) : null}
            {result.truncated ? (
              <Alert tone="info" title="Match list truncated">
                Showing the first {formatNumber(result.matches.length)} matches. Refine the pattern
                to see fewer results.
              </Alert>
            ) : null}

            {result.matches.length === 0 ? (
              <EmptyState
                icon={<Regex className="size-5" aria-hidden />}
                title={result.error ? "No matches" : "No matches found"}
                description="Adjust the pattern, flags, or test text. A non-global pattern reports at most one match."
              />
            ) : (
              <ul className="max-h-96 space-y-2 overflow-auto pr-1">
                {result.matches.map((match, index) => (
                  <li
                    key={`${match.index}-${index}`}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[12px] uppercase tracking-wider text-faint">
                      <span>Match {index + 1}</span>
                      <span>
                        {match.index}–{match.end}
                      </span>
                    </div>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[14px] text-text">
                      {match.value || "(empty match)"}
                    </pre>
                    {match.groups.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5 font-mono text-[12px] text-muted">
                        {match.groups.map((group, groupIndex) => (
                          <li key={groupIndex}>
                            <span className="text-faint">${groupIndex + 1}</span> ={" "}
                            {group === null ? <span className="text-faint">undefined</span> : group}
                          </li>
                        ))}
                        {match.namedGroups.map((group) => (
                          <li key={group.name}>
                            <span className="text-faint">${`<${group.name}>`}</span> ={" "}
                            {group.value === null ? (
                              <span className="text-faint">undefined</span>
                            ) : (
                              group.value
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <p className="font-mono text-[12px] text-faint">
              {formatNumber(result.matches.length)} match
              {result.matches.length === 1 ? "" : "es"} · {result.elapsedMs.toFixed(2)} ms
            </p>
          </div>
        </Panel>
      </ToolGrid>

      <Panel title="Replace preview" description="Runs String.replace with the same flags.">
        {replaced.error ? (
          <Alert tone="danger" title="Replacement failed">
            {replaced.error}
          </Alert>
        ) : (
          <CodeOutput value={replaced.output} language="replaced text" filename="replaced.txt" />
        )}
      </Panel>

      <Panel
        title="Highlighted matches"
        description="Highlights use the matches above; zero-width matches have no visible span."
        actions={<CopyButton value={text} label="Copy text" />}
      >
        <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 p-3 font-mono text-[14px] leading-relaxed text-text">
          {segments.length === 0 ? (
            <span className="text-faint">No match positions to highlight.</span>
          ) : (
            segments.map((segment, index) =>
              segment.matchIndex === null ? (
                <span key={index}>{segment.text}</span>
              ) : (
                <mark
                  key={index}
                  className="rounded bg-accent-soft px-0.5 text-accent"
                  title={`Match ${segment.matchIndex + 1}`}
                >
                  {segment.text}
                </mark>
              ),
            )
          )}
        </div>
      </Panel>
    </ToolStack>
  );
}
