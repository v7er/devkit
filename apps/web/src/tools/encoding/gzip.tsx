import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  InlineRow,
  Panel,
  Segmented,
  Spinner,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import {
  compressToBase64,
  compressionSupported,
  decompressFromBase64,
  type GzipFormat,
} from "./logic";

type Mode = "compress" | "decompress";

const SAMPLE =
  "devkit compresses text in your browser. Nothing is uploaded, and the compressed bytes are shown as Base64 for easy transport.";

interface Result {
  key: string;
  value: string;
  error: string;
  inputBytes: number;
  outputBytes: number;
}

const EMPTY_RESULT: Result = { key: "", value: "", error: "", inputBytes: 0, outputBytes: 0 };

export default function GzipTool() {
  const [mode, setMode] = useState<Mode>("compress");
  const [format, setFormat] = useState<GzipFormat>("gzip");
  const [input, setInput] = useState(SAMPLE);
  const [result, setResult] = useState<Result>(EMPTY_RESULT);
  const supported = compressionSupported();

  const key = `${mode}|${format}|${input}`;
  const active = supported && input.trim().length > 0;
  const current = result.key === key ? result : EMPTY_RESULT;
  const busy = active && result.key !== key;

  useEffect(() => {
    if (!supported || !input.trim()) return;

    const nextKey = `${mode}|${format}|${input}`;
    let cancelled = false;
    const task =
      mode === "compress"
        ? compressToBase64(input, format)
        : decompressFromBase64(input, format);

    task
      .then((next) => {
        if (cancelled) return;
        setResult({
          key: nextKey,
          value: next.value,
          error: "",
          inputBytes: next.inputBytes,
          outputBytes: next.outputBytes,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          ...EMPTY_RESULT,
          key: nextKey,
          error: error instanceof Error ? error.message : "Could not process this input.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [format, input, mode, supported]);

  const savedPercent =
    mode === "compress" && current.inputBytes > 0 && !current.error
      ? Math.round((1 - current.outputBytes / current.inputBytes) * 100)
      : null;

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={setMode}
          options={[
            { value: "compress", label: "Compress" },
            { value: "decompress", label: "Decompress" },
          ]}
        />
        <Segmented
          label="Format"
          value={format}
          onChange={(next) => setFormat(next)}
          options={[
            { value: "gzip", label: "gzip" },
            { value: "deflate", label: "deflate" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!current.error && current.value) setInput(current.value);
            setMode((current) => (current === "compress" ? "decompress" : "compress"));
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
      </div>

      {!supported ? (
        <Alert tone="warning" title="Compression is not available">
          This browser does not provide the CompressionStream and DecompressionStream APIs.
        </Alert>
      ) : null}

      <Alert tone="info">
        gzip follows RFC 1952. The deflate option uses the zlib wrapper from RFC 1950, not raw
        DEFLATE. Compressed output is Base64 so it can be copied as text.
      </Alert>

      <ToolGrid>
        <Panel
          title={mode === "compress" ? "Text to compress" : "Base64 input"}
          description={
            mode === "compress"
              ? "UTF-8 text is compressed locally with the selected format."
              : "Base64 from this tool or another gzip/deflate producer. URL-safe Base64 is accepted."
          }
        >
          <Field
            label={mode === "compress" ? "UTF-8 text" : "Base64"}
            hint={
              mode === "compress"
                ? `${formatBytes(new TextEncoder().encode(input).length)} of UTF-8 input`
                : undefined
            }
          >
            <TextArea
              mono
              rows={14}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                mode === "compress"
                  ? "Type or paste text to compress…"
                  : "Paste Base64-encoded compressed data…"
              }
              aria-label={mode === "compress" ? "Text to compress" : "Base64 data to decompress"}
            />
          </Field>
        </Panel>

        <Panel
          title="Result"
          description={mode === "compress" ? "Base64-encoded compressed bytes" : "Decompressed UTF-8 text"}
          actions={busy ? <Spinner label="Working" /> : null}
        >
          <div className="space-y-3">
            {current.error ? (
              <Alert tone="danger" title="Invalid input">
                {current.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={current.value}
              language={mode === "compress" ? "base64" : "text"}
              filename={mode === "compress" ? "compressed.txt" : "decompressed.txt"}
              placeholder={
                mode === "compress" ? "Base64 compressed data appears here" : "Decompressed text appears here"
              }
              maxHeight={360}
            />
            <div className="space-y-1.5">
              <InlineRow label="Input size">{formatBytes(current.inputBytes)}</InlineRow>
              <InlineRow label="Output size">{formatBytes(current.outputBytes)}</InlineRow>
              {savedPercent !== null ? (
                <InlineRow label="Size change">
                  {savedPercent > 0 ? `${savedPercent}% smaller` : `${Math.abs(savedPercent)}% larger`}
                </InlineRow>
              ) : null}
            </div>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
