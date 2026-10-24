import { codeTools } from "./code";
import { cssTools } from "./css";
import { dataTools } from "./data";
import { datetimeTools } from "./datetime";
import { encodingTools } from "./encoding";
import { imageTools } from "./image";
import { miscTools } from "./misc";
import { securityTools } from "./security";
import { textTools } from "./text";
import type { ToolDefinition } from "./types";
import { webTools } from "./web";

export const tools: ToolDefinition[] = [
  ...dataTools,
  ...encodingTools,
  ...securityTools,
  ...textTools,
  ...webTools,
  ...imageTools,
  ...cssTools,
  ...datetimeTools,
  ...codeTools,
  ...miscTools,
];

export const toolById = new Map(tools.map((tool) => [tool.id, tool]));

export const toolsByCategory = new Map(
  [...new Set(tools.map((tool) => tool.category))].map((category) => [
    category,
    tools.filter((tool) => tool.category === category),
  ]),
);

export const featuredTools = tools.filter((tool) => tool.featured);

export type { CategoryInfo, ToolCategory, ToolDefinition } from "./types";
