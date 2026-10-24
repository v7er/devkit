import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  InlineRow,
  Panel,
  Segmented,
  Select,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import {
  decodeHexText,
  encodeHexText,
  type SeparatorOption,
} from "./logic";

type Mode = "encode" | "decode";

const SAMPLE = "Hello, 世界 👋";

export default function HexTextTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [separator, setSeparator] = useState<SeparatorOption>("space");
  const [upperCase, setUpperCase] = useState(false);
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      const conversion =
        mode === "encode"
          ? encodeHexText(input, { separator, upperCase })
          : decodeHexText(input);
      return { value: conversion.value, byteCount: conversion.byteCount, error: "" };
    } catch (error) {
      return {
        value: "",
        byteCount: 0,
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [input, mode, separator, upperCase]);

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={setMode}
          options={[
            { value: "encode", label: "Text to hex" },
            { value: "decode", label: "Hex to text" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!result.error) setInput(result.value);
            setMode((current) => (current === "encode" ? "decode" : "encode"));
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
      </div>

      <ToolGrid>
        <Panel
          title={mode === "encode" ? "Text" : "Hexadecimal input"}
          description={
            mode === "encode"
              ? "Text is converted to its UTF-8 bytes, then each byte to two hex digits."
              : "Accepts whitespace, commas, colons, hyphens, underscores, and 0x prefixes between bytes."
          }
        >
          <div className="space-y-3">
            <Field label={mode === "encode" ? "UTF-8 text" : "Hex bytes"}>
              <TextArea
                mono
                rows={12}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={mode === "encode" ? "Type text to hex-encode…" : "Paste hex such as 48 65 6c 6c 6f…"}
                aria-label={mode === "encode" ? "Text to hex-encode" : "Hex to decode"}
              />
            </Field>
            {mode === "encode" ? (
              <>
                <Select
                  label="Separator"
                  value={separator}
                  onChange={(value) => setSeparator(value as SeparatorOption)}
                  options={[
                    { value: "space", label: "Space" },
                    { value: "none", label: "None" },
                    { value: "colon", label: "Colon ( : )" },
                    { value: "hyphen", label: "Hyphen ( - )" },
                    { value: "newline", label: "New line" },
                  ]}
                />
                <Toggle
                  label="Uppercase hex"
                  description="Write A–F instead of a–f."
                  checked={upperCase}
                  onChange={setUpperCase}
                />
              </>
            ) : null}
          </div>
        </Panel>

        <Panel title="Result" description={mode === "encode" ? "Hex output" : "Decoded UTF-8 text"}>
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "encode" ? "hex" : "text"}
              filename={mode === "encode" ? "hex.txt" : "decoded.txt"}
              placeholder={mode === "encode" ? "Hex output appears here" : "Decoded text appears here"}
              maxHeight={360}
            />
            <InlineRow label="Bytes">
              {result.error ? "—" : formatBytes(result.byteCount)}
            </InlineRow>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
