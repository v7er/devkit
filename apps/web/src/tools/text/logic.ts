import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import { diffArrays, diffWords } from "diff";
import DOMPurify from "dompurify";
import { marked } from "marked";

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ------------------------------------------------------------------ */
/* RegEx tester                                                        */
/* ------------------------------------------------------------------ */

export const REGEX_FLAGS = "dgimsuvy";
export const MAX_REGEX_MATCHES = 500;

export interface RegexMatch {
  index: number;
  end: number;
  value: string;
  groups: Array<string | null>;
  namedGroups: Array<{ name: string; value: string | null }>;
}

export interface RegexRun {
  error: string;
  matches: RegexMatch[];
  truncated: boolean;
  elapsedMs: number;
}

export function validateRegexFlags(flags: string): string {
  const seen = new Set<string>();
  for (const flag of flags) {
    if (!REGEX_FLAGS.includes(flag)) {
      return `Unsupported flag "${flag}". Use only ${REGEX_FLAGS.split("").join(", ")}.`;
    }
    if (seen.has(flag)) return `Duplicate flag "${flag}".`;
    seen.add(flag);
  }
  if (flags.includes("u") && flags.includes("v")) {
    return "Flags u and v cannot be combined.";
  }
  return "";
}

function toMatch(result: RegExpExecArray): RegexMatch {
  return {
    index: result.index,
    end: result.index + result[0].length,
    value: result[0],
    groups: result.slice(1).map((value) => value ?? null),
    namedGroups: result.groups
      ? Object.entries(result.groups).map(([name, value]) => ({ name, value: value ?? null }))
      : [],
  };
}

export function runRegex(
  pattern: string,
  flags: string,
  text: string,
  limit = MAX_REGEX_MATCHES,
): RegexRun {
  const started = performance.now();
  const flagError = validateRegexFlags(flags);
  if (flagError) {
    return { error: flagError, matches: [], truncated: false, elapsedMs: 0 };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    return {
      error: errorMessage(error, "Invalid regular expression"),
      matches: [],
      truncated: false,
      elapsedMs: performance.now() - started,
    };
  }

  const matches: RegexMatch[] = [];
  let truncated = false;
  try {
    if (regex.global || regex.sticky) {
      regex.lastIndex = 0;
      let result = regex.exec(text);
      while (result !== null) {
        matches.push(toMatch(result));
        if (matches.length >= limit) {
          truncated = true;
          break;
        }
        if (result[0].length === 0) {
          regex.lastIndex += 1;
          if (regex.lastIndex > text.length) break;
        }
        result = regex.exec(text);
      }
    } else {
      const result = regex.exec(text);
      if (result) matches.push(toMatch(result));
    }
  } catch (error) {
    return {
      error: errorMessage(error, "The regular expression failed while matching"),
      matches,
      truncated,
      elapsedMs: performance.now() - started,
    };
  }

  return { error: "", matches, truncated, elapsedMs: performance.now() - started };
}

export function runRegexReplace(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
): { error: string; output: string } {
  const flagError = validateRegexFlags(flags);
  if (flagError) return { error: flagError, output: "" };
  try {
    const regex = new RegExp(pattern, flags);
    return { error: "", output: text.replace(regex, replacement) };
  } catch (error) {
    return { error: errorMessage(error, "Invalid replacement"), output: "" };
  }
}

export interface HighlightSegment {
  text: string;
  matchIndex: number | null;
}

export function highlightMatches(text: string, matches: RegexMatch[]): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  matches.forEach((match, matchIndex) => {
    const start = Math.max(match.index, cursor);
    if (match.end <= start) return;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), matchIndex: null });
    segments.push({ text: text.slice(start, match.end), matchIndex });
    cursor = match.end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matchIndex: null });
  return segments;
}

export function detectReDoS(pattern: string): string | null {
  if (/\((?:\?:)?[^()]*?(?:[+*]|\{\d+,\})[^()]*?\)(?:[+*]|\{\d+,\})/.test(pattern)) {
    return "Nested quantifiers such as (a+)+ can backtrack exponentially on input that almost matches. Use a stricter pattern or anchor it.";
  }
  const alternation = /\(([^()|]+)\|([^()|]+)\)([+*])/.exec(pattern);
  if (alternation) {
    const left = alternation[1];
    const right = alternation[2];
    if (left === right || left.startsWith(right) || right.startsWith(left)) {
      return `Repeated alternatives such as (${left}|${right})${alternation[3]} can backtrack exponentially. Make the alternatives mutually exclusive.`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Diff checker                                                        */
/* ------------------------------------------------------------------ */

export const MAX_DIFF_CHARS = 200_000;

export type DiffMode = "lines" | "words";
export type DiffKind = "equal" | "added" | "removed";

export interface DiffToken {
  value: string;
  kind: DiffKind;
}

export interface DiffLine {
  kind: DiffKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export interface DiffAnalysis {
  error: string;
  tokens: DiffToken[];
  lines: DiffLine[];
  sideBySide: SideBySideRow[];
  summary: DiffSummary;
}

export interface DiffOptions {
  mode: DiffMode;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

const EMPTY_DIFF: DiffAnalysis = {
  error: "",
  tokens: [],
  lines: [],
  sideBySide: [],
  summary: { added: 0, removed: 0, unchanged: 0 },
};

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function normalizeLine(line: string, options: DiffOptions): string {
  let value = line;
  if (options.ignoreWhitespace) value = value.trim().replace(/\s+/g, " ");
  if (options.ignoreCase) value = value.toLowerCase();
  return value;
}

function buildLines(oldText: string, newText: string, options: DiffOptions): DiffLine[] {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const changes = diffArrays(oldLines, newLines, {
    comparator: (left, right) => normalizeLine(left, options) === normalizeLine(right, options),
  });

  const lines: DiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  for (const change of changes) {
    for (const line of change.value) {
      if (change.removed) {
        lines.push({ kind: "removed", text: line, oldLine: oldNumber++, newLine: null });
      } else if (change.added) {
        lines.push({ kind: "added", text: line, oldLine: null, newLine: newNumber++ });
      } else {
        lines.push({ kind: "equal", text: line, oldLine: oldNumber++, newLine: newNumber++ });
      }
    }
  }
  return lines;
}

export function buildSideBySide(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.kind === "equal") {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }
    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (index < lines.length && lines[index].kind !== "equal") {
      const changed = lines[index];
      if (changed.kind === "removed") removed.push(changed);
      else added.push(changed);
      index += 1;
    }
    const count = Math.max(removed.length, added.length);
    for (let offset = 0; offset < count; offset += 1) {
      rows.push({ left: removed[offset] ?? null, right: added[offset] ?? null });
    }
  }
  return rows;
}

export function analyzeDiff(oldText: string, newText: string, options: DiffOptions): DiffAnalysis {
  if (oldText.length + newText.length > MAX_DIFF_CHARS) {
    return {
      ...EMPTY_DIFF,
      error: `Input is too large to diff. Keep both sides under ${MAX_DIFF_CHARS.toLocaleString()} characters in total.`,
    };
  }

  if (options.mode === "words") {
    const changes = diffWords(oldText, newText, { ignoreCase: options.ignoreCase });
    const tokens: DiffToken[] = changes.map((change) => ({
      value: change.value,
      kind: change.added ? "added" : change.removed ? "removed" : "equal",
    }));
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    for (const token of tokens) {
      const words = token.value.match(/\S+/g)?.length ?? 0;
      if (token.kind === "added") added += words;
      else if (token.kind === "removed") removed += words;
      else unchanged += words;
    }
    return {
      error: "",
      tokens,
      lines: [],
      sideBySide: [],
      summary: { added, removed, unchanged },
    };
  }

  const lines = buildLines(oldText, newText, options);
  const summary = lines.reduce<DiffSummary>(
    (total, line) => {
      if (line.kind === "added") total.added += 1;
      else if (line.kind === "removed") total.removed += 1;
      else total.unchanged += 1;
      return total;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );

  return {
    error: "",
    tokens: [],
    lines,
    sideBySide: buildSideBySide(lines),
    summary,
  };
}

export function unifiedDiffText(lines: DiffLine[]): string {
  return lines
    .map((line) => {
      const marker = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
      return `${marker} ${line.text}`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Case converter                                                      */
/* ------------------------------------------------------------------ */

export type CaseStyle =
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "title"
  | "sentence"
  | "dot"
  | "lower";

export const CASE_STYLES: Array<{ value: CaseStyle; label: string; example: string }> = [
  { value: "camel", label: "camelCase", example: "helloWorld" },
  { value: "pascal", label: "PascalCase", example: "HelloWorld" },
  { value: "snake", label: "snake_case", example: "hello_world" },
  { value: "kebab", label: "kebab-case", example: "hello-world" },
  { value: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD" },
  { value: "title", label: "Title Case", example: "Hello World" },
  { value: "sentence", label: "Sentence case", example: "Hello world" },
  { value: "dot", label: "dot.case", example: "hello.world" },
  { value: "lower", label: "lowercase", example: "hello world" },
];

export function splitWords(input: string): string[] {
  const withBoundaries = input
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!withBoundaries) return [];
  return withBoundaries.split(/\s+/).filter(Boolean);
}

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function convertCase(input: string, style: CaseStyle): string {
  const words = splitWords(input);
  if (words.length === 0) return "";

  switch (style) {
    case "camel":
      return words
        .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
        .join("");
    case "pascal":
      return words.map(capitalize).join("");
    case "snake":
      return words.map((word) => word.toLowerCase()).join("_");
    case "kebab":
      return words.map((word) => word.toLowerCase()).join("-");
    case "constant":
      return words.map((word) => word.toUpperCase()).join("_");
    case "title":
      return words.map(capitalize).join(" ");
    case "sentence": {
      const joined = words.map((word) => word.toLowerCase()).join(" ");
      return joined.charAt(0).toUpperCase() + joined.slice(1);
    }
    case "dot":
      return words.map((word) => word.toLowerCase()).join(".");
    case "lower":
      return words.map((word) => word.toLowerCase()).join(" ");
  }
}

/* ------------------------------------------------------------------ */
/* Text counter                                                        */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "this", "that", "as", "by", "from", "not",
  "no", "you", "i", "we", "they", "he", "she", "has", "have", "had", "do", "does", "did",
  "will", "would", "can", "could", "so", "than", "then", "there", "their", "its", "your",
  "my", "our", "me", "him", "her", "them", "us", "all", "any", "each", "into", "over",
  "under", "about", "more", "most", "some", "such", "only", "own", "same", "too", "very",
  "just", "also",
]);

export interface WordFrequency {
  word: string;
  count: number;
  percent: number;
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
  uniqueWords: number;
  readingSeconds: number;
  readingLabel: string;
  frequencies: WordFrequency[];
}

export function wordTokens(input: string): string[] {
  return input.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function countText(input: string, options: { ignoreCommonWords?: boolean } = {}): TextStats {
  const words = wordTokens(input);
  const characters = Array.from(input).length;
  const charactersNoSpaces = Array.from(input.replace(/\s/gu, "")).length;
  const lines = input === "" ? 0 : input.replace(/\r\n?/g, "\n").split("\n").length;
  const paragraphs = input.split(/\n\s*\n/).filter((block) => block.trim() !== "").length;
  const sentences = input.trim()
    ? input
        .trim()
        .split(/(?<=[.!?…])\s+/u)
        .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence)).length
    : 0;

  const counts = new Map<string, number>();
  for (const word of words) {
    const key = word.toLowerCase();
    if (options.ignoreCommonWords && STOP_WORDS.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const totalForFrequency = [...counts.values()].reduce((total, count) => total + count, 0);
  const frequencies = [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      percent: totalForFrequency === 0 ? 0 : (count / totalForFrequency) * 100,
    }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word))
    .slice(0, 12);

  const readingSeconds = Math.round((words.length / 200) * 60);
  const readingLabel =
    words.length === 0
      ? "0 min"
      : readingSeconds < 60
        ? "<1 min"
        : `${Math.ceil(readingSeconds / 60)} min`;

  return {
    characters,
    charactersNoSpaces,
    words: words.length,
    lines,
    sentences,
    paragraphs,
    bytes: new TextEncoder().encode(input).length,
    uniqueWords: counts.size,
    readingSeconds,
    readingLabel,
    frequencies,
  };
}

/* ------------------------------------------------------------------ */
/* Markdown preview                                                    */
/* ------------------------------------------------------------------ */

const SANITIZE_CONFIG = {
  FORBID_TAGS: ["style", "form", "iframe", "object", "embed", "base", "meta", "link"],
  FORBID_ATTR: ["style", "srcset"],
};

let linkHookInstalled = false;
if (typeof window !== "undefined" && !linkHookInstalled) {
  linkHookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof window.Element && node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function renderMarkdown(
  markdown: string,
  options: { breaks?: boolean } = {},
): { html: string; error: string } {
  try {
    const raw = marked.parse(markdown, {
      gfm: true,
      breaks: options.breaks ?? false,
      async: false,
    });
    return { html: DOMPurify.sanitize(raw, SANITIZE_CONFIG), error: "" };
  } catch (error) {
    return { html: "", error: errorMessage(error, "Could not render this Markdown") };
  }
}

export function buildHtmlDocument(title: string, bodyHtml: string): string {
  const safeTitle = title.replace(/[&<>"]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    return "&quot;";
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
body { max-width: 46rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.65; color: #1f2430; }
pre { background: #f4f5f8; padding: 0.9rem 1rem; border-radius: 0.6rem; overflow: auto; }
code { font-family: ui-monospace, monospace; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d6d9e0; padding: 0.45rem 0.7rem; text-align: left; }
blockquote { border-left: 3px solid #d6d9e0; margin-left: 0; padding-left: 1rem; color: #5b6170; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Lorem ipsum                                                         */
/* ------------------------------------------------------------------ */

export type LoremTheme = "classic" | "developer";
export type LoremUnit = "words" | "sentences" | "paragraphs";

export const LOREM_LIMITS: Record<LoremUnit, { min: number; max: number }> = {
  words: { min: 1, max: 300 },
  sentences: { min: 1, max: 40 },
  paragraphs: { min: 1, max: 15 },
};

const CLASSIC_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do",
  "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim",
  "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi",
  "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit",
  "voluptate", "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt",
  "mollit", "anim", "id", "est", "laborum", "vitae", "dictum", "justo", "vel", "lectus",
  "fermentum", "posuere", "urna", "nec", "tincidunt", "praesent", "facilisis", "gravida",
];

const DEVELOPER_WORDS = [
  "algorithm", "array", "async", "binary", "boolean", "branch", "buffer", "cache", "callback",
  "client", "commit", "compile", "component", "concurrency", "container", "database", "debug",
  "deploy", "diff", "digest", "endpoint", "event", "exception", "function", "gateway", "hash",
  "header", "hook", "immutable", "index", "interface", "iterator", "kernel", "latency", "lint",
  "listener", "merge", "middleware", "module", "mutex", "namespace", "object", "observable",
  "payload", "pipeline", "pixel", "pointer", "promise", "protocol", "query", "queue", "reducer",
  "refactor", "render", "repository", "request", "response", "router", "runtime", "schema",
  "scope", "script", "server", "session", "socket", "stack", "state", "stream", "string",
  "syntax", "thread", "token", "transaction", "transport", "typescript", "variable", "vector",
  "virtual", "worker",
];

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  theme: LoremTheme;
  startWithLorem: boolean;
}

export interface LoremResult {
  error: string;
  text: string;
  wordCount: number;
}

export function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function pickWord(words: string[], random: (max: number) => number): string {
  const index = Math.abs(random(words.length)) % words.length;
  return words[index];
}

function randomSentence(words: string[], random: (max: number) => number): string {
  const length = 8 + (Math.abs(random(7)) % 7);
  const picked = Array.from({ length }, () => pickWord(words, random));
  const sentence = picked.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function randomParagraph(
  words: string[],
  random: (max: number) => number,
  firstSentence: string | null,
): string {
  const count = 3 + (Math.abs(random(4)) % 4);
  const sentences: string[] = [];
  if (firstSentence) sentences.push(firstSentence);
  while (sentences.length < count) sentences.push(randomSentence(words, random));
  return sentences.join(" ");
}

export function generateLorem(
  options: LoremOptions,
  random: (max: number) => number = secureRandomInt,
): LoremResult {
  const limits = LOREM_LIMITS[options.unit];
  if (!Number.isInteger(options.count) || options.count < limits.min || options.count > limits.max) {
    return {
      error: `Count must be a whole number between ${limits.min} and ${limits.max} for ${options.unit}.`,
      text: "",
      wordCount: 0,
    };
  }

  const words = options.theme === "developer" ? DEVELOPER_WORDS : CLASSIC_WORDS;
  const opener = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
  let text = "";

  if (options.unit === "words") {
    const picked: string[] = [];
    if (options.startWithLorem) picked.push("Lorem", "ipsum");
    while (picked.length < options.count) picked.push(pickWord(words, random));
    text = picked.slice(0, options.count).join(" ");
  } else if (options.unit === "sentences") {
    const sentences: string[] = [];
    if (options.startWithLorem) sentences.push(opener);
    while (sentences.length < options.count) sentences.push(randomSentence(words, random));
    text = sentences.slice(0, options.count).join(" ");
  } else {
    const paragraphs: string[] = [];
    for (let index = 0; index < options.count; index += 1) {
      const firstSentence = options.startWithLorem && index === 0 ? opener : null;
      paragraphs.push(randomParagraph(words, random, firstSentence));
    }
    text = paragraphs.join("\n\n");
  }

  return { error: "", text, wordCount: wordTokens(text).length };
}

/* ------------------------------------------------------------------ */
/* Text dedupe                                                         */
/* ------------------------------------------------------------------ */

export type DedupeSort = "none" | "asc" | "desc";

export interface DedupeOptions {
  trim: boolean;
  dropEmpty: boolean;
  removeDuplicates: boolean;
  caseInsensitive: boolean;
  sort: DedupeSort;
}

export interface DuplicateGroup {
  value: string;
  count: number;
}

export interface DedupeResult {
  output: string;
  inputLines: number;
  outputLines: number;
  droppedEmpty: number;
  duplicateLines: number;
  duplicates: DuplicateGroup[];
}

export function dedupeText(input: string, options: DedupeOptions): DedupeResult {
  const rawLines = input === "" ? [] : input.replace(/\r\n?/g, "\n").split("\n");
  const counts = new Map<string, DuplicateGroup>();
  const processed: Array<{ value: string; key: string }> = [];
  let droppedEmpty = 0;

  for (const rawLine of rawLines) {
    const value = options.trim ? rawLine.trim() : rawLine;
    if (options.dropEmpty && value.trim() === "") {
      droppedEmpty += 1;
      continue;
    }
    const key = options.caseInsensitive ? value.toLocaleLowerCase() : value;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { value, count: 1 });
    processed.push({ value, key });
  }

  const seen = new Set<string>();
  const kept: string[] = [];
  let duplicateLines = 0;
  for (const line of processed) {
    if (options.removeDuplicates && seen.has(line.key)) {
      duplicateLines += 1;
      continue;
    }
    seen.add(line.key);
    kept.push(line.value);
  }

  if (options.sort !== "none") {
    const direction = options.sort === "asc" ? 1 : -1;
    kept.sort(
      (left, right) =>
        direction *
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
    );
  }

  const duplicates = [...counts.values()]
    .filter((group) => group.count > 1)
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

  return {
    output: kept.join("\n"),
    inputLines: rawLines.length,
    outputLines: kept.length,
    droppedEmpty,
    duplicateLines,
    duplicates,
  };
}

/* ------------------------------------------------------------------ */
/* Slug generator                                                      */
/* ------------------------------------------------------------------ */

export type SlugSeparator = "-" | "_" | "";

export interface SlugOptions {
  separator: SlugSeparator;
  lowercase: boolean;
  maxLength: number;
}

const TRANSLITERATION: Record<string, string> = {
  ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ı: "i", ħ: "h",
  ŋ: "n", ŧ: "t", ĸ: "k",
};

function truncateSlug(slug: string, maxLength: number, separator: string): string {
  if (!maxLength || slug.length <= maxLength) return slug;
  const chars = Array.from(slug).slice(0, maxLength).join("");
  if (!separator) return chars;
  return chars.replace(new RegExp(`${separator}+$`), "");
}

export function slugify(input: string, options: SlugOptions): string {
  let value = input.replace(
    /[ßæœøđðþłıħŋŧĸ]/gi,
    (character) => TRANSLITERATION[character.toLowerCase()] ?? character,
  );
  value = value.normalize("NFKD").replace(/\p{M}+/gu, "");

  const separator = options.separator;
  value = value.replace(/[^\p{L}\p{N}]+/gu, separator);
  if (separator) {
    value = value
      .replace(new RegExp(`${separator}{2,}`, "g"), separator)
      .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");
  }
  if (options.lowercase) value = value.toLowerCase();

  return truncateSlug(value, options.maxLength, separator);
}

export interface SlugLine {
  line: string;
  slug: string;
}

export function slugifyLines(
  input: string,
  options: SlugOptions,
): { slugs: SlugLine[]; output: string } {
  const lines = input === "" ? [] : input.replace(/\r\n?/g, "\n").split("\n");
  const slugs = lines
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => ({ line, slug: slugify(line, options) }))
    .filter((entry) => entry.slug !== "");
  return { slugs, output: slugs.map((entry) => entry.slug).join("\n") };
}

/* ------------------------------------------------------------------ */
/* String escape                                                       */
/* ------------------------------------------------------------------ */

export type EscapeStyle = "javascript" | "json" | "python" | "csharp" | "sql" | "shell";
export type EscapeDirection = "escape" | "unescape";

export const ESCAPE_STYLES: Array<{ value: EscapeStyle; label: string; hint: string }> = [
  {
    value: "javascript",
    label: "JavaScript",
    hint: "Escaped body without surrounding quotes. Supports \\n, \\u, \\x, and \\u{...}.",
  },
  { value: "json", label: "JSON", hint: "Escaped body without surrounding quotes. JSON has no \\v or \\x escapes." },
  {
    value: "python",
    label: "Python",
    hint: "Escaped body without surrounding quotes. Supports \\x, \\u, \\U, and octal escapes.",
  },
  {
    value: "csharp",
    label: "C#",
    hint: "Escaped body without surrounding quotes. Supports \\x, \\u, and \\U escapes.",
  },
  { value: "sql", label: "SQL", hint: "Single quotes are doubled. Wrap the result in 'single quotes' in your query." },
  { value: "shell", label: "Shell (POSIX)", hint: "Single-quoted shell word, safe for sh, bash, and zsh." },
];

export interface EscapeResult {
  output: string;
  error: string;
}

function hex(value: number, width: number): string {
  return value.toString(16).padStart(width, "0");
}

function escapeJsonString(input: string): string {
  let output = "";
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0;
    if (character === '"') output += '\\"';
    else if (character === "\\") output += "\\\\";
    else if (character === "\b") output += "\\b";
    else if (character === "\f") output += "\\f";
    else if (character === "\n") output += "\\n";
    else if (character === "\r") output += "\\r";
    else if (character === "\t") output += "\\t";
    else if (code < 0x20 || code === 0x7f) output += `\\u${hex(code, 4)}`;
    else output += character;
  }
  return output;
}

function escapeCodeString(input: string, style: "javascript" | "python" | "csharp"): string {
  let output = "";
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "\\") output += "\\\\";
    else if (character === '"') output += '\\"';
    else if (character === "'") output += "\\'";
    else if (character === "\b") output += "\\b";
    else if (character === "\f") output += "\\f";
    else if (character === "\n") output += "\\n";
    else if (character === "\r") output += "\\r";
    else if (character === "\t") output += "\\t";
    else if (character === "\v") output += "\\v";
    else if (character === "\u0007" && style !== "javascript") output += "\\a";
    else if (code < 0x20 || code === 0x7f) {
      output += style === "python" ? `\\x${hex(code, 2)}` : `\\u${hex(code, 4)}`;
    } else output += character;
  }
  return output;
}

export function escapeText(input: string, style: EscapeStyle): EscapeResult {
  switch (style) {
    case "json":
      return { output: escapeJsonString(input), error: "" };
    case "javascript":
    case "python":
    case "csharp":
      return { output: escapeCodeString(input, style), error: "" };
    case "sql":
      return { output: input.replace(/'/g, "''"), error: "" };
    case "shell":
      return { output: `'${input.replace(/'/g, "'\\''")}'`, error: "" };
  }
}

interface UnescapeState {
  output: string;
  error: string;
}

function readHex(input: string, start: number, length: number): { value: number; next: number } | null {
  const slice = input.slice(start, start + length);
  if (slice.length !== length || !/^[0-9a-fA-F]+$/.test(slice)) return null;
  return { value: Number.parseInt(slice, 16), next: start + length };
}

function unescapeCodeString(
  input: string,
  style: "javascript" | "json" | "python" | "csharp",
): UnescapeState {
  let output = "";
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character !== "\\") {
      output += character;
      continue;
    }
    index += 1;
    if (index >= input.length) return { output: "", error: "The input ends with a lone backslash." };
    const escape = input[index];
    const position = index + 1;

    if (escape === "u") {
      if (style === "javascript" && input[index + 1] === "{") {
        const close = input.indexOf("}", index + 2);
        if (close === -1) return { output: "", error: `Unclosed \\u{ escape at position ${position}.` };
        const slice = input.slice(index + 2, close);
        if (!/^[0-9a-fA-F]{1,6}$/.test(slice)) {
          return { output: "", error: `Invalid \\u{${slice}} escape at position ${position}.` };
        }
        const code = Number.parseInt(slice, 16);
        if (code > 0x10ffff) return { output: "", error: `Code point out of range at position ${position}.` };
        output += String.fromCodePoint(code);
        index = close;
        continue;
      }
      const parsed = readHex(input, index + 1, 4);
      if (!parsed) return { output: "", error: `Invalid \\u escape at position ${position}.` };
      output += String.fromCharCode(parsed.value);
      index = parsed.next - 1;
      continue;
    }

    if (escape === "x") {
      if (style === "json") return { output: "", error: "JSON does not support \\x escapes. Use \\u00NN." };
      if (style === "csharp") {
        let end = index + 1;
        while (end < input.length && end < index + 5 && /^[0-9a-fA-F]$/.test(input[end])) end += 1;
        if (end === index + 1) {
          return { output: "", error: `Invalid \\x escape at position ${position}.` };
        }
        output += String.fromCharCode(Number.parseInt(input.slice(index + 1, end), 16));
        index = end - 1;
        continue;
      }
      const parsed = readHex(input, index + 1, 2);
      if (!parsed) return { output: "", error: `Invalid \\x escape at position ${position}.` };
      output += String.fromCharCode(parsed.value);
      index = parsed.next - 1;
      continue;
    }

    if (escape === "U") {
      if (style !== "python" && style !== "csharp") {
        return { output: "", error: `\\U is not valid in ${style} strings.` };
      }
      const parsed = readHex(input, index + 1, 8);
      if (!parsed || parsed.value > 0x10ffff) {
        return { output: "", error: `Invalid \\U escape at position ${position}.` };
      }
      output += String.fromCodePoint(parsed.value);
      index = parsed.next - 1;
      continue;
    }

    if (/[0-7]/.test(escape)) {
      if (style === "javascript" && escape === "0") {
        output += "\0";
        continue;
      }
      if (style === "json" || style === "javascript") {
        return { output: "", error: `Octal escapes are not allowed in ${style} strings.` };
      }
      let slice = escape;
      while (slice.length < 3 && /[0-7]/.test(input[index + 1] ?? "")) {
        index += 1;
        slice += input[index];
      }
      output += String.fromCharCode(Number.parseInt(slice, 8));
      continue;
    }

    switch (escape) {
      case "n":
        output += "\n";
        break;
      case "r":
        output += "\r";
        break;
      case "t":
        output += "\t";
        break;
      case "b":
        output += "\b";
        break;
      case "f":
        output += "\f";
        break;
      case "v":
        if (style === "json") return { output: "", error: "JSON does not support \\v escapes." };
        output += "\v";
        break;
      case "a":
        if (style === "javascript" || style === "json") {
          return { output: "", error: `\\a is not valid in ${style} strings.` };
        }
        output += "\u0007";
        break;
      case "0":
        if (style === "json") return { output: "", error: "JSON does not support \\0 escapes." };
        output += "\0";
        break;
      case "\\":
        output += "\\";
        break;
      case '"':
        output += '"';
        break;
      case "'":
        if (style === "json") {
          return { output: "", error: `\\' is not a valid JSON escape at position ${position}.` };
        }
        output += "'";
        break;
      case "/":
        if (style === "json" || style === "javascript") output += "/";
        else return { output: "", error: `\\/ is not a valid escape at position ${position}.` };
        break;
      default:
        return {
          output: "",
          error: `Unsupported escape \\${escape} at position ${position}.`,
        };
    }
  }
  return { output, error: "" };
}

function unescapeShell(input: string): UnescapeState {
  let output = "";
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else output += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = null;
        continue;
      }
      if (character === "\\") {
        const next = input[index + 1];
        if (next === undefined) return { output: "", error: "The input ends with a lone backslash." };
        if ('"\\$`\n'.includes(next)) {
          if (next !== "\n") output += next;
          index += 1;
          continue;
        }
      }
      output += character;
      continue;
    }
    if (character === "'") {
      quote = "'";
      continue;
    }
    if (character === '"') {
      quote = '"';
      continue;
    }
    if (character === "\\") {
      const next = input[index + 1];
      if (next === undefined) return { output: "", error: "The input ends with a lone backslash." };
      if (next !== "\n") output += next;
      index += 1;
      continue;
    }
    output += character;
  }
  if (quote) return { output: "", error: `Unterminated ${quote === "'" ? "single" : "double"} quote.` };
  return { output, error: "" };
}

export function unescapeText(input: string, style: EscapeStyle): EscapeResult {
  switch (style) {
    case "json":
    case "javascript":
    case "python":
    case "csharp":
      return unescapeCodeString(input, style);
    case "sql": {
      let value = input.trim();
      if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
        value = value.slice(1, -1);
      }
      return { output: value.replace(/''/g, "'"), error: "" };
    }
    case "shell":
      return unescapeShell(input);
  }
}

/* ------------------------------------------------------------------ */
/* Cron parser                                                         */
/* ------------------------------------------------------------------ */

export interface CronField {
  name: string;
  value: string;
}

export interface CronRun {
  iso: string;
  formatted: string;
}

export interface CronAnalysis {
  error: string;
  description: string;
  warning: string;
  nextRuns: CronRun[];
  fields: CronField[];
  hasSeconds: boolean;
}

export const CRON_FIELD_REFERENCE: Array<{
  name: string;
  range: string;
  special: string;
}> = [
  { name: "Second (optional)", range: "0–59", special: "* , - /" },
  { name: "Minute", range: "0–59", special: "* , - /" },
  { name: "Hour", range: "0–23", special: "* , - /" },
  { name: "Day of month", range: "1–31", special: "* , - / L ?" },
  { name: "Month", range: "1–12 or JAN–DEC", special: "* , - /" },
  { name: "Day of week", range: "0–7 or SUN–SAT", special: "* , - / L # ?" },
];

export const CRON_PRESETS: Array<{ label: string; expression: string }> = [
  { label: "Every minute", expression: "* * * * *" },
  { label: "Every 15 minutes", expression: "*/15 * * * *" },
  { label: "Weekdays at 09:00", expression: "0 9 * * 1-5" },
  { label: "First of month", expression: "0 0 1 * *" },
  { label: "Every 10 seconds", expression: "*/10 * * * * *" },
];

const FIVE_FIELD_NAMES = ["Minute", "Hour", "Day of month", "Month", "Day of week"];
const SIX_FIELD_NAMES = ["Second", "Minute", "Hour", "Day of month", "Month", "Day of week"];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

const EMPTY_CRON: CronAnalysis = {
  error: "",
  description: "",
  warning: "",
  nextRuns: [],
  fields: [],
  hasSeconds: false,
};

export function analyzeCron(
  expression: string,
  options: { timeZone: string; currentDate?: Date },
): CronAnalysis {
  const trimmed = expression.trim();
  if (!trimmed) return { ...EMPTY_CRON, error: "Enter a cron expression." };
  if (!isValidTimeZone(options.timeZone)) {
    return { ...EMPTY_CRON, error: `Unknown time zone "${options.timeZone}".` };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6) {
    return {
      ...EMPTY_CRON,
      error: `A cron expression needs 5 fields, or 6 with seconds. Found ${tokens.length}.`,
    };
  }
  const hasSeconds = tokens.length === 6;
  const names = hasSeconds ? SIX_FIELD_NAMES : FIVE_FIELD_NAMES;
  const fields = tokens.map((value, index) => ({ name: names[index], value }));

  let description = "";
  let warning = "";
  try {
    description = cronstrue.toString(trimmed, {
      throwExceptionOnParseError: true,
      use24HourTimeFormat: true,
    });
  } catch (error) {
    warning = `No human-readable description is available: ${errorMessage(error, "unsupported expression")}.`;
  }

  try {
    const interval = CronExpressionParser.parse(trimmed, {
      currentDate: options.currentDate ?? new Date(),
      tz: options.timeZone,
    });
    const nextRuns: CronRun[] = [];
    for (let index = 0; index < 5; index += 1) {
      const next = interval.next().toDate();
      nextRuns.push({ iso: next.toISOString(), formatted: formatInTimeZone(next, options.timeZone) });
    }

    const dayOfMonth = fields[hasSeconds ? 3 : 2].value;
    const dayOfWeek = fields[hasSeconds ? 5 : 4].value;
    if (dayOfMonth !== "*" && dayOfMonth !== "?" && dayOfWeek !== "*" && dayOfWeek !== "?") {
      warning = warning
        ? `${warning} Day-of-month and day-of-week are both restricted; the next runs use OR semantics.`
        : "Day-of-month and day-of-week are both restricted; the next runs use OR semantics.";
    }

    return { error: "", description, warning, nextRuns, fields, hasSeconds };
  } catch (error) {
    return {
      ...EMPTY_CRON,
      error: errorMessage(error, "Invalid cron expression"),
      description,
      warning,
      fields,
      hasSeconds,
    };
  }
}
