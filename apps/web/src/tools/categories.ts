import {
  Binary,
  Braces,
  Clock,
  Code2,
  Globe,
  Image,
  Palette,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";
import type { CategoryInfo, ToolCategory } from "./types";

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "data",
    name: "Data & formats",
    description: "JSON, YAML, CSV, XML, schemas, SQL, and GraphQL.",
    icon: Braces,
  },
  {
    id: "encoding",
    name: "Encoders & decoders",
    description: "Base64, URL, hex, binary, Morse, compressed payloads.",
    icon: Binary,
  },
  {
    id: "security",
    name: "Security & crypto",
    description: "Hashes, JWTs, keys, passwords, and encryption.",
    icon: ShieldCheck,
  },
  {
    id: "text",
    name: "Text & strings",
    description: "Regex, diffs, case, counts, Markdown, and cleanup.",
    icon: Type,
  },
  {
    id: "web",
    name: "Web & network",
    description: "HTTP, URLs, headers, subnets, and API snippets.",
    icon: Globe,
  },
  {
    id: "image",
    name: "Images & media",
    description: "Convert, crop, compress, resize, and inspect images.",
    icon: Image,
  },
  {
    id: "css",
    name: "CSS & frontend",
    description: "Colors, gradients, shadows, layouts, and CSS units.",
    icon: Palette,
  },
  {
    id: "datetime",
    name: "Date, time & math",
    description: "Timestamps, time zones, durations, and calculators.",
    icon: Clock,
  },
  {
    id: "code",
    name: "Code & tooling",
    description: "Git, Docker, permissions, .env files, and snippets.",
    icon: Code2,
  },
  {
    id: "misc",
    name: "Specialized",
    description: "QR codes, licenses, system info, and reference tables.",
    icon: Sparkles,
  },
];

export const categoryById = new Map<ToolCategory, CategoryInfo>(
  CATEGORIES.map((category) => [category.id, category]),
);
