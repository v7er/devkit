import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Panel,
  Spinner,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatBytes, formatNumber } from "@/lib/utils";
import terserBundleUrl from "../../../node_modules/terser/dist/bundle.min.js?url";

interface TerserResponse {
  code?: string;
  error?: unknown;
  warnings?: string[];
}

interface TerserModule {
  minify: (code: string, options?: Record<string, unknown>) => Promise<TerserResponse> | TerserResponse;
}

const SAMPLE = `function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}

export { greet };
`;

const MAX_INPUT = 1_000_000;

let terserPromise: Promise<TerserModule> | null = null;

function readGlobalTerser(): TerserModule | null {
  const candidate = (globalThis as { Terser?: unknown }).Terser;
  if (!candidate || typeof candidate !== "object") return null;
  const minify = (candidate as { minify?: unknown }).minify;
  return typeof minify === "function" ? (candidate as TerserModule) : null;
}

function loadTerser(): Promise<TerserModule> {
  const existing = readGlobalTerser();
  if (existing) return Promise.resolve(existing);
  if (terserPromise) return terserPromise;

  terserPromise = new Promise<TerserModule>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = terserBundleUrl;
    script.async = true;
    script.onload = () => {
      const loaded = readGlobalTerser();
      if (loaded) resolve(loaded);
      else reject(new Error("The Terser bundle loaded but did not expose a minify function."));
    };
    script.onerror = () => reject(new Error("Could not load the Terser browser bundle."));
    document.head.appendChild(script);
  });

  terserPromise.catch(() => {
    terserPromise = null;
  });
  return terserPromise;
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Minification failed.";
}

type LoadStatus = "loading" | "ready" | "error";

export default function JsMinifierTool() {
  const [code, setCode] = useState(SAMPLE);
  const [compress, setCompress] = useState(true);
  const [mangle, setMangle] = useState(true);
  const [dropConsole, setDropConsole] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ before: number; after: number; ms: number } | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const terserRef = useRef<TerserModule | null>(null);

  useEffect(() => {
    let active = true;
    loadTerser().then(
      (module) => {
        if (!active) return;
        terserRef.current = module;
        setStatus("ready");
      },
      (reason: unknown) => {
        if (!active) return;
        setStatus("error");
        setLoadError(describeFailure(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retryLoad = () => {
    setStatus("loading");
    setLoadError("");
    setAttempt((value) => value + 1);
  };

  const minify = async () => {
    const terser = terserRef.current;
    if (!terser) return;
    if (!code.trim()) {
      setError("Paste JavaScript to minify.");
      return;
    }
    if (code.length > MAX_INPUT) {
      setError(
        `Input is ${formatNumber(code.length)} characters. Keep it under ${formatNumber(MAX_INPUT)} for this tool.`,
      );
      return;
    }

    setBusy(true);
    setError("");
    try {
      const started = performance.now();
      const response = await terser.minify(code, {
        compress: compress ? { passes: 2, drop_console: dropConsole } : false,
        mangle,
        format: { comments: false },
        sourceMap: false,
      });
      if (response.error) throw response.error;
      if (typeof response.code !== "string" || response.code.length === 0) {
        throw new Error("Terser returned no output for this input.");
      }
      setOutput(response.code);
      setStats({
        before: new TextEncoder().encode(code).length,
        after: new TextEncoder().encode(response.code).length,
        ms: Math.round(performance.now() - started),
      });
    } catch (reason) {
      setError(describeFailure(reason));
    } finally {
      setBusy(false);
    }
  };

  const savings = stats && stats.before > 0 ? Math.max(0, 100 - (stats.after / stats.before) * 100) : 0;

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="JavaScript input"
          description="Minified with Terser in this browser tab."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setCode(SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="Source" htmlFor="minifier-source">
              <TextArea
                id="minifier-source"
                mono
                rows={20}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="function add(a, b) { return a + b; }"
                aria-label="JavaScript to minify"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Compress"
                description="Fold constants and shorten expressions."
                checked={compress}
                onChange={setCompress}
              />
              <Toggle
                label="Mangle names"
                description="Rename local variables to short identifiers."
                checked={mangle}
                onChange={setMangle}
              />
              <Toggle
                label="Drop console calls"
                description="Remove console.* when compression is on."
                checked={dropConsole}
                onChange={setDropConsole}
              />
            </div>

            {status === "loading" ? (
              <Alert tone="info">
                <Spinner label="Loading the Terser bundle" />
              </Alert>
            ) : null}

            {status === "error" ? (
              <Alert tone="danger" title="Terser could not load">
                {loadError}
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={retryLoad}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : null}

            {status === "ready" ? (
              <Button variant="primary" onClick={() => void minify()} disabled={busy}>
                <Play className="size-3.5" aria-hidden />
                {busy ? "Minifying…" : "Minify"}
              </Button>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Minified output"
          description="Byte sizes are measured from UTF-8 encoded text."
          actions={stats ? <Badge tone="accent">{savings.toFixed(1)}% smaller</Badge> : null}
        >
          <div className="space-y-3">
            {error ? (
              <Alert tone="danger" title="Minification failed">
                {error}
              </Alert>
            ) : null}

            {stats ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Before</p>
                  <p className="mt-0.5 font-mono text-text">{formatBytes(stats.before)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">After</p>
                  <p className="mt-0.5 font-mono text-text">{formatBytes(stats.after)}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <p className="text-faint">Time</p>
                  <p className="mt-0.5 font-mono text-text">{stats.ms} ms</p>
                </div>
              </div>
            ) : null}

            <CodeOutput
              value={output}
              language="javascript"
              filename="minified.js"
              placeholder={
                status === "ready" ? "Press Minify to see the compressed output" : "Loading Terser…"
              }
              maxHeight={480}
              wrap={false}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
