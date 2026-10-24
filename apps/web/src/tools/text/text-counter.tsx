import { useMemo, useState } from "react";
import { Clock, Hash, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Panel,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { countText } from "./logic";

const SAMPLE = `devkit keeps every tool local. No text leaves your machine.

Count the words, inspect the reading time, and find the phrases you repeat. The counter handles paragraphs, sentences, and Unicode text such as café, naïve, and 日本語.

A fast interface makes small utilities pleasant to use.`;

export default function TextCounterTool() {
  const [text, setText] = useState(SAMPLE);
  const [ignoreCommonWords, setIgnoreCommonWords] = useState(false);

  const stats = useMemo(() => countText(text, { ignoreCommonWords }), [ignoreCommonWords, text]);

  const cards = [
    { label: "Characters", value: stats.characters },
    { label: "Without spaces", value: stats.charactersNoSpaces },
    { label: "Words", value: stats.words },
    { label: "Lines", value: stats.lines },
    { label: "Sentences", value: stats.sentences },
    { label: "Paragraphs", value: stats.paragraphs },
    { label: "Bytes (UTF-8)", value: stats.bytes },
    { label: "Unique words", value: stats.uniqueWords },
  ];

  const maxCount = stats.frequencies[0]?.count ?? 1;

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Text"
          description="Counts update as you type and stay in this tab."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Content">
              <TextArea
                mono
                rows={16}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste text to measure"
                aria-label="Text to count"
              />
            </Field>
            <Toggle
              label="Ignore common words"
              description="Hides stop words such as the, and, and of from word frequencies."
              checked={ignoreCommonWords}
              onChange={setIgnoreCommonWords}
            />
          </div>
        </Panel>

        <Panel
          title="Statistics"
          description="Reading time assumes 200 words per minute."
          actions={
            <Badge tone="accent">
              <Clock className="size-3" aria-hidden />
              {stats.readingLabel} read
            </Badge>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2.5"
              >
                <p className="font-mono text-lg font-semibold text-text">
                  {formatNumber(card.value)}
                </p>
                <p className="text-[11px] text-faint">{card.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-xs text-faint">
            <p>
              {stats.sentences === 0
                ? "No sentences detected."
                : `Average sentence length: ${(stats.words / Math.max(stats.sentences, 1)).toFixed(1)} words.`}
            </p>
            <p>
              Byte count uses UTF-8, so accented and CJK characters take more than one byte each.
            </p>
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="Frequent words"
        description="Top 12 words by count; ties are alphabetical."
        actions={<Badge>{stats.frequencies.length} shown</Badge>}
      >
        {stats.frequencies.length === 0 ? (
          <EmptyState
            icon={<Hash className="size-5" aria-hidden />}
            title="No words to rank"
            description="Enter some text, or turn off the common-word filter if every word is hidden."
          />
        ) : (
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {stats.frequencies.map((entry) => (
              <li key={entry.word}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-text">{entry.word}</span>
                  <span className="shrink-0 text-faint">
                    {formatNumber(entry.count)} · {entry.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max((entry.count / maxCount) * 100, 3)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ToolStack>
  );
}
