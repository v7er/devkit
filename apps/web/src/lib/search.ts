import type { ToolDefinition } from "@/tools/types";

function scoreTool(tool: ToolDefinition, query: string): number {
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const id = tool.id.toLowerCase();

  if (name === query) return 120;
  if (name.startsWith(query)) return 100;
  if (id === query) return 95;
  if (name.includes(query)) return 80;
  if (id.includes(query)) return 70;

  let score = 0;
  for (const keyword of tool.keywords) {
    const value = keyword.toLowerCase();
    if (value === query) score = Math.max(score, 75);
    else if (value.startsWith(query)) score = Math.max(score, 60);
    else if (value.includes(query)) score = Math.max(score, 45);
  }

  if (description.includes(query)) score = Math.max(score, 30);
  if (tool.category.includes(query)) score = Math.max(score, 20);
  return score;
}

export function searchTools(
  query: string,
  tools: ToolDefinition[],
  limit = 40,
): ToolDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tools.slice(0, limit);

  return tools
    .map((tool) => ({ tool, score: scoreTool(tool, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, limit)
    .map((entry) => entry.tool);
}
