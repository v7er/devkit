import {
  GraphQLError,
  parse as parseGraphql,
  print as printGraphql,
  type DocumentNode,
} from "graphql";
import { JSONPath } from "jsonpath-plus";
import { format as formatSqlQuery, type SqlLanguage } from "sql-formatter";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { parseJson } from "@/lib/json";

/* ------------------------------------------------------------------------- *
 * YAML <-> JSON
 * ------------------------------------------------------------------------- */

export interface YamlToJsonOptions {
  indent?: number;
}

export interface JsonToYamlOptions {
  indent?: number;
  multiDocument?: boolean;
}

export function yamlToJson(source: string, options: YamlToJsonOptions = {}): string {
  if (!source.trim()) throw new Error("Input is empty");
  const documents = parseAllDocuments(source);
  if (documents.length === 0) throw new Error("No YAML documents found");

  const values: unknown[] = [];
  for (const document of documents) {
    const error = document.errors[0];
    if (error) {
      const position = error.linePos?.[0];
      throw new Error(
        position
          ? `Line ${position.line}, column ${position.col}: ${error.message}`
          : error.message,
      );
    }
    const value: unknown = document.toJS();
    values.push(value === undefined ? null : value);
  }

  const result = values.length === 1 ? values[0] : values;
  return `${JSON.stringify(result, null, options.indent ?? 2)}\n`;
}

export function jsonToYaml(source: string, options: JsonToYamlOptions = {}): string {
  const value = parseJson(source);
  const indent = options.indent ?? 2;
  const documents =
    options.multiDocument === true && Array.isArray(value) ? value : [value];
  if (documents.length === 0) {
    throw new Error("JSON array is empty, so there are no documents to write");
  }
  return documents
    .map((document) => stringifyYaml(document, { indent, lineWidth: 0 }))
    .join("---\n");
}

/* ------------------------------------------------------------------------- *
 * CSV <-> JSON
 * ------------------------------------------------------------------------- */

export type CsvDelimiter = "," | ";" | "\t" | "|";

export interface CsvToJsonOptions {
  delimiter?: string;
  hasHeader?: boolean;
}

export interface JsonToCsvOptions {
  delimiter?: string;
  includeHeader?: boolean;
}

function assertDelimiter(delimiter: string): void {
  if (
    delimiter.length !== 1 ||
    delimiter === '"' ||
    delimiter === "\n" ||
    delimiter === "\r"
  ) {
    throw new Error("Delimiter must be a single character other than a quote or line break");
  }
}

function csvLocation(source: string, index: number): { line: number; column: number } {
  const upto = source.slice(0, Math.max(0, index));
  const lines = upto.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1] ?? "").length + 1 };
}

/** Parse RFC 4180 CSV into rows of raw string fields. */
export function parseCsv(source: string, delimiter = ","): string[][] {
  if (!source.trim()) throw new Error("Input is empty");
  assertDelimiter(delimiter);

  const input = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowStarted = false;
  let quoteStart = 0;
  let index = 0;

  while (index < input.length) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        const next = input[index];
        if (next !== undefined && next !== delimiter && next !== "\n" && next !== "\r") {
          const location = csvLocation(input, index);
          throw new Error(
            `Line ${location.line}, column ${location.column}: Unexpected character after a closing quote`,
          );
        }
        continue;
      }
      field += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        const location = csvLocation(input, index);
        throw new Error(
          `Line ${location.line}, column ${location.column}: Quote inside an unquoted field`,
        );
      }
      inQuotes = true;
      rowStarted = true;
      quoteStart = index;
      index += 1;
      continue;
    }

    if (character === delimiter) {
      row.push(field);
      field = "";
      rowStarted = true;
      index += 1;
      continue;
    }

    if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      if (rowStarted || row.length > 0 || field.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        rowStarted = false;
      }
      index += 1;
      continue;
    }

    field += character;
    rowStarted = true;
    index += 1;
  }

  if (inQuotes) {
    const location = csvLocation(input, quoteStart);
    throw new Error(
      `Line ${location.line}, column ${location.column}: Quoted field is not closed`,
    );
  }

  if (rowStarted || row.length > 0 || field.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function uniqueHeader(base: string, used: Set<string>): string {
  const stem = base || "column";
  let candidate = stem;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${stem}_${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function headerNames(firstRow: string[], width: number): string[] {
  const used = new Set<string>();
  const names: string[] = [];
  for (let index = 0; index < width; index += 1) {
    const raw = (firstRow[index] ?? "").trim();
    names.push(uniqueHeader(raw || `column_${index + 1}`, used));
  }
  return names;
}

export function csvToJson(source: string, options: CsvToJsonOptions = {}): unknown {
  const rows = parseCsv(source, options.delimiter ?? ",");
  if (!options.hasHeader) return rows;

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = headerNames(rows[0] ?? [], width);
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? "";
}

function escapeCsvField(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRecords(value: unknown): { headers: string[]; rows: string[][] } {
  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error("JSON array is empty");
    if (value.every((item) => isPlainObject(item))) {
      const headers: string[] = [];
      for (const item of value) {
        for (const key of Object.keys(item)) {
          if (!headers.includes(key)) headers.push(key);
        }
      }
      const rows = value.map((item) => headers.map((key) => csvCell(item[key])));
      return { headers, rows };
    }
    if (value.every((item) => Array.isArray(item))) {
      const rows = value.map((item) => item.map(csvCell));
      const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
      const headers = Array.from({ length: width }, (_, index) => `column_${index + 1}`);
      return {
        headers,
        rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? "")),
      };
    }
    if (value.every((item) => !isPlainObject(item) && !Array.isArray(item))) {
      return {
        headers: ["value"],
        rows: value.map((item) => [csvCell(item)]),
      };
    }
    throw new Error(
      "Array mixes objects, arrays, and scalar values; make every item the same shape",
    );
  }

  if (isPlainObject(value)) {
    const headers = Object.keys(value);
    return { headers, rows: [headers.map((key) => csvCell(value[key]))] };
  }

  throw new Error("CSV export needs a JSON object or array at the top level");
}

export function jsonToCsv(source: string, options: JsonToCsvOptions = {}): string {
  const value = parseJson(source);
  const delimiter = options.delimiter ?? ",";
  assertDelimiter(delimiter);
  const { headers, rows } = csvRecords(value);
  const lines: string[] = [];
  if (options.includeHeader) {
    lines.push(headers.map((header) => escapeCsvField(header, delimiter)).join(delimiter));
  }
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(cell, delimiter)).join(delimiter));
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------------- *
 * JSON -> TypeScript
 * ------------------------------------------------------------------------- */

export interface JsonToTypescriptOptions {
  rootName?: string;
  readonly?: boolean;
}

interface TsProp {
  name: string;
  node: TsNode;
  optional: boolean;
}

type TsNode =
  | { kind: "primitive"; name: string }
  | { kind: "object"; props: TsProp[] }
  | { kind: "array"; element: TsNode }
  | { kind: "union"; members: TsNode[] };

function primitiveNode(name: string): TsNode {
  return { kind: "primitive", name };
}

function inferTsNode(value: unknown): TsNode {
  if (value === null) return primitiveNode("null");
  if (Array.isArray(value)) {
    const element =
      value.length === 0 ? primitiveNode("unknown") : mergeTsNodes(value.map(inferTsNode));
    return { kind: "array", element };
  }
  if (isPlainObject(value)) {
    return {
      kind: "object",
      props: Object.entries(value).map(([name, child]) => ({
        name,
        node: inferTsNode(child),
        optional: false,
      })),
    };
  }
  if (typeof value === "string") return primitiveNode("string");
  if (typeof value === "number") return primitiveNode("number");
  if (typeof value === "boolean") return primitiveNode("boolean");
  return primitiveNode("unknown");
}

function nodeKey(node: TsNode): string {
  switch (node.kind) {
    case "primitive":
      return `p:${node.name}`;
    case "array":
      return `a:${nodeKey(node.element)}`;
    case "object":
      return `o:{${node.props
        .map((prop) => `${prop.name}${prop.optional ? "?" : ""}=${nodeKey(prop.node)}`)
        .join(",")}}`;
    case "union":
      return `u:(${node.members.map(nodeKey).sort().join("|")})`;
  }
}

function flattenUnion(node: TsNode): TsNode[] {
  if (node.kind !== "union") return [node];
  return node.members.flatMap(flattenUnion);
}

function unionNode(members: TsNode[]): TsNode {
  const seen = new Set<string>();
  const unique: TsNode[] = [];
  for (const member of members.flatMap(flattenUnion)) {
    const key = nodeKey(member);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(member);
  }
  if (unique.length === 1) return unique[0];
  return { kind: "union", members: unique };
}

function mergeObjectNodes(a: TsNode & { kind: "object" }, b: TsNode & { kind: "object" }): TsNode {
  const names: string[] = a.props.map((prop) => prop.name);
  for (const prop of b.props) {
    if (!names.includes(prop.name)) names.push(prop.name);
  }
  const props: TsProp[] = [];
  for (const name of names) {
    const left = a.props.find((prop) => prop.name === name);
    const right = b.props.find((prop) => prop.name === name);
    if (left && right) {
      props.push({
        name,
        node: mergeTsNodes([left.node, right.node]),
        optional: left.optional || right.optional,
      });
      continue;
    }
    const present = left ?? right;
    if (present) props.push({ ...present, optional: true });
  }
  return { kind: "object", props };
}

function mergeTsNode(left: TsNode, right: TsNode): TsNode {
  if (nodeKey(left) === nodeKey(right)) return left;
  if (left.kind === "object" && right.kind === "object") {
    return mergeObjectNodes(left, right);
  }
  if (left.kind === "array" && right.kind === "array") {
    return { kind: "array", element: mergeTsNode(left.element, right.element) };
  }
  return unionNode([left, right]);
}

function mergeTsNodes(nodes: TsNode[]): TsNode {
  if (nodes.length === 0) return primitiveNode("unknown");
  return nodes.slice(1).reduce(mergeTsNode, nodes[0]);
}

function pascalCase(value: string): string {
  const words = value
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const joined = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  const name = joined || "Type";
  return /^[0-9]/.test(name) ? `Type${name}` : name;
}

class TypeScriptWriter {
  private readonly declarations: string[] = [];
  private readonly usedNames = new Set<string>();

  constructor(private readonly readonly: boolean) {}

  type(node: TsNode, hint: string): string {
    switch (node.kind) {
      case "primitive":
        return node.name;
      case "array":
        return `Array<${this.type(node.element, `${hint}Item`)}>`;
      case "union":
        return node.members.map((member) => this.type(member, hint)).join(" | ");
      case "object":
        return this.renderObject(node, hint);
    }
  }

  private renderObject(node: TsNode & { kind: "object" }, hint: string): string {
    if (node.props.length === 0) return "Record<string, unknown>";
    const name = this.allocate(hint);
    const properties = node.props.map((prop) => {
      const property =
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(prop.name) ? prop.name : JSON.stringify(prop.name);
      const optional = prop.optional ? "?" : "";
      const readonly = this.readonly ? "readonly " : "";
      const type = this.type(prop.node, pascalCase(prop.name));
      return `  ${readonly}${property}${optional}: ${type};`;
    });
    this.declarations.push(`export interface ${name} {\n${properties.join("\n")}\n}`);
    return name;
  }

  private allocate(hint: string): string {
    const stem = pascalCase(hint);
    let candidate = stem;
    let counter = 2;
    while (this.usedNames.has(candidate)) {
      candidate = `${stem}${counter}`;
      counter += 1;
    }
    this.usedNames.add(candidate);
    return candidate;
  }

  declarationText(): string {
    return this.declarations.slice().reverse().join("\n\n");
  }
}

export function jsonToTypescript(source: string, options: JsonToTypescriptOptions = {}): string {
  const value = parseJson(source);
  const rootName = pascalCase(options.rootName?.trim() || "Root");
  const writer = new TypeScriptWriter(options.readonly === true);
  const rootType = writer.type(inferTsNode(value), rootName);
  const declarations = writer.declarationText();

  if (rootType === rootName) {
    return declarations ? `${declarations}\n` : "";
  }

  const alias = `export type ${rootName} = ${rootType};`;
  return declarations ? `${alias}\n\n${declarations}\n` : `${alias}\n`;
}

/* ------------------------------------------------------------------------- *
 * JSONPath
 * ------------------------------------------------------------------------- */

export interface JsonPathMatch {
  path: string;
  value: unknown;
}

function formatJsonPath(path: unknown): string {
  if (typeof path === "string") return path;
  if (!Array.isArray(path)) return "$";
  let result = "$";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
      continue;
    }
    const key = String(segment);
    if (key === "$") continue;
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) result += `.${key}`;
    else result += `[${JSON.stringify(key)}]`;
  }
  return result;
}

export function evaluateJsonPath(source: string, expression: string): JsonPathMatch[] {
  if (!expression.trim()) throw new Error("Enter a JSONPath expression");
  const json = parseJson(source);

  let raw: unknown;
  try {
    raw = JSONPath({
      path: expression.trim(),
      json,
      resultType: "all",
      wrap: true,
      eval: "safe",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid expression";
    throw new Error(`Invalid JSONPath expression: ${message}`);
  }

  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => {
    if (isPlainObject(item) && "value" in item && "path" in item) {
      return { path: formatJsonPath(item.path), value: item.value };
    }
    return { path: "$", value: item };
  });
}

/* ------------------------------------------------------------------------- *
 * XML formatter
 * ------------------------------------------------------------------------- */

export type XmlIndent = 2 | 4 | "\t";

export interface XmlFormatOptions {
  indent?: XmlIndent;
}

export interface XmlFormatResult {
  output: string;
  root: string;
  elements: number;
  attributes: number;
}

function indentUnit(indent: XmlIndent): string {
  if (indent === "\t") return "\t";
  return " ".repeat(indent);
}

function pad(depth: number, indent: string): string {
  return indent.repeat(depth);
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

function findXmlParserError(document: XMLDocument): Element | null {
  for (const element of Array.from(document.getElementsByTagName("*"))) {
    if (element.localName === "parsererror") return element;
  }
  const root = document.documentElement;
  return root && root.localName === "parsererror" ? root : null;
}

function normalizeXmlError(text: string): string {
  const detail = text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^this page contains/i.test(line) &&
        !/^below is a rendering/i.test(line),
    )
    .join(" ");
  return (detail || text.trim() || "XML is not well-formed").replace(
    /^error on line (\d+) at column (\d+):\s*/i,
    "Line $1, column $2: ",
  );
}

function parseXmlDocument(source: string): XMLDocument {
  if (!source.trim()) throw new Error("Input is empty");
  const document = new DOMParser().parseFromString(source, "application/xml");
  const error = findXmlParserError(document);
  if (error) throw new Error(normalizeXmlError(error.textContent ?? ""));
  if (!document.documentElement) throw new Error("XML must have a root element");
  return document;
}

function openTag(element: Element): string {
  const attributes = Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${escapeXmlAttribute(attribute.value)}"`)
    .join("");
  return `<${element.nodeName}${attributes}`;
}

function inlineXml(node: Node): string {
  switch (node.nodeType) {
    case 1: {
      const element = node as Element;
      const children = Array.from(element.childNodes);
      const open = openTag(element);
      if (children.length === 0) return `${open}/>`;
      return `${open}>${children.map(inlineXml).join("")}</${element.nodeName}>`;
    }
    case 3:
      return escapeXmlText(node.nodeValue ?? "");
    case 4:
      return `<![CDATA[${node.nodeValue ?? ""}]]>`;
    case 7: {
      const target = node.nodeName;
      const data = node.nodeValue ?? "";
      return `<?${target}${data ? ` ${data}` : ""}?>`;
    }
    case 8:
      return `<!--${node.nodeValue ?? ""}-->`;
    default:
      return "";
  }
}

function formatXmlNode(node: Node, depth: number, indent: string): string {
  switch (node.nodeType) {
    case 1:
      return formatXmlElement(node as Element, depth, indent);
    case 3: {
      const text = (node.nodeValue ?? "").trim();
      return text ? `${pad(depth, indent)}${escapeXmlText(text)}` : "";
    }
    case 4:
      return `${pad(depth, indent)}<![CDATA[${node.nodeValue ?? ""}]]>`;
    case 7: {
      const data = node.nodeValue ?? "";
      return `${pad(depth, indent)}<?${node.nodeName}${data ? ` ${data}` : ""}?>`;
    }
    case 8:
      return `${pad(depth, indent)}<!--${node.nodeValue ?? ""}-->`;
    case 10:
      return `${pad(depth, indent)}${new XMLSerializer().serializeToString(node)}`;
    default:
      return "";
  }
}

function formatXmlElement(element: Element, depth: number, indent: string): string {
  const children = Array.from(element.childNodes);
  const hasMixedText = children.some(
    (child) => child.nodeType === 3 && (child.nodeValue ?? "").trim().length > 0,
  );
  if (hasMixedText) {
    return `${pad(depth, indent)}${inlineXml(element)}`;
  }

  const open = openTag(element);
  const meaningfulChildren = children
    .map((child) => formatXmlNode(child, depth + 1, indent))
    .filter((value) => value.length > 0);

  if (meaningfulChildren.length === 0) {
    return `${pad(depth, indent)}${open}/>`;
  }

  return [
    `${pad(depth, indent)}${open}>`,
    ...meaningfulChildren,
    `${pad(depth, indent)}</${element.nodeName}>`,
  ].join("\n");
}

function countXml(element: Element): { elements: number; attributes: number } {
  let elements = 1;
  let attributes = element.attributes.length;
  for (const child of Array.from(element.children)) {
    const counts = countXml(child);
    elements += counts.elements;
    attributes += counts.attributes;
  }
  return { elements, attributes };
}

export function formatXml(source: string, options: XmlFormatOptions = {}): XmlFormatResult {
  const document = parseXmlDocument(source);
  const indent = indentUnit(options.indent ?? 2);
  // DOMParser drops the XML declaration, so keep it from the original source.
  const declaration = source.match(/^\s*(<\?xml\s[\s\S]*?\?>)/i)?.[1];
  const body = Array.from(document.childNodes)
    .map((node) => formatXmlNode(node, 0, indent))
    .filter((value) => value.length > 0);
  const output = (declaration ? [declaration, ...body] : body).join("\n");
  const counts = countXml(document.documentElement);
  return {
    output: `${output}\n`,
    root: document.documentElement.nodeName,
    ...counts,
  };
}

/* ------------------------------------------------------------------------- *
 * XML <-> JSON
 * ------------------------------------------------------------------------- */

export interface XmlToJsonOptions {
  attributes?: boolean;
  parseTypes?: boolean;
}

export interface JsonToXmlOptions {
  indent?: XmlIndent;
  rootName?: string;
  useRootKey?: boolean;
}

function coerceXmlScalar(value: string, parseTypes: boolean): unknown {
  if (!parseTypes) return value;
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const number = Number(trimmed);
    if (Number.isFinite(number)) return number;
  }
  return value;
}

function elementToJsonValue(element: Element, options: XmlToJsonOptions): unknown {
  const attributes = options.attributes === false ? [] : Array.from(element.attributes);
  const children = Array.from(element.children);
  const directText = Array.from(element.childNodes)
    .filter((child) => child.nodeType === 3)
    .map((child) => child.nodeValue ?? "")
    .join("")
    .trim();
  const hasText = directText.length > 0;

  if (children.length === 0 && attributes.length === 0) {
    return hasText ? coerceXmlScalar(directText, options.parseTypes === true) : "";
  }

  const result: Record<string, unknown> = {};
  for (const attribute of attributes) {
    result[`@${attribute.name}`] = coerceXmlScalar(
      attribute.value,
      options.parseTypes === true,
    );
  }
  if (hasText) result["#text"] = coerceXmlScalar(directText, options.parseTypes === true);

  for (const child of children) {
    const key = child.nodeName;
    const value = elementToJsonValue(child, options);
    if (!(key in result)) {
      result[key] = value;
      continue;
    }
    const existing = result[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}

export function xmlToJson(source: string, options: XmlToJsonOptions = {}): Record<string, unknown> {
  const document = parseXmlDocument(source);
  return { [document.documentElement.nodeName]: elementToJsonValue(document.documentElement, options) };
}

function isXmlName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9._:-]*$/.test(name);
}

function scalarText(value: unknown, context: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  throw new Error(`${context} must be a string, number, or boolean`);
}

function renderJsonElement(
  name: string,
  value: unknown,
  depth: number,
  indent: string,
): string {
  if (!isXmlName(name)) throw new Error(`"${name}" is not a valid XML element name`);
  const prefix = pad(depth, indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix}<${name}/>`;
    const items = value
      .map((item) => renderJsonElement("item", item, depth + 1, indent))
      .join("\n");
    return `${prefix}<${name}>\n${items}\n${prefix}</${name}>`;
  }

  if (isPlainObject(value)) {
    const attributes: string[] = [];
    for (const [key, attributeValue] of Object.entries(value)) {
      if (!key.startsWith("@")) continue;
      const attributeName = key.slice(1);
      if (!isXmlName(attributeName)) {
        throw new Error(`"${attributeName}" is not a valid XML attribute name`);
      }
      const text = scalarText(attributeValue, `Attribute "${attributeName}"`);
      attributes.push(` ${attributeName}="${escapeXmlAttribute(text)}"`);
    }

    const textValue =
      "#text" in value ? scalarText(value["#text"], `Text of <${name}>`) : "";
    const blocks: string[] = [];
    for (const [key, childValue] of Object.entries(value)) {
      if (key === "#text" || key.startsWith("@")) continue;
      if (Array.isArray(childValue)) {
        for (const item of childValue) {
          blocks.push(renderJsonElement(key, item, depth + 1, indent));
        }
      } else {
        blocks.push(renderJsonElement(key, childValue, depth + 1, indent));
      }
    }

    const open = `<${name}${attributes.join("")}`;
    if (blocks.length === 0) {
      if (!textValue) return `${prefix}${open}/>`;
      return `${prefix}${open}>${escapeXmlText(textValue)}</${name}>`;
    }
    const inner = textValue ? [`${pad(depth + 1, indent)}${escapeXmlText(textValue)}`, ...blocks] : blocks;
    return `${prefix}${open}>\n${inner.join("\n")}\n${prefix}</${name}>`;
  }

  if (value === null || value === undefined) return `${prefix}<${name}/>`;
  if (value === "") return `${prefix}<${name}/>`;
  return `${prefix}<${name}>${escapeXmlText(scalarText(value, `Value of <${name}>`))}</${name}>`;
}

export function jsonToXml(source: string, options: JsonToXmlOptions = {}): string {
  const value = parseJson(source);
  const indent = indentUnit(options.indent ?? 2);
  const fallbackRoot = options.rootName?.trim() || "root";
  let root = fallbackRoot;
  let content: unknown = value;

  if (options.useRootKey !== false && isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && isXmlName(keys[0])) {
      root = keys[0];
      content = value[keys[0]];
    }
  }

  return `${renderJsonElement(root, content, 0, indent)}\n`;
}

/* ------------------------------------------------------------------------- *
 * JSON -> JSON Schema (draft-07)
 * ------------------------------------------------------------------------- */

export interface JsonSchemaOptions {
  title?: string;
  required?: boolean;
  additionalProperties?: boolean;
}

type JsonSchema = Record<string, unknown>;

function typeList(schema: JsonSchema): string[] {
  const type = schema.type;
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === "string");
  return [];
}

function isPrimitiveSchema(schema: JsonSchema): boolean {
  const kind = typeList(schema);
  return (
    kind.length > 0 &&
    !("properties" in schema) &&
    !("items" in schema) &&
    !("anyOf" in schema) &&
    kind.every((item) => item !== "object" && item !== "array")
  );
}

function isEmptySchema(schema: JsonSchema): boolean {
  return Object.keys(schema).length === 0;
}

function dedupeSchemas(schemas: JsonSchema[]): JsonSchema[] {
  const seen = new Set<string>();
  const result: JsonSchema[] = [];
  for (const schema of schemas) {
    const key = JSON.stringify(schema);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(schema);
  }
  return result;
}

function mergeSchemas(left: JsonSchema, right: JsonSchema): JsonSchema {
  if (isEmptySchema(left)) return right;
  if (isEmptySchema(right)) return left;
  if (JSON.stringify(left) === JSON.stringify(right)) return left;

  if (isPrimitiveSchema(left) && isPrimitiveSchema(right)) {
    const types = new Set([...typeList(left), ...typeList(right)]);
    if (types.has("number")) types.delete("integer");
    const merged = Array.from(types);
    return { type: merged.length === 1 ? merged[0] : merged };
  }

  if (left.type === "object" && right.type === "object") {
    const leftProps = isPlainObject(left.properties) ? left.properties : {};
    const rightProps = isPlainObject(right.properties) ? right.properties : {};
    const names: string[] = Object.keys(leftProps);
    for (const name of Object.keys(rightProps)) {
      if (!names.includes(name)) names.push(name);
    }
    const properties: JsonSchema = {};
    const required: string[] = [];
    for (const name of names) {
      const leftValue = leftProps[name];
      const rightValue = rightProps[name];
      if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
        properties[name] = mergeSchemas(leftValue, rightValue);
      } else {
        properties[name] = isPlainObject(leftValue) ? leftValue : rightValue;
      }
      const leftRequired = Array.isArray(left.required) ? left.required : [];
      const rightRequired = Array.isArray(right.required) ? right.required : [];
      if (leftRequired.includes(name) && rightRequired.includes(name)) required.push(name);
    }
    const merged: JsonSchema = { type: "object", properties };
    if (required.length > 0) merged.required = required;
    if (left.additionalProperties === false || right.additionalProperties === false) {
      merged.additionalProperties = false;
    }
    return merged;
  }

  if (left.type === "array" && right.type === "array") {
    const leftItems = isPlainObject(left.items) ? left.items : {};
    const rightItems = isPlainObject(right.items) ? right.items : {};
    return { type: "array", items: mergeSchemas(leftItems, rightItems) };
  }

  return { anyOf: dedupeSchemas([left, right]) };
}

function inferSchema(value: unknown, options: JsonSchemaOptions): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {} };
    return {
      type: "array",
      items: value.map((item) => inferSchema(item, options)).reduce(mergeSchemas),
    };
  }
  if (isPlainObject(value)) {
    const properties: JsonSchema = {};
    for (const [key, child] of Object.entries(value)) {
      properties[key] = inferSchema(child, options);
    }
    const schema: JsonSchema = { type: "object", properties };
    if (options.required !== false && Object.keys(properties).length > 0) {
      schema.required = Object.keys(properties);
    }
    if (options.additionalProperties === false) schema.additionalProperties = false;
    return schema;
  }
  if (typeof value === "string") return { type: "string" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number" };
  }
  return {};
}

export function jsonToJsonSchema(
  source: string,
  options: JsonSchemaOptions = {},
): string {
  const value = parseJson(source);
  const schema: JsonSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...(options.title?.trim() ? { title: options.title.trim() } : {}),
    ...inferSchema(value, options),
  };
  return `${JSON.stringify(schema, null, 2)}\n`;
}

/* ------------------------------------------------------------------------- *
 * SQL formatter
 * ------------------------------------------------------------------------- */

export type SqlDialect =
  | "sql"
  | "mysql"
  | "postgresql"
  | "sqlite"
  | "tsql"
  | "plsql"
  | "bigquery"
  | "snowflake"
  | "mariadb"
  | "redshift"
  | "trino"
  | "spark";

export type SqlKeywordCase = "upper" | "lower" | "preserve";

export interface SqlFormatOptions {
  dialect?: SqlDialect;
  keywordCase?: SqlKeywordCase;
  indent?: 2 | 4 | "\t";
}

export function formatSql(source: string, options: SqlFormatOptions = {}): string {
  if (!source.trim()) throw new Error("Input is empty");
  const indent = options.indent ?? 2;
  const language = (options.dialect ?? "sql") as SqlLanguage;
  try {
    return formatSqlQuery(source, {
      language,
      keywordCase: options.keywordCase ?? "upper",
      tabWidth: indent === "\t" ? 2 : indent,
      useTabs: indent === "\t",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not format this query";
    throw new Error(message);
  }
}

/* ------------------------------------------------------------------------- *
 * GraphQL formatter
 * ------------------------------------------------------------------------- */

export interface GraphqlFormatResult {
  output: string;
  definitions: number;
  kinds: string[];
}

export class GraphqlFormatError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = "GraphqlFormatError";
    this.line = line;
    this.column = column;
  }
}

function describeDefinitionKind(kind: string): string {
  return kind
    .replace(/Definition$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

export function formatGraphql(source: string): GraphqlFormatResult {
  if (!source.trim()) throw new GraphqlFormatError("Input is empty");
  let document: DocumentNode;
  try {
    document = parseGraphql(source);
  } catch (error) {
    if (error instanceof GraphQLError) {
      const location = error.locations?.[0];
      const message = error.message.replace(/^Syntax Error:\s*/i, "");
      if (location) {
        throw new GraphqlFormatError(
          `Line ${location.line}, column ${location.column}: ${message}`,
          location.line,
          location.column,
        );
      }
      throw new GraphqlFormatError(message);
    }
    throw error instanceof Error
      ? new GraphqlFormatError(error.message)
      : new GraphqlFormatError("Could not parse GraphQL");
  }

  const kinds = Array.from(
    new Set(document.definitions.map((definition) => describeDefinitionKind(definition.kind))),
  );
  return {
    output: `${printGraphql(document)}\n`,
    definitions: document.definitions.length,
    kinds,
  };
}
