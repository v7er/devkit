import { lazyTool } from "../lazy";
import type { ToolDefinition } from "../types";

export const textTools: ToolDefinition[] = [
  {
    id: "regex-tester",
    name: "RegEx Tester",
    description:
      "Test regular expressions with live matches, capture groups, replacement previews, and highlighted results.",
    category: "text",
    keywords: ["regexp", "pattern", "match", "capture", "replace", "redos", "regular expression"],
    component: lazyTool(() => import("./regex-tester")),
  },
  {
    id: "diff-checker",
    name: "Diff Checker",
    description:
      "Compare two texts line by line or word by word with unified and side-by-side views.",
    category: "text",
    keywords: ["compare", "text", "changes", "patch", "merge", "lines", "word"],
    component: lazyTool(() => import("./diff-checker")),
  },
  {
    id: "case-converter",
    name: "Case Converter",
    description:
      "Convert text between camel, Pascal, snake, kebab, constant, title, sentence, and dot case.",
    category: "text",
    keywords: ["camel", "pascal", "snake", "kebab", "title", "sentence", "constant", "naming"],
    component: lazyTool(() => import("./case-converter")),
  },
  {
    id: "text-counter",
    name: "Text Counter",
    description:
      "Count characters, words, lines, sentences, paragraphs, and bytes with reading time and word frequency.",
    category: "text",
    keywords: ["count", "words", "characters", "statistics", "frequency", "reading time", "letters"],
    component: lazyTool(() => import("./text-counter")),
  },
  {
    id: "markdown-preview",
    name: "Markdown Preview",
    description:
      "Render GitHub-flavored Markdown with tables and task lists, then export the sanitized HTML.",
    category: "text",
    keywords: ["gfm", "html", "tables", "task list", "render", "sanitized", "md"],
    component: lazyTool(() => import("./markdown-preview")),
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum Generator",
    description:
      "Generate classic or developer-themed placeholder text by words, sentences, or paragraphs.",
    category: "text",
    keywords: ["placeholder", "dummy", "filler", "sample", "random", "copy"],
    component: lazyTool(() => import("./lorem-ipsum")),
  },
  {
    id: "text-dedupe",
    name: "Text Deduplicator",
    description: "Remove duplicate lines, trim whitespace, drop blanks, and sort the remaining text.",
    category: "text",
    keywords: ["dedupe", "duplicate", "unique", "lines", "sort", "clean"],
    component: lazyTool(() => import("./text-dedupe")),
  },
  {
    id: "slug-generator",
    name: "Slug Generator",
    description:
      "Turn titles and names into URL-safe slugs with transliteration and length limits.",
    category: "text",
    keywords: ["url", "permalink", "transliterate", "seo", "friendly", "clean url"],
    component: lazyTool(() => import("./slug-generator")),
  },
  {
    id: "string-escape",
    name: "String Escaper",
    description: "Escape and unescape strings for JavaScript, JSON, Python, C#, SQL, and POSIX shells.",
    category: "text",
    keywords: ["escape", "unescape", "literal", "quote", "backslash", "json", "python", "shell"],
    component: lazyTool(() => import("./string-escape")),
  },
  {
    id: "cron-parser",
    name: "Cron Expression Parser",
    description: "Explain cron expressions and preview the next runs in a selected time zone.",
    category: "text",
    keywords: ["schedule", "crontab", "timezone", "next run", "cronjob"],
    component: lazyTool(() => import("./cron-parser")),
  },
];
