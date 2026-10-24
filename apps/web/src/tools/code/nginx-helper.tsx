import { useMemo, useState } from "react";
import { Braces, Server, ShieldCheck } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { buildNginxConfig, defaultNginxOptions, validateBraces, type NginxOptions } from "./logic";

const SAMPLE_CONFIG = `server {
    listen 80;
    server_name example.com;

    location / {
        root /var/www/site;
    }
}`;

export default function NginxHelperTool() {
  const [options, setOptions] = useState<NginxOptions>(defaultNginxOptions);
  const [checkInput, setCheckInput] = useState("");

  const result = useMemo(() => buildNginxConfig(options), [options]);
  const braceCheck = checkInput.trim() ? validateBraces(checkInput) : null;

  const update = <K extends keyof NginxOptions>(key: K, value: NginxOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Server" description="Generates a complete server block from these fields.">
          <div className="space-y-4">
            <Segmented
              label="Mode"
              value={options.mode}
              onChange={(value) => update("mode", value)}
              options={[
                { value: "static", label: "Static files" },
                { value: "proxy", label: "Reverse proxy" },
              ]}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Server name"
                htmlFor="nginx-server-name"
                hint="Space-separated domains, *.example.com, or _."
              >
                <Input
                  id="nginx-server-name"
                  value={options.serverName}
                  onChange={(event) => update("serverName", event.target.value)}
                  className="font-mono"
                  aria-label="Server name"
                />
              </Field>
              <Field label="Listen port" htmlFor="nginx-port" hint="1–65535.">
                <Input
                  id="nginx-port"
                  value={options.listenPort}
                  onChange={(event) => update("listenPort", event.target.value)}
                  inputMode="numeric"
                  className="font-mono"
                  aria-label="Listen port"
                />
              </Field>
            </div>

            {options.mode === "static" ? (
              <Field
                label="Document root"
                htmlFor="nginx-root"
                hint="Absolute path served by the location block."
              >
                <Input
                  id="nginx-root"
                  value={options.root}
                  onChange={(event) => update("root", event.target.value)}
                  className="font-mono"
                  aria-label="Document root"
                />
              </Field>
            ) : (
              <div className="space-y-3">
                <Field
                  label="Proxy target"
                  htmlFor="nginx-proxy-target"
                  hint="Include the scheme and port, for example http://localhost:3000."
                >
                  <Input
                    id="nginx-proxy-target"
                    value={options.proxyTarget}
                    onChange={(event) => update("proxyTarget", event.target.value)}
                    className="font-mono"
                    aria-label="Proxy target"
                  />
                </Field>
                <Toggle
                  label="WebSocket upgrade"
                  description="Forward Upgrade and Connection headers."
                  checked={options.websocket}
                  onChange={(checked) => update("websocket", checked)}
                />
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
              <Toggle
                label="TLS / SSL"
                description="Add certificate directives to the server block."
                checked={options.ssl}
                onChange={(checked) => update("ssl", checked)}
              />
              {options.ssl ? (
                <>
                  <Field label="Certificate path" htmlFor="nginx-cert" hint="Absolute path to the full chain.">
                    <Input
                      id="nginx-cert"
                      value={options.certPath}
                      onChange={(event) => update("certPath", event.target.value)}
                      className="font-mono"
                      aria-label="Certificate path"
                    />
                  </Field>
                  <Field label="Key path" htmlFor="nginx-key" hint="Absolute path to the private key.">
                    <Input
                      id="nginx-key"
                      value={options.keyPath}
                      onChange={(event) => update("keyPath", event.target.value)}
                      className="font-mono"
                      aria-label="Certificate key path"
                    />
                  </Field>
                  <Toggle
                    label="Redirect HTTP to HTTPS"
                    description="Adds a port 80 server that returns 301."
                    checked={options.redirectHttp}
                    onChange={(checked) => update("redirectHttp", checked)}
                  />
                </>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Max body size"
                htmlFor="nginx-body"
                hint="For example 10m, 512k, or 0 for unlimited."
              >
                <Input
                  id="nginx-body"
                  value={options.clientMaxBodySize}
                  onChange={(event) => update("clientMaxBodySize", event.target.value)}
                  className="font-mono"
                  aria-label="Maximum client body size"
                />
              </Field>
              <Toggle
                label="Gzip"
                description="Compress text, JSON, and SVG responses."
                checked={options.gzip}
                onChange={(checked) => update("gzip", checked)}
                className="pt-6"
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="nginx.conf"
          description="Brace balance is verified before the snippet is returned."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCheckInput(SAMPLE_CONFIG);
              }}
            >
              <Braces className="size-3.5" aria-hidden />
              Try brace check
            </Button>
          }
        >
          <div className="space-y-3">
            {result.errors.map((error) => (
              <Alert key={error} tone="danger" title="Fix this field">
                {error}
              </Alert>
            ))}

            {result.warnings.map((warning) => (
              <Alert key={warning} tone="warning">
                {warning}
              </Alert>
            ))}

            <CodeOutput
              value={result.config}
              language="nginx"
              filename="nginx.conf"
              placeholder="Fix the errors to generate a server block"
              maxHeight={460}
              wrap={false}
            />

            {result.config ? (
              <div className="flex items-center gap-1.5 text-xs text-faint">
                <ShieldCheck className="size-3.5" aria-hidden />
                Braces balanced · {result.config.split("\n").length} lines
              </div>
            ) : null}

            <div className="space-y-2 border-t border-line pt-3">
              <Field
                label="Brace check"
                htmlFor="nginx-brace-input"
                hint="Paste any nginx snippet to verify its braces."
              >
                <TextArea
                  id="nginx-brace-input"
                  mono
                  rows={5}
                  value={checkInput}
                  onChange={(event) => setCheckInput(event.target.value)}
                  placeholder={SAMPLE_CONFIG}
                  aria-label="Config to check for balanced braces"
                />
              </Field>
              {braceCheck ? (
                braceCheck.balanced ? (
                  <Alert tone="success">Braces are balanced.</Alert>
                ) : (
                  <Alert tone="danger" title="Brace problem">
                    <ul className="list-disc space-y-1 pl-4">
                      {braceCheck.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </Alert>
                )
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-xs text-faint">
              <Server className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Review paths and certificate locations before deploying this block.
            </p>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
