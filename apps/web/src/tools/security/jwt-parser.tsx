import { useMemo, useState } from "react";
import { Braces, Clock, ShieldAlert, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  CopyButton,
  EmptyState,
  Field,
  Panel,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { decodeJwt, describeClaims } from "./logic";

const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJkZXZraXQiLCJzdWIiOiJkZW1vLXVzZXIiLCJhdWQiOiJkZXZraXQtYXBwIiwiaWF0IjoxNzAwMDAwMDAwLCJuYmYiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDA4NjQwMCwicm9sZSI6ImFkbWluIn0." +
  "ZGVtby1zaWduYXR1cmU";

export default function JwtParserTool() {
  const [token, setToken] = useState("");

  const parsed = useMemo(() => {
    if (!token.trim()) return { jwt: null, error: "" };
    try {
      return { jwt: decodeJwt(token), error: "" };
    } catch (error) {
      return {
        jwt: null,
        error: error instanceof Error ? error.message : "Could not decode this token",
      };
    }
  }, [token]);

  const claims = useMemo(
    () => (parsed.jwt ? describeClaims(parsed.jwt.payload) : []),
    [parsed.jwt],
  );

  const expiration = claims.find((claim) => claim.key === "exp");
  const notBefore = claims.find((claim) => claim.key === "nbf");
  const algorithm = parsed.jwt?.header.alg;

  return (
    <ToolGrid>
      <Panel
        title="Token"
        description="Paste a JWT or Bearer token. Decoding happens in memory."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setToken(SAMPLE)}>
            <Sparkles className="size-3.5" aria-hidden />
            Sample
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="JWT" hint="Three Base64URL segments separated by dots.">
            <TextArea
              mono
              rows={14}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="eyJhbGciOi…"
              aria-label="JWT to decode"
            />
          </Field>
          <Alert tone="warning" title="Signature not verified">
            This tool only decodes the token. A well-formed token is not a trusted token; verify
            the signature and claims before using any value.
          </Alert>
        </div>
      </Panel>

      <Panel title="Decoded token" description="Header, claims, and signature" flush>
        <div className="space-y-3 p-4">
          {parsed.error ? (
            <Alert tone="danger" title="Invalid token">
              {parsed.error}
            </Alert>
          ) : null}

          {!parsed.error && !parsed.jwt ? (
            <EmptyState
              icon={<Braces className="size-6" aria-hidden />}
              title="No token yet"
              description="Paste a JWT on the left to inspect its header, claims, and signature."
            />
          ) : null}

          {parsed.jwt ? (
            <>
              {expiration?.state === "expired" ? (
                <Alert tone="danger" title="Token is expired">
                  Expired at {expiration.time}. Servers should reject this token.
                </Alert>
              ) : null}
              {notBefore?.state === "not-yet-valid" ? (
                <Alert tone="warning" title="Token is not active yet">
                  Valid from {notBefore.time}.
                </Alert>
              ) : null}
              {expiration?.state === "valid" && notBefore?.state !== "not-yet-valid" ? (
                <Alert tone="success" title="Within the validity window">
                  Expires at {expiration.time}.
                </Alert>
              ) : null}
              {!expiration ? (
                <Alert tone="info" title="No expiration claim">
                  This token carries no <code>exp</code> claim, so its lifetime is decided by the
                  issuer.
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">alg {typeof algorithm === "string" ? algorithm : "none"}</Badge>
                <Badge tone="neutral">typ {typeof parsed.jwt.header.typ === "string" ? parsed.jwt.header.typ : "unknown"}</Badge>
                <Badge tone="neutral">
                  {claims.length} {claims.length === 1 ? "claim" : "claims"}
                </Badge>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <CodeOutput
                  value={JSON.stringify(parsed.jwt.header, null, 2)}
                  language="header.json"
                  filename="jwt-header.json"
                  maxHeight={200}
                />
                <CodeOutput
                  value={JSON.stringify(parsed.jwt.payload, null, 2)}
                  language="payload.json"
                  filename="jwt-payload.json"
                  maxHeight={200}
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
                  <Clock className="size-3.5 text-accent" aria-hidden />
                  <p className="text-xs font-semibold text-muted">Claims</p>
                </div>
                <div className="divide-y divide-line">
                  {claims.map((claim) => (
                    <div
                      key={claim.key}
                      className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-start gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-text">{claim.key}</p>
                        <p className="truncate text-[12px] text-faint">{claim.label}</p>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-mono text-xs text-muted">{claim.value}</p>
                        {claim.time ? <p className="text-[12px] text-faint">{claim.time}</p> : null}
                        {claim.state !== "unknown" ? (
                          <Badge tone={claim.state === "valid" ? "accent" : "warning"}>
                            {claim.state}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <ShieldAlert className="size-3.5" aria-hidden />
                    Signature
                  </p>
                  <CopyButton value={parsed.jwt.signature} />
                </div>
                <p className="mt-1 break-all font-mono text-[12px] text-faint">
                  {parsed.jwt.signature || "(empty)"}
                </p>
                <p className="mt-2 break-all font-mono text-[12px] text-faint">
                  hex: {parsed.jwt.signatureHex || "(empty)"}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-faint">
                  The signature bytes are shown for inspection only. Use the JWT Verifier with the
                  issuer's key to check them.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </Panel>
    </ToolGrid>
  );
}
