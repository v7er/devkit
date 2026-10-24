import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Panel,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { formatGraphql } from "./logic";

const OPERATION_SAMPLE = `query GetUser($id: ID!) { user(id: $id) { id name email posts(first: 5) { title createdAt } } } mutation UpdateName($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }`;

const SCHEMA_SAMPLE = `type User { id: ID! name: String! email: String posts(first: Int = 5): [Post!]! } type Post { id: ID! title: String! createdAt: String } type Query { user(id: ID!): User }`;

export default function GraphqlFormatterTool() {
  const [input, setInput] = useState(OPERATION_SAMPLE);

  const result = useMemo(() => {
    try {
      return { formatted: formatGraphql(input), error: "" };
    } catch (error) {
      return {
        formatted: null,
        error: error instanceof Error ? error.message : "Could not parse this GraphQL",
      };
    }
  }, [input]);

  return (
    <ToolGrid>
      <Panel
        title="GraphQL input"
        description="Accepts operations, fragments, type definitions, and schema extensions."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setInput(OPERATION_SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Operations
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setInput(SCHEMA_SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Schema
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextArea
            mono
            rows={18}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="query { user { id name } }"
            aria-label="GraphQL input"
            spellCheck={false}
          />
          <Alert tone="info">
            Parsing validates GraphQL syntax only. It does not check names against a schema or run
            any operation.
          </Alert>
        </div>
      </Panel>

      <Panel
        title="Formatted GraphQL"
        description="Canonical indentation with graphql print rules."
        flush
      >
        <div className="space-y-3 p-4">
          {result.error || !result.formatted ? (
            <Alert tone="danger" title="Invalid GraphQL">
              {result.error || "GraphQL could not be formatted"}
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Definitions</p>
                <p className="mt-0.5 font-mono text-text">{result.formatted.definitions}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Kinds</p>
                <p className="mt-0.5 font-mono text-text">
                  {result.formatted.kinds.join(", ")}
                </p>
              </div>
            </div>
          )}
          <CodeOutput
            value={result.formatted?.output ?? ""}
            language="graphql"
            filename="formatted.graphql"
            placeholder="Formatted GraphQL appears here"
            maxHeight={520}
            wrap={false}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
