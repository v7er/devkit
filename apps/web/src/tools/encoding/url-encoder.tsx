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
import { formatBytes } from "@/lib/utils";
import { decodeUrl, encodeUrl, type UrlScope } from "./logic";

type Mode = "encode" | "decode";

const SAMPLE = "search?q=hello world&lang=日本";

export default function UrlEncoderTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [scope, setScope] = useState<UrlScope>("component");
  const [plusSpaces, setPlusSpaces] = useState(false);
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      const value =
        mode === "encode"
          ? encodeUrl(input, { scope, plusSpaces })
          : decodeUrl(input, { scope, plusSpaces });
      return { value, error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not convert this input.",
      };
    }
  }, [input, mode, plusSpaces, scope]);

  const inputBytes = useMemo(() => {
    try {
      return formatBytes(new TextEncoder().encode(input).length);
    } catch {
      return null;
    }
  }, [input]);

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
        <Segmented
          label="Scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: "component", label: "Component" },
            { value: "url", label: "Whole URL" },
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
          title={mode === "encode" ? "Plain text" : "Percent-encoded input"}
          description={
            scope === "component"
              ? "Component mode encodes reserved characters such as / ? & = and #."
              : "Whole URL mode keeps : / ? & = # intact and encodes the rest."
          }
        >
          <Field
            label={mode === "encode" ? "Text or URL" : "Encoded text"}
            hint={inputBytes ? `UTF-8 · ${inputBytes}` : undefined}
          >
            <TextArea
              mono
              rows={12}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === "encode" ? "Type text or a URL to encode…" : "Paste percent-encoded text…"}
              aria-label={mode === "encode" ? "Text to encode" : "Text to decode"}
            />
          </Field>
          <Toggle
            className="mt-3"
            label="Use plus for spaces"
            description="Encode spaces as + and decode + as a space. Common in query strings."
            checked={plusSpaces}
            onChange={setPlusSpaces}
          />
        </Panel>

        <Panel title="Result" description={mode === "encode" ? "Percent-encoded output" : "Decoded UTF-8 text"}>
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid input">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "encode" ? "percent-encoded" : "text"}
              filename={mode === "encode" ? "encoded-url.txt" : "decoded-url.txt"}
              placeholder={mode === "encode" ? "Encoded output appears here" : "Decoded text appears here"}
              maxHeight={360}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
