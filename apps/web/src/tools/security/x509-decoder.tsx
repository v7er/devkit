import { useMemo, useState } from "react";
import { FileSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  FileDrop,
  InlineRow,
  Panel,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { readFileAsArrayBuffer } from "@/lib/download";
import {
  errorMessage,
  parseCertificate,
  type CertificateInfo,
} from "./logic";

const MAX_FILE_BYTES = 1_000_000;

interface ParseState {
  info: CertificateInfo | null;
  error: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <InlineRow label={label}>
        <span className="break-all">{value}</span>
      </InlineRow>
    </div>
  );
}

export default function X509DecoderTool() {
  const [input, setInput] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [readError, setReadError] = useState("");

  const parsed = useMemo<ParseState>(() => {
    if (bytes) {
      try {
        return { info: parseCertificate(bytes), error: "" };
      } catch (caught) {
        return { info: null, error: errorMessage(caught, "Could not parse the certificate") };
      }
    }
    if (!input.trim()) return { info: null, error: "" };
    try {
      return { info: parseCertificate(input), error: "" };
    } catch (caught) {
      return { info: null, error: errorMessage(caught, "Could not parse the certificate") };
    }
  }, [bytes, input]);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setReadError("Certificate files must be 1 MB or smaller");
      return;
    }
    try {
      const buffer = await readFileAsArrayBuffer(file);
      setBytes(new Uint8Array(buffer));
      setInput("");
      setFileName(file.name);
      setReadError("");
    } catch (caught) {
      setReadError(errorMessage(caught, "Could not read the file"));
    }
  }

  function handleText(value: string) {
    setInput(value);
    setBytes(null);
    setFileName("");
    setReadError("");
  }

  const info = parsed.info;
  const validityTone =
    info?.validity === "valid" ? "success" : info?.validity === "expired" ? "danger" : "warning";
  const validityTitle =
    info?.validity === "valid"
      ? "Certificate is within its validity period"
      : info?.validity === "expired"
        ? "Certificate is expired"
        : "Certificate is not valid yet";

  return (
    <ToolGrid>
      <Panel
        title="Certificate"
        description="Paste PEM or Base64 DER, or load a file up to 1 MB."
        actions={
          input || bytes ? (
            <button
              type="button"
              className="text-xs font-medium text-muted underline-offset-2 hover:text-text hover:underline"
              onClick={() => {
                setInput("");
                setBytes(null);
                setFileName("");
                setReadError("");
              }}
            >
              Clear
            </button>
          ) : null
        }
      >
        <div className="space-y-3">
          <Field
            label="PEM or Base64 DER"
            hint="A full PEM block or the Base64 body is accepted."
          >
            <TextArea
              mono
              rows={13}
              value={input}
              onChange={(event) => handleText(event.target.value)}
              placeholder={"-----BEGIN CERTIFICATE-----\n…"}
              aria-label="Certificate to decode"
            />
          </Field>

          <FileDrop
            accept=".pem,.crt,.cer,.der,.txt"
            onFiles={handleFiles}
            label="Drop a certificate file"
            hint="PEM or DER, up to 1 MB"
          />

          {fileName ? (
            <p className="text-xs text-faint">
              Loaded <span className="font-mono text-muted">{fileName}</span>
            </p>
          ) : null}

          {readError ? (
            <Alert tone="danger" title="File error">
              {readError}
            </Alert>
          ) : null}

          {parsed.error ? (
            <Alert tone="danger" title="Invalid certificate">
              {parsed.error}
            </Alert>
          ) : null}

          <Alert tone="info" title="Fields decoded">
            This reads common X.509 fields: serial number, subject, issuer, validity, subject
            alternative names, public key algorithm, and extension names. It does not verify the
            signature chain or revocation and does not decode every extension value.
          </Alert>
        </div>
      </Panel>

      <Panel title="Details" description={fileName || "Parsed locally"}>
        {info ? (
          <div className="space-y-3">
            <Alert tone={validityTone} title={validityTitle}>
              {info.notBefore.toISOString()} → {info.notAfter.toISOString()}
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">X.509 {info.version}</Badge>
              <Badge tone="neutral">{info.publicKeyDetails}</Badge>
              <Badge tone={info.isCa ? "warning" : "neutral"}>
                {info.isCa === null ? "CA: unknown" : info.isCa ? "CA: yes" : "CA: no"}
              </Badge>
              <Badge tone="neutral">{info.extensions.length} extensions</Badge>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              <DetailRow label="Serial (hex)" value={info.serialNumber} />
              <DetailRow label="Serial (decimal)" value={info.serialDecimal} />
              <DetailRow label="Signature" value={info.signatureAlgorithm} />
              <DetailRow label="Issuer" value={info.issuer} />
              <DetailRow label="Subject" value={info.subject} />
              <DetailRow label="Not before" value={info.notBefore.toISOString()} />
              <DetailRow label="Not after" value={info.notAfter.toISOString()} />
              <DetailRow label="Public key" value={`${info.publicKeyAlgorithm} · ${info.publicKeyDetails}`} />
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <ShieldCheck className="size-3.5" aria-hidden />
                Subject alternative names
              </p>
              {info.subjectAltNames.length ? (
                <ul className="mt-1.5 space-y-1">
                  {info.subjectAltNames.map((name) => (
                    <li key={name} className="break-all font-mono text-[11px] text-faint">
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-faint">None found.</p>
              )}
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <ShieldAlert className="size-3.5" aria-hidden />
                Extensions present
              </p>
              {info.extensions.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {info.extensions.map((extension, index) => (
                    <Badge key={`${extension}-${index}`} tone="neutral">
                      {extension}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-faint">None found.</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Extension values such as key usage, policies, and AIA are named only when known.
                Treat decoded text as informational until verified with a certificate tool.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<FileSearch className="size-6" aria-hidden />}
            title="No certificate decoded"
            description="Paste a PEM or Base64 DER certificate, or drop a file, to inspect its fields."
          />
        )}
      </Panel>
    </ToolGrid>
  );
}
