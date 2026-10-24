import { useMemo, useState } from "react";
import { ArrowLeftRight, Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Panel,
  Segmented,
  Select,
  TextArea,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import { jsonToYaml, yamlToJson } from "./logic";

const YAML_SAMPLE = `project: devkit
private: true
tools:
  - id: yaml-json
    local: true
  - id: csv-json
    local: true
meta:
  stars: 1280
  tags: [yaml, json, config]
`;

const JSON_SAMPLE = `{
  "project": "devkit",
  "private": true,
  "tools": [
    { "id": "yaml-json", "local": true },
    { "id": "csv-json", "local": true }
  ]
}
`;

type Direction = "yaml-to-json" | "json-to-yaml";

export default function YamlJsonTool() {
  const [direction, setDirection] = useState<Direction>("yaml-to-json");
  const [input, setInput] = useState(YAML_SAMPLE);
  const [indent, setIndent] = useState("2");
  const [multiDocument, setMultiDocument] = useState(false);

  const result = useMemo(() => {
    try {
      const width = Number(indent);
      const output =
        direction === "yaml-to-json"
          ? yamlToJson(input, { indent: width })
          : jsonToYaml(input, { indent: width, multiDocument });
      return { output, error: "" };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Could not convert this input",
      };
    }
  }, [direction, indent, input, multiDocument]);

  const jsonOutput = direction === "yaml-to-json";

  function swap() {
    if (!result.output) return;
    setInput(result.output);
    setDirection(jsonOutput ? "json-to-yaml" : "yaml-to-json");
  }

  function loadSample() {
    setInput(jsonOutput ? YAML_SAMPLE : JSON_SAMPLE);
  }

  return (
    <ToolGrid>
      <Panel
        title={jsonOutput ? "YAML input" : "JSON input"}
        description={
          jsonOutput
            ? "Multi-document streams convert to a JSON array."
            : "Objects convert to YAML mappings and arrays to sequences."
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={loadSample}>
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
              { value: "yaml-to-json", label: "YAML → JSON" },
              { value: "json-to-yaml", label: "JSON → YAML" },
            ]}
          />
          <TextArea
            mono
            rows={16}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={jsonOutput ? "key: value" : '{"key": "value"}'}
            aria-label={jsonOutput ? "YAML input" : "JSON input"}
            spellCheck={false}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Indentation"
              value={indent}
              onChange={setIndent}
              options={[
                { value: "2", label: "2 spaces" },
                { value: "4", label: "4 spaces" },
              ]}
            />
            {jsonOutput ? null : (
              <div className="flex items-end pb-2">
                <Toggle
                  label="Split array into documents"
                  description="Write each top-level array item as its own YAML document."
                  checked={multiDocument}
                  onChange={setMultiDocument}
                />
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title={jsonOutput ? "JSON output" : "YAML output"}
        description="Conversion runs locally in your browser."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title={jsonOutput ? "Invalid YAML" : "Invalid JSON"}>
              {result.error}
            </Alert>
          ) : (
            <Alert tone="success" title="Conversion complete">
              {result.output.trimEnd().split("\n").length} lines of{" "}
              {jsonOutput ? "JSON" : "YAML"} generated.
            </Alert>
          )}
          <CodeOutput
            value={result.output}
            language={jsonOutput ? "json" : "yaml"}
            filename={jsonOutput ? "converted.json" : "converted.yaml"}
            placeholder="Converted output appears here"
            maxHeight={460}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
