export class JsonParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "JsonParseError";
    this.line = line;
    this.column = column;
  }
}

function positionOf(source: string, index: number): { line: number; column: number } {
  const upto = source.slice(0, Math.max(0, index));
  const lines = upto.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function parseJson(source: string): unknown {
  const trimmed = source.trim();
  if (!trimmed) throw new JsonParseError("Input is empty", 1, 1);
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const match = /position (\d+)/i.exec(message);
    const position = match ? positionOf(trimmed, Number(match[1])) : { line: 1, column: 1 };
    throw new JsonParseError(message.replace(/^JSON\.parse:\s*/i, ""), position.line, position.column);
  }
}

export function formatJson(source: string, indent: number | "\t" = 2): string {
  return `${JSON.stringify(parseJson(source), null, indent)}\n`;
}

export function minifyJson(source: string): string {
  return JSON.stringify(parseJson(source));
}

export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, sortJsonKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(sortJsonKeys(value), null, indent);
}
