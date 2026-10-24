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
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { pluralize } from "@/lib/utils";
import {
  decodeBinaryText,
  encodeBinaryText,
  type SeparatorOption,
} from "./logic";

type Mode = "encode" | "decode";

const SAMPLE = "Hi 👋";

export default function BinaryTextTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [separator, setSeparator] = useState<SeparatorOption>("space");
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      const conversion =
        mode === "encode" ? encodeBinaryText(input, separator) : decodeBinaryText(input);
      return { value: conversion.value, byteCount: conversion.byteCount, error: "" };
    } catch (error) {
      return {
        value: "",
        byteCount: 0,
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [input, mode, separator]);

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={setMode}
          options={[
            { value: "encode", label: "Text to binary" },
            { value: "decode", label: "Binary to text" },
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
          title={mode === "encode" ? "Text" : "Binary input"}
          description={
            mode === "encode"
              ? "Each UTF-8 byte becomes exactly eight bits, most significant bit first."
              : "Accepts whitespace, commas, underscores, and 0b prefixes between groups."
          }
        >
          <div className="space-y-3">
            <Field label={mode === "encode" ? "UTF-8 text" : "Binary groups"}>
              <TextArea
                mono
                rows={12}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  mode === "encode"
                    ? "Type text to convert to binary…"
                    : "Paste binary such as 01001000 01101001…"
                }
                aria-label={mode === "encode" ? "Text to convert to binary" : "Binary to decode"}
              />
            </Field>
            {mode === "encode" ? (
              <Select
                label="Separator"
                value={separator}
                onChange={(value) => setSeparator(value as SeparatorOption)}
                options={[
                  { value: "space", label: "Space" },
                  { value: "none", label: "None" },
                  { value: "newline", label: "New line" },
                ]}
              />
            ) : null}
          </div>
        </Panel>

        <Panel title="Result" description={mode === "encode" ? "8-bit binary" : "Decoded UTF-8 text"}>
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "encode" ? "binary" : "text"}
              filename={mode === "encode" ? "binary.txt" : "decoded.txt"}
              placeholder={
                mode === "encode" ? "Binary output appears here" : "Decoded text appears here"
              }
              maxHeight={360}
            />
            <InlineRow label="Bytes">
              {result.error
                ? "—"
                : `${pluralize(result.byteCount, "byte")} · ${result.byteCount * 8} bits`}
            </InlineRow>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
