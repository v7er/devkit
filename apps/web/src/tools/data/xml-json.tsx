import { useMemo, useState } from "react";
import { ArrowLeftRight, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  TextArea,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import { jsonToXml, xmlToJson, type XmlIndent } from "./logic";

const XML_SAMPLE = `<catalog>
  <book id="bk101" available="true">
    <title>XML Developer's Guide</title>
    <price>44.95</price>
  </book>
  <book id="bk102">
    <title>Midnight Rain</title>
    <price>5.95</price>
  </book>
</catalog>`;

const JSON_SAMPLE = `{
  "catalog": {
    "book": [
      { "@id": "bk101", "available": "true", "title": "XML Developer's Guide", "price": 44.95 },
      { "@id": "bk102", "title": "Midnight Rain", "price": 5.95 }
    ]
  }
}
`;

type Direction = "xml-to-json" | "json-to-xml";
type Indent = "2" | "4" | "tab";

function indentValue(value: Indent): XmlIndent {
  return value === "tab" ? "\t" : Number(value) === 4 ? 4 : 2;
}

export default function XmlJsonTool() {
  const [direction, setDirection] = useState<Direction>("xml-to-json");
  const [input, setInput] = useState(XML_SAMPLE);
  const [indent, setIndent] = useState<Indent>("2");
  const [attributes, setAttributes] = useState(true);
  const [parseTypes, setParseTypes] = useState(true);
  const [rootName, setRootName] = useState("root");
  const [useRootKey, setUseRootKey] = useState(true);

  const result = useMemo(() => {
    try {
      const output =
        direction === "xml-to-json"
          ? `${JSON.stringify(xmlToJson(input, { attributes, parseTypes }), null, 2)}\n`
          : jsonToXml(input, {
              indent: indentValue(indent),
              rootName,
              useRootKey,
            });
      return { output, error: "" };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Could not convert this input",
      };
    }
  }, [attributes, direction, indent, input, parseTypes, rootName, useRootKey]);

  const jsonOutput = direction === "xml-to-json";

  function swap() {
    if (!result.output) return;
    setInput(result.output);
    setDirection(jsonOutput ? "json-to-xml" : "xml-to-json");
  }

  return (
    <ToolGrid>
      <Panel
        title={jsonOutput ? "XML input" : "JSON input"}
        description={
          jsonOutput
            ? "Attributes become @name keys and text-only elements become strings."
            : "Use @name keys for attributes and #text for mixed element content."
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInput(jsonOutput ? XML_SAMPLE : JSON_SAMPLE)}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={swap}
              disabled={!result.output}
              aria-label="Use the output as the new input"
              title="Use the output as the new input"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden />
              Swap
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Segmented
            label="Conversion"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "xml-to-json", label: "XML → JSON" },
              { value: "json-to-xml", label: "JSON → XML" },
            ]}
          />
          <TextArea
            mono
            rows={16}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={jsonOutput ? "<root><item>1</item></root>" : '{"root": {"item": 1}}'}
            aria-label={jsonOutput ? "XML input" : "JSON input"}
            spellCheck={false}
          />
          <Alert tone="info" title="Mapping conventions">
            Attributes use <code className="font-mono">@name</code>, text content uses{" "}
            <code className="font-mono">#text</code>, and repeated elements become arrays.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
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
            {jsonOutput ? (
              <div className="space-y-3 pt-1">
                <Toggle
                  label="Include attributes"
                  description="Read XML attributes as @name keys."
                  checked={attributes}
                  onChange={setAttributes}
                />
                <Toggle
                  label="Coerce scalar types"
                  description="Convert true, false, null, and numbers."
                  checked={parseTypes}
                  onChange={setParseTypes}
                />
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <Field label="Fallback root element" hint="Used when the object has multiple keys.">
                  <Input
                    value={rootName}
                    onChange={(event) => setRootName(event.target.value)}
                    aria-label="Fallback root element"
                    spellCheck={false}
                  />
                </Field>
                <Toggle
                  label="Use single key as root"
                  description="A lone valid key becomes the document element."
                  checked={useRootKey}
                  onChange={setUseRootKey}
                />
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title={jsonOutput ? "JSON output" : "XML output"}
        description="Conversion happens in memory on this device."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title={jsonOutput ? "Invalid XML" : "Invalid JSON"}>
              {result.error}
            </Alert>
          ) : (
            <Alert tone="success" title="Conversion complete">
              {result.output.trimEnd().split("\n").length} lines generated.
            </Alert>
          )}
          <CodeOutput
            value={result.output}
            language={jsonOutput ? "json" : "xml"}
            filename={jsonOutput ? "converted.json" : "converted.xml"}
            placeholder="Converted output appears here"
            maxHeight={500}
            wrap={false}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
