import { useMemo, useState } from "react";
import { Alert, Button, CodeOutput, Panel, TextArea, ToolGrid, ToolStack } from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import { minifyCss } from "./logic";

const SAMPLE = `/* Card styles */
.card {
  padding: 16px 24px;
  background: url("images/paper texture.png");
  content: "keep  spaces";
}

.card:hover { color: #ffffff; }
`;

export default function CssMinifierTool() {
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    try {
      return { value: minifyCss(input), error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not minify this CSS.",
      };
    }
  }, [input]);

  const before = new TextEncoder().encode(input).length;
  const after = result.error ? 0 : new TextEncoder().encode(result.value).length;
  const saved = before > 0 && !result.error ? ((before - after) / before) * 100 : null;

  return (
    <ToolGrid>
      <Panel
        title="CSS input"
        description="Comments and incidental whitespace are removed. Strings and url() contents stay intact."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setInput("")}>
            Clear
          </Button>
        }
      >
        <TextArea
          mono
          rows={18}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste CSS here…"
          aria-label="CSS to minify"
        />
      </Panel>

      <ToolStack>
        <Panel title="Minified CSS" description="Conservative output that remains valid CSS.">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface-2 p-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Before</p>
                <p className="mt-0.5 font-mono text-sm text-text">{formatBytes(before)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">After</p>
                <p className="mt-0.5 font-mono text-sm text-text">
                  {result.error ? "—" : formatBytes(after)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Saved</p>
                <p className="mt-0.5 font-mono text-sm text-text">
                  {saved === null ? "—" : `${saved.toFixed(1)}%`}
                </p>
              </div>
            </div>

            {result.error ? (
              <Alert tone="danger" title="Invalid CSS">
                {result.error}
              </Alert>
            ) : null}

            <CodeOutput
              value={result.value}
              language="css"
              filename="minified.css"
              placeholder="Minified CSS appears here"
              maxHeight={420}
            />
          </div>
        </Panel>
      </ToolStack>
    </ToolGrid>
  );
}
