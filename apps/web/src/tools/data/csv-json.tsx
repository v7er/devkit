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
import { csvToJson, jsonToCsv, type CsvDelimiter } from "./logic";

const CSV_SAMPLE = `name,role,location
Ada Lovelace,engineer,London
"Grace Hopper",admiral,"New York, NY"
"Katherine Johnson",""mathematician"",Hampton
`;

const JSON_SAMPLE = `[
  { "name": "Ada Lovelace", "role": "engineer", "location": "London" },
  { "name": "Grace Hopper", "role": "admiral", "location": "New York, NY" },
  { "name": "Katherine Johnson", "role": "mathematician", "location": "Hampton" }
]
`;

type Direction = "csv-to-json" | "json-to-csv";

export default function CsvJsonTool() {
  const [direction, setDirection] = useState<Direction>("csv-to-json");
  const [input, setInput] = useState(CSV_SAMPLE);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);

  const result = useMemo(() => {
    try {
      if (direction === "csv-to-json") {
        const value = csvToJson(input, { delimiter, hasHeader });
        return {
          output: `${JSON.stringify(value, null, 2)}\n`,
          count: Array.isArray(value) ? value.length : 0,
          error: "",
        };
      }
      const output = jsonToCsv(input, { delimiter, includeHeader });
      const lines = output.trimEnd().split("\n").length;
      return {
        output,
        count: Math.max(0, lines - (includeHeader ? 1 : 0)),
        error: "",
      };
    } catch (error) {
      return {
        output: "",
        count: 0,
        error: error instanceof Error ? error.message : "Could not convert this input",
      };
    }
  }, [delimiter, direction, hasHeader, includeHeader, input]);

  const csvOutput = direction === "csv-to-json" ? false : true;

  function swap() {
    if (!result.output) return;
    setInput(result.output);
    setDirection(csvOutput ? "json-to-csv" : "csv-to-json");
  }

  function loadSample() {
    setInput(csvOutput ? JSON_SAMPLE : CSV_SAMPLE);
  }

  return (
    <ToolGrid>
      <Panel
        title={csvOutput ? "JSON input" : "CSV input"}
        description={
          csvOutput
            ? "Arrays of objects, arrays of arrays, and arrays of values are supported."
            : "RFC 4180 quoting handles commas, quotes, and line breaks inside fields."
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
              { value: "csv-to-json", label: "CSV → JSON" },
              { value: "json-to-csv", label: "JSON → CSV" },
            ]}
          />
          <TextArea
            mono
            rows={16}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={csvOutput ? '[{"name": "Ada"}]' : "name,role\nAda,engineer"}
            aria-label={csvOutput ? "JSON input" : "CSV input"}
            spellCheck={false}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Delimiter"
              value={delimiter}
              onChange={(value) => setDelimiter(value as CsvDelimiter)}
              options={[
                { value: ",", label: "Comma (,)" },
                { value: ";", label: "Semicolon (;)" },
                { value: "\t", label: "Tab" },
                { value: "|", label: "Pipe (|)" },
              ]}
            />
            <div className="flex items-end pb-1">
              {csvOutput ? (
                <Toggle
                  label="Include header row"
                  description="Write column names as the first row."
                  checked={includeHeader}
                  onChange={setIncludeHeader}
                />
              ) : (
                <Toggle
                  label="First row is a header"
                  description="Use the first row as object keys."
                  checked={hasHeader}
                  onChange={setHasHeader}
                />
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={csvOutput ? "CSV output" : "JSON output"}
        description="Quoted fields are escaped according to RFC 4180."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title={csvOutput ? "Invalid JSON" : "Invalid CSV"}>
              {result.error}
            </Alert>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
              <span className="text-faint">{csvOutput ? "Rows written" : "Items converted"}</span>
              <span className="font-mono text-text">{result.count}</span>
            </div>
          )}
          <CodeOutput
            value={result.output}
            language={csvOutput ? "csv" : "json"}
            filename={csvOutput ? "converted.csv" : "converted.json"}
            placeholder="Converted output appears here"
            maxHeight={460}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
