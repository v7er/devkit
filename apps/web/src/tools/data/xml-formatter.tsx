import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  InlineRow,
  Panel,
  Select,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { formatXml, type XmlIndent } from "./logic";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog><book id="bk101"><author>Gambardella, Matthew</author><title>XML Developer's Guide</title><price>44.95</price></book><book id="bk102"><author>Ralls, Kim</author><title>Midnight Rain</title><price>5.95</price></book></catalog>`;

type Indent = "2" | "4" | "tab";

function indentValue(value: Indent): XmlIndent {
  return value === "tab" ? "\t" : Number(value) === 4 ? 4 : 2;
}

export default function XmlFormatterTool() {
  const [input, setInput] = useState(SAMPLE);
  const [indent, setIndent] = useState<Indent>("2");

  const result = useMemo(() => {
    try {
      return { formatted: formatXml(input, { indent: indentValue(indent) }), error: "" };
    } catch (error) {
      return {
        formatted: null,
        error: error instanceof Error ? error.message : "Could not parse this XML",
      };
    }
  }, [indent, input]);

  return (
    <ToolGrid>
      <Panel
        title="XML input"
        description="Parsed with the browser's native XML parser."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
            <Sparkles className="size-3.5" aria-hidden />
            Sample
          </Button>
        }
      >
        <div className="space-y-3">
          <TextArea
            mono
            rows={18}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="<root><item>value</item></root>"
            aria-label="XML input"
            spellCheck={false}
          />
          <Select
            label="Indentation"
            value={indent}
            onChange={(value) => setIndent(value as Indent)}
            options={[
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
              { value: "tab", label: "Tabs" },
            ]}
          />
          <Alert tone="info">
            Mixed content keeps its inline text. Comments, CDATA, processing instructions, and the
            XML declaration are preserved.
          </Alert>
        </div>
      </Panel>

      <Panel title="Formatted XML" description="Well-formed output, ready to copy or download." flush>
        <div className="space-y-3 p-4">
          {result.error || !result.formatted ? (
            <Alert tone="danger" title="Invalid XML">
              {result.error || "XML could not be formatted"}
            </Alert>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <InlineRow label="Root element">{result.formatted.root}</InlineRow>
              <InlineRow label="Elements">{result.formatted.elements}</InlineRow>
              <InlineRow label="Attributes">{result.formatted.attributes}</InlineRow>
            </div>
          )}
          <CodeOutput
            value={result.formatted?.output ?? ""}
            language="xml"
            filename="formatted.xml"
            placeholder="Formatted XML appears here"
            maxHeight={500}
            wrap={false}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
