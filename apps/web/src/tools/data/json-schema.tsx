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
import { jsonToJsonSchema } from "./logic";

const SAMPLE = `{
  "id": 1,
  "name": "devkit",
  "tags": ["data", "local"],
  "owner": { "login": "ada", "verified": true },
  "tools": [
    { "id": "json-formatter", "stars": 12 },
    { "id": "csv-json", "stars": 8, "featured": true }
  ]
}`;

export default function JsonSchemaTool() {
  const [input, setInput] = useState(SAMPLE);
  const [title, setTitle] = useState("Project");
  const [required, setRequired] = useState(true);
  const [additionalProperties, setAdditionalProperties] = useState(false);

  const result = useMemo(() => {
    try {
      const output = jsonToJsonSchema(input, { title, required, additionalProperties });
      return { output, error: "" };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Could not infer a schema from this JSON",
      };
    }
  }, [additionalProperties, input, required, title]);

  return (
    <ToolGrid>
      <Panel
        title="JSON sample"
        description="Objects in the same array are merged into one schema."
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
          <Field label="Schema title" hint="Optional; omitted when left blank.">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Project"
              aria-label="Schema title"
              spellCheck={false}
            />
          </Field>
          <Toggle
            label="Mark fields as required"
            description="Every property present in the sample becomes required."
            checked={required}
            onChange={setRequired}
          />
          <Toggle
            label="Disallow unknown properties"
            description="Set additionalProperties to false on every object."
            checked={additionalProperties}
            onChange={setAdditionalProperties}
          />
        </div>
      </Panel>

      <Panel
        title="JSON Schema output"
        description="Draft-07 schema inferred from this sample."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title="Invalid JSON">
              {result.error}
            </Alert>
          ) : (
            <Alert tone="info" title="Single-sample inference">
              Arrays of objects are merged, and null values widen the type. Validate against real
              data before publishing the schema.
            </Alert>
          )}
          <CodeOutput
            value={result.output}
            language="json (draft-07)"
            filename="schema.json"
            placeholder="Generated schema appears here"
            maxHeight={520}
            wrap={false}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
