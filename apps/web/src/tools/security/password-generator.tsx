import { useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  EmptyState,
  Panel,
  Slider,
  Toggle,
  ToolGrid,
} from "@/components/ui";
import {
  errorMessage,
  generatePasswords,
  passwordAlphabet,
  passwordEntropyBits,
  passwordStrengthLabel,
  validatePasswordOptions,
  type PasswordOptions,
} from "./logic";

const INITIAL_OPTIONS: PasswordOptions = {
  length: 16,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

export default function PasswordGeneratorTool() {
  const [options, setOptions] = useState<PasswordOptions>(INITIAL_OPTIONS);
  const [count, setCount] = useState(5);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [error, setError] = useState("");

  function updateOptions(patch: Partial<PasswordOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
    setPasswords([]);
    setError("");
  }

  function handleGenerate() {
    const validation = validatePasswordOptions(options);
    if (validation) {
      setError(validation);
      setPasswords([]);
      return;
    }
    try {
      setPasswords(generatePasswords(options, count));
      setError("");
    } catch (caught) {
      setPasswords([]);
      setError(errorMessage(caught, "Could not generate passwords"));
    }
  }

  const validation = validatePasswordOptions(options);
  const alphabetSize = validation ? 0 : passwordAlphabet(options).length;
  const entropy = passwordEntropyBits(options.length, alphabetSize);
  const strength = passwordStrengthLabel(entropy);
  const output = passwords.join("\n");

  return (
    <ToolGrid>
      <Panel title="Rules" description="Characters come from crypto.getRandomValues.">
        <div className="space-y-3">
          <Slider
            label="Length"
            value={options.length}
            min={4}
            max={128}
            onChange={(value) => updateOptions({ length: value })}
            format={(value) => `${value} characters`}
          />

          <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
            <Toggle
              checked={options.lowercase}
              onChange={(checked) => updateOptions({ lowercase: checked })}
              label="Lowercase"
              description="a–z"
            />
            <Toggle
              checked={options.uppercase}
              onChange={(checked) => updateOptions({ uppercase: checked })}
              label="Uppercase"
              description="A–Z"
            />
            <Toggle
              checked={options.digits}
              onChange={(checked) => updateOptions({ digits: checked })}
              label="Digits"
              description="0–9"
            />
            <Toggle
              checked={options.symbols}
              onChange={(checked) => updateOptions({ symbols: checked })}
              label="Symbols"
              description="Punctuation such as ! @ # $ %"
            />
            <Toggle
              checked={options.excludeAmbiguous}
              onChange={(checked) => updateOptions({ excludeAmbiguous: checked })}
              label="Exclude ambiguous characters"
              description="Removes look-alikes such as I, l, 1, O, and 0."
            />
          </div>

          <Slider
            label="Bulk count"
            value={count}
            min={1}
            max={25}
            onChange={(value) => {
              setCount(value);
              setPasswords([]);
              setError("");
            }}
            format={(value) => `${value} ${value === 1 ? "password" : "passwords"}`}
          />

          <Button variant="primary" onClick={handleGenerate} disabled={Boolean(validation)}>
            <Sparkles className="size-4" aria-hidden />
            Generate
          </Button>

          {error ? (
            <Alert tone="danger" title="Cannot generate">
              {error}
            </Alert>
          ) : null}

          <Alert tone={entropy >= 80 ? "success" : "info"} title="Entropy estimate">
            {validation
              ? validation
              : `${entropy.toFixed(1)} bits per password from a ${alphabetSize}-character alphabet. ${strength}.`}
          </Alert>

          <p className="text-xs leading-relaxed text-faint">
            The estimate assumes each character is drawn uniformly at random. A long password that
            you invent yourself has far less entropy than this number suggests.
          </p>
        </div>
      </Panel>

      <Panel
        title="Passwords"
        description={passwords.length ? `${passwords.length} generated` : "Nothing generated yet"}
        flush
      >
        <div className="space-y-3 p-4">
          {passwords.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{strength}</Badge>
                <Badge tone="neutral">{options.length} chars</Badge>
                <Badge tone="neutral">{passwords.length} values</Badge>
              </div>
              <CodeOutput
                value={output}
                language="passwords"
                filename="passwords.txt"
                maxHeight={420}
              />
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                Copy what you need, then clear the output. Passwords are held in this tab's memory
                only.
              </p>
            </>
          ) : (
            <EmptyState
              icon={<KeyRound className="size-6" aria-hidden />}
              title="No passwords yet"
              description="Pick the character classes and length, then generate up to 25 passwords at once."
            />
          )}
        </div>
      </Panel>
    </ToolGrid>
  );
}
