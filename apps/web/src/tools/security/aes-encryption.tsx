import { useState } from "react";
import { KeyRound, Lock, Unlock } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  EmptyState,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  Spinner,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import { base64ToBytes, bytesToBase64, bytesToText, textToBytes } from "@/lib/encoding";
import {
  AES_DEFAULT_ITERATIONS,
  AES_ITERATIONS_MAX,
  AES_ITERATIONS_MIN,
  aesIvLength,
  copyBytes,
  decodeAesEnvelope,
  encodeAesEnvelope,
  errorMessage,
  validateAesIterations,
  type AesAlgorithm,
  type AesEnvelope,
} from "./logic";

type Mode = "encrypt" | "decrypt";

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  algorithm: AesAlgorithm,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    copyBytes(textToBytes(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: copyBytes(salt), iterations, hash: "SHA-256" },
    material,
    { name: algorithm, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function cipherParams(algorithm: AesAlgorithm, iv: Uint8Array): AesGcmParams | AesCbcParams {
  const copy = copyBytes(iv);
  return algorithm === "AES-GCM" ? { name: "AES-GCM", iv: copy } : { name: "AES-CBC", iv: copy };
}

async function encryptText(
  plaintext: string,
  password: string,
  algorithm: AesAlgorithm,
  iterations: number,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(aesIvLength(algorithm)));
  const key = await deriveKey(password, salt, iterations, algorithm);
  const ciphertext = await crypto.subtle.encrypt(
    cipherParams(algorithm, iv),
    key,
    copyBytes(textToBytes(plaintext)),
  );
  const envelope: AesEnvelope = {
    v: 1,
    alg: algorithm,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return encodeAesEnvelope(envelope);
}

async function decryptText(payload: string, password: string): Promise<string> {
  const envelope = decodeAesEnvelope(payload);
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ct);
  const key = await deriveKey(password, salt, envelope.iterations, envelope.alg);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      cipherParams(envelope.alg, iv),
      key,
      copyBytes(ciphertext),
    );
  } catch {
    throw new Error("Decryption failed. Check the password, cipher mode, and payload.");
  }
  try {
    return bytesToText(new Uint8Array(plaintext), true);
  } catch {
    throw new Error("Decrypted bytes are not valid UTF-8 text");
  }
}

export default function AesEncryptionTool() {
  const [mode, setMode] = useState<Mode>("encrypt");
  const [algorithm, setAlgorithm] = useState<AesAlgorithm>("AES-GCM");
  const [password, setPassword] = useState("");
  const [iterations, setIterations] = useState(String(AES_DEFAULT_ITERATIONS));
  const [plaintext, setPlaintext] = useState("devkit keeps secrets in this tab.");
  const [payload, setPayload] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setOutput("");
    setError("");
  }

  async function handleRun() {
    setError("");
    setOutput("");
    if (!password) {
      setError("Enter a password");
      return;
    }

    let iterationCount = AES_DEFAULT_ITERATIONS;
    if (mode === "encrypt") {
      if (!plaintext) {
        setError("Enter text to encrypt");
        return;
      }
      if (!/^\d+$/.test(iterations.trim())) {
        setError("Iterations must be a whole number");
        return;
      }
      iterationCount = Number(iterations);
      const iterationError = validateAesIterations(iterationCount);
      if (iterationError) {
        setError(iterationError);
        return;
      }
    }

    setRunning(true);
    try {
      if (mode === "encrypt") {
        setOutput(await encryptText(plaintext, password, algorithm, iterationCount));
      } else {
        setOutput(await decryptText(payload, password));
      }
    } catch (caught) {
      setError(errorMessage(caught, "Could not process the payload"));
    } finally {
      setRunning(false);
    }
  }

  const isEncrypt = mode === "encrypt";

  return (
    <ToolGrid>
      <Panel
        title="Input"
        description="AES-256 runs locally. The password is used with PBKDF2-SHA256."
      >
        <div className="space-y-3">
          <Segmented
            label="Mode"
            value={mode}
            onChange={changeMode}
            options={[
              { value: "encrypt", label: "Encrypt" },
              { value: "decrypt", label: "Decrypt" },
            ]}
          />

          <Select
            label="Cipher mode"
            value={algorithm}
            onChange={(value) => {
              setAlgorithm(value as AesAlgorithm);
              setOutput("");
              setError("");
            }}
            options={[
              { value: "AES-GCM", label: "AES-GCM · authenticated" },
              { value: "AES-CBC", label: "AES-CBC · not authenticated" },
            ]}
          />

          <Field
            label="Password"
            hint="Use a long passphrase. A new random salt is created for every encryption."
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passphrase"
              autoComplete="off"
              spellCheck={false}
              aria-label="Encryption password"
            />
          </Field>

          {isEncrypt ? (
            <>
              <Field
                label="PBKDF2 iterations"
                hint={`Between ${AES_ITERATIONS_MIN.toLocaleString("en-US")} and ${AES_ITERATIONS_MAX.toLocaleString("en-US")}. Higher counts slow down guessing.`}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={AES_ITERATIONS_MIN}
                  max={AES_ITERATIONS_MAX}
                  step={10_000}
                  value={iterations}
                  onChange={(event) => setIterations(event.target.value)}
                  aria-label="PBKDF2 iteration count"
                />
              </Field>

              <Field label="Plaintext">
                <TextArea
                  mono
                  rows={7}
                  value={plaintext}
                  onChange={(event) => setPlaintext(event.target.value)}
                  placeholder="Text to encrypt…"
                  aria-label="Text to encrypt"
                />
              </Field>
            </>
          ) : (
            <Field
              label="Base64 envelope"
              hint="Paste a payload produced here. It includes the mode, salt, IV, and iteration count."
            >
              <TextArea
                mono
                rows={9}
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                placeholder="eyJ2IjoxLCJhbGciOi…"
                aria-label="Payload to decrypt"
              />
            </Field>
          )}

          <Button variant="primary" onClick={handleRun} disabled={running}>
            {isEncrypt ? (
              <Lock className="size-4" aria-hidden />
            ) : (
              <Unlock className="size-4" aria-hidden />
            )}
            {running ? "Working…" : isEncrypt ? "Encrypt" : "Decrypt"}
          </Button>

          {running ? <Spinner label="Running PBKDF2 and AES" /> : null}

          {error ? (
            <Alert tone="danger" title="AES error">
              {error}
            </Alert>
          ) : null}

          {algorithm === "AES-CBC" ? (
            <Alert tone="warning" title="CBC does not authenticate">
              AES-CBC hides the plaintext but cannot detect tampering. Prefer AES-GCM unless another
              system requires CBC.
            </Alert>
          ) : (
            <Alert tone="info" title="Authenticated encryption">
              AES-GCM rejects a payload when the password is wrong or the ciphertext was changed.
            </Alert>
          )}
        </div>
      </Panel>

      <Panel
        title={isEncrypt ? "Envelope" : "Plaintext"}
        description={
          isEncrypt ? "Base64 JSON containing salt, IV, and ciphertext" : "Decoded in this tab only"
        }
        flush
      >
        <div className="space-y-3 p-4">
          {output ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{algorithm}</Badge>
                <Badge tone="neutral">PBKDF2-SHA256</Badge>
                {isEncrypt ? <Badge tone="neutral">{iterations} iterations</Badge> : null}
              </div>
              <CodeOutput
                value={output}
                language={isEncrypt ? "base64 envelope" : "text"}
                filename={isEncrypt ? "aes-envelope.txt" : "decrypted.txt"}
                maxHeight={420}
              />
              <p className="text-xs leading-relaxed text-faint">
                {isEncrypt
                  ? "Send this envelope with its password over separate channels. Anyone with both can decrypt it."
                  : "The password and the envelope parameters must match exactly. Nothing is stored."}
              </p>
            </>
          ) : (
            <EmptyState
              icon={<KeyRound className="size-6" aria-hidden />}
              title={isEncrypt ? "No envelope yet" : "No plaintext yet"}
              description={
                isEncrypt
                  ? "Enter a password and plaintext, then encrypt to produce a Base64 envelope."
                  : "Paste an envelope and enter its password, then decrypt."
              }
            />
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
