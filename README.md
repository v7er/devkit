# devkit

A local-first toolbox for developers. Ninety-seven utilities for data formats, encoding,
security, text, the web, images, CSS, dates, code, and everyday reference work. Every byte is
processed in your browser or desktop app; no tool uploads content to a server.

![License: MIT](https://img.shields.io/badge/license-MIT-34d399)

## What is included

- **Web app** (`apps/web`) — React 19, Vite 7, Tailwind CSS 4, React Router 7. Deploys as a
  static Cloudflare Worker.
- **Desktop app** (`apps/desktop`) — Tauri 2 shell around the same web build for macOS,
  Windows, and Linux.
- **Tool registry** — 97 lazy-loaded tools across ten categories. Each tool is its own chunk, so
  the first load stays small.
- **Local-first behavior** — no telemetry, no accounts, no uploads. DNS lookup and the WebSocket
  tester are the only network features, and both require an explicit action.

### Tool categories

| Category | Tools |
| --- | --- |
| Data & formats | JSON formatter, YAML/JSON, CSV/JSON, JSON to TypeScript, JSONPath, XML formatter, XML/JSON, JSON Schema, SQL formatter, GraphQL formatter |
| Encoders & decoders | Base64, URL, HTML entities, hex, binary, Morse, gzip/deflate, punycode, Base32/Base58 |
| Security & crypto | Hash generator, JWT parser, HMAC, bcrypt, UUID/ULID, RSA/EC keys, password generator, AES, JWT verifier, X.509 decoder, random bytes |
| Text & strings | Regex tester, diff checker, case converter, text counter, Markdown preview, Lorem Ipsum, deduplicator, slug generator, string escape, cron parser |
| Web & network | HTTP status, cURL converter, user agent, subnet calculator, URL parser, ports, DNS lookup, WebSocket tester, header inspector, meta tags |
| Images & media | Converter, compressor, resizer, cropper, SVG optimizer, favicon generator, palette extractor, EXIF viewer, placeholders, image/Base64 |
| CSS & frontend | Box shadow, gradient, flex/grid playground, color converter, CSS minifier, px/rem, border radius, Tailwind search |
| Date, time & math | Timestamp, time zones, date difference, base converter, duration parser, bitwise, percentages, matrix, random numbers, timer |
| Code & tooling | Chmod, git helper, Docker Compose, .env formatter, AST explorer, JS minifier, .gitignore, code screenshot, nginx helper |
| Specialized | QR generator, QR reader, SemVer, ASCII table, DPR, storage converter, license selector, system info, keycode, clipboard history |

## Requirements

- Node.js **20.19+** (or 22.12+)
- pnpm **10**
- Rust **1.77+** and the platform build tools only for the desktop app

```bash
corepack enable
pnpm install
```

## Development

```bash
pnpm dev            # web app at http://localhost:5173
pnpm typecheck      # all workspaces
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm build          # production web build in apps/web/dist
pnpm tauri:dev      # desktop app with hot reload
pnpm tauri:build    # signed desktop bundle for the current OS
```

The first Tauri build downloads and compiles the Rust dependencies, which takes a few minutes.
On macOS the build needs Xcode Command Line Tools; on Windows it needs the WebView2 runtime and
Visual Studio Build Tools; on Linux it needs `webkit2gtk-4.1` and the usual GTK packages. See
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Project layout

```text
devkit/
├── apps/
│   ├── web/
│   │   ├── public/              # favicon, theme bootstrap, _headers
│   │   ├── src/
│   │   │   ├── app/             # theme and command-palette context
│   │   │   ├── components/      # layout and UI primitives
│   │   │   ├── lib/             # encoding, hashing, JSON, files, hooks
│   │   │   └── tools/           # one folder per category
│   │   ├── wrangler.jsonc       # Cloudflare Worker static assets
│   │   └── vite.config.ts
│   └── desktop/
│       └── src-tauri/           # Tauri 2 shell, config, icons
├── docs/TOOL_AUTHORING.md       # how to add a tool
├── AGENTS.md                    # contributor and agent conventions
└── LICENSE
```

## Adding a tool

Read [docs/TOOL_AUTHORING.md](docs/TOOL_AUTHORING.md). A tool is a default-exported React
component plus one registry entry in its category index. The registry aggregates categories, so
there is no central switch to edit.

```bash
pnpm --filter @devkit/web exec vitest run src/tools/data
pnpm --filter @devkit/web exec tsc --noEmit
```

## Deploy the website to Cloudflare

The web build is a static single-page app served by a Cloudflare Worker with SPA fallback. The
configuration is in `apps/web/wrangler.jsonc`; security headers live in
`apps/web/public/_headers` and are copied into the build.

```bash
pnpm --filter @devkit/web exec wrangler login   # once
pnpm deploy:dry                                 # build + validate, no upload
pnpm deploy                                     # build + deploy
```

`wrangler deploy` prints the `*.workers.dev` URL. To attach a custom domain, add a route to
`apps/web/wrangler.jsonc`:

```jsonc
{
  "routes": [{ "pattern": "devkit.example.com", "custom_domain": true }]
}
```

For a Git-connected Cloudflare Pages project, use:

- Build command: `pnpm build`
- Output directory: `apps/web/dist`
- Root directory: repository root
- Environment: `NODE_VERSION=22`, `PNPM_VERSION=10`

For Workers Builds, use `pnpm deploy` and let Wrangler read `apps/web/wrangler.jsonc`.

### CI

`.github/workflows/ci.yml` runs install, lint, typecheck, tests, production build, and a
Wrangler dry run on every push and pull request. Deployment is intentionally left to an
authenticated environment; add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and a
deploy step if you want automated releases.

## Security and privacy

- The web build sets a strict Content Security Policy. `connect-src` allows same-origin requests,
  Cloudflare DNS-over-HTTPS, and user-initiated WebSocket connections.
- No analytics, error reporting, or third-party fonts. The app ships its own CSS and data.
- Secrets typed into security tools stay in component memory. Nothing is written to
  `localStorage` except theme/preferences, recent tools, and explicit clipboard history entries.
- The DNS lookup sends only the hostname and record type you enter to
  `https://cloudflare-dns.com/dns-query`.
- The desktop shell exposes only `core:default` Tauri permissions; the webview has no filesystem
  or shell access.

## License

MIT. See [LICENSE](LICENSE).
