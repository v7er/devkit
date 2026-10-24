import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  CopyButton,
  Panel,
  Segmented,
  Slider,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  generateLorem,
  LOREM_LIMITS,
  secureRandomInt,
  type LoremResult,
  type LoremTheme,
  type LoremUnit,
} from "./logic";

const UNIT_OPTIONS: Array<{ value: LoremUnit; label: string }> = [
  { value: "words", label: "Words" },
  { value: "sentences", label: "Sentences" },
  { value: "paragraphs", label: "Paragraphs" },
];

const THEME_OPTIONS: Array<{ value: LoremTheme; label: string }> = [
  { value: "classic", label: "Classic Latin" },
  { value: "developer", label: "Developer" },
];

function buildLorem(
  unit: LoremUnit,
  count: number,
  theme: LoremTheme,
  startWithLorem: boolean,
): LoremResult {
  return generateLorem(
    {
      unit,
      count,
      theme,
      startWithLorem: theme === "classic" && startWithLorem,
    },
    secureRandomInt,
  );
}

export default function LoremIpsumTool() {
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [count, setCount] = useState(3);
  const [theme, setTheme] = useState<LoremTheme>("classic");
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [result, setResult] = useState<LoremResult>(() =>
    buildLorem("paragraphs", 3, "classic", true),
  );

  const limits = LOREM_LIMITS[unit];

  function handleUnit(next: LoremUnit) {
    const nextLimits = LOREM_LIMITS[next];
    const nextCount = Math.min(Math.max(count, nextLimits.min), nextLimits.max);
    setUnit(next);
    setCount(nextCount);
    setResult(buildLorem(next, nextCount, theme, startWithLorem));
  }

  function handleCount(next: number) {
    setCount(next);
    setResult(buildLorem(unit, next, theme, startWithLorem));
  }

  function handleTheme(next: LoremTheme) {
    setTheme(next);
    setResult(buildLorem(unit, count, next, startWithLorem));
  }

  function handleStartWithLorem(next: boolean) {
    setStartWithLorem(next);
    setResult(buildLorem(unit, count, theme, next));
  }

  function handleReset() {
    setUnit("paragraphs");
    setCount(3);
    setTheme("classic");
    setStartWithLorem(true);
    setResult(buildLorem("paragraphs", 3, "classic", true));
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Options"
          description="Values come from a cryptographically seeded random source in this tab."
        >
          <div className="space-y-4">
            <Segmented label="Generate" value={unit} onChange={handleUnit} options={UNIT_OPTIONS} />
            <Slider
              label="Count"
              value={count}
              min={limits.min}
              max={limits.max}
              onChange={handleCount}
              format={(value) => `${value} ${unit}`}
            />
            <Segmented label="Theme" value={theme} onChange={handleTheme} options={THEME_OPTIONS} />
            {theme === "classic" ? (
              <Toggle
                label="Start with the classic opener"
                description="Begins with “Lorem ipsum dolor sit amet, consectetur adipiscing elit.”"
                checked={startWithLorem}
                onChange={handleStartWithLorem}
              />
            ) : (
              <p className="text-xs text-faint">
                Developer theme uses terms such as algorithm, cache, middleware, and promise.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setResult(buildLorem(unit, count, theme, startWithLorem))}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Regenerate
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
            <p className="text-xs text-faint">
              Paragraphs are separated by blank lines. Every generated value can be copied or
              downloaded.
            </p>
          </div>
        </Panel>

        <Panel
          title="Generated text"
          description="Each regeneration produces a new sequence."
          actions={
            <>
              <Badge tone="accent">{result.wordCount} words</Badge>
              <CopyButton value={result.text} label="Copy" />
            </>
          }
        >
          <div className="space-y-3">
            {result.error ? (
              <Alert tone="danger" title="Cannot generate text">
                {result.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={result.text}
              language="plain text"
              filename="lorem-ipsum.txt"
              maxHeight={520}
              placeholder="Generated text appears here"
            />
            <div className="flex items-center gap-2 text-xs text-faint">
              <Sparkles className="size-3.5" aria-hidden />
              Placeholder text for layouts and mockups. Replace it before publishing.
            </div>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
