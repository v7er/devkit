import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Panel,
  Segmented,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  decodeHtmlEntities,
  encodeHtmlEntities,
  type HtmlEntityStyle,
} from "./logic";

type Mode = "encode" | "decode";

const SAMPLE = `<a href="/about">Tom & Jerry's café</a>`;

export default function HtmlEntitiesTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [style, setStyle] = useState<HtmlEntityStyle>("named");
  const [encodeAll, setEncodeAll] = useState(false);
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      const value =
        mode === "encode"
          ? encodeHtmlEntities(input, { style, encodeAll })
          : decodeHtmlEntities(input);
      return { value, error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [encodeAll, input, mode, style]);

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Conversion"
          value={mode}
          onChange={setMode}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        {mode === "encode" ? (
          <Segmented
            label="Entity style"
            value={style}
            onChange={setStyle}
            options={[
              { value: "named", label: "Named" },
              { value: "numeric", label: "Numeric" },
            ]}
          />
        ) : null}
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
          title={mode === "encode" ? "HTML text" : "Entity-encoded input"}
          description={
            mode === "encode"
              ? "Special characters are always escaped. Named mode falls back to numeric references when a character has no name."
              : "Decodes named, decimal, and hexadecimal references. Unknown entities are left as written."
          }
        >
          <Field label={mode === "encode" ? "Text" : "HTML with entities"}>
            <TextArea
              mono
              rows={12}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === "encode" ? "Type HTML or text…" : "Paste text containing &amp; entities…"}
              aria-label={mode === "encode" ? "Text to encode" : "Text with entities to decode"}
            />
          </Field>
          {mode === "encode" ? (
            <Toggle
              className="mt-3"
              label="Encode all non-ASCII characters"
              description="Also convert accented letters, symbols, and emoji to character references."
              checked={encodeAll}
              onChange={setEncodeAll}
            />
          ) : null}
        </Panel>

        <Panel
          title="Result"
          description={mode === "encode" ? "Entity-encoded HTML" : "Decoded text"}
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "encode" ? "html entities" : "text"}
              filename={mode === "encode" ? "encoded.html" : "decoded.txt"}
              placeholder={mode === "encode" ? "Encoded output appears here" : "Decoded text appears here"}
              maxHeight={360}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
