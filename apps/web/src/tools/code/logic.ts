import { parse as acornParse } from "acorn";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { parseDocument, stringify } from "yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ------------------------------------------------------------------ */
/* chmod                                                               */
/* ------------------------------------------------------------------ */

export type PermissionRole = "owner" | "group" | "other";
export type PermissionName = "read" | "write" | "execute";
export type SpecialBit = "setuid" | "setgid" | "sticky";

export interface ChmodBits {
  owner: Record<PermissionName, boolean>;
  group: Record<PermissionName, boolean>;
  other: Record<PermissionName, boolean>;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export class ChmodError extends Error {}

const ROLE_SHIFT: Record<PermissionRole, number> = { owner: 6, group: 3, other: 0 };
const PERMISSION_VALUE: Record<PermissionName, number> = { read: 4, write: 2, execute: 1 };
const SPECIAL_VALUE: Record<SpecialBit, number> = { setuid: 0o4000, setgid: 0o2000, sticky: 0o1000 };

export function parseOctalMode(value: string): number {
  const trimmed = value.trim().replace(/^0o/i, "");
  if (!/^[0-7]{3,4}$/.test(trimmed)) {
    throw new ChmodError("Enter three or four octal digits (for example 755 or 4755).");
  }
  return Number.parseInt(trimmed, 8);
}

export function modeBits(mode: number): ChmodBits {
  const roleBits = (role: PermissionRole) => {
    const bits = (mode >> ROLE_SHIFT[role]) & 0o7;
    return {
      read: (bits & 4) !== 0,
      write: (bits & 2) !== 0,
      execute: (bits & 1) !== 0,
    };
  };
  return {
    owner: roleBits("owner"),
    group: roleBits("group"),
    other: roleBits("other"),
    setuid: (mode & SPECIAL_VALUE.setuid) !== 0,
    setgid: (mode & SPECIAL_VALUE.setgid) !== 0,
    sticky: (mode & SPECIAL_VALUE.sticky) !== 0,
  };
}

export function bitsToMode(bits: ChmodBits): number {
  let mode = 0;
  for (const role of ["owner", "group", "other"] as PermissionRole[]) {
    for (const permission of ["read", "write", "execute"] as PermissionName[]) {
      if (bits[role][permission]) mode |= PERMISSION_VALUE[permission] << ROLE_SHIFT[role];
    }
  }
  for (const bit of ["setuid", "setgid", "sticky"] as SpecialBit[]) {
    if (bits[bit]) mode |= SPECIAL_VALUE[bit];
  }
  return mode;
}

export function setPermission(
  mode: number,
  role: PermissionRole,
  permission: PermissionName,
  enabled: boolean,
): number {
  const mask = PERMISSION_VALUE[permission] << ROLE_SHIFT[role];
  return enabled ? mode | mask : mode & ~mask;
}

export function setSpecial(mode: number, bit: SpecialBit, enabled: boolean): number {
  return enabled ? mode | SPECIAL_VALUE[bit] : mode & ~SPECIAL_VALUE[bit];
}

export function modeToOctal(mode: number): string {
  const octal = (mode & 0o7777).toString(8);
  return octal.padStart(mode > 0o777 ? 4 : 3, "0");
}

export function modeToSymbolic(mode: number): string {
  const bits = modeBits(mode);
  const role = (value: Record<PermissionName, boolean>, special: "setuid" | "setgid" | "sticky" | null) => {
    const read = value.read ? "r" : "-";
    const write = value.write ? "w" : "-";
    let execute = value.execute ? "x" : "-";
    if (special && bits[special]) execute = value.execute ? "s" : "S";
    if (special === "sticky" && bits.sticky) execute = value.execute ? "t" : "T";
    return `${read}${write}${execute}`;
  };
  return `${role(bits.owner, "setuid")}${role(bits.group, "setgid")}${role(bits.other, "sticky")}`;
}

export function modeToSymbolicSet(mode: number): string {
  const bits = modeBits(mode);
  const value = (role: Record<PermissionName, boolean>) =>
    `${role.read ? "r" : ""}${role.write ? "w" : ""}${role.execute ? "x" : ""}` || "-";
  return `u=${value(bits.owner)},g=${value(bits.group)},o=${value(bits.other)}`;
}

export function parseSymbolic(value: string): number {
  const trimmed = value.trim();
  const symbolic = trimmed.startsWith("-") ? trimmed.slice(1) : trimmed;
  if (!/^[r-][w-][xsStT-][r-][w-][xsStT-][r-][w-][xsStT-]$/.test(symbolic)) {
    throw new ChmodError("Use nine symbolic characters, for example rwxr-xr-x.");
  }
  const permission = (segment: string): number => {
    let bits = 0;
    if (segment[0] === "r") bits |= 4;
    if (segment[1] === "w") bits |= 2;
    if (segment[2] === "x" || segment[2] === "s" || segment[2] === "t") bits |= 1;
    return bits;
  };
  let mode = 0;
  mode |= permission(symbolic.slice(0, 3)) << 6;
  mode |= permission(symbolic.slice(3, 6)) << 3;
  mode |= permission(symbolic.slice(6, 9));
  if (symbolic[2] === "s" || symbolic[2] === "S") mode |= SPECIAL_VALUE.setuid;
  if (symbolic[5] === "s" || symbolic[5] === "S") mode |= SPECIAL_VALUE.setgid;
  if (symbolic[8] === "t" || symbolic[8] === "T") mode |= SPECIAL_VALUE.sticky;
  return mode;
}

export function modeToChmodCommand(mode: number, target: string, recursive = false): string {
  const path = shellQuote(target.trim() || "path");
  return `chmod ${recursive ? "-R " : ""}${modeToOctal(mode)} ${path}`;
}

/* ------------------------------------------------------------------ */
/* git helper                                                          */
/* ------------------------------------------------------------------ */

export type GitCommandKind =
  | "commit"
  | "branch"
  | "rebase"
  | "cherry-pick"
  | "reset"
  | "stash"
  | "push";

export interface GitCommandInput {
  kind: GitCommandKind;
  message: string;
  all: boolean;
  amend: boolean;
  noVerify: boolean;
  signoff: boolean;
  branchName: string;
  startPoint: string;
  checkout: boolean;
  branchForce: boolean;
  upstream: string;
  interactive: boolean;
  autosquash: boolean;
  autostash: boolean;
  rebaseAction: "start" | "continue" | "abort";
  commits: string;
  noCommit: boolean;
  cherryPickAction: "start" | "continue" | "abort";
  resetMode: "soft" | "mixed" | "hard";
  target: string;
  stashAction: "push" | "pop" | "apply" | "drop" | "list" | "clear";
  stashRef: string;
  includeUntracked: boolean;
  keepIndex: boolean;
  remote: string;
  branch: string;
  setUpstream: boolean;
  forceWithLease: boolean;
  tags: boolean;
  dryRun: boolean;
}

export const defaultGitInput: GitCommandInput = {
  kind: "commit",
  message: "",
  all: false,
  amend: false,
  noVerify: false,
  signoff: false,
  branchName: "",
  startPoint: "",
  checkout: true,
  branchForce: false,
  upstream: "origin/main",
  interactive: false,
  autosquash: false,
  autostash: false,
  rebaseAction: "start",
  commits: "",
  noCommit: false,
  cherryPickAction: "start",
  resetMode: "mixed",
  target: "HEAD~1",
  stashAction: "push",
  stashRef: "",
  includeUntracked: false,
  keepIndex: false,
  remote: "origin",
  branch: "",
  setUpstream: false,
  forceWithLease: false,
  tags: false,
  dryRun: false,
};

export interface GitCommandResult {
  command: string;
  explanation: string[];
  warnings: string[];
  error: string;
}

const SAFE_SHELL_VALUE = /^[A-Za-z0-9_@%+=:,./~-]+$/;

export function shellQuote(value: string): string {
  if (value === "") return "''";
  if (SAFE_SHELL_VALUE.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function isValidRefName(value: string): boolean {
  if (!value || value.startsWith("-")) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) return false;
  if (value.startsWith("/") || value.endsWith("/")) return false;
  if (value.includes("..") || value.includes("//") || value.includes("@{")) return false;
  if (value.endsWith(".lock") || value.endsWith(".")) return false;
  return true;
}

function isValidRevision(value: string): boolean {
  if (!value || value.startsWith("-")) return false;
  if (!/^[A-Za-z0-9._/~^-]+$/.test(value)) return false;
  if (value.includes("..") || value.includes("//")) return false;
  if (value.startsWith("/") || value.endsWith("/") || value.endsWith(".") || value.endsWith(".lock")) return false;
  return true;
}

function joinCommand(args: string[]): string {
  return ["git", ...args].map((part) => (part.startsWith("--") || part.startsWith("-") ? part : shellQuote(part))).join(" ");
}

export function buildGitCommand(input: GitCommandInput): GitCommandResult {
  const warnings: string[] = [];
  const explanation: string[] = [];
  const args: string[] = [];
  const fail = (error: string): GitCommandResult => ({ command: "", explanation: [], warnings, error });

  switch (input.kind) {
    case "commit": {
      const message = input.message.trim();
      if (!message && !input.amend) return fail("Add a commit message, or enable amend to reuse the previous message.");
      args.push("commit");
      if (input.all) {
        args.push("-a");
        explanation.push("-a: Stage tracked files that were modified or deleted.");
      }
      if (input.amend) {
        args.push("--amend");
        explanation.push("--amend: Replace the previous commit instead of adding a new one.");
        warnings.push("Amending rewrites the last commit. Do not amend a commit that has already been pushed to a shared branch.");
      }
      if (input.noVerify) {
        args.push("--no-verify");
        explanation.push("--no-verify: Skip Git hooks such as pre-commit and commit-msg.");
      }
      if (input.signoff) {
        args.push("--signoff");
        explanation.push("--signoff: Add a Signed-off-by trailer with your configured identity.");
      }
      if (message) {
        args.push("-m", message);
        explanation.push("-m: Use the given text as the commit message.");
      } else {
        args.push("--no-edit");
        explanation.push("--no-edit: Keep the previous commit message unchanged.");
      }
      break;
    }
    case "branch": {
      const name = input.branchName.trim();
      if (!isValidRefName(name)) return fail("Enter a valid branch name without spaces or a leading dash.");
      const start = input.startPoint.trim();
      if (start && !isValidRevision(start)) return fail("The starting point is not a valid branch or revision name.");
      if (input.checkout) {
        args.push("switch", "-c", name);
        if (start) args.push(start);
        explanation.push("switch -c: Create the branch and check it out immediately.");
        if (start) explanation.push("Starting point: Branch from this commit instead of HEAD.");
      } else {
        args.push("branch");
        if (input.branchForce) {
          args.push("-f");
          explanation.push("-f: Move an existing branch to the new starting point.");
          warnings.push("Forcing branches can discard commits that were only reachable from the old branch tip.");
        }
        args.push(name);
        if (start) args.push(start);
        explanation.push("branch: Create the branch without switching to it.");
      }
      break;
    }
    case "rebase": {
      if (input.rebaseAction === "continue") {
        args.push("rebase", "--continue");
        explanation.push("--continue: Resume the rebase after resolving conflicts.");
        break;
      }
      if (input.rebaseAction === "abort") {
        args.push("rebase", "--abort");
        explanation.push("--abort: Stop the rebase and restore the original branch state.");
        break;
      }
      const upstream = input.upstream.trim();
      if (!isValidRefName(upstream)) return fail("Enter a valid upstream branch, for example origin/main.");
      args.push("rebase");
      if (input.interactive) {
        args.push("-i");
        explanation.push("-i: Open the todo list to reorder, squash, or edit commits.");
      }
      if (input.autosquash) {
        args.push("--autosquash");
        explanation.push("--autosquash: Reorder fixup! and squash! commits next to their targets.");
      }
      if (input.autostash) {
        args.push("--autostash");
        explanation.push("--autostash: Stash local changes before the rebase and reapply them afterwards.");
      }
      args.push(upstream);
      explanation.push("upstream: Replay your commits on top of this branch.");
      warnings.push("Rebasing rewrites commit hashes. Avoid rebasing commits that other people already pulled.");
      break;
    }
    case "cherry-pick": {
      if (input.cherryPickAction === "continue") {
        args.push("cherry-pick", "--continue");
        explanation.push("--continue: Continue after resolving a conflict.");
        break;
      }
      if (input.cherryPickAction === "abort") {
        args.push("cherry-pick", "--abort");
        explanation.push("--abort: Cancel the sequence and restore the previous state.");
        break;
      }
      const commits = input.commits.trim().split(/\s+/).filter(Boolean);
      if (commits.length === 0) return fail("Enter at least one commit hash to cherry-pick.");
      if (commits.some((commit) => !/^[A-Za-z0-9._/-]+$/.test(commit) || commit.startsWith("-"))) {
        return fail("Commit hashes may only contain letters, numbers, dots, slashes, and dashes.");
      }
      args.push("cherry-pick");
      if (input.noCommit) {
        args.push("-n");
        explanation.push("-n: Apply the changes without creating a commit.");
      }
      args.push(...commits);
      explanation.push("commits: Apply each commit to the current branch in the order given.");
      warnings.push("Cherry-picking creates new commits with different hashes from the originals.");
      break;
    }
    case "reset": {
      const target = input.target.trim();
      if (!isValidRevision(target)) return fail("Enter a valid commit or revision, for example HEAD~1.");
      args.push("reset", `--${input.resetMode}`, target);
      explanation.push(`--${input.resetMode}: Reset ${resetModeHelp(input.resetMode)}.`);
      if (input.resetMode === "hard") {
        warnings.push("A hard reset permanently discards uncommitted changes and untracked files are not touched.");
      }
      if (input.resetMode === "soft") {
        warnings.push("A soft reset leaves the changes staged so you can recommit them.");
      }
      break;
    }
    case "stash": {
      if (input.stashAction === "list") {
        args.push("stash", "list");
        explanation.push("list: Show the saved stash entries.");
        break;
      }
      if (input.stashAction === "clear") {
        args.push("stash", "clear");
        explanation.push("clear: Remove every stash entry.");
        warnings.push("Cleared stash entries cannot be recovered.");
        break;
      }
      if (input.stashAction === "push") {
        args.push("stash", "push");
        if (input.includeUntracked) {
          args.push("-u");
          explanation.push("-u: Include untracked files in the stash.");
        }
        if (input.keepIndex) {
          args.push("--keep-index");
          explanation.push("--keep-index: Leave staged changes in the working tree.");
        }
        if (input.message.trim()) {
          args.push("-m", input.message.trim());
          explanation.push("-m: Attach a message to the stash entry.");
        }
        break;
      }
      args.push("stash", input.stashAction);
      if (input.stashRef.trim()) args.push(input.stashRef.trim());
      if (input.stashAction === "drop") warnings.push("Dropping a stash removes it permanently.");
      explanation.push(`${input.stashAction}: ${input.stashAction === "pop" ? "Apply the stash and remove it." : input.stashAction === "apply" ? "Apply the stash and keep it saved." : "Remove the stash entry without applying it."}`);
      break;
    }
    case "push": {
      const remote = input.remote.trim();
      if (!isValidRefName(remote)) return fail("Enter a valid remote name, for example origin.");
      const branch = input.branch.trim();
      if (branch && !isValidRefName(branch)) return fail("Enter a valid branch name or leave it empty.");
      if (input.setUpstream && !branch) return fail("Set an upstream requires a branch name.");
      args.push("push");
      args.push(remote);
      if (branch) args.push(branch);
      if (input.setUpstream) {
        args.push("-u");
        explanation.push("-u: Record the remote branch as the upstream for future pushes and pulls.");
      }
      if (input.forceWithLease) {
        args.push("--force-with-lease");
        explanation.push("--force-with-lease: Overwrite the remote branch only if it has not moved since your last fetch.");
        warnings.push("Force-pushing can overwrite commits on the remote. Fetch first and prefer --force-with-lease over --force.");
      }
      if (input.tags) {
        args.push("--tags");
        explanation.push("--tags: Push all local tags along with the branch.");
      }
      if (input.dryRun) {
        args.push("--dry-run");
        explanation.push("--dry-run: Show what would be pushed without changing the remote.");
      }
      break;
    }
    default: {
      return fail("Choose a Git command to build.");
    }
  }

  return { command: joinCommand(args), explanation, warnings, error: "" };
}

function resetModeHelp(mode: "soft" | "mixed" | "hard"): string {
  if (mode === "soft") return "the branch pointer only, keeping changes staged";
  if (mode === "mixed") return "the branch pointer and index, leaving changes in the working tree";
  return "the branch pointer, index, and working tree";
}

/* ------------------------------------------------------------------ */
/* .env formatter                                                      */
/* ------------------------------------------------------------------ */

export interface EnvIssue {
  line: number;
  kind: "duplicate" | "invalid-name" | "malformed";
  message: string;
}

export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  leadingComments: string[];
  inlineComment: string;
}

export interface EnvFormatOptions {
  sortKeys?: boolean;
  dedupe?: boolean;
  quoteValues?: boolean;
  preserveComments?: boolean;
  exportPrefix?: boolean;
}

export interface EnvFormatResult {
  output: string;
  keyCount: number;
  keys: string[];
  issues: EnvIssue[];
  duplicateKeys: string[];
}

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function splitEnvValue(raw: string): { value: string; inlineComment: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed[0];
    let escaped = false;
    for (let index = 1; index < trimmed.length; index += 1) {
      const character = trimmed[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) {
        const rest = trimmed.slice(index + 1).trim();
        const comment = rest.startsWith("#") ? rest.slice(1).trim() : "";
        return { value: trimmed.slice(0, index + 1), inlineComment: comment };
      }
    }
    return { value: trimmed, inlineComment: "" };
  }
  const match = /^(.*?)(?:\s+#\s?(.*))?$/.exec(trimmed);
  if (!match) return { value: trimmed, inlineComment: "" };
  return { value: match[1].trim(), inlineComment: (match[2] ?? "").trim() };
}

export function quoteEnvValue(value: string): string {
  if (/^"(?:[^"\\]|\\.)*"$/.test(value) || /^'(?:[^'\\]|\\.)*'$/.test(value)) return value;
  if (value === "" || /[\s#"'\\`]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function formatEnv(source: string, options: EnvFormatOptions = {}): EnvFormatResult {
  const { sortKeys = false, dedupe = false, quoteValues = false, preserveComments = true, exportPrefix = false } = options;
  const lines = source.split(/\r?\n/);
  const entries: EnvEntry[] = [];
  const issues: EnvIssue[] = [];
  const headerComments: string[] = [];
  let pendingComments: string[] = [];
  let seenEntry = false;
  let trailingComments: string[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("#")) {
      if (!seenEntry) headerComments.push(trimmed);
      else pendingComments.push(trimmed);
      return;
    }
    const body = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trimStart() : trimmed;
    const equals = body.indexOf("=");
    if (equals <= 0) {
      issues.push({
        line: lineNumber,
        kind: "malformed",
        message: `Line ${lineNumber}: expected KEY=value, found "${trimmed}".`,
      });
      return;
    }
    const key = body.slice(0, equals).trim();
    if (!ENV_KEY.test(key)) {
      issues.push({
        line: lineNumber,
        kind: "invalid-name",
        message: `Line ${lineNumber}: "${key}" is not a valid environment variable name.`,
      });
      return;
    }
    const { value, inlineComment } = splitEnvValue(body.slice(equals + 1));
    entries.push({
      key,
      value,
      line: lineNumber,
      leadingComments: pendingComments,
      inlineComment,
    });
    pendingComments = [];
    seenEntry = true;
  });

  trailingComments = pendingComments;
  const occurrences = new Map<string, number>();
  const duplicateKeys: string[] = [];
  for (const entry of entries) {
    const count = (occurrences.get(entry.key) ?? 0) + 1;
    occurrences.set(entry.key, count);
    if (count > 1) {
      if (!duplicateKeys.includes(entry.key)) duplicateKeys.push(entry.key);
      issues.push({
        line: entry.line,
        kind: "duplicate",
        message: `Line ${entry.line}: duplicate key "${entry.key}".`,
      });
    }
  }

  const lastIndexByKey = new Map<string, number>();
  entries.forEach((entry, index) => lastIndexByKey.set(entry.key, index));
  const kept = dedupe ? entries.filter((entry, index) => lastIndexByKey.get(entry.key) === index) : entries.slice();
  if (sortKeys) kept.sort((a, b) => a.key.localeCompare(b.key));

  const outputLines: string[] = [];
  if (preserveComments && headerComments.length > 0) {
    outputLines.push(...headerComments);
    if (kept.length > 0) outputLines.push("");
  }
  for (const entry of kept) {
    if (preserveComments && entry.leadingComments.length > 0) outputLines.push(...entry.leadingComments);
    const value = quoteValues ? quoteEnvValue(entry.value) : entry.value;
    const prefix = exportPrefix ? "export " : "";
    const comment = preserveComments && entry.inlineComment ? ` # ${entry.inlineComment}` : "";
    outputLines.push(`${prefix}${entry.key}=${value}${comment}`);
  }
  if (preserveComments && trailingComments.length > 0) {
    if (outputLines.length > 0) outputLines.push("");
    outputLines.push(...trailingComments);
  }

  return {
    output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
    keyCount: kept.length,
    keys: [...new Set(entries.map((entry) => entry.key))],
    issues,
    duplicateKeys,
  };
}

/* ------------------------------------------------------------------ */
/* docker compose                                                      */
/* ------------------------------------------------------------------ */

export interface ComposeValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  services: string[];
  volumes: string[];
  networks: string[];
}

export function validateCompose(source: string): ComposeValidation {
  const empty: ComposeValidation = { ok: false, errors: [], warnings: [], services: [], volumes: [], networks: [] };
  if (!source.trim()) return { ...empty, errors: ["Paste a Compose file to validate."] };

  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return {
      ...empty,
      errors: document.errors.map((error) => {
        const position = error.linePos?.[0];
        return position
          ? `Line ${position.line}, column ${position.col}: ${error.message}`
          : error.message;
      }),
    };
  }

  const data: unknown = document.toJS();
  if (!isRecord(data)) return { ...empty, errors: ["The Compose file must contain a mapping at the top level."] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const services: string[] = [];

  if ("version" in data) {
    warnings.push('The top-level "version" key is obsolete in Compose v2 and can be removed.');
  }

  const serviceMap = data.services;
  if (!isRecord(serviceMap)) {
    errors.push('Missing required top-level "services" mapping.');
  } else if (Object.keys(serviceMap).length === 0) {
    errors.push('The "services" mapping is empty. Add at least one service.');
  } else {
    for (const [name, service] of Object.entries(serviceMap)) {
      services.push(name);
      if (!isRecord(service)) {
        errors.push(`Service "${name}" must be a mapping of keys.`);
        continue;
      }
      if (!("image" in service) && !("build" in service)) {
        errors.push(`Service "${name}" needs an "image" or "build" key.`);
      }
      if ("ports" in service && !Array.isArray(service.ports)) {
        errors.push(`Service "${name}": "ports" must be a list.`);
      }
      if ("volumes" in service && !Array.isArray(service.volumes)) {
        errors.push(`Service "${name}": "volumes" must be a list.`);
      }
      if ("environment" in service) {
        const environment = service.environment;
        const validEnvironment = Array.isArray(environment) || isRecord(environment);
        if (!validEnvironment) errors.push(`Service "${name}": "environment" must be a list or mapping.`);
      }
      if ("depends_on" in service) {
        const dependsOn = service.depends_on;
        const validDependsOn = Array.isArray(dependsOn) || isRecord(dependsOn);
        if (!validDependsOn) errors.push(`Service "${name}": "depends_on" must be a list or mapping.`);
      }
      if ("restart" in service && typeof service.restart !== "string") {
        errors.push(`Service "${name}": "restart" must be a string.`);
      }
    }
  }

  const namedVolumes = isRecord(data.volumes) ? Object.keys(data.volumes) : [];
  const namedNetworks = isRecord(data.networks) ? Object.keys(data.networks) : [];
  if ("volumes" in data && !isRecord(data.volumes)) {
    errors.push('The top-level "volumes" key must be a mapping.');
  }
  if ("networks" in data && !isRecord(data.networks)) {
    errors.push('The top-level "networks" key must be a mapping.');
  }

  return { ok: errors.length === 0, errors, warnings, services, volumes: namedVolumes, networks: namedNetworks };
}

export interface ComposePreset {
  id: string;
  label: string;
  description: string;
  service: Record<string, unknown>;
  dependsOn?: string[];
}

export const COMPOSE_PRESETS: ComposePreset[] = [
  {
    id: "node",
    label: "Node.js",
    description: "Node 22 with a source bind mount and a dependency volume.",
    service: {
      image: "node:22-alpine",
      working_dir: "/app",
      command: ["sh", "-c", "npm install && npm run dev"],
      ports: ["3000:3000"],
      environment: { NODE_ENV: "development" },
      volumes: ["./:/app", "node-modules:/app/node_modules"],
    },
  },
  {
    id: "nginx",
    label: "Nginx",
    description: "Static or reverse proxy front end on port 8080.",
    service: {
      image: "nginx:alpine",
      ports: ["8080:80"],
      restart: "unless-stopped",
    },
  },
  {
    id: "postgres",
    label: "PostgreSQL",
    description: "Postgres 16 with a persistent data volume.",
    service: {
      image: "postgres:16-alpine",
      ports: ["5432:5432"],
      environment: {
        POSTGRES_USER: "devkit",
        POSTGRES_PASSWORD: "devkit",
        POSTGRES_DB: "devkit",
      },
      volumes: ["postgres-data:/var/lib/postgresql/data"],
    },
  },
  {
    id: "mysql",
    label: "MySQL",
    description: "MySQL 8.4 with a persistent data volume.",
    service: {
      image: "mysql:8.4",
      ports: ["3306:3306"],
      environment: {
        MYSQL_ROOT_PASSWORD: "devkit",
        MYSQL_DATABASE: "devkit",
      },
      volumes: ["mysql-data:/var/lib/mysql"],
    },
  },
  {
    id: "redis",
    label: "Redis",
    description: "Redis 7 with append-only persistence.",
    service: {
      image: "redis:7-alpine",
      command: ["redis-server", "--appendonly", "yes"],
      ports: ["6379:6379"],
      volumes: ["redis-data:/data"],
    },
  },
  {
    id: "mongo",
    label: "MongoDB",
    description: "MongoDB 7 with a persistent data volume.",
    service: {
      image: "mongo:7",
      ports: ["27017:27017"],
      volumes: ["mongo-data:/data/db"],
    },
  },
  {
    id: "adminer",
    label: "Adminer",
    description: "Database UI on port 8081 for Postgres or MySQL.",
    service: {
      image: "adminer:latest",
      ports: ["8081:8080"],
      restart: "unless-stopped",
    },
    dependsOn: ["postgres", "mysql"],
  },
  {
    id: "mailpit",
    label: "Mailpit",
    description: "Local SMTP catcher with a web inbox.",
    service: {
      image: "axllent/mailpit:latest",
      ports: ["8025:8025", "1025:1025"],
      restart: "unless-stopped",
    },
  },
];

const COMPOSE_VOLUME_NAMES: Record<string, string[]> = {
  node: ["node-modules"],
  postgres: ["postgres-data"],
  mysql: ["mysql-data"],
  redis: ["redis-data"],
  mongo: ["mongo-data"],
};

export interface ComposeGeneration {
  text: string;
  error: string;
}

export function generateCompose(selectedIds: string[], projectName = ""): ComposeGeneration {
  const name = projectName.trim();
  if (name && !/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
    return {
      text: "",
      error: 'Project name must start with a lowercase letter or digit and contain only a-z, 0-9, "-", and "_".',
    };
  }
  const chosen = COMPOSE_PRESETS.filter((preset) => selectedIds.includes(preset.id));
  if (chosen.length === 0) return { text: "", error: "Select at least one service to generate a Compose file." };

  const services: Record<string, Record<string, unknown>> = {};
  const volumes: Record<string, Record<string, never>> = {};
  for (const preset of chosen) {
    const service: Record<string, unknown> = JSON.parse(JSON.stringify(preset.service)) as Record<string, unknown>;
    const dependencies = (preset.dependsOn ?? []).filter((dependency) => selectedIds.includes(dependency));
    if (dependencies.length > 0) service.depends_on = dependencies;
    services[preset.id] = service;
    for (const volume of COMPOSE_VOLUME_NAMES[preset.id] ?? []) volumes[volume] = {};
  }

  const document: Record<string, unknown> = {};
  if (name) document.name = name;
  document.services = services;
  if (Object.keys(volumes).length > 0) document.volumes = volumes;
  return { text: stringify(document, { lineWidth: 0 }), error: "" };
}

/* ------------------------------------------------------------------ */
/* .gitignore                                                          */
/* ------------------------------------------------------------------ */

export interface GitignorePreset {
  id: string;
  label: string;
  description: string;
  patterns: string[];
}

export const GITIGNORE_PRESETS: GitignorePreset[] = [
  {
    id: "node",
    label: "Node.js",
    description: "Dependencies, build output, logs, and local env files.",
    patterns: [
      "node_modules/",
      ".pnpm-store/",
      "dist/",
      "build/",
      "coverage/",
      ".cache/",
      ".next/",
      ".nuxt/",
      ".svelte-kit/",
      ".turbo/",
      ".parcel-cache/",
      "*.log",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "pnpm-debug.log*",
      ".env",
      ".env.*",
      "!.env.example",
    ],
  },
  {
    id: "python",
    label: "Python",
    description: "Bytecode, virtual environments, caches, and packaging output.",
    patterns: [
      "__pycache__/",
      "*.py[cod]",
      ".venv/",
      "venv/",
      "env/",
      ".pytest_cache/",
      ".mypy_cache/",
      ".ruff_cache/",
      ".coverage",
      "htmlcov/",
      ".ipynb_checkpoints/",
      "*.egg-info/",
      "dist/",
      "build/",
    ],
  },
  {
    id: "go",
    label: "Go",
    description: "Compiled binaries, test output, and workspace files.",
    patterns: ["bin/", "*.exe", "*.test", "*.out", "go.work", "go.work.sum", "vendor/"],
  },
  {
    id: "rust",
    label: "Rust",
    description: "Cargo build artifacts and editor backups.",
    patterns: ["target/", "**/*.rs.bk", "*.pdb"],
  },
  {
    id: "java",
    label: "Java",
    description: "Gradle, Maven, and IDE build output.",
    patterns: ["*.class", "*.jar", "*.war", "target/", "build/", "out/", ".gradle/", "!.mvn/wrapper/maven-wrapper.jar"],
  },
  {
    id: "macos",
    label: "macOS",
    description: "Finder metadata and system folders.",
    patterns: [".DS_Store", ".AppleDouble", ".LSOverride", "Icon?", "._*", ".Spotlight-V100", ".Trashes", ".fseventsd"],
  },
  {
    id: "windows",
    label: "Windows",
    description: "Thumbnail caches, shortcuts, and recycle bin data.",
    patterns: ["Thumbs.db", "ehthumbs.db", "Desktop.ini", "$RECYCLE.BIN/", "*.lnk"],
  },
  {
    id: "editors",
    label: "Editors",
    description: "JetBrains, VS Code, Vim, and Eclipse workspace files.",
    patterns: [".idea/", ".vscode/*", "!.vscode/extensions.json", "*.swp", "*.swo", "*~", ".project", ".classpath", ".settings/"],
  },
];

export interface GitignoreResult {
  text: string;
  patternCount: number;
  duplicatesRemoved: number;
  unknown: string[];
  sections: Array<{ id: string; label: string; count: number }>;
}

export function mergeGitignore(selectedIds: string[]): GitignoreResult {
  const known = new Set(GITIGNORE_PRESETS.map((preset) => preset.id));
  const selected = new Set(selectedIds);
  const unknown = selectedIds.filter((id) => !known.has(id));
  const seen = new Set<string>();
  const sections: Array<{ id: string; label: string; count: number }> = [];
  const blocks: string[] = [];
  let duplicatesRemoved = 0;

  for (const preset of GITIGNORE_PRESETS) {
    if (!selected.has(preset.id)) continue;
    const patterns: string[] = [];
    for (const pattern of preset.patterns) {
      if (seen.has(pattern)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(pattern);
      patterns.push(pattern);
    }
    if (patterns.length === 0) continue;
    sections.push({ id: preset.id, label: preset.label, count: patterns.length });
    blocks.push(`# ${preset.label}\n${patterns.join("\n")}`);
  }

  if (blocks.length === 0) {
    return { text: "", patternCount: 0, duplicatesRemoved, unknown, sections };
  }

  const chosenLabels = sections.map((section) => section.label).join(", ");
  const header = `# Generated with devkit .gitignore Generator\n# Presets: ${chosenLabels}`;
  return {
    text: `${header}\n\n${blocks.join("\n\n")}\n`,
    patternCount: seen.size,
    duplicatesRemoved,
    unknown,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* JavaScript AST                                                      */
/* ------------------------------------------------------------------ */

export interface AstTreeNode {
  id: string;
  type: string;
  label: string;
  detail: string;
  location: string;
  children: AstTreeNode[];
}

export interface AstParseResult {
  tree: AstTreeNode | null;
  nodeCount: number;
  truncated: boolean;
  error: string;
  errorLine: number | null;
  errorColumn: number | null;
}

const AST_METADATA_KEYS = new Set(["type", "start", "end", "loc", "range", "raw"]);

function isAstNode(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.type === "string";
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") {
    const rendered = JSON.stringify(value);
    return rendered.length > 60 ? `${rendered.slice(0, 57)}…` : rendered;
  }
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function nodeLocation(node: Record<string, unknown>): string {
  const loc = node.loc;
  if (!isRecord(loc) || !isRecord(loc.start) || !isRecord(loc.end)) return "";
  const start = loc.start;
  const end = loc.end;
  if (typeof start.line !== "number" || typeof start.column !== "number") return "";
  if (typeof end.line !== "number" || typeof end.column !== "number") return "";
  return `${start.line}:${start.column + 1}–${end.line}:${end.column + 1}`;
}

interface AstBuildState {
  count: number;
  limit: number;
  truncated: boolean;
}

function buildAstNode(node: Record<string, unknown>, label: string, state: AstBuildState): AstTreeNode | null {
  if (state.count >= state.limit) {
    state.truncated = true;
    return null;
  }
  state.count += 1;
  const details: string[] = [];
  const children: AstTreeNode[] = [];
  const type = typeof node.type === "string" ? node.type : "Unknown";

  for (const [key, value] of Object.entries(node)) {
    if (AST_METADATA_KEYS.has(key)) continue;
    if (isAstNode(value)) {
      const child = buildAstNode(value, key, state);
      if (child) children.push(child);
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const item: unknown = value[index];
        if (isAstNode(item)) {
          const child = buildAstNode(item, `${key}[${index}]`, state);
          if (child) children.push(child);
        }
      }
      if (value.length === 0) details.push(`${key}: []`);
      continue;
    }
    if (value === null || ["string", "number", "boolean", "bigint"].includes(typeof value)) {
      const formatted = formatPrimitive(value);
      if (formatted) details.push(`${key}: ${formatted}`);
      continue;
    }
    if (isRecord(value)) {
      const pattern = formatPrimitive(value.pattern);
      const flags = formatPrimitive(value.flags);
      if (pattern) details.push(`${key}: /${pattern}/${flags.replace(/^"|"$/g, "")}`);
    }
  }

  return {
    id: `${state.count}-${label || type}`,
    type,
    label,
    detail: details.join(", "),
    location: nodeLocation(node),
    children,
  };
}

export function parseJavaScript(source: string, sourceType: "module" | "script" = "module", maxNodes = 5000): AstParseResult {
  try {
    const program = acornParse(source, {
      ecmaVersion: "latest",
      sourceType,
      locations: true,
    });
    const state: AstBuildState = { count: 0, limit: maxNodes, truncated: false };
    const tree = buildAstNode(program as unknown as Record<string, unknown>, "", state);
    return {
      tree,
      nodeCount: state.count,
      truncated: state.truncated,
      error: "",
      errorLine: null,
      errorColumn: null,
    };
  } catch (error) {
    const located = error as { message?: unknown; loc?: { line?: unknown; column?: unknown } };
    const message = typeof located.message === "string" ? located.message : "Could not parse this JavaScript.";
    const line = typeof located.loc?.line === "number" ? located.loc.line : null;
    const column = typeof located.loc?.column === "number" ? located.loc.column + 1 : null;
    return {
      tree: null,
      nodeCount: 0,
      truncated: false,
      error: message,
      errorLine: line,
      errorColumn: column,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Code screenshot                                                     */
/* ------------------------------------------------------------------ */

export const SCREENSHOT_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Shell" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "sql", label: "SQL" },
  { value: "css", label: "CSS" },
  { value: "xml", label: "HTML / XML" },
  { value: "yaml", label: "YAML" },
];

export interface ScreenshotTheme {
  id: string;
  label: string;
  background: string;
  foreground: string;
  gutter: string;
  lineNumber: string;
  colors: Record<string, string>;
}

export const SCREENSHOT_THEMES: ScreenshotTheme[] = [
  {
    id: "dark",
    label: "Devkit Dark",
    background: "#0d1117",
    foreground: "#e6edf3",
    gutter: "#30363d",
    lineNumber: "#8b949e",
    colors: {
      keyword: "#ff7b72",
      string: "#a5d6ff",
      comment: "#8b949e",
      number: "#79c0ff",
      literal: "#79c0ff",
      function: "#d2a8ff",
      title: "#d2a8ff",
      type: "#ffa657",
      variable: "#ffa657",
      attr: "#79c0ff",
      attribute: "#79c0ff",
      tag: "#7ee787",
      name: "#7ee787",
      operator: "#ff7b72",
      punctuation: "#e6edf3",
      meta: "#8b949e",
      built_in: "#ffa657",
      symbol: "#a5d6ff",
      section: "#d2a8ff",
      regexp: "#a5d6ff",
      "selector-tag": "#7ee787",
    },
  },
  {
    id: "light",
    label: "Paper Light",
    background: "#ffffff",
    foreground: "#24292f",
    gutter: "#d0d7de",
    lineNumber: "#6e7781",
    colors: {
      keyword: "#cf222e",
      string: "#0a3069",
      comment: "#6e7781",
      number: "#0550ae",
      literal: "#0550ae",
      function: "#8250df",
      title: "#8250df",
      type: "#953800",
      variable: "#953800",
      attr: "#0550ae",
      attribute: "#0550ae",
      tag: "#116329",
      name: "#116329",
      operator: "#cf222e",
      punctuation: "#24292f",
      meta: "#6e7781",
      built_in: "#953800",
      symbol: "#0a3069",
      section: "#8250df",
      regexp: "#0a3069",
      "selector-tag": "#116329",
    },
  },
];

export function screenshotThemeById(id: string): ScreenshotTheme {
  return SCREENSHOT_THEMES.find((theme) => theme.id === id) ?? SCREENSHOT_THEMES[0];
}

export function themeColor(theme: ScreenshotTheme, scope: string): string {
  if (!scope) return theme.foreground;
  const direct = theme.colors[scope];
  if (direct) return direct;
  const scopeFamily = scope.split("-")[0];
  return theme.colors[scopeFamily] ?? theme.foreground;
}

export interface CodeToken {
  text: string;
  scope: string;
}

export interface HighlightResult {
  lines: CodeToken[][];
  error: string;
}

export function highlightCode(code: string, language: string): HighlightResult {
  if (!code) return { lines: [], error: "" };
  try {
    const html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    const document = new DOMParser().parseFromString(html, "text/html");
    const lines: CodeToken[][] = [[]];

    const appendText = (text: string, scope: string) => {
      const segments = text.split("\n");
      segments.forEach((segment, index) => {
        if (index > 0) lines.push([]);
        if (segment) lines[lines.length - 1].push({ text: segment, scope });
      });
    };

    const walk = (node: Node, scope: string) => {
      if (node.nodeType === 3) {
        appendText(node.textContent ?? "", scope);
        return;
      }
      if (node.nodeType !== 1) return;
      const element = node as HTMLElement;
      const classes = (element.getAttribute("class") ?? "").split(/\s+/);
      const tokenClass = classes.find((name) => name.startsWith("hljs-"));
      const nextScope = tokenClass ? tokenClass.slice("hljs-".length) : scope;
      for (const child of Array.from(element.childNodes)) walk(child, nextScope);
    };

    for (const child of Array.from(document.body.childNodes)) walk(child, "");
    return { lines, error: "" };
  } catch (error) {
    return {
      lines: [],
      error: error instanceof Error ? error.message : "Could not highlight this code.",
    };
  }
}

export function expandTabs(line: string, tabSize = 2): string {
  let output = "";
  for (const character of line) {
    if (character === "\t") {
      const spaces = tabSize - (output.length % tabSize);
      output += " ".repeat(spaces);
    } else {
      output += character;
    }
  }
  return output;
}

export interface ScreenshotLayoutInput {
  lineCount: number;
  maxLineLength: number;
  fontSize: number;
  padding: number;
  showLineNumbers: boolean;
}

export interface ScreenshotLayout {
  width: number;
  height: number;
  lineHeight: number;
  charWidth: number;
  gutterWidth: number;
  codeWidth: number;
}

export function computeScreenshotLayout(input: ScreenshotLayoutInput): ScreenshotLayout {
  const fontScale = 0.6;
  const lineCount = Math.max(input.lineCount, 1);
  const charWidth = input.fontSize * fontScale;
  const lineHeight = Math.round(input.fontSize * 1.6);
  const digits = String(lineCount).length;
  const gutterWidth = input.showLineNumbers ? Math.ceil(digits * charWidth + 24) : 0;
  const codeWidth = Math.max(input.maxLineLength, 1) * charWidth;
  const width = Math.min(2400, Math.max(360, Math.ceil(input.padding * 2 + gutterWidth + codeWidth + input.padding)));
  const height = Math.min(6000, Math.max(160, Math.ceil(input.padding * 2 + lineCount * lineHeight)));
  return { width, height, lineHeight, charWidth, gutterWidth, codeWidth };
}

export function screenshotFilename(value: string): string {
  const base = value
    .trim()
    .replace(/\.[A-Za-z0-9]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "code-screenshot"}.png`;
}

/* ------------------------------------------------------------------ */
/* Nginx                                                               */
/* ------------------------------------------------------------------ */

export interface NginxOptions {
  mode: "static" | "proxy";
  serverName: string;
  listenPort: string;
  root: string;
  proxyTarget: string;
  ssl: boolean;
  certPath: string;
  keyPath: string;
  websocket: boolean;
  gzip: boolean;
  clientMaxBodySize: string;
  redirectHttp: boolean;
}

export const defaultNginxOptions: NginxOptions = {
  mode: "static",
  serverName: "example.com",
  listenPort: "80",
  root: "/var/www/site",
  proxyTarget: "http://localhost:3000",
  ssl: false,
  certPath: "/etc/letsencrypt/live/example.com/fullchain.pem",
  keyPath: "/etc/letsencrypt/live/example.com/privkey.pem",
  websocket: false,
  gzip: true,
  clientMaxBodySize: "10m",
  redirectHttp: true,
};

export interface NginxBuildResult {
  config: string;
  errors: string[];
  warnings: string[];
}

export function validateBraces(config: string): { balanced: boolean; errors: string[] } {
  const errors: string[] = [];
  let depth = 0;
  let line = 1;
  let quote: string | null = null;

  for (let index = 0; index < config.length; index += 1) {
    const character = config[index];
    if (character === "\n") {
      line += 1;
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#") {
      while (index < config.length && config[index] !== "\n") index += 1;
      line += 1;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth < 0) {
        errors.push(`Line ${line}: unexpected closing brace.`);
        depth = 0;
      }
    }
  }

  if (depth > 0) errors.push(`Missing ${depth} closing ${depth === 1 ? "brace" : "braces"}.`);
  return { balanced: errors.length === 0, errors };
}

function isValidServerNameList(value: string): boolean {
  const names = value.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return false;
  return names.every((name) => name === "_" || /^(\*\.)?[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(name));
}

export function buildNginxConfig(options: NginxOptions): NginxBuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const serverName = options.serverName.trim();
  const port = Number(options.listenPort.trim());

  if (!isValidServerNameList(serverName)) {
    errors.push("Enter a valid server name, for example example.com, *.example.com, or _.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("Listen port must be a whole number between 1 and 65535.");
  }
  if (options.mode === "static") {
    const root = options.root.trim();
    if (!root) {
      errors.push("A document root is required for a static site.");
    } else if (!root.startsWith("/")) {
      errors.push("The document root must be an absolute path starting with /.");
    } else if (/\s/.test(root)) {
      errors.push("The document root cannot contain spaces.");
    }
  } else {
    const target = options.proxyTarget.trim();
    if (!/^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(target)) {
      errors.push("Proxy target must be an http:// or https:// URL, for example http://localhost:3000.");
    } else if (target.endsWith("/")) {
      warnings.push("A trailing slash in proxy_pass replaces the matched location prefix. Keep it only if that is intended.");
    }
  }

  if (options.ssl) {
    if (!options.certPath.trim().startsWith("/")) errors.push("Certificate path must be an absolute path.");
    if (!options.keyPath.trim().startsWith("/")) errors.push("Certificate key path must be an absolute path.");
    if (serverName === "_") warnings.push("A wildcard server name cannot serve SNI-based certificates to most clients.");
  }

  const bodySize = options.clientMaxBodySize.trim();
  if (bodySize && !/^\d+[kKmMgG]?$/.test(bodySize)) {
    errors.push('Client body size must look like 10m, 512k, or 0 for unlimited.');
  }

  if (errors.length > 0) return { config: "", errors, warnings };

  const lines: string[] = [];
  const push = (value: string) => lines.push(value);
  const indented = (value: string) => lines.push(`    ${value}`);
  const names = serverName;

  if (options.ssl && options.redirectHttp) {
    push("server {");
    indented("listen 80;");
    indented(`server_name ${names};`);
    indented("return 301 https://$host$request_uri;");
    push("}");
    push("");
  }

  push("server {");
  indented(`listen ${port}${options.ssl ? " ssl" : ""};`);
  indented(`server_name ${names};`);
  if (options.ssl) {
    indented(`ssl_certificate ${options.certPath.trim()};`);
    indented(`ssl_certificate_key ${options.keyPath.trim()};`);
    indented("ssl_protocols TLSv1.2 TLSv1.3;");
    indented("ssl_session_cache shared:SSL:10m;");
  }
  push("");
  if (options.mode === "static") {
    indented(`root ${options.root.trim()};`);
    indented("index index.html;");
    push("");
    indented("location / {");
    indented("    try_files $uri $uri/ =404;");
    indented("}");
  } else {
    const target = options.proxyTarget.trim();
    indented("location / {");
    indented(`    proxy_pass ${target};`);
    indented("    proxy_http_version 1.1;");
    indented("    proxy_set_header Host $host;");
    indented("    proxy_set_header X-Real-IP $remote_addr;");
    indented("    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
    indented("    proxy_set_header X-Forwarded-Proto $scheme;");
    if (options.websocket) {
      indented('    proxy_set_header Upgrade $http_upgrade;');
      indented('    proxy_set_header Connection "upgrade";');
    }
    indented("}");
  }

  if (options.gzip) {
    push("");
    indented("gzip on;");
    indented("gzip_types text/plain text/css application/javascript application/json image/svg+xml;");
  }
  if (bodySize) {
    indented(`client_max_body_size ${bodySize};`);
  }
  push("}");

  const config = `${lines.join("\n")}\n`;
  const braces = validateBraces(config);
  if (!braces.balanced) {
    return { config: "", errors: braces.errors, warnings };
  }
  return { config, errors: [], warnings };
}
