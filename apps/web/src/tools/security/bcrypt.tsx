import { useState } from "react";
import { compare, hash } from "bcryptjs";
import { ShieldCheck, Timer } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Slider,
  Spinner,
  TextArea,
  ToolGrid,
} from "@/components/ui";
import {
  BCRYPT_MAX_COST,
  BCRYPT_MIN_COST,
  bcryptCostHint,
  describeBcryptHash,
  validateBcryptCost,
  validateBcryptPassword,
} from "./logic";

type Mode = "hash" | "verify";

export default function BcryptTool() {
  const [mode, setMode] = useState<Mode>("hash");
  const [password, setPassword] = useState("");
  const [cost, setCost] = useState(10);
  const [hashInput, setHashInput] = useState("");
  const [result, setResult] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setResult("");
    setVerified(null);
    setError("");
  }

  async function handleHash() {
    const validation = validateBcryptPassword(password) || validateBcryptCost(cost);
    if (validation) {
      setError(validation);
      setResult("");
      return;
    }
    setError("");
    setResult("");
    setRunning(true);
    try {
      const value = await hash(password, cost);
      setResult(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the bcrypt hash");
    } finally {
      setRunning(false);
    }
  }

  async function handleVerify() {
    const validation = validateBcryptPassword(password);
    if (validation) {
      setError(validation);
      setVerified(null);
      return;
    }
    try {
      describeBcryptHash(hashInput);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this hash");
      setVerified(null);
      return;
    }
    setError("");
    setVerified(null);
    setRunning(true);
    try {
      setVerified(await compare(password, hashInput.trim()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this hash");
    } finally {
      setRunning(false);
    }
  }

  const hashInfo = (() => {
    if (!result) return null;
    try {
      return describeBcryptHash(result);
    } catch {
      return null;
    }
  })();

  return (
    <ToolGrid>
      <Panel
        title={mode === "hash" ? "Password to hash" : "Password and hash"}
        description="Bcrypt is deliberately slow. Hashing runs locally and is not reversible."
      >
        <div className="space-y-3">
          <Segmented
            label="Mode"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "hash", label: "Generate" },
              { value: "verify", label: "Verify" },
            ]}
          />

          <Field
            label="Password"
            hint="Bcrypt uses at most 72 bytes of the password."
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="off"
              aria-label="Password"
            />
          </Field>

          {mode === "hash" ? (
            <>
              <Slider
                label="Cost factor"
                value={cost}
                min={BCRYPT_MIN_COST}
                max={BCRYPT_MAX_COST}
                onChange={setCost}
                format={(value) => `${value} · ${Math.pow(2, value).toLocaleString("en-US")} rounds`}
              />
              <Alert tone={cost >= 12 ? "warning" : "info"} title="About the cost factor">
                {bcryptCostHint(cost)} Higher costs resist guessing attacks but slow every login.
              </Alert>
              <Button variant="primary" onClick={handleHash} disabled={running}>
                <ShieldCheck className="size-4" aria-hidden />
                {running ? "Hashing…" : "Generate hash"}
              </Button>
            </>
          ) : (
            <>
              <Field label="Bcrypt hash" hint="Paste a $2a$, $2b$, or $2y$ hash.">
                <TextArea
                  mono
                  rows={3}
                  value={hashInput}
                  onChange={(event) => setHashInput(event.target.value)}
                  placeholder="$2b$10$…"
                  aria-label="Bcrypt hash to verify"
                />
              </Field>
              <Button variant="primary" onClick={handleVerify} disabled={running}>
                <Timer className="size-4" aria-hidden />
                {running ? "Checking…" : "Verify password"}
              </Button>
            </>
          )}

          {running ? <Spinner label="Running bcrypt rounds" /> : null}

          {error ? (
            <Alert tone="danger" title="Bcrypt error">
              {error}
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={mode === "hash" ? "Hash" : "Verification"}
        description={mode === "hash" ? "Store the full hash, including the salt" : "Compared in memory"}
      >
        <div className="space-y-3">
          {mode === "hash" ? (
            <>
              {result ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="accent">bcrypt {hashInfo?.version ?? ""}</Badge>
                    <Badge tone="neutral">cost {hashInfo?.cost ?? cost}</Badge>
                  </div>
                  <CodeOutput value={result} language="bcrypt" filename="bcrypt-hash.txt" maxHeight={120} />
                </>
              ) : (
                <p className="text-xs text-faint">
                  The generated hash includes its own salt. A new hash for the same password will
                  differ every time.
                </p>
              )}
            </>
          ) : (
            <>
              {verified === true ? (
                <Alert tone="success" title="Password matches">
                  The password produces this bcrypt hash.
                </Alert>
              ) : null}
              {verified === false ? (
                <Alert tone="danger" title="Password does not match">
                  The password does not produce this bcrypt hash.
                </Alert>
              ) : null}
              {verified === null && !error ? (
                <p className="text-xs text-faint">
                  Enter the password and hash, then verify. The result is not stored.
                </p>
              ) : null}
              {hashInput ? (
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted">Hash parameters</p>
                  <p className="mt-1 break-all font-mono text-[12px] text-faint">
                    {(() => {
                      try {
                        const info = describeBcryptHash(hashInput);
                        return `${info.version} · cost ${info.cost} · ${Math.pow(2, info.cost).toLocaleString("en-US")} rounds`;
                      } catch {
                        return "Unrecognized hash format";
                      }
                    })()}
                  </p>
                </div>
              ) : null}
            </>
          )}
          <p className="text-xs leading-relaxed text-faint">
            Bcrypt is a password hashing function, not encryption. Never reuse the same password
            across services and never store plaintext.
          </p>
        </div>
      </Panel>
    </ToolGrid>
  );
}
