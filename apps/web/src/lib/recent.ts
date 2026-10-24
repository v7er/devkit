import { toolById } from "@/tools/registry";
import type { ToolDefinition } from "@/tools/types";

const KEY = "devkit:recent";
const LIMIT = 6;

export function readRecentIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecent(id: string): void {
  if (!toolById.has(id)) return;
  try {
    const next = [id, ...readRecentIds().filter((entry) => entry !== id)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Recent tools are a convenience; storage failures are not fatal.
  }
}

export function recentTools(): ToolDefinition[] {
  return readRecentIds()
    .map((id) => toolById.get(id))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}
