import { lazyTool } from "../lazy";
import type { ToolDefinition } from "../types";

export const datetimeTools: ToolDefinition[] = [
  {
    id: "timestamp",
    name: "Unix Timestamp Converter",
    description:
      "Convert Unix seconds or milliseconds to local, UTC, and ISO dates, or turn a date into a timestamp.",
    category: "datetime",
    keywords: ["unix", "epoch", "timestamp", "iso 8601", "seconds", "milliseconds", "clock"],
    component: lazyTool(() => import("./timestamp")),
  },
  {
    id: "timezone",
    name: "Time Zone Converter",
    description: "Compare one instant across IANA time zones with daylight-saving offsets.",
    category: "datetime",
    keywords: ["timezone", "time zone", "utc", "gmt", "offset", "dst", "converter"],
    component: lazyTool(() => import("./timezone")),
  },
  {
    id: "date-diff",
    name: "Date Difference",
    description:
      "Measure the days, hours, minutes, and seconds between two dates, with an optional business-day count.",
    category: "datetime",
    keywords: ["date", "difference", "duration", "business days", "age", "elapsed"],
    component: lazyTool(() => import("./date-diff")),
  },
  {
    id: "base-converter",
    name: "Number Base Converter",
    description:
      "Convert integers between binary, octal, decimal, hexadecimal, and any base from 2 to 36.",
    category: "datetime",
    keywords: ["base", "radix", "binary", "octal", "decimal", "hex", "hexadecimal", "bigint"],
    component: lazyTool(() => import("./base-converter")),
  },
  {
    id: "duration-parser",
    name: "Duration Parser",
    description:
      "Parse durations such as 2h 30m, 1.5 days, ISO 8601, or plain seconds and format them in multiple units.",
    category: "datetime",
    keywords: ["duration", "parse", "time span", "hours", "minutes", "iso 8601", "seconds"],
    component: lazyTool(() => import("./duration-parser")),
  },
  {
    id: "bitwise",
    name: "Bitwise Calculator",
    description:
      "Apply AND, OR, XOR, NOT, and shifts with 8, 16, 32, or 64-bit views and binary output.",
    category: "datetime",
    keywords: ["bitwise", "and", "or", "xor", "not", "shift", "binary", "bits", "mask"],
    component: lazyTool(() => import("./bitwise")),
  },
  {
    id: "percentage-ratio",
    name: "Percentage & Ratio",
    description:
      "Find a percentage of a value, measure percent change, simplify ratios, and split parts.",
    category: "datetime",
    keywords: ["percentage", "percent", "ratio", "aspect ratio", "proportion", "change"],
    component: lazyTool(() => import("./percentage-ratio")),
  },
  {
    id: "matrix",
    name: "Matrix Calculator",
    description:
      "Add, multiply, transpose, and invert small matrices, or compute the determinant.",
    category: "datetime",
    keywords: ["matrix", "determinant", "inverse", "transpose", "multiply", "linear algebra"],
    component: lazyTool(() => import("./matrix")),
  },
  {
    id: "random-number",
    name: "Random Number Generator",
    description:
      "Generate uniform integers or floats in a range, unique sets, and reproducible seeded sequences.",
    category: "datetime",
    keywords: ["random", "number", "prng", "seed", "mulberry32", "range", "unique", "dice"],
    component: lazyTool(() => import("./random-number")),
  },
  {
    id: "timer",
    name: "Stopwatch & Timer",
    description: "Run a stopwatch with laps or a countdown timer that stays accurate while paused.",
    category: "datetime",
    keywords: ["timer", "stopwatch", "countdown", "lap", "elapsed", "clock"],
    component: lazyTool(() => import("./timer")),
  },
];
