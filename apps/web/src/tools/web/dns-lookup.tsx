import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import {
  DNS_QUERY_ENDPOINT,
  DnsError,
  buildDnsQueryUrl,
  normalizeDomain,
  parseDnsResponse,
  type DnsRecordType,
  type DnsResult,
} from "./logic";

const RECORD_TYPES: Array<{ value: DnsRecordType; label: string }> = [
  { value: "A", label: "A — IPv4 address" },
  { value: "AAAA", label: "AAAA — IPv6 address" },
  { value: "CNAME", label: "CNAME — canonical name" },
  { value: "MX", label: "MX — mail exchange" },
  { value: "TXT", label: "TXT — text records" },
  { value: "NS", label: "NS — name servers" },
  { value: "SOA", label: "SOA — start of authority" },
];

function lookupErrorMessage(error: unknown): string {
  if (error instanceof DnsError) return error.message;
  if (error instanceof TypeError) {
    return "Could not reach Cloudflare DNS over HTTPS. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "The lookup failed.";
}

export default function DnsLookupTool() {
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<DnsRecordType>("A");
  const [result, setResult] = useState<DnsResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResult(null);

    let hostname: string;
    try {
      hostname = normalizeDomain(domain);
    } catch (caught) {
      setError(lookupErrorMessage(caught));
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    try {
      const response = await fetch(buildDnsQueryUrl(hostname, type), {
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new DnsError(`Cloudflare returned HTTP ${response.status}. Try again later.`);
      }
      const payload: unknown = await response.json();
      if (controller.signal.aborted) return;
      setResult(parseDnsResponse(payload));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(lookupErrorMessage(caught));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  function cancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setResult(null);
    setNotice("The DNS request was cancelled.");
  }

  return (
    <ToolGrid>
      <Panel
        title="DNS lookup"
        description="Queries Cloudflare's DNS-over-HTTPS resolver directly from your browser."
      >
        <form className="space-y-3" onSubmit={lookup}>
          <Field
            label="Domain name"
            hint="Hostname only, without a scheme, path, or port."
          >
            <Input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              aria-label="Domain name to look up"
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          <Select
            label="Record type"
            value={type}
            onChange={(value) => setType(value as DnsRecordType)}
            options={RECORD_TYPES}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              Look up
            </Button>
            {loading ? (
              <>
                <Button variant="secondary" onClick={cancel}>
                  Cancel
                </Button>
                <Spinner label="Querying Cloudflare" />
              </>
            ) : null}
          </div>
          <p className="break-all text-xs text-faint">
            Request goes to <span className="font-mono">{DNS_QUERY_ENDPOINT}</span>. No other host is
            contacted.
          </p>
        </form>

        {error ? (
          <Alert tone="danger" title="Lookup failed" className="mt-3">
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert tone="info" className="mt-3">
            {notice}
          </Alert>
        ) : null}
      </Panel>

      <Panel
        title="Answer"
        description={result ? `${result.records.length} record${result.records.length === 1 ? "" : "s"} returned` : "Results from the resolver appear here."}
      >
        {loading ? (
          <div className="py-8 text-center">
            <Spinner label="Resolving domain" />
          </div>
        ) : result ? (
          <div className="space-y-3">
            {result.status !== 0 ? (
              <Alert tone="warning" title="Resolver status">
                {result.statusMessage || `The resolver returned status ${result.status}.`}
              </Alert>
            ) : null}
            {result.truncated ? (
              <Alert tone="warning">The resolver marked this answer as truncated.</Alert>
            ) : null}
            {result.records.length === 0 ? (
              <EmptyState
                title="No records returned"
                description={
                  result.status === 0
                    ? "The domain exists but has no records of this type."
                    : "Try a different domain or record type."
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {result.records.map((record, index) => (
                  <li key={`${record.name}-${record.type}-${index}`} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-all font-mono text-xs text-text">{record.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-faint">
                        {record.type} · TTL {record.ttl}s
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{record.data}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <EmptyState
            title="No lookup yet"
            description="Enter a domain and choose a record type. The query runs only after you press Look up."
          />
        )}
      </Panel>
    </ToolGrid>
  );
}
