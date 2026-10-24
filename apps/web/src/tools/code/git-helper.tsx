import { useMemo, useState } from "react";
import { GitBranch, RefreshCw, Terminal } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  buildGitCommand,
  defaultGitInput,
  type GitCommandInput,
  type GitCommandKind,
} from "./logic";

const KIND_OPTIONS: Array<{ value: GitCommandKind; label: string }> = [
  { value: "commit", label: "Commit" },
  { value: "branch", label: "Create branch" },
  { value: "rebase", label: "Rebase" },
  { value: "cherry-pick", label: "Cherry-pick" },
  { value: "reset", label: "Reset" },
  { value: "stash", label: "Stash" },
  { value: "push", label: "Push" },
];

const DESTRUCTIVE_WARNING = /rewrite|discard|overwrite|permanently|cannot be recovered/i;

export default function GitHelperTool() {
  const [input, setInput] = useState<GitCommandInput>(defaultGitInput);
  const result = useMemo(() => buildGitCommand(input), [input]);

  const update = <K extends keyof GitCommandInput>(key: K, value: GitCommandInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const destructive =
    result.warnings.some((warning) => DESTRUCTIVE_WARNING.test(warning)) ||
    (input.kind === "reset" && input.resetMode === "hard") ||
    (input.kind === "stash" && input.stashAction === "clear");

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Command builder"
          description="Every field maps to one flag, shown in the explanation panel."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInput({ ...defaultGitInput, kind: input.kind })}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Reset
            </Button>
          }
        >
          <div className="space-y-4">
            <Select
              label="Git command"
              value={input.kind}
              onChange={(value) => update("kind", value as GitCommandKind)}
              options={KIND_OPTIONS}
            />

            {input.kind === "commit" ? (
              <div className="space-y-3">
                <Field
                  label="Commit message"
                  htmlFor="git-commit-message"
                  hint="Used with -m. Leave empty only when amending."
                >
                  <TextArea
                    id="git-commit-message"
                    rows={3}
                    value={input.message}
                    onChange={(event) => update("message", event.target.value)}
                    placeholder="feat: add the thing"
                    aria-label="Commit message"
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle
                    label="Stage tracked changes (-a)"
                    description="Adds modified and deleted files."
                    checked={input.all}
                    onChange={(checked) => update("all", checked)}
                  />
                  <Toggle
                    label="Amend (--amend)"
                    description="Replace the previous commit."
                    checked={input.amend}
                    onChange={(checked) => update("amend", checked)}
                  />
                  <Toggle
                    label="Skip hooks (--no-verify)"
                    description="Bypass pre-commit and commit-msg."
                    checked={input.noVerify}
                    onChange={(checked) => update("noVerify", checked)}
                  />
                  <Toggle
                    label="Sign off (--signoff)"
                    description="Add a Signed-off-by trailer."
                    checked={input.signoff}
                    onChange={(checked) => update("signoff", checked)}
                  />
                </div>
              </div>
            ) : null}

            {input.kind === "branch" ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Branch name" htmlFor="git-branch-name">
                    <Input
                      id="git-branch-name"
                      value={input.branchName}
                      onChange={(event) => update("branchName", event.target.value)}
                      placeholder="feature/my-change"
                      aria-label="Branch name"
                    />
                  </Field>
                  <Field
                    label="Start point"
                    htmlFor="git-branch-start"
                    hint="Optional commit or branch."
                  >
                    <Input
                      id="git-branch-start"
                      value={input.startPoint}
                      onChange={(event) => update("startPoint", event.target.value)}
                      placeholder="origin/main"
                      aria-label="Branch start point"
                    />
                  </Field>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle
                    label="Check out (switch -c)"
                    description="Create and switch in one step."
                    checked={input.checkout}
                    onChange={(checked) => update("checkout", checked)}
                  />
                  {!input.checkout ? (
                    <Toggle
                      label="Force (-f)"
                      description="Move an existing branch."
                      checked={input.branchForce}
                      onChange={(checked) => update("branchForce", checked)}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {input.kind === "rebase" ? (
              <div className="space-y-3">
                <Select
                  label="Action"
                  value={input.rebaseAction}
                  onChange={(value) => update("rebaseAction", value as GitCommandInput["rebaseAction"])}
                  options={[
                    { value: "start", label: "Start a rebase" },
                    { value: "continue", label: "Continue after conflicts" },
                    { value: "abort", label: "Abort and restore" },
                  ]}
                />
                {input.rebaseAction === "start" ? (
                  <>
                    <Field label="Upstream" htmlFor="git-rebase-upstream" hint="Branch to replay onto.">
                      <Input
                        id="git-rebase-upstream"
                        value={input.upstream}
                        onChange={(event) => update("upstream", event.target.value)}
                        placeholder="origin/main"
                        aria-label="Rebase upstream"
                      />
                    </Field>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Toggle
                        label="Interactive (-i)"
                        checked={input.interactive}
                        onChange={(checked) => update("interactive", checked)}
                      />
                      <Toggle
                        label="Autosquash"
                        checked={input.autosquash}
                        onChange={(checked) => update("autosquash", checked)}
                      />
                      <Toggle
                        label="Autostash"
                        checked={input.autostash}
                        onChange={(checked) => update("autostash", checked)}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {input.kind === "cherry-pick" ? (
              <div className="space-y-3">
                <Select
                  label="Action"
                  value={input.cherryPickAction}
                  onChange={(value) =>
                    update("cherryPickAction", value as GitCommandInput["cherryPickAction"])
                  }
                  options={[
                    { value: "start", label: "Pick commits" },
                    { value: "continue", label: "Continue after conflicts" },
                    { value: "abort", label: "Abort and restore" },
                  ]}
                />
                {input.cherryPickAction === "start" ? (
                  <>
                    <Field
                      label="Commit hashes"
                      htmlFor="git-cherry-commits"
                      hint="Separate multiple hashes with spaces."
                    >
                      <Input
                        id="git-cherry-commits"
                        value={input.commits}
                        onChange={(event) => update("commits", event.target.value)}
                        placeholder="a1b2c3d 4e5f6a7"
                        className="font-mono"
                        aria-label="Commits to cherry-pick"
                      />
                    </Field>
                    <Toggle
                      label="Do not commit (-n)"
                      description="Apply changes to the working tree only."
                      checked={input.noCommit}
                      onChange={(checked) => update("noCommit", checked)}
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            {input.kind === "reset" ? (
              <div className="space-y-3">
                <Segmented
                  label="Reset mode"
                  value={input.resetMode}
                  onChange={(value) => update("resetMode", value)}
                  options={[
                    { value: "soft", label: "Soft" },
                    { value: "mixed", label: "Mixed" },
                    { value: "hard", label: "Hard" },
                  ]}
                />
                <Field label="Target revision" htmlFor="git-reset-target" hint="For example HEAD~1.">
                  <Input
                    id="git-reset-target"
                    value={input.target}
                    onChange={(event) => update("target", event.target.value)}
                    className="font-mono"
                    aria-label="Reset target"
                  />
                </Field>
              </div>
            ) : null}

            {input.kind === "stash" ? (
              <div className="space-y-3">
                <Select
                  label="Stash action"
                  value={input.stashAction}
                  onChange={(value) => update("stashAction", value as GitCommandInput["stashAction"])}
                  options={[
                    { value: "push", label: "Save changes (push)" },
                    { value: "pop", label: "Pop and remove" },
                    { value: "apply", label: "Apply and keep" },
                    { value: "drop", label: "Drop an entry" },
                    { value: "list", label: "List entries" },
                    { value: "clear", label: "Clear all entries" },
                  ]}
                />
                {input.stashAction === "push" ? (
                  <>
                    <Field label="Stash message" htmlFor="git-stash-message" hint="Optional label (-m).">
                      <Input
                        id="git-stash-message"
                        value={input.message}
                        onChange={(event) => update("message", event.target.value)}
                        placeholder="work in progress"
                        aria-label="Stash message"
                      />
                    </Field>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Include untracked (-u)"
                        checked={input.includeUntracked}
                        onChange={(checked) => update("includeUntracked", checked)}
                      />
                      <Toggle
                        label="Keep index (--keep-index)"
                        checked={input.keepIndex}
                        onChange={(checked) => update("keepIndex", checked)}
                      />
                    </div>
                  </>
                ) : null}
                {input.stashAction === "pop" ||
                input.stashAction === "apply" ||
                input.stashAction === "drop" ? (
                  <Field label="Stash reference" htmlFor="git-stash-ref" hint="Optional, such as stash@{1}.">
                    <Input
                      id="git-stash-ref"
                      value={input.stashRef}
                      onChange={(event) => update("stashRef", event.target.value)}
                      className="font-mono"
                      aria-label="Stash reference"
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {input.kind === "push" ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Remote" htmlFor="git-push-remote">
                    <Input
                      id="git-push-remote"
                      value={input.remote}
                      onChange={(event) => update("remote", event.target.value)}
                      placeholder="origin"
                      aria-label="Push remote"
                    />
                  </Field>
                  <Field label="Branch" htmlFor="git-push-branch" hint="Leave empty to use the current branch.">
                    <Input
                      id="git-push-branch"
                      value={input.branch}
                      onChange={(event) => update("branch", event.target.value)}
                      placeholder="main"
                      aria-label="Push branch"
                    />
                  </Field>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle
                    label="Set upstream (-u)"
                    checked={input.setUpstream}
                    onChange={(checked) => update("setUpstream", checked)}
                  />
                  <Toggle
                    label="Force with lease"
                    description="Refuse to overwrite unseen remote work."
                    checked={input.forceWithLease}
                    onChange={(checked) => update("forceWithLease", checked)}
                  />
                  <Toggle
                    label="Push tags (--tags)"
                    checked={input.tags}
                    onChange={(checked) => update("tags", checked)}
                  />
                  <Toggle
                    label="Dry run"
                    description="Report what would be pushed."
                    checked={input.dryRun}
                    onChange={(checked) => update("dryRun", checked)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Generated command"
          description="Run it from the repository root."
          actions={
            destructive ? <Badge tone="warning">Destructive</Badge> : <Badge tone="accent">Safe</Badge>
          }
        >
          <div className="space-y-4">
            {result.error ? (
              <Alert tone="danger" title="Cannot build this command">
                {result.error}
              </Alert>
            ) : (
              <CodeOutput
                value={result.command}
                language="bash"
                filename="git-command.sh"
                placeholder="Fill in the form to build a command"
                maxHeight={140}
                wrap={false}
              />
            )}

            {result.warnings.map((warning) => (
              <Alert key={warning} tone="warning" title="Review before running">
                {warning}
              </Alert>
            ))}

            {result.explanation.length > 0 ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted">
                  <Terminal className="size-3.5" aria-hidden />
                  Flag reference
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted">
                  {result.explanation.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-line-strong" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.command ? (
              <p className="flex items-center gap-1.5 text-xs text-faint">
                <GitBranch className="size-3.5" aria-hidden />
                Review the command against your working tree before running it.
              </p>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
