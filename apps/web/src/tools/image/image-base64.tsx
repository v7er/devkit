import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Download, FileCode, FileUp, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Field,
  FileDrop,
  InlineRow,
  Panel,
  Segmented,
  TextArea,
  ToolStack,
} from "@/components/ui";
import { downloadBlob, downloadText, readFileAsDataUrl } from "@/lib/download";
import { formatBytes } from "@/lib/utils";
import {
  MAX_BASE64_IMAGE_BYTES,
  MAX_IMAGE_FILE_BYTES,
  extensionForMime,
  fileBaseName,
  parseImageBase64,
  type ParsedImageBase64,
} from "./logic";

type Mode = "encode" | "decode";
type OutputKind = "data-url" | "base64";

interface EncodedImage {
  dataUrl: string;
  base64: string;
  mime: string;
  filename: string;
  fileSize: number;
}

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)$/i;

function bytesBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes.slice().buffer], { type });
}

export default function ImageBase64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [encoded, setEncoded] = useState<EncodedImage | null>(null);
  const [outputKind, setOutputKind] = useState<OutputKind>("data-url");
  const [encodeError, setEncodeError] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [input, setInput] = useState("");
  const [decoded, setDecoded] = useState<ParsedImageBase64 | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [decodeError, setDecodeError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const outputValue = useMemo(() => {
    if (!encoded) return "";
    return outputKind === "data-url" ? encoded.dataUrl : encoded.base64;
  }, [encoded, outputKind]);

  async function encodeFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setEncodeError("");
    setEncoded(null);
    if (file.size === 0) {
      setEncodeError("This file is empty.");
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setEncodeError(
        `Choose an image under ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    if (!file.type.startsWith("image/") && !IMAGE_EXTENSION.test(file.name)) {
      setEncodeError("Choose an image file such as PNG, JPEG, WebP, GIF, or SVG.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const comma = dataUrl.indexOf(",");
      const metadata = dataUrl.slice(5, comma);
      const mime = metadata.split(";")[0] || "application/octet-stream";
      if (!mime.startsWith("image/")) {
        setEncodeError("That file is not an image MIME type.");
        return;
      }
      setEncoded({
        dataUrl,
        base64: dataUrl.slice(comma + 1),
        mime,
        filename: file.name,
        fileSize: file.size,
      });
      setOutputKind("data-url");
    } catch (error) {
      setEncodeError(error instanceof Error ? error.message : "Could not read this file.");
    }
  }

  function decode() {
    setDecoding(true);
    setDecodeError("");
    try {
      const parsed = parseImageBase64(input);
      setPreviewUrl(URL.createObjectURL(bytesBlob(parsed.bytes, parsed.mime)));
      setDecoded(parsed);
    } catch (error) {
      setDecoded(null);
      setPreviewUrl("");
      setDecodeError(error instanceof Error ? error.message : "Could not decode this Base64.");
    } finally {
      setDecoding(false);
    }
  }

  function sendToDecoder() {
    if (!encoded) return;
    setInput(outputValue);
    setMode("decode");
    setDecoded(null);
    setPreviewUrl("");
    setDecodeError("");
  }

  const declaredMismatch =
    decoded !== null &&
    decoded.declaredMime !== null &&
    decoded.declaredMime !== "" &&
    decoded.declaredMime !== decoded.mime;

  return (
    <ToolStack>
      <Panel
        title="Base64 image"
        description="Convert images to Base64 or data URLs and back, entirely on this device."
        actions={
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "encode", label: "Image to Base64" },
              { value: "decode", label: "Base64 to image" },
            ]}
          />
        }
      >
        {mode === "encode" ? (
          <div className="space-y-3">
            <FileDrop
              accept="image/*"
              onFiles={(files) => void encodeFiles(files)}
              label={encoded ? "Choose another image" : "Drop an image or click to browse"}
              hint="PNG, JPEG, WebP, GIF, AVIF, or SVG · up to 50 MB"
            />
            {encodeError ? <Alert tone="danger">{encodeError}</Alert> : null}
            {encoded ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InlineRow label="File">{encoded.filename}</InlineRow>
                  <InlineRow label="Original size">{formatBytes(encoded.fileSize)}</InlineRow>
                  <InlineRow label="MIME type">{encoded.mime}</InlineRow>
                  <InlineRow label="Encoded length">
                    {encoded.base64.length.toLocaleString()} characters
                  </InlineRow>
                </div>
                <Segmented
                  label="Output"
                  value={outputKind}
                  onChange={setOutputKind}
                  options={[
                    { value: "data-url", label: "Data URL" },
                    { value: "base64", label: "Raw Base64" },
                  ]}
                />
                <TextArea
                  mono
                  readOnly
                  rows={5}
                  value={outputValue}
                  aria-label="Encoded Base64 output"
                  className="break-all"
                />
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={outputValue} label="Copy output" />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadText(
                        outputValue,
                        `${fileBaseName(encoded.filename)}.${outputKind === "data-url" ? "txt" : "b64"}`,
                      )
                    }
                  >
                    <Download className="size-4" aria-hidden />
                    Download text
                  </Button>
                  <Button variant="secondary" onClick={sendToDecoder}>
                    <ArrowLeftRight className="size-4" aria-hidden />
                    Open in decoder
                  </Button>
                </div>
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-faint">
                <FileUp className="size-4" aria-hidden />
                Your data URL or Base64 appears here after you choose an image.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Field
              label="Base64 or data URL"
              hint={`Accepted image formats are detected from the decoded bytes · up to ${Math.round(
                MAX_BASE64_IMAGE_BYTES / 1024 / 1024,
              )} MB decoded`}
            >
              <TextArea
                mono
                rows={8}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="data:image/png;base64,iVBORw0KGgo… or iVBORw0KGgo…"
                aria-label="Base64 or data URL input"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={decode} disabled={decoding || !input.trim()}>
                <FileCode className="size-4" aria-hidden />
                {decoding ? "Decoding…" : "Decode to image"}
              </Button>
              {input ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInput("");
                    setDecoded(null);
                    setPreviewUrl("");
                    setDecodeError("");
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                  Clear
                </Button>
              ) : null}
            </div>
            {decodeError ? <Alert tone="danger">{decodeError}</Alert> : null}
            {decoded ? (
              <>
                {declaredMismatch ? (
                  <Alert tone="warning" title="MIME type mismatch">
                    The data URL declared {decoded.declaredMime}, but the bytes are{" "}
                    {decoded.mime}. The detected type wins.
                  </Alert>
                ) : null}
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Decoded image preview"
                    className="max-h-72 w-full rounded-lg border border-line bg-surface-2 object-contain"
                  />
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <InlineRow label="Detected MIME">
                    <Badge tone="accent">{decoded.mime}</Badge>
                  </InlineRow>
                  <InlineRow label="Decoded size">{formatBytes(decoded.bytes.length)}</InlineRow>
                </div>
                <Button
                  variant="primary"
                  onClick={() =>
                    downloadBlob(
                      bytesBlob(decoded.bytes, decoded.mime),
                      `image.${extensionForMime(decoded.mime)}`,
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  Download image
                </Button>
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-faint">
                <ArrowLeftRight className="size-4" aria-hidden />
                Paste Base64 to preview and download the decoded image.
              </p>
            )}
          </div>
        )}
      </Panel>
    </ToolStack>
  );
}
