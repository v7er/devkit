import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Panel,
  Segmented,
  Select,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { formatSql, type SqlDialect, type SqlKeywordCase } from "./logic";

const SAMPLE = `select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true and o.created_at > '2024-01-01' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 10;`;

type Indent = "2" | "4" | "tab";

const DIALECTS: Array<{ value: SqlDialect; label: string }> = [
  { value: "sql", label: "Standard SQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "sqlite", label: "SQLite" },
  { value: "tsql", label: "T-SQL" },
  { value: "plsql", label: "PL/SQL" },
  { value: "bigquery", label: "BigQuery" },
  { value: "snowflake", label: "Snowflake" },
  { value: "redshift", label: "Redshift" },
  { value: "trino", label: "Trino" },
  { value: "spark", label: "Spark SQL" },
];

export default function SqlFormatterTool() {
  const [input, setInput] = useState(SAMPLE);
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [keywordCase, setKeywordCase] = useState<SqlKeywordCase>("upper");
  const [indent, setIndent] = useState<Indent>("2");

  const result = useMemo(() => {
    try {
      const value = indent === "tab" ? "\t" : Number(indent) === 4 ? 4 : 2;
      return {
        output: formatSql(input, { dialect, keywordCase, indent: value }),
        error: "",
      };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Could not format this SQL",
      };
    }
  }, [dialect, indent, input, keywordCase]);

  return (
    <ToolGrid>
      <Panel
        title="SQL input"
        description="Formatted locally with sql-formatter; nothing is executed."
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
            placeholder="select * from users where active = true;"
            aria-label="SQL input"
            spellCheck={false}
          />
          <Select
            label="Dialect"
            value={dialect}
            onChange={(value) => setDialect(value as SqlDialect)}
            options={DIALECTS}
          />
          <Segmented
            label="Keyword case"
            value={keywordCase}
            onChange={setKeywordCase}
            options={[
              { value: "upper", label: "UPPER" },
              { value: "lower", label: "lower" },
              { value: "preserve", label: "Preserve" },
            ]}
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
        </div>
      </Panel>

      <Panel title="Formatted SQL" description="Readable output with the selected dialect rules." flush>
        <div className="space-y-3 p-4">
          {result.error ? (
            <Alert tone="danger" title="Could not format SQL">
              {result.error}
            </Alert>
          ) : (
            <Alert tone="success" title="Formatted">
              {result.output.trimEnd().split("\n").length} lines generated. Formatting changes
              whitespace and keyword case only.
            </Alert>
          )}
          <CodeOutput
            value={result.output}
            language="sql"
            filename="formatted.sql"
            placeholder="Formatted SQL appears here"
            maxHeight={520}
            wrap={false}
          />
        </div>
      </Panel>
    </ToolGrid>
  );
}
