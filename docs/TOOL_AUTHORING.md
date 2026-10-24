# Tool authoring guide

Every devkit tool runs entirely in the browser. A tool may read files only after the user
selects them, and must not send content to a server. The app is a single Vite + React SPA that
ships to Cloudflare Pages/Workers and into a Tauri desktop shell.

## Contract

A tool is one default-exported React component in
`apps/web/src/tools/<category>/<tool-id>.tsx` plus one registration entry in
`apps/web/src/tools/<category>/index.ts`.

```tsx
// apps/web/src/tools/encoding/url-encoder.tsx
import { useMemo, useState } from "react";
import { CodeOutput, Field, Panel, TextArea, ToolGrid, ToolStack } from "@/components/ui";

export default function UrlEncoderTool() {
  const [input, setInput] = useState("");
  const output = useMemo(() => encodeURIComponent(input), [input]);

  return (
    <ToolGrid>
      <Panel title="Input">
        <Field label="Text">
          <TextArea
            mono
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Text to encode"
          />
        </Field>
      </Panel>
      <Panel title="Output">
        <CodeOutput value={output} filename="encoded.txt" />
      </Panel>
    </ToolGrid>
  );
}
```

```ts
// apps/web/src/tools/encoding/index.ts
import { lazy } from "react";
import type { ToolDefinition } from "../types";

export const encodingTools: ToolDefinition[] = [
  // Existing entries stay in place.
  {
    id: "url-encoder",
    name: "URL Encoder / Decoder",
    description: "Percent-encode or decode URLs, query values, and path segments.",
    category: "encoding",
    keywords: ["url", "uri", "percent", "encode", "decode", "query"],
    component: lazy(() => import("./url-encoder")),
  },
];
```

`id` must be unique across the whole app and match the filename. It is the URL slug
(`/tools/url-encoder`). Names are title case. Descriptions are one sentence, start with a verb,
and end with a period. Keywords are lowercase search terms that are not already in the name.

## File ownership

Work only inside your category folder:

- `apps/web/src/tools/<category>/*.tsx|ts`
- `apps/web/src/tools/<category>/index.ts`

Do not edit `src/tools/registry.ts`, `src/tools/categories.ts`, shared UI, shared lib, app
layout, package manifests, or docs. If a shared helper is missing, copy the small amount of
logic you need into your category folder (usually `logic.ts`) instead of changing shared code.

Existing tools in an index must be kept. Append your entries beside them.

## UI conventions

Use the shared primitives from `@/components/ui`:

- `Panel` for a titled surface (`title`, `description`, optional `actions`, `flush`).
- `ToolGrid` for a two-column desktop layout that stacks on mobile.
- `ToolStack` when a single column is clearer.
- `Field` + `Input` / `TextArea` for labeled inputs. Always pass a label and `aria-label` or
  `htmlFor`.
- `Select` and `Segmented` for mutually exclusive choices.
- `Button` (`primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `icon`).
- `CodeOutput` for generated text. It includes copy and download controls.
- `CopyButton` for a short value shown outside `CodeOutput`.
- `Alert` for validation failures (`tone="danger"`) and caveats (`warning`, `info`, `success`).
- `FileDrop` for local files. `readFileAsText`, `readFileAsDataUrl`, and
  `readFileAsArrayBuffer` from `@/lib/download`.
- `Slider`, `Toggle`, `InlineRow`, `EmptyState`, `Spinner`, `Badge`, `Kbd`, `useToast`.
- `useLocalStorage` from `@/lib/hooks` for preferences that should survive reloads. Do not store
  sensitive values (keys, tokens, passwords) there.

Rules:

- Compute derived output with `useMemo`; handle invalid input without throwing during render.
- Keep the main input and output visible together on large screens.
- Every button has a visible label or an `aria-label` plus `title`.
- File inputs accept a useful subset (`image/*`, `.svg`, `.json`, `.xlsx`, etc.).
- Use `font-mono` for machine data and monospace text areas.
- Prefer native browser APIs over new dependencies.
- No `any`, no non-null assertions on user input, and no `@ts-ignore`.
- Keep components under roughly 250 lines. Move pure logic to `<category>/logic.ts`.
- Avoid decorative complexity. A tool should be usable in one screen.

## Shared helpers

Import from `@/lib/*`:

- `encoding.ts`: `textToBytes`, `bytesToText`, `encodeBase64` / `decodeBase64`,
  `base64ToBytes`, `bytesToBase64`, `bytesToHex` / `hexToBytes`, `encodeHex` / `decodeHex`,
  `bytesToBinary` / `binaryToBytes`, `encodeBinary` / `decodeBinary`, `encodeBase32` /
  `decodeBase32`, `encodeBase58` / `decodeBase58`, `escapeHtml` / `unescapeHtml`,
  `encodeUrlComponent` / `decodeUrlComponent`.
- `hashing.ts`: `HASH_ALGORITHMS`, `hashAlgorithmById`, `hashBytes`, `hashText`, `hmacBytes`,
  `hmacHex`, `type HashAlgorithm`. Noble hash functions require explicit `.js` subpath imports;
  use the helpers instead.
- `json.ts`: `parseJson` (throws `JsonParseError` with `line` and `column`), `formatJson`,
  `minifyJson`, `sortJsonKeys`, `stableStringify`.
- `utils.ts`: `cn`, `clamp`, `formatBytes`, `formatNumber`, `truncate`, `pluralize`.
- `download.ts`: `downloadBlob`, `downloadText`, `downloadDataUrl`, and file readers.
- `clipboard.ts`: `copyText`, `readClipboard`.
- `hooks.ts`: `useLocalStorage`, `useCopyState`.
- `recent.ts`, `search.ts`.

Shared helpers must remain dependency-free enough to run in the browser.

## Installed packages

Available in `apps/web/package.json`: `@noble/hashes`, `acorn`, `bcryptjs`, `cron-parser`,
`cronstrue`, `diff`, `dompurify`, `graphql`, `highlight.js`, `jsqr`, `jsonpath-plus`,
`lucide-react`, `marked`, `qrcode`, `semver`, `sql-formatter`, `terser`, `yaml`.

Browser APIs that are fair game: Canvas, `CanvasRenderingContext2D`, `createImageBitmap`,
`CompressionStream` / `DecompressionStream`, Web Crypto (`crypto.subtle`), `URL`, `DOMParser`,
`XMLSerializer`, `TextEncoder` / `TextDecoder`, `FileReader`, `Intl`, `WebSocket`,
`performance`, `matchMedia`.

Do not add dependencies. Do not call remote APIs except the DNS-over-HTTPS endpoint
(`https://cloudflare-dns.com/dns-query`) and user-initiated WebSocket connections.

## Logic and tests

Put non-trivial parsing, conversion, or formatting in `<category>/logic.ts` and test it with
Vitest:

```ts
// apps/web/src/tools/data/logic.test.ts
import { describe, expect, it } from "vitest";
import { csvToJson } from "./logic";

describe("csvToJson", () => {
  it("handles quoted commas", () => {
    expect(csvToJson('name,note\nAda,"hello, world"')).toEqual([
      { name: "Ada", note: "hello, world" },
    ]);
  });
});
```

Cover the failure paths you show in the UI. Tests must not depend on network access. For
canvas-only tools, test the pure helpers (dimension math, color conversion, filename handling)
and keep the drawing code thin.

Run these commands from the repo root before reporting done:

```bash
pnpm --filter @devkit/web exec tsc --noEmit
pnpm --filter @devkit/web exec vitest run src/tools/<category>
pnpm --filter @devkit/web exec eslint src/tools/<category>
```

Other categories may be under construction while you work. If `tsc` reports errors only in
files outside your folder, report that instead of changing those files.

## Category inventories

Implement every tool listed. IDs and names are fixed so links and search stay stable.

### data

| id | name | core behavior |
| --- | --- | --- |
| `json-formatter` | JSON Formatter & Validator | Already implemented. Keep it. |
| `yaml-json` | YAML ↔ JSON | Bi-directional conversion with `yaml`, multi-document support, clear errors. |
| `csv-json` | CSV ↔ JSON | RFC 4180 quoting, delimiter choice, header toggle, nested output preview. |
| `json-to-typescript` | JSON to TypeScript | Generate interfaces/types from a JSON sample, merge arrays of objects, optional `readonly`. |
| `jsonpath` | JSONPath Evaluator | Evaluate expressions with `jsonpath-plus`, show matches and count. |
| `xml-formatter` | XML Formatter | Pretty-print and validate with `DOMParser`, report parser errors. |
| `xml-json` | XML ↔ JSON | Convert with attributes/text conventions; round-trip simple documents. |
| `json-schema` | JSON Schema Generator | Infer draft-07 schema from a JSON sample, handle required fields and arrays. |
| `sql-formatter` | SQL Formatter | Dialect select, keyword case, indent width via `sql-formatter`. |
| `graphql-formatter` | GraphQL Formatter | Parse and print operations/schemas with `graphql`, report syntax locations. |

### encoding

| id | name | core behavior |
| --- | --- | --- |
| `base64` | Base64 Encoder / Decoder | Already implemented. Keep it. |
| `url-encoder` | URL Encoder / Decoder | Component vs whole-URL modes, plus-space handling, UTF-8. |
| `html-entities` | HTML Entity Encoder / Decoder | Named and numeric entities, encode-all option. |
| `hex-text` | Hex ↔ Text | UTF-8 aware, separators, uppercase, odd-length errors. |
| `binary-text` | Binary ↔ Text | 8-bit groups, optional separators, byte count. |
| `morse-code` | Morse Code Translator | Letters, digits, punctuation; play audio tones with Web Audio; timing controls. |
| `gzip` | Gzip / Deflate | Compress and decompress text with `CompressionStream`, Base64 transport format. |
| `punycode` | Punycode / IDN Converter | Unicode domain to ASCII and back; multiple labels; validation. |
| `base32-base58` | Base32 / Base58 | Encode/decode text and hex with both alphabets (use shared helpers). |

### security

| id | name | core behavior |
| --- | --- | --- |
| `hash-generator` | Hash Generator | Already implemented. Keep it. |
| `jwt-parser` | JWT Parser | Decode header/payload/signature locally, show registered claims and expiry status. Never verify by default. |
| `hmac` | HMAC Generator | Any supported hash, key encodings (text/hex/base64), hex/base64 output, comparison. |
| `bcrypt` | Bcrypt Generator & Verifier | Hash with configurable rounds and verify with `bcryptjs`; warn about cost. |
| `uuid-ulid` | UUID / ULID Generator | v4 and v5 (namespace + name) UUIDs, ULIDs, bulk counts, uppercase/braces/hyphen toggles. |
| `rsa-keypair` | RSA / EC Key Generator | Web Crypto key pairs, PEM export (PKCS#8/SPKI), RSA or ECDSA P-256, copy/download. |
| `password-generator` | Password Generator | Length, character classes, exclude ambiguous, entropy estimate, bulk generation. |
| `aes-encryption` | AES Encryption | AES-GCM and AES-CBC via Web Crypto, password-derived key (PBKDF2), Base64 payload with IV/salt metadata. |
| `jwt-verify` | JWT Verifier | Verify HS256/384/512 and RS256/ES256 with a secret or PEM public key using Web Crypto. |
| `x509-decoder` | X.509 Certificate Decoder | Parse PEM/DER subset (subject, issuer, validity, serial, SANs, key algorithm) with a small ASN.1 reader; say what is unsupported. |
| `random-bytes` | Random Bytes Generator | Sizes, hex/base64/decimal output, copy/download. Use `crypto.getRandomValues`. |

### text

| id | name | core behavior |
| --- | --- | --- |
| `regex-tester` | RegEx Tester | Flags, live matches with capture groups, highlighted match list, replace preview, ReDoS warning. |
| `diff-checker` | Diff Checker | Line and word diff with `diff`, side-by-side or unified view, ignore whitespace/case. |
| `case-converter` | Case Converter | camel, Pascal, snake, kebab, CONSTANT, Title, sentence, dot; preserve separators sensibly. |
| `text-counter` | Text Counter | Characters, words, lines, sentences, paragraphs, bytes, reading time, frequency table. |
| `markdown-preview` | Markdown Preview | Live preview with `marked` and sanitize with `dompurify`; HTML export; GFM tables/task lists. |
| `lorem-ipsum` | Lorem Ipsum Generator | Words, sentences, paragraphs; classic or developer-themed; start with "Lorem ipsum". |
| `text-dedupe` | Text Deduplicator | Remove duplicate lines, trim, drop empty, sort, case-insensitive option, counts. |
| `slug-generator` | Slug Generator | Unicode transliteration, separator choice, lowercase, max length, bulk lines. |
| `string-escape` | String Escape / Unescape | JS, JSON, Python, C#, SQL, shell styles; round-trip where defined. |
| `cron-parser` | Cron Expression Parser | Human description with `cronstrue`, next runs with `cron-parser`, field help. |

### web

| id | name | core behavior |
| --- | --- | --- |
| `http-status` | HTTP Status Codes | Searchable reference for 1xx–5xx with descriptions and categories. |
| `curl-converter` | cURL to Code | Parse common cURL flags (`-X`, `-H`, `-d`, `--data-raw`, `-u`, `-F`, `--compressed`) and emit fetch, Python requests, Go, and Node. |
| `user-agent` | User-Agent Parser | Best-effort browser/engine/OS/device detection, plus raw string and common UA presets. |
| `subnet-calculator` | IP Subnet Calculator | IPv4 CIDR math: network, broadcast, mask, wildcard, host range/count, binary mask. |
| `url-parser` | URL Parser & Builder | Full URL breakdown, query parameter editor, relative URL handling, encoded/decoded values. |
| `port-reference` | Port Reference | Searchable common ports and protocols, filter by TCP/UDP. |
| `dns-lookup` | DNS Lookup | DNS-over-HTTPS via `cloudflare-dns.com`, record types A/AAAA/CNAME/MX/TXT/NS/SOA, clear network errors. |
| `websocket-tester` | WebSocket Tester | Connect to user-provided `ws(s)://` URL, send text, log messages, close cleanly. User-initiated only. |
| `http-headers` | HTTP Header Inspector | Parse raw request/response headers, show cookies, security headers, duplicates. |
| `meta-tags` | Meta Tag Generator | Title, description, canonical, Open Graph, Twitter cards, robots; live HTML with escaped values. |

### image

| id | name | core behavior |
| --- | --- | --- |
| `image-converter` | Image Converter | Canvas conversion among PNG, JPEG, WebP (and AVIF when the browser encodes it); quality control; detect fallback. |
| `image-compressor` | Image Compressor | Quality and max-dimension controls, before/after size and savings, download. |
| `image-resizer` | Image Resizer | Width/height with aspect lock, percentage mode, presets, PNG/JPEG/WebP output. |
| `image-cropper` | Image Cropper | Drag a crop rectangle over a preview canvas, aspect presets, export the crop. |
| `svg-optimizer` | SVG Optimizer | Remove comments/metadata/editor namespaces, collapse whitespace, report size change; keep it conservative. |
| `favicon-generator` | Favicon Generator | Generate 16/32/48/180/192/512 PNGs and a multi-image `favicon.ico` container; download each or all. |
| `palette-extractor` | Palette Extractor | Quantize sampled pixels into a dominant palette with hex values and copy controls. |
| `exif-viewer` | EXIF Viewer | Parse JPEG APP1 EXIF (orientation, camera, exposure, GPS) and offer metadata-stripped re-encode. |
| `placeholder-image` | Placeholder Image | Size, background, text color, label, format; canvas render and download. |
| `image-base64` | Image ↔ Base64 | File to data URL/Base64 and Base64/data URL to preview and download. |

### css

| id | name | core behavior |
| --- | --- | --- |
| `box-shadow` | Box Shadow Generator | Multiple layers, inset, color/opacity, live preview, CSS export. |
| `gradient` | Gradient Generator | Linear/radial, multiple stops, angle, preview, CSS export. |
| `flexbox-grid` | Flexbox & Grid Playground | Controls for common flex/grid properties, live preview, generated CSS. |
| `color-converter` | Color Converter | HEX/RGB/HSL/HSV/OKLCH, alpha, contrast ratio, accessible text color. |
| `css-minifier` | CSS Minifier | Conservative comment/whitespace removal with string/url safety, before/after size. |
| `px-rem` | px ↔ rem Converter | Base font size, batch conversion table, reverse conversion. |
| `border-radius` | Border Radius Generator | Per-corner values or uniform, elliptical slash syntax, live preview, CSS. |
| `tailwind-search` | Tailwind Class Search | Curated searchable utility reference (spacing, layout, color, typography) with examples. |

### datetime

| id | name | core behavior |
| --- | --- | --- |
| `timestamp` | Unix Timestamp Converter | Seconds/ms detection, local/UTC/ISO output, date to timestamp, live clock. |
| `timezone` | Time Zone Converter | Compare a chosen instant across zones with `Intl.DateTimeFormat`, DST-aware. |
| `date-diff` | Date Difference | Days/hours/minutes/seconds between two dates, business-day option, calendar breakdown. |
| `base-converter` | Number Base Converter | Binary/octal/decimal/hex/arbitrary base 2–36, big integers, signed handling. |
| `duration-parser` | Duration Parser | Parse `2h 30m`, `1.5 days`, ISO 8601, seconds; format in multiple units. |
| `bitwise` | Bitwise Calculator | AND/OR/XOR/NOT/shifts with 8/16/32/64-bit views and binary output. |
| `percentage-ratio` | Percentage & Ratio | Percent of, change, ratio simplification, aspect ratio, parts. |
| `matrix` | Matrix Calculator | Add, multiply, transpose, determinant, inverse for small matrices; clear errors. |
| `random-number` | Random Number Generator | Uniform integers/floats, ranges, unique sets, optional seeded PRNG. |
| `timer` | Stopwatch & Timer | Stopwatch, countdown, laps; use `performance.now` and clean up intervals. |

### code

| id | name | core behavior |
| --- | --- | --- |
| `chmod` | Chmod Calculator | Octal/symbolic conversion, owner/group/other matrix, special bits, command output. |
| `git-helper` | Git Command Helper | Build common commands (commit, branch, rebase, cherry-pick, reset, stash) from a form with explanations. |
| `docker-compose` | Docker Compose Helper | Validate YAML shape and required keys with `yaml`, generate a starter compose file from services. |
| `env-formatter` | .env Formatter | Parse, sort, dedupe, validate key names, quote values, detect duplicate keys. |
| `ast-explorer` | JavaScript AST Explorer | Parse JS/TS-ish JavaScript with `acorn` and render an expandable syntax tree. |
| `js-minifier` | JS Minifier | Use Terser's browser bundle (`terser/dist/bundle.min.js`) for real minification; report errors, before/after size. |
| `gitignore` | .gitignore Generator | Stack presets (Node, Python, Go, Rust, Java, macOS, Windows, editors) merged without duplicates. |
| `code-screenshot` | Code Screenshot | Render highlighted code (highlight.js) to a canvas with theme, padding, line numbers, download PNG. |
| `nginx-helper` | Nginx Config Helper | Build server/proxy/static/SSL blocks from a form; validate braces and required values. |

### misc

| id | name | core behavior |
| --- | --- | --- |
| `qr-generator` | QR Code Generator | Text/URL/Wi-Fi payloads, error correction, size, colors, PNG/SVG download via `qrcode`. |
| `qr-reader` | QR Code Reader | Decode QR from an uploaded image with `jsqr`; show payload and format. |
| `semver` | SemVer Calculator | Validate, compare, satisfy ranges, increment major/minor/patch with `semver`. |
| `ascii-table` | ASCII Table | Searchable 0–127 table (control names, decimal, hex, binary) plus extended Latin-1 notes. |
| `dpr` | Device Pixel Ratio | Live viewport, DPR, CSS/device resolution, color depth, touch support, zoom estimate. |
| `storage-converter` | Storage Size Converter | Bytes/Bits and SI/IEC units, high precision, batch table. |
| `license-selector` | License Selector | Short questionnaire (permissions, patent, copyleft, attribution) that recommends MIT, Apache-2.0, GPL-3.0, MPL-2.0, or Unlicense with a summary. |
| `system-info` | System Information | Browser, platform, cores, memory, locale, timezone, screen, WebGL renderer where available. |
| `keycode` | Keycode Inspector | Capture keydown/keyup, show `key`, `code`, `keyCode`, modifiers; pause and clear. |
| `clipboard-history` | Clipboard History | Local, opt-in history of copied snippets with search and clear. Never capture automatically; add entries from an explicit paste/read action. |

## Definition of done

- Every listed tool exists, is registered, and its route renders.
- Invalid input produces an `Alert`, not a crash.
- Core logic has tests; `vitest` passes for your category.
- `tsc --noEmit` and `eslint` pass for your files.
- No unused imports, no `console.log`, no placeholder text such as "TODO".
- No dependency was added and no shared file was edited.
