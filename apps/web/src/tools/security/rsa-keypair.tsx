import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Panel,
  Select,
  Spinner,
  ToolGrid,
} from "@/components/ui";
import { derToPem, errorMessage } from "./logic";

type AlgorithmId =
  | "RSA-OAEP-2048"
  | "RSA-OAEP-3072"
  | "RSA-OAEP-4096"
  | "RSA-PSS-2048"
  | "RSA-PSS-3072"
  | "ECDSA-P256";

interface AlgorithmOption {
  id: AlgorithmId;
  label: string;
  description: string;
}

const ALGORITHMS: AlgorithmOption[] = [
  {
    id: "RSA-OAEP-2048",
    label: "RSA-OAEP · 2048 bit",
    description: "Encryption with OAEP padding. A common baseline for new keys.",
  },
  {
    id: "RSA-OAEP-3072",
    label: "RSA-OAEP · 3072 bit",
    description: "Encryption with a larger modulus and slower generation.",
  },
  {
    id: "RSA-OAEP-4096",
    label: "RSA-OAEP · 4096 bit",
    description: "Encryption with the largest supported modulus. Generation can take a while.",
  },
  {
    id: "RSA-PSS-2048",
    label: "RSA-PSS · 2048 bit",
    description: "Signing with PSS padding. Use the matching verify algorithm.",
  },
  {
    id: "RSA-PSS-3072",
    label: "RSA-PSS · 3072 bit",
    description: "Signing with a larger modulus.",
  },
  {
    id: "ECDSA-P256",
    label: "ECDSA · P-256",
    description: "Compact signing keys with the P-256 curve and SHA-256.",
  },
];

interface GeneratedKeys {
  algorithm: AlgorithmId;
  privatePem: string;
  publicPem: string;
}

async function createKeyPair(algorithm: AlgorithmId): Promise<CryptoKeyPair> {
  if (algorithm === "ECDSA-P256") {
    return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
  }

  let name: "RSA-OAEP" | "RSA-PSS";
  let modulusLength: number;
  switch (algorithm) {
    case "RSA-OAEP-2048":
      name = "RSA-OAEP";
      modulusLength = 2048;
      break;
    case "RSA-OAEP-3072":
      name = "RSA-OAEP";
      modulusLength = 3072;
      break;
    case "RSA-OAEP-4096":
      name = "RSA-OAEP";
      modulusLength = 4096;
      break;
    case "RSA-PSS-2048":
      name = "RSA-PSS";
      modulusLength = 2048;
      break;
    case "RSA-PSS-3072":
      name = "RSA-PSS";
      modulusLength = 3072;
      break;
    default:
      throw new Error("Unsupported key algorithm");
  }

  const params: RsaHashedKeyGenParams = {
    name,
    modulusLength,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  };
  const usages: KeyUsage[] = name === "RSA-OAEP" ? ["encrypt", "decrypt"] : ["sign", "verify"];
  return crypto.subtle.generateKey(params, true, usages);
}

async function exportKeys(algorithm: AlgorithmId): Promise<GeneratedKeys> {
  const pair = await createKeyPair(algorithm);
  const [privateDer, publicDer] = await Promise.all([
    crypto.subtle.exportKey("pkcs8", pair.privateKey),
    crypto.subtle.exportKey("spki", pair.publicKey),
  ]);
  return {
    algorithm,
    privatePem: derToPem(privateDer, "PRIVATE KEY"),
    publicPem: derToPem(publicDer, "PUBLIC KEY"),
  };
}

export default function RsaKeypairTool() {
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("RSA-OAEP-2048");
  const [keys, setKeys] = useState<GeneratedKeys | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const selected = ALGORITHMS.find((item) => item.id === algorithm) ?? ALGORITHMS[0];
  const result = keys?.algorithm === algorithm ? keys : null;

  async function handleGenerate() {
    setRunning(true);
    setError("");
    try {
      setKeys(await exportKeys(algorithm));
    } catch (caught) {
      setKeys(null);
      setError(errorMessage(caught, "Could not generate the key pair"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <ToolGrid>
      <Panel
        title="Key pair"
        description="Generated locally with Web Crypto. Nothing is uploaded or stored."
      >
        <div className="space-y-3">
          <Select
            label="Algorithm"
            value={algorithm}
            onChange={(value) => {
              setAlgorithm(value as AlgorithmId);
              setError("");
            }}
            options={ALGORITHMS.map((item) => ({ value: item.id, label: item.label }))}
          />

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xs font-semibold text-muted">{selected.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-faint">{selected.description}</p>
          </div>

          <Alert tone="warning" title="Private keys are sensitive">
            The private key appears in this page only. Copy it somewhere safe, then clear it. It is
            never written to local storage.
          </Alert>

          <Button variant="primary" onClick={handleGenerate} disabled={running}>
            <KeyRound className="size-4" aria-hidden />
            {running ? "Generating…" : "Generate key pair"}
          </Button>

          {running ? <Spinner label="Generating keys with Web Crypto" /> : null}

          {error ? (
            <Alert tone="danger" title="Key generation failed">
              {error}
            </Alert>
          ) : null}

          <p className="text-xs leading-relaxed text-faint">
            RSA keys use a public exponent of 65537 and SHA-256. The private key is exported as
            PKCS#8 and the public key as SPKI.
          </p>
        </div>
      </Panel>

      <Panel
        title="PEM output"
        description={result ? "Copy or download each key separately" : "Generate a pair to see PEM"}
      >
        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{result.algorithm}</Badge>
              <Badge tone="neutral">PKCS#8 private</Badge>
              <Badge tone="neutral">SPKI public</Badge>
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <ShieldCheck className="size-3.5" aria-hidden />
                Public key
              </p>
              <CodeOutput
                value={result.publicPem}
                language="pem"
                filename="public-key-spki.pem"
                maxHeight={180}
              />
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <KeyRound className="size-3.5" aria-hidden />
                Private key
              </p>
              <CodeOutput
                value={result.privatePem}
                language="pem"
                filename="private-key-pkcs8.pem"
                maxHeight={260}
              />
            </div>

            <Field label="Compatibility">
              <p className="text-xs leading-relaxed text-faint">
                These PEM blocks use unencrypted PKCS#8. Protect the private key with file
                permissions or a secrets manager.
              </p>
            </Field>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <KeyRound className="mb-2 size-6 text-faint" aria-hidden />
            <p className="text-sm font-medium text-text">No key pair yet</p>
            <p className="mt-1 max-w-sm text-xs text-faint">
              Choose an algorithm and generate a pair. RSA-OAEP keys encrypt; RSA-PSS and ECDSA keys
              sign.
            </p>
          </div>
        )}
      </Panel>
    </ToolGrid>
  );
}
