import { useMemo, useState } from "react";
import { ArrowLeftRight, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  InlineRow,
  Panel,
  Segmented,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { pluralize } from "@/lib/utils";
import {
  convertBase,
  type BaseAlphabet,
  type BaseDirection,
  type BaseKind,
} from "./logic";

const TEXT_SAMPLE = "Hello, devkit!";
const HEX_SAMPLE = "48656c6c6f2c206465766b697421";

export default function Base32Base58Tool() {
  const [alphabet, setAlphabet] = useState<BaseAlphabet>("base32");
  const [direction, setDirection] = useState<BaseDirection>("encode");
  const [kind, setKind] = useState<BaseKind>("text");
  const [input, setInput] = useState(TEXT_SAMPLE);

  const result = useMemo(() => {
    try {
      const conversion = convertBase(input, { alphabet, direction, kind });
      return { value: conversion.value, byteCount: conversion.byteCount, error: "" };
    } catch (error) {
      return {
        value: "",
        byteCount: 0,
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [alphabet, direction, input, kind]);

  const alphabetName = alphabet === "base32" ? "Base32" : "Base58";
  const inputLabel =
    direction === "encode"
      ? kind === "text"
        ? "UTF-8 text"
        : "Hex bytes"
      : `${alphabetName} input`;
  const outputLabel =
    direction === "encode"
      ? alphabetName
      : kind === "text"
        ? "UTF-8 text"
        : "Hex bytes";

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Alphabet"
          value={alphabet}
          onChange={setAlphabet}
          options={[
            { value: "base32", label: "Base32" },
            { value: "base58", label: "Base58" },
          ]}
        />
        <Segmented
          label="Conversion"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        <Segmented
          label={direction === "encode" ? "Input format" : "Output format"}
          value={kind}
          onChange={setKind}
          options={[
            { value: "text", label: "Text" },
            { value: "hex", label: "Hex" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!result.error) setInput(result.value);
            setDirection((current) => (current === "encode" ? "decode" : "encode"));
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
      </div>

      <ToolGrid>
        <Panel
          title="Input"
          description={
            alphabet === "base32"
              ? "Base32 uses the RFC 4648 alphabet without padding; decoding accepts padding, spaces, and lowercase."
              : "Base58 uses the Bitcoin alphabet (no 0, O, I, or l) and preserves leading zero bytes."
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInput(kind === "text" ? TEXT_SAMPLE : HEX_SAMPLE)}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <Field
            label={inputLabel}
            hint={
              direction === "decode"
                ? "Whitespace is ignored by Base32 decoding; Base58 must not contain spaces."
                : undefined
            }
          >
            <TextArea
              mono
              rows={12}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                direction === "encode"
                  ? kind === "text"
                    ? "Type text to encode…"
                    : "Paste hex bytes such as 48656c6c6f…"
                  : kind === "text"
                    ? `Paste ${alphabetName} to decode…`
                    : `Paste ${alphabetName} to decode to hex…`
              }
              aria-label={`${inputLabel} to convert`}
            />
          </Field>
        </Panel>

        <Panel title="Result" description={`${outputLabel} output`}>
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={outputLabel.toLowerCase()}
              filename={direction === "encode" ? "encoded.txt" : "decoded.txt"}
              placeholder="Converted output appears here"
              maxHeight={360}
            />
            <InlineRow label="Bytes">
              {result.error ? "—" : pluralize(result.byteCount, "byte")}
            </InlineRow>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
