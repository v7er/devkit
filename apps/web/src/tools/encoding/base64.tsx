import { useMemo, useState } from "react";
import { ArrowLeftRight, FileUp, X } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  FileDrop,
  Panel,
  Segmented,
  TextArea,
  Toggle,
  ToolStack,
} from "@/components/ui";
import { readFileAsDataUrl } from "@/lib/download";
import { base64ToBytes, bytesToText, encodeBase64 } from "@/lib/encoding";
import { formatBytes } from "@/lib/utils";

type Mode = "encode" | "decode";
type Variant = "standard" | "url";

interface LoadedFile {
  name: string;
  size: number;
  base64: string;
}

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [variant, setVariant] = useState<Variant>("standard");
  const [lineWrap, setLineWrap] = useState(false);
  const [input, setInput] = useState("Hello, devkit!");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState("");

  const result = useMemo(() => {
    try {
      if (mode === "encode") {
        if (file) {
          const encoded = lineWrap
            ? file.base64.replace(/(.{76})/g, "$1\n").trim()
            : file.base64;
          return { value: encoded, error: "" };
        }
        const encoded = encodeBase64(input, variant === "url");
        return {
          value: lineWrap ? encoded.replace(/(.{76})/g, "$1\n").trim() : encoded,
          error: "",
        };
      }

      const bytes = base64ToBytes(input);
      const text = bytesToText(bytes, true);
      return { value: text, error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not convert this input",
      };
    }
  }, [file, input, lineWrap, mode, variant]);

  const binaryPreview = useMemo(() => {
    if (mode !== "encode" || file) return null;
    try {
      const bytes = new TextEncoder().encode(input);
      return `${formatBytes(bytes.length)} · ${bytes.length} bytes`;
    } catch {
      return null;
    }
  }, [file, input, mode]);

  async function handleFiles(files: File[]) {
    const next = files[0];
    if (!next) return;
    setFileError("");
    try {
      const dataUrl = await readFileAsDataUrl(next);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      setFile({ name: next.name, size: next.size, base64 });
      setMode("encode");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not read this file");
    }
  }

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={(next) => setMode(next)}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        <Segmented
          label="Alphabet"
          value={variant}
          onChange={(next) => setVariant(next)}
          options={[
            { value: "standard", label: "Standard" },
            { value: "url", label: "URL-safe" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setMode((current) => (current === "encode" ? "decode" : "encode"));
            setInput(result.value || input);
            setFile(null);
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title={mode === "encode" ? "Plain text or file" : "Base64 input"}
          description={
            mode === "encode"
              ? "UTF-8 text is encoded byte for byte. Files are read locally."
              : "Whitespace, URL-safe characters, and missing padding are accepted."
          }
          actions={
            file ? (
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="size-3.5" aria-hidden />
                Clear file
              </Button>
            ) : null
          }
        >
          <div className="space-y-3">
            {mode === "encode" && !file ? (
              <FileDrop
                accept="*/*"
                onFiles={handleFiles}
                label="Encode a file instead"
                hint="Any file type · processed in your browser"
              />
            ) : null}
            {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                <FileUp className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-text">{file.name}</span>
                <span className="shrink-0 text-faint">{formatBytes(file.size)}</span>
              </div>
            ) : (
              <Field
                label={mode === "encode" ? "Text" : "Base64"}
                hint={mode === "encode" ? binaryPreview ?? undefined : undefined}
              >
                <TextArea
                  mono
                  rows={12}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={mode === "encode" ? "Type or paste text…" : "Paste Base64 data…"}
                  aria-label={mode === "encode" ? "Text to encode" : "Base64 to decode"}
                />
              </Field>
            )}
            <Toggle
              label="Wrap at 76 characters"
              description="Useful for MIME and email payloads."
              checked={lineWrap}
              onChange={setLineWrap}
            />
          </div>
        </Panel>

        <Panel
          title="Result"
          description={mode === "encode" ? "Base64 output" : "Decoded UTF-8 text"}
          flush
        >
          <div className="space-y-3 p-4">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language="base64"
              filename={mode === "encode" ? "encoded.txt" : "decoded.txt"}
              placeholder={mode === "encode" ? "Encoded output appears here" : "Decoded text appears here"}
              maxHeight={360}
            />
          </div>
        </Panel>
      </div>
    </ToolStack>
  );
}
