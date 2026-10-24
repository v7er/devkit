import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  bitsToMode,
  buildGitCommand,
  buildNginxConfig,
  computeScreenshotLayout,
  defaultGitInput,
  defaultNginxOptions,
  expandTabs,
  formatEnv,
  generateCompose,
  highlightCode,
  mergeGitignore,
  modeBits,
  modeToChmodCommand,
  modeToOctal,
  modeToSymbolic,
  modeToSymbolicSet,
  parseJavaScript,
  parseOctalMode,
  parseSymbolic,
  quoteEnvValue,
  screenshotFilename,
  setPermission,
  setSpecial,
  shellQuote,
  validateBraces,
  validateCompose,
} from "./logic";
import type { AstTreeNode } from "./logic";

function collectTypes(node: AstTreeNode, types: string[] = []): string[] {
  types.push(node.type);
  for (const child of node.children) collectTypes(child, types);
  return types;
}

describe("chmod", () => {
  it("parses three and four digit octal modes", () => {
    expect(parseOctalMode("755")).toBe(0o755);
    expect(parseOctalMode("4755")).toBe(0o4755);
    expect(parseOctalMode(" 0755 ")).toBe(0o755);
  });

  it("rejects invalid octal input", () => {
    expect(() => parseOctalMode("")).toThrow("octal");
    expect(() => parseOctalMode("799")).toThrow("octal");
    expect(() => parseOctalMode("77")).toThrow("octal");
    expect(() => parseOctalMode("12345")).toThrow("octal");
  });

  it("converts modes to symbolic strings and back", () => {
    expect(modeToSymbolic(0o755)).toBe("rwxr-xr-x");
    expect(modeToSymbolic(0o644)).toBe("rw-r--r--");
    expect(modeToSymbolic(0o4755)).toBe("rwsr-xr-x");
    expect(modeToSymbolic(0o2750)).toBe("rwxr-s---");
    expect(modeToSymbolic(0o1777)).toBe("rwxrwxrwt");
    expect(parseSymbolic("rwxr-xr-x")).toBe(0o755);
    expect(parseSymbolic("-rwsr-xr-t")).toBe(0o5755);
    expect(parseSymbolic("rwxrwxrwt")).toBe(0o1777);
  });

  it("rejects malformed symbolic strings", () => {
    expect(() => parseSymbolic("rwx")).toThrow("nine symbolic");
    expect(() => parseSymbolic("rwq r-xr-x")).toThrow("nine symbolic");
  });

  it("round-trips bits through the matrix helpers", () => {
    const bits = modeBits(0o640);
    expect(bits.owner).toEqual({ read: true, write: true, execute: false });
    expect(bits.group).toEqual({ read: true, write: false, execute: false });
    expect(bits.other).toEqual({ read: false, write: false, execute: false });
    expect(bitsToMode(bits)).toBe(0o640);

    const executable = setPermission(0o640, "other", "execute", true);
    expect(executable).toBe(0o641);
    expect(setSpecial(executable, "sticky", true)).toBe(0o1641);
    expect(setSpecial(0o7755, "setuid", false)).toBe(0o3755);
  });

  it("formats octal output and the chmod command", () => {
    expect(modeToOctal(0o755)).toBe("755");
    expect(modeToOctal(0o4755)).toBe("4755");
    expect(modeToSymbolicSet(0o754)).toBe("u=rwx,g=rx,o=r");
    expect(modeToChmodCommand(0o755, "deploy script.sh", true)).toBe("chmod -R 755 'deploy script.sh'");
    expect(modeToChmodCommand(0o600, "")).toBe("chmod 600 path");
  });
});

describe("git command builder", () => {
  it("builds a commit and quotes the message", () => {
    const result = buildGitCommand({ ...defaultGitInput, message: "fix: handle it's empty" });
    expect(result.error).toBe("");
    expect(result.command).toBe("git commit -m 'fix: handle it'\\''s empty'");
    expect(result.explanation.join(" ")).toContain("-m");
  });

  it("requires a message unless amending", () => {
    expect(buildGitCommand({ ...defaultGitInput, message: "" }).error).toContain("commit message");
    const amended = buildGitCommand({ ...defaultGitInput, amend: true });
    expect(amended.command).toBe("git commit --amend --no-edit");
    expect(amended.warnings.length).toBeGreaterThan(0);
  });

  it("builds branch, rebase, and cherry-pick commands", () => {
    const branch = buildGitCommand({
      ...defaultGitInput,
      kind: "branch",
      branchName: "feature/login",
      startPoint: "origin/main",
    });
    expect(branch.command).toBe("git switch -c feature/login origin/main");

    const rebase = buildGitCommand({
      ...defaultGitInput,
      kind: "rebase",
      interactive: true,
      autosquash: true,
      upstream: "origin/main",
    });
    expect(rebase.command).toBe("git rebase -i --autosquash origin/main");
    expect(rebase.warnings[0]).toContain("rewrites");

    const cherry = buildGitCommand({
      ...defaultGitInput,
      kind: "cherry-pick",
      commits: "abc123 def456",
    });
    expect(cherry.command).toBe("git cherry-pick abc123 def456");
    expect(buildGitCommand({ ...defaultGitInput, kind: "cherry-pick", commits: "" }).error).toContain("commit");
  });

  it("warns about destructive reset, stash, and push operations", () => {
    const reset = buildGitCommand({ ...defaultGitInput, kind: "reset", resetMode: "hard", target: "HEAD~2" });
    expect(reset.command).toBe("git reset --hard HEAD~2");
    expect(reset.warnings.length).toBeGreaterThan(0);

    const stash = buildGitCommand({
      ...defaultGitInput,
      kind: "stash",
      stashAction: "push",
      includeUntracked: true,
      message: "wip",
    });
    expect(stash.command).toBe("git stash push -u -m wip");

    const drop = buildGitCommand({ ...defaultGitInput, kind: "stash", stashAction: "drop" });
    expect(drop.warnings[0]).toContain("permanently");

    const push = buildGitCommand({
      ...defaultGitInput,
      kind: "push",
      remote: "origin",
      branch: "main",
      setUpstream: true,
      forceWithLease: true,
    });
    expect(push.command).toBe("git push origin main -u --force-with-lease");
    expect(push.warnings.length).toBeGreaterThan(0);
  });

  it("rejects invalid refs and flag injection", () => {
    expect(buildGitCommand({ ...defaultGitInput, kind: "branch", branchName: "bad name" }).error).not.toBe("");
    expect(buildGitCommand({ ...defaultGitInput, kind: "branch", branchName: "--force" }).error).not.toBe("");
    expect(buildGitCommand({ ...defaultGitInput, kind: "push", setUpstream: true, branch: "" }).error).toContain(
      "upstream",
    );
  });

  it("quotes shell values safely", () => {
    expect(shellQuote("plain/file-1")).toBe("plain/file-1");
    expect(shellQuote("two words")).toBe("'two words'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(shellQuote("")).toBe("''");
  });
});

describe(".env formatter", () => {
  it("parses keys, values, comments, and inline comments", () => {
    const result = formatEnv("# App config\nPORT=3000\nNAME=Ada Lovelace # author\nDEBUG=false");
    expect(result.output).toBe(
      "# App config\n\nPORT=3000\nNAME=Ada Lovelace # author\nDEBUG=false\n",
    );
    expect(result.keyCount).toBe(3);
    expect(result.issues).toEqual([]);
  });

  it("sorts keys and moves attached comments", () => {
    const result = formatEnv("# header\nB=2\n# about A\nA=1", { sortKeys: true });
    expect(result.output).toBe("# header\n\n# about A\nA=1\nB=2\n");
  });

  it("detects duplicate keys and removes them when asked", () => {
    const source = "A=1\nB=2\nA=3";
    const plain = formatEnv(source);
    expect(plain.duplicateKeys).toEqual(["A"]);
    expect(plain.issues[0].kind).toBe("duplicate");
    expect(plain.keyCount).toBe(3);

    const deduped = formatEnv(source, { dedupe: true });
    expect(deduped.output).toBe("B=2\nA=3\n");
    expect(deduped.keys).toEqual(["A", "B"]);
  });

  it("reports invalid names and malformed lines", () => {
    const result = formatEnv("1BAD=x\nBAD-NAME=y\nNO_EQUALS\nGOOD=ok");
    expect(result.issues.filter((issue) => issue.kind === "invalid-name")).toHaveLength(2);
    expect(result.issues.filter((issue) => issue.kind === "malformed")).toHaveLength(1);
    expect(result.output).toBe("GOOD=ok\n");
  });

  it("quotes values that contain spaces, hashes, or quotes", () => {
    expect(quoteEnvValue("plain")).toBe("plain");
    expect(quoteEnvValue("two words")).toBe('"two words"');
    expect(quoteEnvValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteEnvValue("'already'")).toBe("'already'");
    expect(formatEnv("A=hello world", { quoteValues: true }).output).toBe('A="hello world"\n');
  });

  it("supports export prefixes and dropping comments", () => {
    const result = formatEnv("# note\nA=1", { exportPrefix: true, preserveComments: false });
    expect(result.output).toBe("export A=1\n");
  });

  it("handles empty input", () => {
    expect(formatEnv("")).toEqual({ output: "", keyCount: 0, keys: [], issues: [], duplicateKeys: [] });
  });
});

describe("docker compose validation", () => {
  it("accepts a valid compose file", () => {
    const result = validateCompose(
      'services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n  db:\n    build: .\n',
    );
    expect(result.ok).toBe(true);
    expect(result.services).toEqual(["web", "db"]);
    expect(result.errors).toEqual([]);
  });

  it("reports missing services and invalid service shapes", () => {
    expect(validateCompose("version: '3.9'").errors[0]).toContain("services");
    expect(validateCompose("services:\n  web:\n    ports: []\n").errors[0]).toContain("image");
    expect(validateCompose("services:\n  web: nginx\n").errors[0]).toContain("mapping");
    expect(validateCompose("services:\n  web:\n    image: x\n    ports: 80\n").errors[0]).toContain("ports");
  });

  it("reports YAML syntax errors with a location", () => {
    const result = validateCompose("services: [");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Line \d+/);
  });

  it("warns about the obsolete version key", () => {
    const result = validateCompose("version: '3.9'\nservices:\n  web:\n    image: nginx\n");
    expect(result.ok).toBe(true);
    expect(result.warnings[0]).toContain("obsolete");
  });

  it("generates a starter file that parses back", () => {
    const generated = generateCompose(["postgres", "redis", "adminer"], "my-stack");
    expect(generated.error).toBe("");
    const parsed = parseYaml(generated.text) as {
      name: string;
      services: Record<string, Record<string, unknown>>;
      volumes: Record<string, unknown>;
    };
    expect(parsed.name).toBe("my-stack");
    expect(Object.keys(parsed.services)).toEqual(["postgres", "redis", "adminer"]);
    expect(parsed.services.adminer.depends_on).toEqual(["postgres"]);
    expect(Object.keys(parsed.volumes)).toEqual(["postgres-data", "redis-data"]);
    expect(generated.text).toContain("postgres:16-alpine");
  });

  it("rejects invalid project names and empty selections", () => {
    expect(generateCompose(["redis"], "Bad Name").error).toContain("Project name");
    expect(generateCompose([]).error).toContain("at least one");
  });
});

describe(".gitignore generator", () => {
  it("merges presets and dedupes shared patterns", () => {
    const result = mergeGitignore(["python", "java"]);
    expect(result.sections.map((section) => section.id)).toEqual(["python", "java"]);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.text).toContain("# Python");
    expect(result.text.match(/^build\/$/gm)).toHaveLength(1);
    expect(result.patternCount).toBe(
      result.sections.reduce((total, section) => total + section.count, 0),
    );
  });

  it("includes the header, categories, and a trailing newline", () => {
    const result = mergeGitignore(["node", "macos"]);
    expect(result.text.startsWith("# Generated with devkit")).toBe(true);
    expect(result.text).toContain("# Node.js");
    expect(result.text).toContain("# macOS");
    expect(result.text).toContain(".DS_Store");
    expect(result.text.endsWith("\n")).toBe(true);
  });

  it("handles empty selections and unknown ids", () => {
    expect(mergeGitignore([]).text).toBe("");
    const result = mergeGitignore(["node", "unknown-stack"]);
    expect(result.unknown).toEqual(["unknown-stack"]);
    expect(result.text).toContain("node_modules/");
  });
});

describe("JavaScript AST", () => {
  it("parses a program into a tree", () => {
    const result = parseJavaScript("const x = 1;", "script");
    expect(result.error).toBe("");
    expect(result.tree?.type).toBe("Program");
    expect(result.nodeCount).toBeGreaterThan(3);
    const types = collectTypes(result.tree as AstTreeNode);
    expect(types).toContain("VariableDeclaration");
    expect(types).toContain("Identifier");
    const identifier = (function find(node: AstTreeNode): AstTreeNode | undefined {
      if (node.type === "Identifier") return node;
      for (const child of node.children) {
        const match = find(child);
        if (match) return match;
      }
      return undefined;
    })(result.tree as AstTreeNode);
    expect(identifier?.detail).toContain('name: "x"');
    expect(identifier?.location).toBe("1:7–1:8");
  });

  it("respects module and script source types", () => {
    expect(parseJavaScript("import x from 'x';", "script").error).toContain("sourceType");
    const moduleResult = parseJavaScript("import x from 'x';", "module");
    expect(moduleResult.error).toBe("");
    expect(collectTypes(moduleResult.tree as AstTreeNode)).toContain("ImportDeclaration");
  });

  it("reports syntax errors with a line and column", () => {
    const result = parseJavaScript("const = 1;", "script");
    expect(result.tree).toBeNull();
    expect(result.error).not.toBe("");
    expect(result.errorLine).toBe(1);
    expect(result.errorColumn).toBeGreaterThan(1);
  });
});

describe("code screenshot helpers", () => {
  it("tokenizes highlighted code and keeps line breaks", () => {
    const result = highlightCode("const x = 1;\nconsole.log(x);", "javascript");
    expect(result.error).toBe("");
    expect(result.lines).toHaveLength(2);
    const text = result.lines.map((line) => line.map((token) => token.text).join("")).join("\n");
    expect(text).toBe("const x = 1;\nconsole.log(x);");
    const scopes = result.lines.flat().map((token) => token.scope);
    expect(scopes).toContain("keyword");
  });

  it("reports unknown languages", () => {
    const result = highlightCode("hello", "not-a-language");
    expect(result.error).not.toBe("");
    expect(result.lines).toEqual([]);
  });

  it("handles empty code", () => {
    expect(highlightCode("", "javascript")).toEqual({ lines: [], error: "" });
  });

  it("expands tabs against the next tab stop", () => {
    expect(expandTabs("\tx")).toBe("  x");
    expect(expandTabs("a\tb")).toBe("a b");
    expect(expandTabs("abc\td", 4)).toBe("abc d");
  });

  it("computes canvas layout and caps huge output", () => {
    const layout = computeScreenshotLayout({
      lineCount: 10,
      maxLineLength: 40,
      fontSize: 14,
      padding: 24,
      showLineNumbers: true,
    });
    expect(layout.charWidth).toBeCloseTo(8.4);
    expect(layout.lineHeight).toBe(22);
    expect(layout.gutterWidth).toBe(41);
    expect(layout.height).toBe(268);
    expect(layout.width).toBe(449);
    expect(layout.width).toBeGreaterThan(layout.codeWidth);

    const huge = computeScreenshotLayout({
      lineCount: 5000,
      maxLineLength: 5000,
      fontSize: 40,
      padding: 40,
      showLineNumbers: true,
    });
    expect(huge.width).toBe(2400);
    expect(huge.height).toBe(6000);
  });

  it("builds safe PNG filenames", () => {
    expect(screenshotFilename("My Snippet.ts")).toBe("my-snippet.png");
    expect(screenshotFilename("already.png")).toBe("already.png");
    expect(screenshotFilename("   ")).toBe("code-screenshot.png");
  });
});

describe("nginx builder", () => {
  it("builds a static server block", () => {
    const result = buildNginxConfig(defaultNginxOptions);
    expect(result.errors).toEqual([]);
    expect(result.config).toContain("listen 80;");
    expect(result.config).toContain("server_name example.com;");
    expect(result.config).toContain("root /var/www/site;");
    expect(result.config).toContain("try_files $uri $uri/ =404;");
    expect(validateBraces(result.config).balanced).toBe(true);
  });

  it("builds a proxy block with websocket headers and SSL redirect", () => {
    const result = buildNginxConfig({
      ...defaultNginxOptions,
      mode: "proxy",
      ssl: true,
      listenPort: "443",
      websocket: true,
      redirectHttp: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.config).toContain("listen 443 ssl;");
    expect(result.config).toContain("proxy_pass http://localhost:3000;");
    expect(result.config).toContain('proxy_set_header Connection "upgrade";');
    expect(result.config).toContain("return 301 https://$host$request_uri;");
    expect(validateBraces(result.config).balanced).toBe(true);
  });

  it("validates required values", () => {
    expect(buildNginxConfig({ ...defaultNginxOptions, listenPort: "70000" }).errors.length).toBeGreaterThan(0);
    expect(buildNginxConfig({ ...defaultNginxOptions, root: "relative/path" }).errors[0]).toContain("absolute");
    expect(buildNginxConfig({ ...defaultNginxOptions, serverName: "bad name!" }).errors.length).toBeGreaterThan(0);
    expect(
      buildNginxConfig({
        ...defaultNginxOptions,
        mode: "proxy",
        proxyTarget: "localhost:3000",
      }).errors.length,
    ).toBeGreaterThan(0);
    expect(buildNginxConfig({ ...defaultNginxOptions, clientMaxBodySize: "ten" }).errors.length).toBeGreaterThan(0);
  });

  it("warns about proxy trailing slashes", () => {
    const result = buildNginxConfig({
      ...defaultNginxOptions,
      mode: "proxy",
      proxyTarget: "http://localhost:3000/",
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain("trailing slash");
  });

  it("validates braces outside quotes and comments", () => {
    expect(validateBraces("server {\n}\n").balanced).toBe(true);
    expect(validateBraces("server {\n").errors[0]).toContain("Missing");
    expect(validateBraces("}\n").errors[0]).toContain("unexpected");
    expect(validateBraces('set $a "{";\n# } comment\n').balanced).toBe(true);
  });
});
