import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  TextArea,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import { jsonToTypescript } from "./logic";

const SAMPLE = `{
  "id": 42,
  "name": "devkit",
  "tags": ["offline", "tools"],
  "owner": { "login": "ada", "verified": true },
  "tools": [
    { "id": "json-formatter", "stars": 12 },
    { "id": "csv-json", "stars": 8, "featured": true }
  ],
  "releases": null
}`;

export default function JsonToTypescriptTool() {
  const [input, setInput] = useState(SAMPLE);
  const [rootName, setRootName] = useState("Project");
  const [readonly, setReadonly] = useState(false);

  const result = useMemo(() => {
    try {
      const output = jsonToTypescript(input, { rootName, readonly });
      return {
        output,
        declarations: output.match(/^export (?:interface|type) /gm)?.length ?? 0,
        error: "",
      };
    } catch (error) {
      return {
        output: "",
        declarations: 0,
        error: error instanceof Error ? error.message : "Could not infer types from this JSON",
      };
    }
  }, [input, readonly, rootName]);

  return (
    <ToolGrid>
      <Panel
        title="JSON sample"
        description="Objects in the same array are merged into one type."
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
            rows={16}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='{"id": 1, "name": "Ada"}'
            aria-label="JSON sample"
            spellCheck={false}
          />
          <Field
            label="Root type name"
            hint="Converted to PascalCase and sanitized into a valid identifier."
          >
            <Input
              value={rootName}
              onChange={(event) => setRootName(event.target.value)}
              placeholder="Project"
              aria-label="Root type name"
              spellCheck={false}
            />
          </Field>
          <Toggle
            label="Readonly properties"
            description="Prefix every generated property with readonly."
            checked={readonly}
            onChange={setReadonly}
          />
        </div>
      </Panel>

      <Panel
        title="TypeScript output"
        description="Interfaces and type aliases inferred from this sample."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title="Invalid JSON">
              {result.error}
            </Alert>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
              <span className="text-faint">Declarations</span>
              <span className="font-mono text-text">{result.declarations}</span>
            </div>
          )}
          <CodeOutput
            value={result.output}
            language="typescript"
            filename="types.ts"
            placeholder="Generated TypeScript appears here"
            maxHeight={500}
            wrap={false}
          />
          <Alert tone="info" title="Single-sample inference">
            Nullable and optional fields reflect this sample. Check the result against your real
            data before using it.
          </Alert>
        </div>
      </Panel>
    </ToolGrid>
  );
}
