import { useMemo, useState } from "react";
import { Download, FileText, RotateCcw } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  CopyButton,
  EmptyState,
  Field,
  Panel,
  Segmented,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { downloadText } from "@/lib/download";
import { buildHtmlDocument, renderMarkdown } from "./logic";

const SAMPLE = [
  "# devkit Markdown preview",
  "",
  "Render **GitHub-flavored Markdown** locally. Tables, task lists, and fenced code work out of the box.",
  "",
  "| Feature | Supported |",
  "| --- | --- |",
  "| GFM tables | Yes |",
  "| Task lists | Yes |",
  "| Raw HTML | Sanitized |",
  "",
  "- [x] Sanitize output with DOMPurify",
  "- [ ] Fetch anything from the network",
  "",
  "> Markdown never leaves this tab.",
  "",
  "```ts",
  'const greeting = "hello, devkit";',
  "```",
].join("\n");

export default function MarkdownPreviewTool() {
  const [source, setSource] = useState(SAMPLE);
  const [view, setView] = useState<"preview" | "raw">("preview");
  const [breaks, setBreaks] = useState(false);

  const rendered = useMemo(() => renderMarkdown(source, { breaks }), [breaks, source]);
  const documentHtml = useMemo(
    () => (rendered.html ? buildHtmlDocument("devkit Markdown export", rendered.html) : ""),
    [rendered.html],
  );

  function handleExport() {
    if (!documentHtml) return;
    downloadText(documentHtml, "markdown-export.html", "text/html");
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Markdown"
          description="GitHub-flavored Markdown is enabled, including tables and task lists."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSource(SAMPLE)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Source">
              <TextArea
                mono
                rows={20}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="# Heading"
                aria-label="Markdown source"
                spellCheck={false}
              />
            </Field>
            <Toggle
              label="Break on single newlines"
              description="Treats one newline as a line break instead of a paragraph continuation."
              checked={breaks}
              onChange={setBreaks}
            />
            <p className="text-xs text-faint">
              Raw HTML is passed through DOMPurify, and links open in a new tab with{" "}
              <span className="font-mono">rel=&quot;noopener noreferrer&quot;</span>.
            </p>
          </div>
        </Panel>

        <Panel
          title="Output"
          description="Preview and export use the same sanitized HTML."
          actions={
            <>
              <CopyButton value={rendered.html} label="Copy HTML" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={!documentHtml}
              >
                <Download className="size-3.5" aria-hidden />
                Export
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "preview", label: "Preview" },
                { value: "raw", label: "Raw HTML" },
              ]}
            />
            {rendered.error ? (
              <Alert tone="danger" title="Could not render Markdown">
                {rendered.error}
              </Alert>
            ) : null}
            {view === "raw" ? (
              <CodeOutput
                value={rendered.html}
                language="sanitized html"
                maxHeight={480}
              />
            ) : source.trim() === "" ? (
              <EmptyState
                icon={<FileText className="size-5" aria-hidden />}
                title="Nothing to preview"
                description="Type Markdown on the left, or load the sample."
              />
            ) : (
              <div
                className="prose-devkit max-h-[480px] overflow-auto rounded-lg border border-line bg-surface p-4"
                // HTML is sanitized by renderMarkdown before it reaches this element.
                dangerouslySetInnerHTML={{ __html: rendered.html }}
              />
            )}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
