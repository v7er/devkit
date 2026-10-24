import { encodeBase64 } from "@/lib/encoding";
import {
  COMMON_PORTS,
  HTTP_STATUSES,
  type HttpStatus,
  type PortEntry,
  type PortProtocol,
} from "./reference";

/* ---------------------------------------------------------------- HTTP status */

export function filterHttpStatuses(
  query: string,
  category: HttpStatus["category"] | null,
  statuses: HttpStatus[] = HTTP_STATUSES,
): HttpStatus[] {
  const needle = query.trim().toLowerCase();
  return statuses.filter((status) => {
    if (category && status.category !== category) return false;
    if (!needle) return true;
    return (
      String(status.code).includes(needle) ||
      status.name.toLowerCase().includes(needle) ||
      status.description.toLowerCase().includes(needle) ||
      status.category.includes(needle)
    );
  });
}

/* ---------------------------------------------------------------- Ports */

export function filterPorts(
  query: string,
  protocol: PortProtocol | "all",
  ports: PortEntry[] = COMMON_PORTS,
): PortEntry[] {
  const needle = query.trim().toLowerCase();
  return ports.filter((entry) => {
    if (protocol !== "all" && entry.protocol !== "both" && entry.protocol !== protocol) return false;
    if (!needle) return true;
    return (
      String(entry.port).includes(needle) ||
      entry.service.toLowerCase().includes(needle) ||
      entry.protocol.includes(needle) ||
      entry.description.toLowerCase().includes(needle)
    );
  });
}

/* ---------------------------------------------------------------- cURL parsing */

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurlParseError";
  }
}

export interface CurlHeader {
  name: string;
  value: string;
}

export interface CurlFormField {
  name: string;
  value: string;
}

export interface CurlAuth {
  username: string;
  password: string;
}

export interface ParsedCurl {
  method: string;
  url: string;
  headers: CurlHeader[];
  body: string | null;
  form: CurlFormField[] | null;
  auth: CurlAuth | null;
  timeoutSeconds: number | null;
  warnings: string[];
}

export type CurlLanguage = "fetch" | "python" | "go" | "node";

const SHORT_VALUE_FLAGS = new Set(["X", "H", "d", "F", "u", "b", "A", "e", "m", "o", "c", "x", "T", "U", "r", "w", "E", "K", "D"]);
const BOOLEAN_SHORT_FLAGS = new Set(["L", "k", "I", "G", "s", "S", "v", "i", "f", "#", "N", "g", "q", "4", "6"]);
const IGNORED_LONG_VALUE_FLAGS = new Set([
  "--output",
  "--cookie-jar",
  "--connect-timeout",
  "--retry",
  "--retry-delay",
  "--write-out",
  "--cert",
  "--key",
  "--cacert",
  "--capath",
  "--cert-type",
  "--key-type",
  "--pass",
  "--resolve",
  "--connect-to",
  "--interface",
  "--limit-rate",
  "--max-redirs",
  "--dns-servers",
  "--local-port",
  "--unix-socket",
  "--output-dir",
  "--trace",
  "--trace-ascii",
  "--stderr",
  "--dump-header",
  "--proxy",
  "--proxy-user",
]);
const IGNORED_BOOLEAN_FLAGS = new Set([
  "-s",
  "--silent",
  "-S",
  "--show-error",
  "-v",
  "--verbose",
  "-i",
  "--include",
  "-f",
  "--fail",
  "--fail-with-body",
  "-N",
  "--no-buffer",
  "-#",
  "--progress-bar",
  "--no-progress-meter",
  "-4",
  "--ipv4",
  "-6",
  "--ipv6",
  "-g",
  "--globoff",
  "-q",
  "--disable",
  "--no-keepalive",
  "--raw",
  "--tlsv1.2",
  "--tlsv1.3",
  "--http1.1",
  "--http2",
  "--http2-prior-knowledge",
  "--http3",
]);

const TOKEN_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Splits a cURL command the way a POSIX shell would for the common cases:
 * single quotes, double quotes with escapes, backslash escapes, and
 * backslash-newline continuations.
 */
export function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let hasCurrent = false;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      continue;
    }

    if (quote === '"') {
      if (char === "\\") {
        const next = input[index + 1];
        if (next === undefined) throw new CurlParseError("The command ends with a dangling backslash.");
        if (next === "\n") {
          index += 1;
          continue;
        }
        if (next === "\r" && input[index + 2] === "\n") {
          index += 2;
          continue;
        }
        if (next === '"' || next === "\\" || next === "$" || next === "`") {
          current += next;
          index += 1;
          continue;
        }
        current += char;
        continue;
      }
      if (char === '"') quote = null;
      else current += char;
      continue;
    }

    if (char === "\\") {
      const next = input[index + 1];
      if (next === undefined) throw new CurlParseError("The command ends with a dangling backslash.");
      if (next === "\n") {
        index += 1;
        continue;
      }
      if (next === "\r" && input[index + 2] === "\n") {
        index += 2;
        continue;
      }
      current += next;
      hasCurrent = true;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      hasCurrent = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (hasCurrent) {
        tokens.push(current);
        current = "";
        hasCurrent = false;
      }
      continue;
    }

    current += char;
    hasCurrent = true;
  }

  if (quote) throw new CurlParseError("A quoted string is not closed.");
  if (hasCurrent) tokens.push(current);
  return tokens;
}

function normalizeCurlUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new CurlParseError("A URL is required.");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new CurlParseError(`"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CurlParseError(`Only http:// and https:// URLs can be converted, not ${url.protocol}`);
  }
  return url.toString();
}

function encodeDataUrlencode(raw: string): string {
  const equals = raw.indexOf("=");
  if (equals > 0) {
    return `${raw.slice(0, equals)}=${encodeURIComponent(raw.slice(equals + 1))}`;
  }
  return encodeURIComponent(raw);
}

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenizeCurl(input.trim());
  if (tokens.length === 0) throw new CurlParseError("Paste a cURL command first.");

  const first = tokens[0].toLowerCase();
  const args = first === "curl" || first === "curl.exe" || first.endsWith("/curl") ? tokens.slice(1) : tokens;

  const warnings: string[] = [];
  const rawHeaders: CurlHeader[] = [];
  const urls: string[] = [];
  const dataParts: string[] = [];
  const form: CurlFormField[] = [];
  let dataKind: "data" | "json" | null = null;
  let method: string | null = null;
  let auth: CurlAuth | null = null;
  let cookie: string | null = null;
  let compressed = false;
  let getMode = false;
  let head = false;
  let insecure = false;
  let userAgent: string | null = null;
  let referer: string | null = null;
  let timeoutSeconds: number | null = null;

  const hasHeader = (name: string) =>
    rawHeaders.some((header) => header.name.toLowerCase() === name.toLowerCase());

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("-") || token === "-") {
      urls.push(normalizeCurlUrl(token));
      continue;
    }

    let flag = token;
    let inlineValue: string | null = null;

    if (token.startsWith("--") && token.includes("=")) {
      const equals = token.indexOf("=");
      flag = token.slice(0, equals);
      inlineValue = token.slice(equals + 1);
    } else if (!token.startsWith("--") && token.length > 2 && SHORT_VALUE_FLAGS.has(token[1])) {
      flag = token.slice(0, 2);
      inlineValue = token.slice(2);
    } else if (!token.startsWith("--") && token.length > 2 && [...token.slice(1)].every((char) => BOOLEAN_SHORT_FLAGS.has(char))) {
      for (const char of token.slice(1)) {
        const short = `-${char}`;
        if (short === "-L") continue;
        if (short === "-k") insecure = true;
        else if (short === "-I") head = true;
        else if (short === "-G") getMode = true;
      }
      continue;
    }

    const readValue = (): string => {
      if (inlineValue !== null) return inlineValue;
      const next = args[index + 1];
      if (next === undefined) throw new CurlParseError(`The ${flag} flag needs a value.`);
      index += 1;
      return next;
    };

    switch (flag) {
      case "-X":
      case "--request": {
        const value = readValue().trim().toUpperCase();
        if (!TOKEN_PATTERN.test(value)) throw new CurlParseError(`"${value}" is not a valid HTTP method.`);
        method = value;
        break;
      }
      case "-H":
      case "--header": {
        const raw = readValue();
        const colon = raw.indexOf(":");
        if (colon <= 0) throw new CurlParseError(`The header "${raw}" must look like "Name: value".`);
        const name = raw.slice(0, colon).trim();
        const value = raw.slice(colon + 1).trim();
        if (!TOKEN_PATTERN.test(name)) throw new CurlParseError(`"${name}" is not a valid header name.`);
        rawHeaders.push({ name, value });
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-urlencode": {
        const raw = readValue();
        if (raw.startsWith("@") || raw.startsWith("<")) {
          warnings.push(`${flag} points at a local file in curl; its literal value was used instead.`);
        }
        dataParts.push(flag === "--data-urlencode" ? encodeDataUrlencode(raw) : raw);
        if (dataKind !== "json") dataKind = "data";
        break;
      }
      case "--json": {
        const raw = readValue();
        if (raw.startsWith("@")) warnings.push("--json points at a local file in curl; its literal value was used instead.");
        dataParts.push(raw);
        dataKind = "json";
        break;
      }
      case "-F":
      case "--form":
      case "--form-string": {
        const raw = readValue();
        const equals = raw.indexOf("=");
        if (equals <= 0) throw new CurlParseError(`The form field "${raw}" must look like "name=value".`);
        const name = raw.slice(0, equals);
        let value = raw.slice(equals + 1);
        const isFile = (flag === "--form-string" ? false : value.startsWith("@") || value.startsWith("<"));
        if (isFile) throw new CurlParseError(`File form fields ("${name}") are not supported; use a text value.`);
        const semicolon = value.indexOf(";");
        if (semicolon >= 0) {
          warnings.push(`Extra form parameters on "${name}" were ignored.`);
          value = value.slice(0, semicolon);
        }
        form.push({ name, value });
        break;
      }
      case "-u":
      case "--user": {
        const raw = readValue();
        const colon = raw.indexOf(":");
        if (colon < 0) throw new CurlParseError('The --user value must look like "username:password".');
        auth = { username: raw.slice(0, colon), password: raw.slice(colon + 1) };
        break;
      }
      case "-b":
      case "--cookie": {
        const raw = readValue();
        if (raw.startsWith("@") || !raw.includes("=")) {
          warnings.push("Cookie files are not supported; pass pairs directly, for example -b \"session=abc\".");
        } else {
          cookie = raw;
        }
        break;
      }
      case "--url":
        urls.push(normalizeCurlUrl(readValue()));
        break;
      case "-A":
      case "--user-agent":
        userAgent = readValue();
        break;
      case "-e":
      case "--referer":
        referer = readValue();
        break;
      case "-m":
      case "--max-time": {
        const raw = readValue();
        const seconds = Number(raw);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          throw new CurlParseError(`The --max-time value "${raw}" must be a positive number of seconds.`);
        }
        timeoutSeconds = seconds;
        break;
      }
      case "--compressed":
        compressed = true;
        break;
      case "-G":
      case "--get":
        getMode = true;
        break;
      case "-I":
      case "--head":
        head = true;
        break;
      case "-L":
      case "--location":
        break;
      case "-k":
      case "--insecure":
        insecure = true;
        break;
      case "-T":
      case "--upload-file":
        throw new CurlParseError("File uploads with -T are not supported; only request flags can be converted.");
      case "-o":
      case "-c":
      case "-x":
      case "-U":
      case "-r":
      case "-w":
      case "-E":
      case "-K":
      case "-D":
        readValue();
        if (flag === "-x") warnings.push("Proxy flags are not represented in the generated code.");
        break;
      default:
        if (IGNORED_LONG_VALUE_FLAGS.has(flag)) {
          readValue();
          if (flag === "--proxy" || flag === "--proxy-user") {
            warnings.push("Proxy flags are not represented in the generated code.");
          }
          break;
        }
        if (IGNORED_BOOLEAN_FLAGS.has(flag)) break;
        throw new CurlParseError(`Unsupported flag "${flag}". Remove it or convert the request manually.`);
    }
  }

  if (urls.length === 0) throw new CurlParseError("No URL found. Add one, for example https://example.com/api.");
  if (urls.length > 1) warnings.push(`Only the first of ${urls.length} URLs was converted.`);
  if (auth && hasHeader("authorization")) {
    warnings.push("The explicit Authorization header takes precedence over -u.");
    auth = null;
  }
  if (insecure) warnings.push("TLS verification stays enabled in the generated code.");

  const headers = [...rawHeaders];
  if (form.length > 0 && dataParts.length > 0) {
    throw new CurlParseError("The command mixes -d and -F; cURL also requires choosing one body type.");
  }
  if (dataParts.length > 0) {
    if (dataKind === "json") {
      if (!hasHeader("content-type")) headers.push({ name: "Content-Type", value: "application/json" });
      if (!hasHeader("accept")) headers.push({ name: "Accept", value: "application/json" });
    } else if (!hasHeader("content-type")) {
      headers.push({ name: "Content-Type", value: "application/x-www-form-urlencoded" });
    }
  }
  if (compressed && !hasHeader("accept-encoding")) {
    headers.push({ name: "Accept-Encoding", value: "gzip, deflate, br" });
  }
  if (userAgent && !hasHeader("user-agent")) headers.push({ name: "User-Agent", value: userAgent });
  if (referer && !hasHeader("referer")) headers.push({ name: "Referer", value: referer });
  if (cookie && !hasHeader("cookie")) headers.push({ name: "Cookie", value: cookie });

  let resolvedMethod = method ?? (form.length > 0 || dataParts.length > 0 ? "POST" : head ? "HEAD" : "GET");
  let url = urls[0];
  let body: string | null = dataParts.join("&");

  if (getMode && body !== null) {
    const parsedUrl = new URL(url);
    const query = parsedUrl.search ? `${parsedUrl.search}&${body}` : `?${body}`;
    parsedUrl.search = query;
    url = parsedUrl.toString();
    body = null;
    if (!method) resolvedMethod = "GET";
  }

  if (resolvedMethod === "GET" || resolvedMethod === "HEAD") {
    if (body !== null || form.length > 0) {
      warnings.push(`${resolvedMethod} requests cannot carry a body in the generated code; the body was omitted.`);
      body = null;
      form.length = 0;
    }
  }

  return {
    method: resolvedMethod,
    url,
    headers,
    body,
    form: form.length > 0 ? form : null,
    auth,
    timeoutSeconds,
    warnings,
  };
}

export function basicAuthHeader(auth: CurlAuth): string {
  return `Basic ${encodeBase64(`${auth.username}:${auth.password}`)}`;
}

export function curlHeaders(parsed: ParsedCurl): CurlHeader[] {
  if (!parsed.auth) return parsed.headers;
  return [...parsed.headers, { name: "Authorization", value: basicAuthHeader(parsed.auth) }];
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function fetchCode(parsed: ParsedCurl, node: boolean): string {
  const headers = curlHeaders(parsed);
  const lines: string[] = [];
  if (node) lines.push("// Requires Node.js 18 or newer.", "");
  if (parsed.form) {
    lines.push("const form = new FormData();");
    for (const field of parsed.form) lines.push(`form.append(${quote(field.name)}, ${quote(field.value)});`);
    lines.push("");
  }
  lines.push(`const response = await fetch(${quote(parsed.url)}, {`);
  lines.push(`  method: ${quote(parsed.method)},`);
  if (headers.length > 0) {
    lines.push("  headers: {");
    for (const header of headers) lines.push(`    ${quote(header.name)}: ${quote(header.value)},`);
    lines.push("  },");
  }
  if (parsed.form) lines.push("  body: form,");
  else if (parsed.body !== null) lines.push(`  body: ${quote(parsed.body)},`);
  if (parsed.timeoutSeconds !== null) {
    lines.push(`  signal: AbortSignal.timeout(${Math.round(parsed.timeoutSeconds * 1000)}),`);
  }
  lines.push("});", "");
  lines.push("if (!response.ok) {");
  lines.push("  throw new Error(`Request failed with status ${response.status}`);");
  lines.push("}", "");
  lines.push(`const ${node ? "body" : "data"} = await response.text();`);
  return lines.join("\n");
}

function pythonCode(parsed: ParsedCurl): string {
  const lines: string[] = ["import requests", "", `url = ${quote(parsed.url)}`];
  if (parsed.headers.length > 0) {
    lines.push("headers = {");
    for (const header of parsed.headers) lines.push(`    ${quote(header.name)}: ${quote(header.value)},`);
    lines.push("}");
  }
  if (parsed.form) {
    lines.push("files = {");
    for (const field of parsed.form) lines.push(`    ${quote(field.name)}: (None, ${quote(field.value)}),`);
    lines.push("}");
  }
  if (parsed.body !== null) lines.push(`data = ${quote(parsed.body)}`);

  lines.push("", "response = requests.request(");
  lines.push(`    ${quote(parsed.method)},`);
  lines.push("    url,");
  if (parsed.headers.length > 0) lines.push("    headers=headers,");
  if (parsed.form) lines.push("    files=files,");
  else if (parsed.body !== null) lines.push("    data=data,");
  if (parsed.auth) lines.push(`    auth=(${quote(parsed.auth.username)}, ${quote(parsed.auth.password)}),`);
  if (parsed.timeoutSeconds !== null) lines.push(`    timeout=${parsed.timeoutSeconds},`);
  lines.push(")", "");
  lines.push("if response.ok:");
  lines.push("    print(response.text)");
  lines.push("else:");
  lines.push('    print(f"HTTP {response.status_code}: {response.reason}")');
  return lines.join("\n");
}

function goCode(parsed: ParsedCurl): string {
  const bodyExpression = parsed.body !== null ? "strings.NewReader(body)" : parsed.form ? "&body" : "nil";
  const imports = new Set(["fmt", "io", "net/http"]);
  if (parsed.body !== null) imports.add("strings");
  if (parsed.form) {
    imports.add("bytes");
    imports.add("mime/multipart");
  }
  if (parsed.timeoutSeconds !== null) imports.add("time");

  const lines: string[] = ["package main", "", "import ("];
  for (const item of [...imports].sort()) lines.push(`\t"${item}"`);
  lines.push(")", "", "func main() {");

  if (parsed.body !== null) lines.push(`\tbody := ${quote(parsed.body)}`);
  if (parsed.form) {
    lines.push("\tvar body bytes.Buffer");
    lines.push("\twriter := multipart.NewWriter(&body)");
    for (const field of parsed.form) {
      lines.push(`\t_ = writer.WriteField(${quote(field.name)}, ${quote(field.value)})`);
    }
    lines.push("\t_ = writer.Close()");
  }
  if (parsed.body !== null || parsed.form) {
    lines.push("");
  }

  lines.push(`\treq, err := http.NewRequest(${quote(parsed.method)}, ${quote(parsed.url)}, ${bodyExpression})`);
  lines.push("\tif err != nil {", "\t\tpanic(err)", "\t}");
  for (const header of parsed.headers) {
    lines.push(`\treq.Header.Set(${quote(header.name)}, ${quote(header.value)})`);
  }
  if (parsed.form) lines.push("\treq.Header.Set(\"Content-Type\", writer.FormDataContentType())");
  if (parsed.auth) lines.push(`\treq.SetBasicAuth(${quote(parsed.auth.username)}, ${quote(parsed.auth.password)})`);

  lines.push("");
  if (parsed.timeoutSeconds !== null) {
    lines.push(`\tclient := &http.Client{Timeout: ${Math.round(parsed.timeoutSeconds * 1000)} * time.Millisecond}`);
    lines.push("\tresp, err := client.Do(req)");
  } else {
    lines.push("\tresp, err := http.DefaultClient.Do(req)");
  }
  lines.push("\tif err != nil {", "\t\tpanic(err)", "\t}", "\tdefer resp.Body.Close()", "");
  lines.push("\tdata, err := io.ReadAll(resp.Body)");
  lines.push("\tif err != nil {", "\t\tpanic(err)", "\t}", "");
  lines.push("\tfmt.Println(string(data))", "}");
  return lines.join("\n");
}

export function generateCurlCode(parsed: ParsedCurl, language: CurlLanguage): string {
  switch (language) {
    case "python":
      return pythonCode(parsed);
    case "go":
      return goCode(parsed);
    case "node":
      return fetchCode(parsed, true);
    case "fetch":
      return fetchCode(parsed, false);
  }
}

/* ---------------------------------------------------------------- IPv4 / CIDR */

export class SubnetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubnetError";
  }
}

export interface SubnetResult {
  input: string;
  address: string;
  prefix: number;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  firstUsable: string;
  lastUsable: string;
  usableCount: number;
  totalAddresses: number;
  hostBits: number;
  maskBinary: string;
  networkBinary: string;
  scope: string;
}

function ipv4ToNumber(address: string): number {
  const parts = address.split(".");
  if (parts.length !== 4) throw new SubnetError("Enter an IPv4 address with four octets, for example 192.168.1.0/24.");
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new SubnetError(`"${part}" is not a valid IPv4 octet.`);
    const value = Number(part);
    if (value > 255) throw new SubnetError(`The octet ${value} is greater than 255.`);
    result = (result * 256 + value) >>> 0;
  }
  return result >>> 0;
}

function numberToIpv4(value: number): string {
  const unsigned = value >>> 0;
  return [unsigned >>> 24, (unsigned >>> 16) & 255, (unsigned >>> 8) & 255, unsigned & 255].join(".");
}

function toBinary(value: number): string {
  const unsigned = value >>> 0;
  return [unsigned >>> 24, (unsigned >>> 16) & 255, (unsigned >>> 8) & 255, unsigned & 255]
    .map((octet) => octet.toString(2).padStart(8, "0"))
    .join(".");
}

function subnetScope(network: number): string {
  const within = (target: number, prefix: number) =>
    ((network & ((0xffffffff << (32 - prefix)) >>> 0)) >>> 0) === target;
  if (network === 0) return "This network (reserved)";
  if (within(ipv4ToNumber("10.0.0.0"), 8)) return "Private (RFC 1918)";
  if (within(ipv4ToNumber("172.16.0.0"), 12)) return "Private (RFC 1918)";
  if (within(ipv4ToNumber("192.168.0.0"), 16)) return "Private (RFC 1918)";
  if (within(ipv4ToNumber("100.64.0.0"), 10)) return "Carrier-grade NAT (RFC 6598)";
  if (within(ipv4ToNumber("127.0.0.0"), 8)) return "Loopback";
  if (within(ipv4ToNumber("169.254.0.0"), 16)) return "Link-local";
  if (within(ipv4ToNumber("192.0.2.0"), 24)) return "Documentation (TEST-NET-1)";
  if (within(ipv4ToNumber("198.51.100.0"), 24)) return "Documentation (TEST-NET-2)";
  if (within(ipv4ToNumber("203.0.113.0"), 24)) return "Documentation (TEST-NET-3)";
  if (within(ipv4ToNumber("198.18.0.0"), 15)) return "Benchmarking (RFC 2544)";
  if (within(ipv4ToNumber("224.0.0.0"), 4)) return "Multicast";
  if (within(ipv4ToNumber("240.0.0.0"), 4)) return "Reserved";
  return "Public";
}

export function calculateSubnet(input: string): SubnetResult {
  const trimmed = input.trim();
  if (!trimmed) throw new SubnetError("Enter a CIDR block, for example 192.168.1.0/24.");
  if (trimmed.includes(":")) throw new SubnetError("IPv6 is not supported; enter an IPv4 CIDR block.");
  const slash = trimmed.indexOf("/");
  if (slash < 0) throw new SubnetError("Add a prefix length, for example 192.168.1.0/24.");
  const address = trimmed.slice(0, slash).trim();
  const prefixText = trimmed.slice(slash + 1).trim();
  if (!/^\d{1,2}$/.test(prefixText)) throw new SubnetError(`"${prefixText}" is not a valid prefix length.`);
  const prefix = Number(prefixText);
  if (prefix > 32) throw new SubnetError("The prefix length must be between 0 and 32.");

  const addressNumber = ipv4ToNumber(address);
  const maskNumber = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (addressNumber & maskNumber) >>> 0;
  const broadcast = (network | (~maskNumber >>> 0)) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);
  const usableCount = prefix >= 31 ? totalAddresses : Math.max(0, totalAddresses - 2);
  const firstUsable = prefix >= 31 ? network : (network + 1) >>> 0;
  const lastUsable = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

  return {
    input: trimmed,
    address: numberToIpv4(addressNumber),
    prefix,
    network: numberToIpv4(network),
    broadcast: numberToIpv4(broadcast),
    mask: numberToIpv4(maskNumber),
    wildcard: numberToIpv4(~maskNumber >>> 0),
    firstUsable: numberToIpv4(firstUsable),
    lastUsable: numberToIpv4(lastUsable),
    usableCount,
    totalAddresses,
    hostBits: 32 - prefix,
    maskBinary: toBinary(maskNumber),
    networkBinary: toBinary(network),
    scope: subnetScope(network),
  };
}

/* ---------------------------------------------------------------- User agent */

export type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "console" | "unknown";

export interface AgentPart {
  name: string;
  version: string;
}

export interface UserAgentInfo {
  browser: AgentPart | null;
  engine: AgentPart | null;
  os: AgentPart | null;
  device: {
    type: DeviceType;
    vendor: string | null;
    model: string | null;
  };
  bot: string | null;
}

function matchVersion(pattern: RegExp, input: string): string | null {
  const match = pattern.exec(input);
  return match?.[1] ?? null;
}

function detectBot(input: string): string | null {
  const bots: Array<[RegExp, string]> = [
    [/Googlebot/i, "Googlebot"],
    [/bingbot/i, "Bingbot"],
    [/DuckDuckBot/i, "DuckDuckBot"],
    [/Baiduspider/i, "Baiduspider"],
    [/YandexBot/i, "YandexBot"],
    [/Applebot/i, "Applebot"],
    [/AhrefsBot/i, "AhrefsBot"],
    [/SemrushBot/i, "SemrushBot"],
    [/GPTBot/i, "GPTBot"],
    [/ClaudeBot/i, "ClaudeBot"],
    [/facebookexternalhit/i, "Facebook crawler"],
    [/Twitterbot/i, "Twitterbot"],
    [/LinkedInBot/i, "LinkedInBot"],
    [/curl\//i, "curl"],
    [/Wget\//i, "Wget"],
    [/python-requests/i, "python-requests"],
    [/PostmanRuntime/i, "Postman"],
  ];
  for (const [pattern, name] of bots) {
    if (pattern.test(input)) return name;
  }
  if (/\bbot\b|\bcrawler\b|\bspider\b/i.test(input)) return "Crawler";
  return null;
}

export function parseUserAgent(input: string): UserAgentInfo {
  const ua = input.trim();
  if (!ua) {
    return { browser: null, engine: null, os: null, device: { type: "unknown", vendor: null, model: null }, bot: null };
  }

  const bot = detectBot(ua);
  const firefoxVersion = matchVersion(/(?:Firefox|FxiOS)\/([\d.]+)/, ua);
  const chromeVersion = matchVersion(/(?:Chrome|CriOS)\/([\d.]+)/, ua);

  let browser: AgentPart | null = null;
  if (/Edg(?:e|A|iOS)?\/([\d.]+)/.test(ua)) {
    browser = { name: "Microsoft Edge", version: matchVersion(/Edg(?:e|A|iOS)?\/([\d.]+)/, ua) ?? "" };
  } else if (/OPR\/([\d.]+)/.test(ua) || /Opera[ /]([\d.]+)/.test(ua)) {
    browser = { name: "Opera", version: matchVersion(/OPR\/([\d.]+)/, ua) ?? matchVersion(/Opera[ /]([\d.]+)/, ua) ?? "" };
  } else if (/SamsungBrowser\/([\d.]+)/.test(ua)) {
    browser = { name: "Samsung Internet", version: matchVersion(/SamsungBrowser\/([\d.]+)/, ua) ?? "" };
  } else if (/HeadlessChrome\/([\d.]+)/.test(ua)) {
    browser = { name: "Headless Chrome", version: matchVersion(/HeadlessChrome\/([\d.]+)/, ua) ?? "" };
  } else if (chromeVersion) {
    browser = { name: /; wv\)/.test(ua) ? "Android WebView" : "Chrome", version: chromeVersion };
  } else if (firefoxVersion) {
    browser = { name: /FxiOS\//.test(ua) ? "Firefox iOS" : "Firefox", version: firefoxVersion };
  } else if (/Version\/([\d.]+).*Safari/.test(ua)) {
    browser = { name: "Safari", version: matchVersion(/Version\/([\d.]+)/, ua) ?? "" };
  } else if (/MSIE ([\d.]+)/.test(ua) || /Trident\//.test(ua)) {
    browser = { name: "Internet Explorer", version: matchVersion(/MSIE ([\d.]+)/, ua) ?? matchVersion(/rv:([\d.]+)/, ua) ?? "" };
  }

  let engine: AgentPart | null = null;
  if (browser && ["Microsoft Edge", "Opera", "Samsung Internet", "Headless Chrome", "Chrome", "Android WebView"].includes(browser.name)) {
    engine = { name: "Blink", version: chromeVersion ?? "" };
  } else if (browser && browser.name.startsWith("Firefox")) {
    engine = { name: "Gecko", version: firefoxVersion ?? "" };
  } else if (browser?.name === "Safari") {
    engine = { name: "WebKit", version: matchVersion(/AppleWebKit\/([\d.]+)/, ua) ?? "" };
  } else if (browser?.name === "Internet Explorer") {
    engine = { name: "Trident", version: matchVersion(/Trident\/([\d.]+)/, ua) ?? "" };
  }

  let os: AgentPart | null = null;
  const iosVersion = matchVersion(/(?:iPhone|iPad|iPod).*? OS ([\d_]+)/, ua);
  const androidVersion = matchVersion(/Android ([\d.]+)/, ua);
  const windowsVersion = matchVersion(/Windows NT ([\d.]+)/, ua);
  const macVersion = matchVersion(/Mac OS X ([\d_.]+)/, ua);
  if (iosVersion) {
    os = { name: "iOS", version: iosVersion.replace(/_/g, ".") };
  } else if (androidVersion) {
    os = { name: "Android", version: androidVersion };
  } else if (windowsVersion) {
    const names: Record<string, string> = {
      "10.0": "10 or 11",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
      "6.0": "Vista",
      "5.2": "Server 2003",
      "5.1": "XP",
      "5.0": "2000",
    };
    os = { name: "Windows", version: names[windowsVersion] ?? windowsVersion };
  } else if (macVersion) {
    os = { name: "macOS", version: macVersion.replace(/_/g, ".") };
  } else if (/CrOS \S+ ([\d.]+)/.test(ua)) {
    os = { name: "ChromeOS", version: matchVersion(/CrOS \S+ ([\d.]+)/, ua) ?? "" };
  } else if (/Linux/.test(ua)) {
    os = { name: "Linux", version: "" };
  }

  let type: DeviceType = "desktop";
  let vendor: string | null = null;
  let model: string | null = null;
  const androidModel = matchVersion(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build[/;]|\))/, ua);

  if (bot) {
    type = "bot";
    model = bot;
  } else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))) {
    type = "tablet";
    vendor = "Apple";
    model = "iPad";
  } else if (/iPhone|iPod/.test(ua)) {
    type = "mobile";
    vendor = "Apple";
    model = /iPod/.test(ua) ? "iPod touch" : "iPhone";
  } else if (androidVersion) {
    type = /Mobile/.test(ua) ? "mobile" : "tablet";
    model = androidModel?.trim() ?? null;
    if (model) {
      if (/^SM-|^GT-/.test(model)) vendor = "Samsung";
      else if (/^Pixel/.test(model)) vendor = "Google";
      else if (/^Redmi|^Mi |^POCO/.test(model)) vendor = "Xiaomi";
      else if (/^OnePlus/.test(model)) vendor = "OnePlus";
      else if (/^HUAWEI|^ANE-|^ELS-/.test(model)) vendor = "Huawei";
    }
  } else if (/PlayStation/.test(ua)) {
    type = "console";
    vendor = "Sony";
    model = /PlayStation 5/.test(ua) ? "PlayStation 5" : /PlayStation 4/.test(ua) ? "PlayStation 4" : "PlayStation";
  } else if (/Xbox/.test(ua)) {
    type = "console";
    vendor = "Microsoft";
    model = "Xbox";
  } else if (/Nintendo/.test(ua)) {
    type = "console";
    vendor = "Nintendo";
    model = "Nintendo";
  } else if (/Mobi|Windows Phone/.test(ua)) {
    type = "mobile";
  } else if (!browser && !os) {
    type = "unknown";
  }

  return { browser, engine, os, device: { type, vendor, model }, bot };
}

/* ---------------------------------------------------------------- URL parsing */

export class UrlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlParseError";
  }
}

export interface UrlQueryParam {
  key: string;
  value: string;
}

export interface UrlBreakdown {
  input: string;
  href: string;
  isRelative: boolean;
  protocolRelative: boolean;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  query: UrlQueryParam[];
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseQueryString(search: string): UrlQueryParam[] {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return [];
  return raw
    .split("&")
    .filter((part) => part.length > 0)
    .map((part) => {
      const equals = part.indexOf("=");
      if (equals < 0) return { key: decodeQueryPart(part), value: "" };
      return { key: decodeQueryPart(part.slice(0, equals)), value: decodeQueryPart(part.slice(equals + 1)) };
    });
}

export function serializeQuery(params: UrlQueryParam[]): string {
  const search = new URLSearchParams();
  for (const param of params) {
    if (!param.key && !param.value) continue;
    search.append(param.key, param.value);
  }
  return search.toString();
}

export function parseUrl(input: string): UrlBreakdown {
  const trimmed = input.trim();
  if (!trimmed) throw new UrlParseError("Enter a URL to parse.");

  const protocolRelative = trimmed.startsWith("//");
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const nonHierarchical = /^(mailto|tel|data|urn|javascript|blob|about):/i.test(trimmed);
  const isAbsolute = hasScheme || protocolRelative || nonHierarchical;

  if (isAbsolute) {
    let url: URL;
    try {
      url = protocolRelative ? new URL(`https:${trimmed}`) : new URL(trimmed);
    } catch {
      throw new UrlParseError("This is not a valid absolute URL.");
    }
    const query = parseQueryString(url.search);
    return {
      input: trimmed,
      href: url.toString(),
      isRelative: protocolRelative,
      protocolRelative,
      protocol: url.protocol,
      username: url.username,
      password: url.password,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      origin: url.origin === "null" ? "" : url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      query,
    };
  }

  const hashIndex = trimmed.indexOf("#");
  const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  if (!pathname && !search && !hash) throw new UrlParseError("Enter a URL or path to parse.");

  return {
    input: trimmed,
    href: trimmed,
    isRelative: true,
    protocolRelative: false,
    protocol: "",
    username: "",
    password: "",
    host: "",
    hostname: "",
    port: "",
    origin: "",
    pathname,
    search,
    hash,
    query: parseQueryString(search),
  };
}

export function buildUrl(breakdown: UrlBreakdown, params: UrlQueryParam[]): string {
  const serialized = serializeQuery(params);
  const search = serialized ? `?${serialized}` : "";

  if (breakdown.isRelative && !breakdown.protocolRelative) {
    return `${breakdown.pathname}${search}${breakdown.hash}`;
  }

  const url = new URL(breakdown.href);
  if (breakdown.protocolRelative) {
    return `//${url.host}${url.pathname}${search}${url.hash}`;
  }
  url.search = search;
  return url.toString();
}

/* ---------------------------------------------------------------- HTTP headers */

export class HeaderParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeaderParseError";
  }
}

export interface HeaderField {
  name: string;
  value: string;
  line: number;
}

export interface ParsedCookie {
  source: "cookie" | "set-cookie";
  name: string;
  value: string;
  attributes: Array<{ name: string; value: string }>;
}

export interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value: string | null;
  note: string;
}

export interface ParsedHeaderBlock {
  startLine: string | null;
  isResponse: boolean;
  protocol: string | null;
  statusCode: number | null;
  statusText: string | null;
  headers: HeaderField[];
  cookies: ParsedCookie[];
  security: SecurityHeaderCheck[];
  duplicates: Array<{ name: string; values: string[] }>;
  byteSize: number;
  bodyIgnored: boolean;
}

const SECURITY_HEADERS: Array<{ name: string; note: string }> = [
  { name: "strict-transport-security", note: "Tells browsers to use HTTPS for future visits." },
  { name: "content-security-policy", note: "Restricts which scripts, styles, and origins may load." },
  { name: "x-content-type-options", note: "With nosniff, stops MIME-type sniffing." },
  { name: "x-frame-options", note: "Blocks framing; CSP frame-ancestors is the modern control." },
  { name: "referrer-policy", note: "Limits referrer data sent to other origins." },
  { name: "permissions-policy", note: "Turns off browser features the page does not need." },
  { name: "cross-origin-opener-policy", note: "Isolates the page from other origins' windows." },
  { name: "cross-origin-resource-policy", note: "Restricts which origins may embed this resource." },
];

function parseCookieValue(source: ParsedCookie["source"], value: string): ParsedCookie | null {
  const segments = value
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  if (source === "cookie") {
    const first = segments[0];
    const equals = first.indexOf("=");
    if (equals <= 0) return null;
    return {
      source,
      name: first.slice(0, equals),
      value: first.slice(equals + 1),
      attributes: [],
    };
  }

  const pair = segments.shift() ?? "";
  const equals = pair.indexOf("=");
  if (equals <= 0) return null;
  return {
    source,
    name: pair.slice(0, equals),
    value: pair.slice(equals + 1),
    attributes: segments.map((segment) => {
      const attributeEquals = segment.indexOf("=");
      if (attributeEquals < 0) return { name: segment, value: "" };
      return { name: segment.slice(0, attributeEquals), value: segment.slice(attributeEquals + 1) };
    }),
  };
}

export function parseHeaders(input: string): ParsedHeaderBlock {
  const normalized = input.replace(/\r\n?/g, "\n").replace(/^\n+/, "");
  if (!normalized.trim()) throw new HeaderParseError("Paste raw HTTP headers first.");

  const lines = normalized.split("\n");
  const blankIndex = lines.findIndex((line) => line.trim() === "");
  const headerLines = blankIndex >= 0 ? lines.slice(0, blankIndex) : lines;
  const bodyIgnored = blankIndex >= 0 && lines.slice(blankIndex + 1).some((line) => line.trim() !== "");
  if (headerLines.length === 0) throw new HeaderParseError("No header lines found.");

  let startLine: string | null = null;
  let firstHeaderIndex = 0;
  if (!headerLines[0].includes(":")) {
    startLine = headerLines[0].trim();
    firstHeaderIndex = 1;
    const requestPattern = /^[A-Z]+ \S+ HTTP\/\d(?:\.\d)?$/;
    const statusPattern = /^HTTP\/\d(?:\.\d)? \d{3}(?: .*)?$/;
    if (!requestPattern.test(startLine) && !statusPattern.test(startLine)) {
      throw new HeaderParseError("The first line must be a request line, a status line, or a header.");
    }
  }

  let protocol: string | null = null;
  let statusCode: number | null = null;
  let statusText: string | null = null;
  let isResponse = false;
  if (startLine) {
    const statusMatch = /^HTTP\/(\d(?:\.\d)?) (\d{3})(?: (.*))?$/.exec(startLine);
    const requestMatch = /^[A-Z]+ \S+ HTTP\/(\d(?:\.\d)?)$/.exec(startLine);
    if (statusMatch) {
      isResponse = true;
      protocol = `HTTP/${statusMatch[1]}`;
      statusCode = Number(statusMatch[2]);
      statusText = statusMatch[3] ?? "";
    } else if (requestMatch) {
      protocol = `HTTP/${requestMatch[1]}`;
    }
  }

  const headers: HeaderField[] = [];
  for (let index = firstHeaderIndex; index < headerLines.length; index += 1) {
    const line = headerLines[index];
    const lineNumber = index + 1;
    if (!line.trim()) continue;

    if (/^[ \t]/.test(line)) {
      const previous = headers[headers.length - 1];
      if (!previous) throw new HeaderParseError(`Line ${lineNumber}: a continuation line has no header to extend.`);
      previous.value = `${previous.value} ${line.trim()}`;
      continue;
    }

    const colon = line.indexOf(":");
    if (colon <= 0) throw new HeaderParseError(`Line ${lineNumber}: "${line.trim()}" is not a "Name: value" header.`);
    const rawName = line.slice(0, colon);
    if (rawName !== rawName.trim()) throw new HeaderParseError(`Line ${lineNumber}: remove whitespace before the colon.`);
    if (!TOKEN_PATTERN.test(rawName)) throw new HeaderParseError(`Line ${lineNumber}: "${rawName}" is not a valid header name.`);
    headers.push({ name: rawName, value: line.slice(colon + 1).trim(), line: lineNumber });
  }

  const lowerNames = headers.map((header) => header.name.toLowerCase());
  const cookies: ParsedCookie[] = [];
  for (let index = 0; index < headers.length; index += 1) {
    if (lowerNames[index] === "set-cookie") {
      const parsed = parseCookieValue("set-cookie", headers[index].value);
      if (parsed) cookies.push(parsed);
    } else if (lowerNames[index] === "cookie") {
      for (const segment of headers[index].value.split(";")) {
        const parsed = parseCookieValue("cookie", segment.trim());
        if (parsed) cookies.push(parsed);
      }
    }
  }

  const security = SECURITY_HEADERS.map(({ name, note }) => {
    const index = lowerNames.indexOf(name);
    return {
      name,
      present: index >= 0,
      value: index >= 0 ? headers[index].value : null,
      note,
    };
  });

  const groups = new Map<string, string[]>();
  for (const header of headers) {
    const key = header.name.toLowerCase();
    const values = groups.get(key);
    if (values) values.push(header.value);
    else groups.set(key, [header.value]);
  }
  const duplicates = [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([name, values]) => ({ name, values }));

  return {
    startLine,
    isResponse,
    protocol,
    statusCode,
    statusText,
    headers,
    cookies,
    security,
    duplicates,
    byteSize: new TextEncoder().encode(headerLines.join("\n")).length,
    bodyIgnored,
  };
}

/* ---------------------------------------------------------------- Meta tags */

export class MetaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaError";
  }
}

export interface MetaInput {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  twitterCard: string;
  twitterSite: string;
  twitterCreator: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  themeColor: string;
}

export interface MetaHint {
  field: string;
  message: string;
  tone: "info" | "warning";
}

export interface MetaOutput {
  html: string;
  hints: MetaHint[];
}

export function escapeMetaValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textLength(value: string): number {
  return Array.from(value).length;
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function generateMetaTags(input: MetaInput): MetaOutput {
  const hints: MetaHint[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  const canonical = input.canonical.trim();
  const lines: string[] = [];

  if (title) {
    lines.push(`<title>${escapeMetaValue(title)}</title>`);
    const length = textLength(title);
    if (length > 60) hints.push({ field: "Title", tone: "warning", message: `${length} characters; search results usually truncate after about 60.` });
    else if (length < 20) hints.push({ field: "Title", tone: "info", message: `${length} characters; 20–60 is easier to scan.` });
  } else {
    hints.push({ field: "Title", tone: "info", message: "Add a title: it is the main search result headline." });
  }

  if (description) {
    lines.push(`<meta name="description" content="${escapeMetaValue(description)}">`);
    const length = textLength(description);
    if (length > 160) hints.push({ field: "Description", tone: "warning", message: `${length} characters; snippets usually truncate after about 160.` });
    else if (length < 50) hints.push({ field: "Description", tone: "info", message: `${length} characters; 50–160 gives search engines more context.` });
  } else {
    hints.push({ field: "Description", tone: "info", message: "Add a description: search engines often show it below the title." });
  }

  if (input.robots) {
    lines.push(`<meta name="robots" content="${escapeMetaValue(input.robots)}">`);
  }

  if (canonical) {
    lines.push(`<link rel="canonical" href="${escapeMetaValue(canonical)}">`);
    if (!isAbsoluteHttpUrl(canonical)) {
      hints.push({ field: "Canonical", tone: "warning", message: "Use an absolute http:// or https:// URL." });
    }
  }

  const ogFields: Array<[string, string]> = [
    ["og:type", input.ogType],
    ["og:site_name", input.ogSiteName],
    ["og:title", input.ogTitle],
    ["og:description", input.ogDescription],
    ["og:url", input.ogUrl],
    ["og:image", input.ogImage],
  ];
  for (const [property, value] of ogFields) {
    if (value.trim()) lines.push(`<meta property="${property}" content="${escapeMetaValue(value.trim())}">`);
  }
  if (input.ogDescription && textLength(input.ogDescription.trim()) > 200) {
    hints.push({ field: "Open Graph description", tone: "warning", message: "Longer than 200 characters; social cards may cut it off." });
  }
  if (input.ogUrl.trim() && !isAbsoluteHttpUrl(input.ogUrl.trim())) {
    hints.push({ field: "Open Graph URL", tone: "warning", message: "Use an absolute http:// or https:// URL." });
  }
  if (input.ogImage.trim() && !isAbsoluteHttpUrl(input.ogImage.trim())) {
    hints.push({ field: "Open Graph image", tone: "warning", message: "Use an absolute http:// or https:// image URL." });
  }

  const twitterFields: Array<[string, string]> = [
    ["twitter:card", input.twitterCard],
    ["twitter:site", input.twitterSite],
    ["twitter:creator", input.twitterCreator],
    ["twitter:title", input.twitterTitle],
    ["twitter:description", input.twitterDescription],
    ["twitter:image", input.twitterImage],
  ];
  for (const [name, value] of twitterFields) {
    if (value.trim()) lines.push(`<meta name="${name}" content="${escapeMetaValue(value.trim())}">`);
  }
  if (input.twitterDescription && textLength(input.twitterDescription.trim()) > 200) {
    hints.push({ field: "Twitter description", tone: "warning", message: "Longer than 200 characters; cards may cut it off." });
  }
  if (input.twitterImage.trim() && !isAbsoluteHttpUrl(input.twitterImage.trim())) {
    hints.push({ field: "Twitter image", tone: "warning", message: "Use an absolute http:// or https:// image URL." });
  }

  if (input.themeColor.trim()) {
    lines.push(`<meta name="theme-color" content="${escapeMetaValue(input.themeColor.trim())}">`);
  }

  return { html: lines.join("\n"), hints };
}

/* ---------------------------------------------------------------- DNS over HTTPS */

export const DNS_QUERY_ENDPOINT = "https://cloudflare-dns.com/dns-query";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA";

export interface DnsRecord {
  name: string;
  type: string;
  ttl: number;
  data: string;
}

export interface DnsResult {
  status: number;
  statusMessage: string;
  records: DnsRecord[];
  truncated: boolean;
}

export class DnsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DnsError";
  }
}

const DNS_TYPES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  257: "CAA",
};

export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new DnsError("Enter a domain name to look up.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new DnsError("Enter a hostname only, for example example.com.");
  }
  if (/[/?#@:\\]/.test(trimmed)) throw new DnsError("Enter a hostname only, without a path, port, or credentials.");
  if (/\s/.test(trimmed)) throw new DnsError("Hostnames cannot contain spaces.");

  let hostname: string;
  try {
    hostname = new URL(`http://${trimmed}`).hostname;
  } catch {
    throw new DnsError(`"${trimmed}" is not a valid hostname.`);
  }
  if (!hostname || hostname.length > 253) throw new DnsError("Hostnames must be 253 characters or fewer.");
  if (hostname.startsWith("[") || hostname.includes("..")) throw new DnsError(`"${trimmed}" is not a valid hostname.`);
  if (!/^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)*\.?$/.test(hostname)) {
    throw new DnsError(`"${trimmed}" is not a valid hostname.`);
  }
  return hostname;
}

export function buildDnsQueryUrl(domain: string, type: DnsRecordType): string {
  const url = new URL(DNS_QUERY_ENDPOINT);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  return url.toString();
}

export function dnsStatusMessage(status: number): string {
  switch (status) {
    case 0:
      return "";
    case 1:
      return "The resolver rejected the query format (FORMERR).";
    case 2:
      return "The resolver could not complete the query (SERVFAIL).";
    case 3:
      return "The domain does not exist (NXDOMAIN).";
    case 4:
      return "The resolver does not support this query (NOTIMP).";
    case 5:
      return "The resolver refused the query (REFUSED).";
    default:
      return `The resolver returned status ${status}.`;
  }
}

export function parseDnsResponse(payload: unknown): DnsResult {
  if (!payload || typeof payload !== "object") {
    throw new DnsError("The resolver returned an unexpected response.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.Status !== "number") {
    throw new DnsError("The resolver response is missing a status code.");
  }
  const status = record.Status;
  const statusMessage = dnsStatusMessage(status);

  let records: DnsRecord[] = [];
  if (record.Answer !== undefined) {
    if (!Array.isArray(record.Answer)) throw new DnsError("The resolver response has an invalid answer section.");
    records = record.Answer.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const answer = entry as Record<string, unknown>;
      if (typeof answer.data !== "string" || typeof answer.name !== "string") return [];
      const typeValue = answer.type;
      const type = typeof typeValue === "number" ? DNS_TYPES[typeValue] ?? `TYPE${typeValue}` : typeof typeValue === "string" ? typeValue : "UNKNOWN";
      const ttl = typeof answer.TTL === "number" && answer.TTL >= 0 ? answer.TTL : 0;
      return [{ name: answer.name, type, ttl, data: answer.data }];
    });
  }

  return {
    status,
    statusMessage,
    records,
    truncated: record.Truncated === true,
  };
}

/* ---------------------------------------------------------------- WebSocket */

export class WebSocketUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebSocketUrlError";
  }
}

export function validateWebSocketUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new WebSocketUrlError("Enter a ws:// or wss:// URL.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WebSocketUrlError("This is not a valid WebSocket URL.");
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new WebSocketUrlError("Use a ws:// or wss:// URL.");
  }
  if (!url.hostname) throw new WebSocketUrlError("The WebSocket URL needs a hostname.");
  return url.toString();
}

export function formatLogTime(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function describeSocketData(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return `[binary frame, ${data.byteLength} bytes]`;
  if (typeof Blob !== "undefined" && data instanceof Blob) return `[binary frame, ${data.size} bytes]`;
  return String(data);
}
