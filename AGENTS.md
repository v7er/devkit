# AGENTS.md

Guidance for coding agents working on **devkit**.

## Project

**devkit** is a local-first desktop toolbox for developers. It bundles small, focused
utilities (JSON formatting, JWT inspection, hashing, encoding, image conversion, and
more) into one fast app that works offline on macOS, Windows, and Linux.

The product specification and the full list of 100 candidate utilities live in
[`DESCRIPTIONS.md`](./DESCRIPTIONS.md). That file is the source of truth for scope.
This file is the source of truth for how to build and change the project.

### Goals

- Zero network dependency for normal tool use. Inputs are processed in memory on the
  user's machine and never uploaded.
- Instant startup and responsive UI. Every tool opens without a page reload.
- Small, auditable surface: no analytics, no telemetry, no background phoning home.
- One consistent shell: a minimal top bar, command palette, and shared layout.

### Non-goals

- Cloud sync, accounts, or collaboration.
- Server-side processing of user data.
- Being a full IDE, terminal emulator, or general automation platform.

## Stack

- **Tauri v2** desktop shell (Rust in `apps/desktop/src-tauri/`)
- **React 19 + TypeScript** frontend, built with **Vite 7**
- **Tailwind CSS v4** for styling
- **React Router 7** for tool routes
- **Vitest + Testing Library** for unit/component tests
- **pnpm** workspaces for the monorepo
- **Cloudflare Workers static assets** (Wrangler) for the website

The detailed tool contract and UI patterns live in
[`docs/TOOL_AUTHORING.md`](./docs/TOOL_AUTHORING.md). Read it before adding a tool.

Prefer the existing dependency when it already solves the problem. Add a dependency
only when it is actively maintained, permissively licensed, and smaller than the code
it replaces. No dependency may collect telemetry or make network calls on import.

## Repository layout

```text
devkit/
├── AGENTS.md
├── DESCRIPTIONS.md              # product spec + 100 tool ideas
├── LICENSE                      # MIT
├── package.json
├── pnpm-workspace.yaml
├── docs/TOOL_AUTHORING.md       # tool contract and UI patterns
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── wrangler.jsonc       # Cloudflare static assets + SPA fallback
│   │   ├── vite.config.ts
│   │   ├── public/              # favicon, theme bootstrap, _headers
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── app/             # theme and palette contexts
│   │       ├── components/
│   │       │   ├── layout/      # shell, top bar, command palette, pages
│   │       │   └── ui/          # buttons, inputs, panels, copy, file drop
│   │       ├── lib/             # pure, reusable logic (no React)
│   │       │   ├── encoding.ts
│   │       │   ├── hashing.ts
│   │       │   ├── json.ts
│   │       │   ├── clipboard.ts
│   │       │   ├── download.ts
│   │       │   └── hooks.ts
│   │       └── tools/
│   │           ├── types.ts
│   │           ├── categories.ts
│   │           ├── registry.ts  # aggregates the ten category indexes
│   │           └── <category>/
│   │               ├── index.ts # ToolDefinition[] for the category
│   │               ├── <tool-id>.tsx
│   │               ├── logic.ts
│   │               └── logic.test.ts
│   └── desktop/
│       ├── package.json
│       └── src-tauri/
│           ├── Cargo.toml
│           ├── tauri.conf.json
│           ├── capabilities/
│           └── src/
└── .github/workflows/ci.yml
```

Keep React out of `apps/web/src/lib/`. Keep tool-specific logic inside the category
folder unless at least two categories use it, in which case promote it to `lib/`.

## Expected commands

Update this list if the scaffold differs; do not leave stale commands behind.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server (browser) | `pnpm dev` |
| Desktop dev | `pnpm tauri:dev` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| Production web build | `pnpm build` |
| Desktop bundle | `pnpm tauri:build` |
| Deploy dry run | `pnpm run deploy:dry` |
| Deploy website | `pnpm run deploy` |

Before handing off work, run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Run
`pnpm build` for changes that affect bundling, lazy loading, or dependencies. Do not
claim a check passed unless its output shows it.

## Tool architecture

Each category owns an index file at `apps/web/src/tools/<category>/index.ts` that
exports a `ToolDefinition[]`. `apps/web/src/tools/registry.ts` aggregates the ten
category arrays into one list. The home page, command palette, search, and router are
generated from that registry, so adding a tool requires edits in one category index.

```ts
// apps/web/src/tools/types.ts
export type ToolCategory =
  | "image"
  | "security"
  | "encoding"
  | "data"
  | "text"
  | "web"
  | "css"
  | "datetime"
  | "code"
  | "misc";

export interface ToolDefinition {
  id: string;                 // kebab-case, stable, used in the URL
  name: string;
  description: string;        // one sentence shown in search results
  category: ToolCategory;
  keywords: string[];         // aliases users may type
  component: LazyExoticComponent<ComponentType>; // React.lazy(() => import("./tool"))
  featured?: boolean;         // shown on the home page and command palette first
}
```

Rules:

- `id` is permanent once released. Changing it breaks bookmarks.
- Lazy-load every tool with `React.lazy` so the initial bundle stays small.
- A tool renders inside the shared `ToolPage` shell; it owns its local state and does
  not reach into other tools.
- Shared behavior (copy to clipboard, download file, clear, error display) uses the
  shared UI components so every tool looks and behaves the same.
- Large or CPU-heavy work (image batches, hashing big files, diffing long text) runs in
  a Web Worker. Keep the main thread responsive.

### Adding a tool

1. Add the component at `apps/web/src/tools/<category>/<tool-id>.tsx` with a default
   export.
2. Put non-React logic in `apps/web/src/tools/<category>/logic.ts` (or a
   tool-specific module) and cover it with a Vitest test.
3. Add an entry to `apps/web/src/tools/<category>/index.ts` with a stable id, the
   category, realistic search keywords, and `lazy(() => import("./<tool-id>"))`.
4. Reuse the shared layout, input/output panels, and copy/download controls.
5. Handle empty, invalid, and very large inputs explicitly.
6. Verify the tool in a browser at both desktop and narrow viewport widths.
7. Confirm the tool appears in search and that its route works on a cold load.

See `docs/TOOL_AUTHORING.md` for the full contract, helper APIs, and the fixed IDs
for all 97 tools.

## Product behavior rules

- **Local-first.** Tool input is processed in memory. Do not add uploads, remote
  evaluation, fonts, scripts, or images fetched at runtime.
- **No telemetry.** Do not add analytics, crash reporting, session replay, or usage
  pings. This includes build-time plugins that inject them.
- **Persistence is opt-in.** Most tools keep state only for the current session. If a
  tool persists something (for example clipboard history), it must be local, easy to
  clear, and disclosed in the UI.
- **Secrets stay out of logs.** Never log tokens, hashes, passwords, or file contents
  to the console, error overlays, or telemetry.
- **Network tools are explicit.** The few tools that need the network (DNS lookup,
  WebSocket tester) must require a user action per request, show what will be
  contacted, and remain usable in a build where networking is disabled.
- **Decoding is not verification.** JWT and certificate tools must say that decoded
  contents are untrusted until verified.
- **Deterministic output.** Given the same input, a tool produces the same output.
  Random generators must let the user see and copy the generated value, and must use
  a cryptographic source (`crypto.getRandomValues`) for keys, passwords, and tokens.
- **No destructive defaults.** Clear, reset, and overwrite actions require intent
  (an explicit button, or confirmation for multi-file operations).

## Security and Tauri

- Keep the Tauri CSP restrictive. Do not add `unsafe-eval` or broad remote origins.
- Grant only the capabilities a feature needs in
  `apps/desktop/src-tauri/capabilities/`. Prefer
  frontend Web APIs (Canvas, Web Crypto, File System Access via dialogs) over new
  Rust plugins.
- Do not add the shell/exec plugin unless a tool genuinely requires it, and never
  pass user input through a shell.
- Validate and bound file inputs (size, type, count) before decoding.
- Avoid `dangerouslySetInnerHTML`. When rendering Markdown or highlighted code, use a
  sanitizer and render inert output.
- Never commit secrets, signing keys, certificates, or `.env` files.

## Code conventions

- TypeScript `strict` mode. No `any` in exported signatures; use `unknown` and narrow.
- Function components with named exports in shared UI, default export for a tool's
  page component.
- Prefer small pure functions in `logic.ts`; components compose them.
- Name files after their primary export. Use kebab-case for tool folders and ids.
- Tailwind utilities for styling. Put repeated token values (colors, spacing, radii)
  in the theme rather than duplicating arbitrary values.
- Every interactive control needs a keyboard path and a visible focus state. Inputs
  need labels; icon-only buttons need `aria-label`.
- Copy is plain and specific. Say what a tool does and what it does not do.
- Handle errors at the boundary: show a short message next to the input, keep the
  previous valid output visible when possible.
- No commented-out code, no dead feature flags, no `TODO` without an issue reference.

## Testing and verification

- Unit-test pure logic: parsers, encoders, formatters, edge cases, invalid input.
- Component-test shared controls and error/empty states where behavior is non-trivial.
- For any UI change, run the app and exercise the affected flow in a browser. Click,
  type, submit, navigate; check the route on a cold load and the tool's empty, invalid,
  and large-input states. A screenshot of one screen is not verification.
- When a change touches shared state, routing, or the registry, check the other tools
  and views that read it, including search and direct URLs.
- Check desktop and narrow layouts when layout or styling changes.
- If a check cannot be run, say so explicitly in the handoff.

## Definition of done

- [ ] The feature works through the shared tool shell and is registered once.
- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- [ ] The affected flow was verified in a browser, including error and empty states.
- [ ] No network call, telemetry, or secret logging was introduced.
- [ ] New dependencies are justified, permissively licensed, and documented.
- [ ] User-facing copy is clear and accurate.

## Git conventions

- Conventional Commits: `feat(tools): add base64 encoder`,
  `fix(jwt): handle unsigned tokens`, `chore(deps): bump vite`.
- One logical change per commit. Do not mix formatting-only churn with behavior.
- Do not commit build output, `node_modules/`, or generated bundles.

## License

devkit is released under the **MIT License**; see [`LICENSE`](./LICENSE).
Contributions are accepted under the same license.

Rules for agents:

- Keep the copyright notice and permission text in `LICENSE` intact.
- Any copied or adapted code must be compatible with MIT and must retain its original
  attribution. Do not paste code from projects with incompatible or unknown licenses.
- New dependencies must be MIT, Apache-2.0, BSD, ISC, or another permissive license.
  Flag copyleft dependencies before adding them.
- Generated assets and fonts must be licensed for redistribution; record the source
  and license in the commit or a nearby notice.
- The **License Selector** utility (idea 97) is an informational guide. It must
  present license text and trade-offs accurately and must not imply legal advice.
