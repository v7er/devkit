import { describe, expect, it } from "vitest";
import {
  analyzeCron,
  analyzeDiff,
  buildHtmlDocument,
  countText,
  convertCase,
  dedupeText,
  detectReDoS,
  escapeText,
  generateLorem,
  highlightMatches,
  renderMarkdown,
  runRegex,
  runRegexReplace,
  slugify,
  slugifyLines,
  splitWords,
  unescapeText,
  unifiedDiffText,
  validateRegexFlags,
} from "./logic";

describe("regex tester", () => {
  it("accepts valid flags and rejects bad ones", () => {
    expect(validateRegexFlags("gims")).toBe("");
    expect(validateRegexFlags("gz")).toContain('"z"');
    expect(validateRegexFlags("gg")).toContain("Duplicate");
    expect(validateRegexFlags("uv")).toContain("cannot be combined");
  });

  it("lists matches with numbered and named groups", () => {
    const result = runRegex("(?<user>\\w+)@(\\w+\\.\\w+)", "g", "ada@example.com, grace@navy.mil");
    expect(result.error).toBe("");
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({
      index: 0,
      end: 15,
      value: "ada@example.com",
      groups: ["ada", "example.com"],
      namedGroups: [{ name: "user", value: "ada" }],
    });
  });

  it("returns a single match when the global flag is missing", () => {
    const result = runRegex("a", "", "aaa");
    expect(result.matches).toHaveLength(1);
  });

  it("reports invalid patterns without throwing", () => {
    const result = runRegex("(", "g", "abc");
    expect(result.error).not.toBe("");
    expect(result.matches).toEqual([]);
  });

  it("advances past zero-length matches", () => {
    const result = runRegex("", "g", "ab");
    expect(result.error).toBe("");
    expect(result.matches).toHaveLength(3);
    expect(result.matches.every((match) => match.value === "")).toBe(true);
  });

  it("builds replacement previews", () => {
    expect(runRegexReplace("(\\w+)@(\\w+)", "g", "a@b", "$2:$1")).toEqual({
      error: "",
      output: "b:a",
    });
    expect(runRegexReplace("(", "", "a", "x").error).not.toBe("");
  });

  it("splits highlighted segments without losing text", () => {
    const result = runRegex("\\d+", "g", "a1b22c");
    const segments = highlightMatches("a1b22c", result.matches);
    expect(segments.map((segment) => segment.text).join("")).toBe("a1b22c");
    expect(segments.filter((segment) => segment.matchIndex !== null)).toHaveLength(2);
  });

  it("warns about nested quantifiers and duplicate alternations", () => {
    expect(detectReDoS("(\\w+)+@example\\.com")).not.toBeNull();
    expect(detectReDoS("(a|ab)+")).not.toBeNull();
    expect(detectReDoS("\\b\\w+@\\w+\\.\\w+\\b")).toBeNull();
  });
});

describe("diff checker", () => {
  it("reports added and removed lines", () => {
    const diff = analyzeDiff("a\nb\nc", "a\nB\nc\nd", {
      mode: "lines",
      ignoreWhitespace: false,
      ignoreCase: false,
    });
    expect(diff.error).toBe("");
    expect(diff.summary).toEqual({ added: 2, removed: 1, unchanged: 2 });
    expect(unifiedDiffText(diff.lines)).toBe("  a\n- b\n+ B\n  c\n+ d");
    expect(diff.sideBySide.some((row) => row.left?.kind === "removed" && row.right?.kind === "added")).toBe(
      true,
    );
  });

  it("ignores case and whitespace when asked", () => {
    const options = { mode: "lines" as const, ignoreWhitespace: true, ignoreCase: true };
    const diff = analyzeDiff("Hello   world\n", "hello world\n", options);
    expect(diff.summary).toEqual({ added: 0, removed: 0, unchanged: 2 });
  });

  it("produces word tokens", () => {
    const diff = analyzeDiff("the quick fox", "the slow fox", {
      mode: "words",
      ignoreWhitespace: false,
      ignoreCase: false,
    });
    expect(diff.tokens.some((token) => token.kind === "removed" && token.value.includes("quick"))).toBe(
      true,
    );
    expect(diff.tokens.some((token) => token.kind === "added" && token.value.includes("slow"))).toBe(
      true,
    );
    expect(diff.summary).toEqual({ added: 1, removed: 1, unchanged: 2 });
  });

  it("refuses oversized input", () => {
    const diff = analyzeDiff("a".repeat(150_000), "b".repeat(100_000), {
      mode: "lines",
      ignoreWhitespace: false,
      ignoreCase: false,
    });
    expect(diff.error).toContain("too large");
    expect(diff.lines).toEqual([]);
  });
});

describe("case converter", () => {
  it("splits separators, camel case, and acronyms", () => {
    expect(splitWords("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
    expect(splitWords("get_user-ID.name")).toEqual(["get", "user", "ID", "name"]);
    expect(splitWords("helloWorld42")).toEqual(["hello", "World", "42"]);
  });

  it("converts between all styles", () => {
    expect(convertCase("hello world", "camel")).toBe("helloWorld");
    expect(convertCase("hello world", "pascal")).toBe("HelloWorld");
    expect(convertCase("helloWorld", "snake")).toBe("hello_world");
    expect(convertCase("Hello World", "kebab")).toBe("hello-world");
    expect(convertCase("hello world", "constant")).toBe("HELLO_WORLD");
    expect(convertCase("hello world", "title")).toBe("Hello World");
    expect(convertCase("HELLO WORLD", "sentence")).toBe("Hello world");
    expect(convertCase("hello world", "dot")).toBe("hello.world");
    expect(convertCase("Hello World", "lower")).toBe("hello world");
  });

  it("returns an empty string for input without words", () => {
    expect(convertCase("---", "camel")).toBe("");
  });
});

describe("text counter", () => {
  it("counts characters, words, lines, sentences, and paragraphs", () => {
    const stats = countText("Hello world. This is a test.\n\nSecond paragraph!");
    expect(stats.words).toBe(8);
    expect(stats.characters).toBe(47);
    expect(stats.lines).toBe(3);
    expect(stats.sentences).toBe(3);
    expect(stats.paragraphs).toBe(2);
    expect(stats.bytes).toBe(47);
    expect(stats.readingLabel).toBe("<1 min");
  });

  it("counts UTF-8 bytes and ignores spaces for character counts", () => {
    const stats = countText("é a");
    expect(stats.bytes).toBe(4);
    expect(stats.characters).toBe(3);
    expect(stats.charactersNoSpaces).toBe(2);
  });

  it("ranks word frequencies and filters common words", () => {
    const stats = countText("the cat the dog the cat");
    expect(stats.frequencies[0]).toMatchObject({ word: "the", count: 3 });
    expect(stats.frequencies[1]).toMatchObject({ word: "cat", count: 2 });
    const filtered = countText("the cat the dog the cat", { ignoreCommonWords: true });
    expect(filtered.frequencies.map((entry) => entry.word)).toEqual(["cat", "dog"]);
  });

  it("handles empty input", () => {
    const stats = countText("");
    expect(stats).toMatchObject({
      characters: 0,
      words: 0,
      lines: 0,
      sentences: 0,
      paragraphs: 0,
      bytes: 0,
      uniqueWords: 0,
      readingLabel: "0 min",
    });
  });
});

describe("markdown preview", () => {
  it("renders GFM tables and task lists", () => {
    const { html, error } = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done");
    expect(error).toBe("");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain('type="checkbox"');
  });

  it("strips scripts, event handlers, and unsafe URLs", () => {
    const { html } = renderMarkdown(
      '<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("hardens links that survive sanitizing", () => {
    const { html } = renderMarkdown("[example](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("escapes the title in exported documents", () => {
    const document = buildHtmlDocument("<unsafe>", "<p>ok</p>");
    expect(document).toContain("<title>&lt;unsafe&gt;</title>");
    expect(document).toContain("<p>ok</p>");
  });
});

describe("lorem ipsum", () => {
  const sequential = (max: number) => {
    if (max <= 0) return 0;
    return 3 % max;
  };

  it("generates an exact word count", () => {
    const result = generateLorem(
      { unit: "words", count: 12, theme: "classic", startWithLorem: true },
      sequential,
    );
    expect(result.error).toBe("");
    expect(result.wordCount).toBe(12);
    expect(result.text.startsWith("Lorem ipsum")).toBe(true);
  });

  it("generates paragraphs separated by blank lines", () => {
    const result = generateLorem(
      { unit: "paragraphs", count: 3, theme: "classic", startWithLorem: true },
      sequential,
    );
    expect(result.text.split("\n\n")).toHaveLength(3);
    expect(result.text.startsWith("Lorem ipsum dolor sit amet")).toBe(true);
  });

  it("uses the developer word list", () => {
    const result = generateLorem(
      { unit: "words", count: 5, theme: "developer", startWithLorem: false },
      (max) => Math.min(1, Math.max(0, max - 1)),
    );
    expect(result.wordCount).toBe(5);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("rejects invalid counts", () => {
    const result = generateLorem(
      { unit: "sentences", count: 0, theme: "classic", startWithLorem: false },
      sequential,
    );
    expect(result.error).toContain("Count must be");
    expect(result.text).toBe("");
  });
});

describe("text dedupe", () => {
  const base = {
    trim: false,
    dropEmpty: false,
    removeDuplicates: true,
    caseInsensitive: false,
    sort: "none" as const,
  };

  it("removes duplicate lines and counts them", () => {
    const result = dedupeText("a\nb\na\nb\na", base);
    expect(result.output).toBe("a\nb");
    expect(result.duplicateLines).toBe(3);
    expect(result.duplicates).toEqual([
      { value: "a", count: 3 },
      { value: "b", count: 2 },
    ]);
  });

  it("matches case-insensitively while keeping the first spelling", () => {
    const result = dedupeText("Alpha\nalpha\nALPHA", { ...base, caseInsensitive: true });
    expect(result.output).toBe("Alpha");
    expect(result.duplicateLines).toBe(2);
  });

  it("trims and drops empty lines", () => {
    const result = dedupeText("  a  \n\n   \n b ", { ...base, trim: true, dropEmpty: true });
    expect(result.output).toBe("a\nb");
    expect(result.droppedEmpty).toBe(2);
  });

  it("sorts the surviving lines", () => {
    expect(dedupeText("c\na\nb", { ...base, sort: "asc" }).output).toBe("a\nb\nc");
    expect(dedupeText("c\na\nb", { ...base, sort: "desc" }).output).toBe("c\nb\na");
  });
});

describe("slug generator", () => {
  it("transliterates accents and strips punctuation", () => {
    expect(slugify("Héllo, Wörld!", { separator: "-", lowercase: true, maxLength: 0 })).toBe(
      "hello-world",
    );
    expect(slugify("Straße & Æther", { separator: "-", lowercase: true, maxLength: 0 })).toBe(
      "strasse-aether",
    );
  });

  it("honours separators, casing, and limits", () => {
    expect(slugify("Hello World", { separator: "_", lowercase: false, maxLength: 0 })).toBe(
      "Hello_World",
    );
    expect(slugify("hello world", { separator: "-", lowercase: true, maxLength: 8 })).toBe(
      "hello-wo",
    );
    expect(slugify("one two three", { separator: "", lowercase: true, maxLength: 0 })).toBe(
      "onetwothree",
    );
  });

  it("processes bulk lines and skips blank ones", () => {
    const result = slugifyLines("Hello World\n\nSecond Line!", {
      separator: "-",
      lowercase: true,
      maxLength: 0,
    });
    expect(result.output).toBe("hello-world\nsecond-line");
    expect(result.slugs).toHaveLength(2);
  });
});

describe("string escape", () => {
  it("round-trips JavaScript control characters and quotes", () => {
    const source = "line\n\"quoted\"\\path\t";
    const escaped = escapeText(source, "javascript");
    expect(escaped.output).toBe('line\\n\\"quoted\\"\\\\path\\t');
    expect(unescapeText(escaped.output, "javascript")).toEqual({ output: source, error: "" });
  });

  it("supports JavaScript code point escapes", () => {
    expect(unescapeText("\\u{1F600}", "javascript")).toEqual({ output: "😀", error: "" });
  });

  it("round-trips JSON and rejects non-JSON escapes", () => {
    const source = "a\nb\t\"c\"";
    const escaped = escapeText(source, "json");
    expect(unescapeText(escaped.output, "json").output).toBe(source);
    expect(unescapeText("\\x41", "json").error).toContain("JSON does not support");
    expect(unescapeText("\\v", "json").error).toContain("JSON does not support");
    expect(unescapeText("\\'", "json").error).toContain("not a valid JSON escape");
    expect(unescapeText("abc\\", "json").error).toContain("lone backslash");
  });

  it("handles Python, C#, and SQL escapes", () => {
    expect(unescapeText("\\x41\\u00e9", "python")).toEqual({ output: "Aé", error: "" });
    expect(unescapeText("\\U0001F600", "python")).toEqual({ output: "😀", error: "" });
    expect(unescapeText("\\x41\\u00e9", "csharp")).toEqual({ output: "Aé", error: "" });
    expect(escapeText("O'Brien", "sql")).toEqual({ output: "O''Brien", error: "" });
    expect(unescapeText("'O''Brien'", "sql")).toEqual({ output: "O'Brien", error: "" });
  });

  it("quotes shell words and unescapes them back", () => {
    const source = "it's a test $HOME";
    const escaped = escapeText(source, "shell");
    expect(escaped.output).toBe("'it'\\''s a test $HOME'");
    expect(unescapeText(escaped.output, "shell")).toEqual({ output: source, error: "" });
    expect(unescapeText("'unterminated", "shell").error).toContain("Unterminated");
    expect(unescapeText("oops\\", "shell").error).toContain("lone backslash");
  });

  it("reports unsupported escapes", () => {
    expect(unescapeText("\\q", "javascript").error).toContain("Unsupported escape");
  });
});

describe("cron parser", () => {
  it("describes an expression and lists the next runs in UTC", () => {
    const result = analyzeCron("*/15 * * * *", {
      timeZone: "UTC",
      currentDate: new Date("2024-01-01T00:07:00Z"),
    });
    expect(result.error).toBe("");
    expect(result.description.toLowerCase()).toContain("every 15 minutes");
    expect(result.nextRuns.map((run) => run.iso)).toEqual([
      "2024-01-01T00:15:00.000Z",
      "2024-01-01T00:30:00.000Z",
      "2024-01-01T00:45:00.000Z",
      "2024-01-01T01:00:00.000Z",
      "2024-01-01T01:15:00.000Z",
    ]);
  });

  it("supports six-field expressions with seconds", () => {
    const result = analyzeCron("*/10 * * * * *", {
      timeZone: "UTC",
      currentDate: new Date("2024-01-01T00:00:05Z"),
    });
    expect(result.hasSeconds).toBe(true);
    expect(result.fields[0]).toEqual({ name: "Second", value: "*/10" });
    expect(result.nextRuns[0].iso).toBe("2024-01-01T00:00:10.000Z");
  });

  it("is timezone aware", () => {
    const result = analyzeCron("0 0 * * *", {
      timeZone: "Asia/Tokyo",
      currentDate: new Date("2024-01-01T00:30:00Z"),
    });
    expect(result.nextRuns[0].iso).toBe("2024-01-01T15:00:00.000Z");
    expect(result.nextRuns[0].formatted).toContain("Jan 02, 2024");
  });

  it("rejects invalid expressions and field counts", () => {
    expect(analyzeCron("not a cron", { timeZone: "UTC" }).error).not.toBe("");
    expect(analyzeCron("1 2 3", { timeZone: "UTC" }).error).toContain("Found 3");
    expect(analyzeCron("99 * * * *", { timeZone: "UTC" }).error).not.toBe("");
    expect(analyzeCron("", { timeZone: "UTC" }).error).toContain("Enter a cron");
    expect(analyzeCron("* * * * *", { timeZone: "Mars/Olympus" }).error).toContain("Unknown time zone");
  });

  it("warns about OR semantics for restricted day fields", () => {
    const result = analyzeCron("0 0 1 * 1", { timeZone: "UTC" });
    expect(result.error).toBe("");
    expect(result.warning).toContain("OR semantics");
  });
});
