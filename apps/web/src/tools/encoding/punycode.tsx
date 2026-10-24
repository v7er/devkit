import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { domainToAscii, domainToUnicode } from "./logic";

type Mode = "ascii" | "unicode";

const SAMPLE = "münchen.example";

export default function PunycodeTool() {
  const [mode, setMode] = useState<Mode>("ascii");
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      return {
        value: mode === "ascii" ? domainToAscii(input) : domainToUnicode(input),
        error: "",
      };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not convert this domain.",
      };
    }
  }, [input, mode]);

  return (
    <ToolStack>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "ascii", label: "Unicode to ASCII" },
            { value: "unicode", label: "ASCII to Unicode" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!result.error) setInput(result.value);
            setMode((current) => (current === "ascii" ? "unicode" : "ascii"));
          }}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap
        </Button>
      </div>

      <Alert tone="info" title="Best-effort IDNA conversion">
        Labels are converted with RFC 3492 Punycode and checked against basic domain rules. This
        tool does not apply the full UTS #46 mapping or IDNA2008 contextual rules.
      </Alert>

      <ToolGrid>
        <Panel
          title={mode === "ascii" ? "Unicode domain" : "ASCII / Punycode domain"}
          description={
            mode === "ascii"
              ? "Every label is converted; labels without non-ASCII characters are kept as written."
              : "Every xn-- label is decoded. Plain ASCII labels are kept as written."
          }
        >
          <Field
            label="Domain name"
            hint="Multiple labels are supported. A trailing dot is preserved."
          >
            <Input
              className="font-mono text-[13px]"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === "ascii" ? "münchen.example" : "xn--mnchen-3ya.example"}
              aria-label={mode === "ascii" ? "Unicode domain to convert" : "Punycode domain to convert"}
              spellCheck={false}
              autoCapitalize="none"
            />
          </Field>
        </Panel>

        <Panel
          title="Result"
          description={mode === "ascii" ? "ASCII / Punycode domain" : "Unicode domain"}
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Invalid domain">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.value}
              language={mode === "ascii" ? "punycode" : "unicode"}
              filename="domain.txt"
              placeholder={mode === "ascii" ? "Punycode appears here" : "Unicode domain appears here"}
              maxHeight={160}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
