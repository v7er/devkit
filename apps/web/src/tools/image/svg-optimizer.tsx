import { useMemo, useState } from "react";
import { FileCode, X } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  FileDrop,
  InlineRow,
  Panel,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { readFileAsText } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import {
  MAX_SVG_BYTES,
  fileBaseName,
  formatSignedPercent,
  optimizeSvg,
  withExtension,
  type SvgOptimizeResult,
} from "./logic";

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export default function SvgOptimizerTool() {
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setFileError("");
    try {
      if (file.size > MAX_SVG_BYTES) {
        throw new Error(`Choose an SVG under ${Math.round(MAX_SVG_BYTES / 1024 / 1024)} MB.`);
      }
      const text = await readFileAsText(file);
      if (!text.trim()) throw new Error("This file is empty.");
      setFileName(file.name);
      setSource(text);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not read this file.");
    }
  }

  const outcome = useMemo<{ result: SvgOptimizeResult } | { error: string } | null>(() => {
    if (!source.trim()) return null;
    try {
      return { result: optimizeSvg(source) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not parse this SVG." };
    }
  }, [source]);

  const result = outcome && "result" in outcome ? outcome.result : null;
  const error = outcome && "error" in outcome ? outcome.error : "";
  const originalBytes = useMemo(() => byteLength(source), [source]);
  const outputBytes = result ? byteLength(result.output) : 0;
  const outputName = withExtension(
    fileName ? `${fileBaseName(fileName)}-optimized` : "optimized",
    "svg",
  );

  return (
    <ToolGrid>
      <Panel
        title="SVG source"
        description="Cleanup happens locally and keeps your original file untouched."
        actions={
          source ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSource("");
                setFileName("");
                setFileError("");
              }}
            >
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <FileDrop
            accept=".svg,image/svg+xml"
            onFiles={(files) => void handleFiles(files)}
            label={source ? "Choose another SVG" : "Drop an SVG or click to browse"}
            hint={`Text-based SVG only · up to ${Math.round(MAX_SVG_BYTES / 1024 / 1024)} MB`}
          />
          {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
          <Field
            label="Or paste SVG markup"
            hint="Comments, metadata, editor namespaces, and whitespace-only text nodes are removed. Path data and CSS are left as written."
          >
            <TextArea
              mono
              rows={12}
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setFileName("");
                setFileError("");
              }}
              placeholder={'<svg xmlns="http://www.w3.org/2000/svg">…</svg>'}
              aria-label="SVG markup to optimize"
            />
          </Field>
          {fileName ? (
            <InlineRow label="Source size">
              {fileName} · {formatBytes(originalBytes)}
            </InlineRow>
          ) : null}
        </div>
      </Panel>

      <Panel title="Optimized SVG" description="Review the cleaned markup before downloading." flush>
        <div className="space-y-3 p-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] uppercase tracking-wider text-faint">Before</p>
                  <p className="mt-1 font-mono text-sm text-text">{formatBytes(originalBytes)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[12px] uppercase tracking-wider text-faint">After</p>
                  <p className="mt-1 font-mono text-sm text-text">{formatBytes(outputBytes)}</p>
                </div>
              </div>
              <InlineRow label="Size change">
                {formatSignedPercent(
                  originalBytes > 0 ? ((outputBytes - originalBytes) / originalBytes) * 100 : 0,
                )}
              </InlineRow>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-line bg-surface-2 p-3 text-xs">
                <InlineRow label="Comments">{result.stats.comments}</InlineRow>
                <InlineRow label="Metadata">{result.stats.metadata}</InlineRow>
                <InlineRow label="Editor nodes">{result.stats.editorNodes}</InlineRow>
                <InlineRow label="Editor attributes">{result.stats.editorAttributes}</InlineRow>
                <InlineRow label="Whitespace nodes">{result.stats.whitespaceNodes}</InlineRow>
              </div>
              {outputBytes >= originalBytes ? (
                <Alert tone="info">
                  This file was already compact, so there was little to remove. The output is
                  still safe to use.
                </Alert>
              ) : null}
              <CodeOutput
                value={result.output}
                filename={outputName}
                language="svg"
                maxHeight={360}
              />
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-faint">
              <FileCode className="size-4" aria-hidden />
              The optimized markup appears here.
            </p>
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
