import { useMemo, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Sparkles,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Panel,
  Segmented,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { parseJavaScript, type AstTreeNode } from "./logic";

const SAMPLE = `const greet = (name) => {
  return \`Hello, \${name}!\`;
};

console.log(greet("devkit"));
`;

type SourceType = "module" | "script";
type ExpandMode = "default" | "all" | "none";

function isNodeOpen(node: AstTreeNode, depth: number, mode: ExpandMode, overrides: Record<string, boolean>) {
  const override = overrides[node.id];
  if (override !== undefined) return override;
  if (mode === "all") return true;
  if (mode === "none") return false;
  return depth < 2;
}

function TreeNode({
  node,
  depth,
  mode,
  overrides,
  onToggle,
}: {
  node: AstTreeNode;
  depth: number;
  mode: ExpandMode;
  overrides: Record<string, boolean>;
  onToggle: (id: string, open: boolean) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = isNodeOpen(node, depth, mode, overrides);

  return (
    <div>
      <div
        className="flex items-start gap-1.5 rounded py-0.5 pr-2 hover:bg-surface-2"
        style={{ paddingLeft: depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id, !isOpen)}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.type}`}
            aria-expanded={isOpen}
            className="mt-0.5 shrink-0 rounded text-faint hover:text-text"
          >
            {isOpen ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        )}
        <span className="shrink-0 text-[11px] font-semibold text-accent">{node.type}</span>
        {node.label ? <span className="shrink-0 text-[11px] text-faint">{node.label}</span> : null}
        {node.detail ? (
          <span className="min-w-0 truncate text-[11px] text-muted" title={node.detail}>
            {node.detail}
          </span>
        ) : null}
        {node.location ? (
          <span className="ml-auto shrink-0 pl-2 text-[10px] text-faint">{node.location}</span>
        ) : null}
      </div>
      {hasChildren && isOpen
        ? node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              mode={mode}
              overrides={overrides}
              onToggle={onToggle}
            />
          ))
        : null}
    </div>
  );
}

export default function AstExplorerTool() {
  const [source, setSource] = useState(SAMPLE);
  const [sourceType, setSourceType] = useState<SourceType>("module");
  const [expandMode, setExpandMode] = useState<ExpandMode>("default");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const result = useMemo(() => parseJavaScript(source, sourceType), [source, sourceType]);

  const resetExpansion = () => {
    setExpandMode("default");
    setOverrides({});
  };

  const toggle = (id: string, open: boolean) => {
    setOverrides((current) => ({ ...current, [id]: open }));
  };

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="JavaScript source"
          description="Parsed locally with acorn, including locations."
          actions={
            <Button variant="ghost" size="sm" onClick={() => { setSource(SAMPLE); resetExpansion(); }}>
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Source" htmlFor="ast-source">
              <TextArea
                id="ast-source"
                mono
                rows={20}
                value={source}
                onChange={(event) => { setSource(event.target.value); resetExpansion(); }}
                placeholder="const answer = 42;"
                aria-label="JavaScript source"
              />
            </Field>
            <Segmented
              label="Source type"
              value={sourceType}
              onChange={(value) => { setSourceType(value); resetExpansion(); }}
              options={[
                { value: "module", label: "Module" },
                { value: "script", label: "Script" },
              ]}
            />
            <p className="text-xs text-faint">
              Modules allow import and export declarations. Scripts treat the file as a classic
              global script.
            </p>
          </div>
        </Panel>

        <Panel
          title="Syntax tree"
          description="Expand nodes to inspect the ESTree structure."
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={!result.tree}
                onClick={() => { setExpandMode("all"); setOverrides({}); }}
              >
                <ChevronsUpDown className="size-3.5" aria-hidden />
                Expand
              </Button>
              <Button variant="ghost" size="sm" disabled={!result.tree} onClick={() => { setExpandMode("none"); setOverrides({}); }}>
                <ChevronsDownUp className="size-3.5" aria-hidden />
                Collapse
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Parse error">
                {result.errorLine !== null
                  ? `Line ${result.errorLine}, column ${result.errorColumn ?? 1}: ${result.error}`
                  : result.error}
              </Alert>
            ) : null}

            {result.truncated ? (
              <Alert tone="warning" title="Tree truncated">
                The tree stopped after {result.nodeCount} nodes to keep the view responsive. Parse a
                smaller snippet to see every node.
              </Alert>
            ) : null}

            <div className="flex items-center gap-1.5">
              <Badge tone={result.error ? "warning" : "accent"}>{result.nodeCount} nodes</Badge>
              <Badge>{sourceType}</Badge>
              {result.tree ? <Badge>{result.tree.type}</Badge> : null}
            </div>

            {result.tree ? (
              <div className="max-h-[560px] overflow-auto rounded-lg border border-line bg-surface-2 p-2 font-mono">
                <TreeNode
                  node={result.tree}
                  depth={0}
                  mode={expandMode}
                  overrides={overrides}
                  onToggle={toggle}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-line bg-surface-2 px-4 py-10 text-xs text-faint">
                <Braces className="mr-2 size-4" aria-hidden />
                Fix the parse error to render the tree.
              </div>
            )}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
