import { useEffect, useMemo, useState } from "react";
import { Clipboard, ClipboardPaste, Search, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Spinner,
  TextArea,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { readClipboard } from "@/lib/clipboard";
import { useLocalStorage } from "@/lib/hooks";
import {
  appendHistory,
  MAX_CLIPBOARD_ENTRIES,
  parseHistory,
  type ClipboardEntry,
} from "./logic";

const STORAGE_KEY = "devkit.clipboard-history.entries";
const PREFERENCE_KEY = "devkit.clipboard-history.persist";

function loadStoredEntries(): ClipboardEntry[] {
  try {
    return parseHistory(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) return "Unknown time";
  return new Date(value).toLocaleString();
}

export default function ClipboardHistoryTool() {
  const [persistHistory, setPersistHistory] = useLocalStorage<boolean>(PREFERENCE_KEY, false);
  const [entries, setEntries] = useState<ClipboardEntry[]>(() =>
    persistHistory ? loadStoredEntries() : [],
  );
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [readError, setReadError] = useState("");
  const [reading, setReading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    try {
      if (persistHistory) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage can be unavailable or full; the in-memory history still works.
    }
  }, [entries, persistHistory]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => entry.text.toLowerCase().includes(needle));
  }, [entries, query]);

  function addSnippet(text: string) {
    if (!text.trim()) {
      setReadError("Nothing to add: the snippet is empty or only whitespace.");
      return;
    }
    const entry: ClipboardEntry = { id: createId(), text, addedAt: Date.now() };
    setEntries((current) => appendHistory(current, entry));
    setDraft("");
    setReadError("");
    setConfirmClear(false);
  }

  async function handleReadClipboard() {
    setReading(true);
    setReadError("");
    try {
      const text = await readClipboard();
      if (!text.trim()) {
        setReadError("The clipboard is empty or contains only whitespace.");
        return;
      }
      addSnippet(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Clipboard access failed.";
      setReadError(`${detail}. Paste into the box below instead.`);
    } finally {
      setReading(false);
    }
  }

  function clearAll() {
    setEntries([]);
    setConfirmClear(false);
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Add a snippet"
          description="Each entry is added only when you ask for it."
          actions={<Badge tone="accent">Opt-in</Badge>}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={handleReadClipboard}
                disabled={reading}
                aria-label="Read the clipboard once and add it to history"
              >
                <ClipboardPaste className="size-4" aria-hidden />
                {reading ? "Reading…" : "Read clipboard"}
              </Button>
              {reading ? <Spinner label="Waiting for permission" /> : null}
            </div>

            <Field
              label="Or paste a snippet"
              hint="Nothing is added until you press Add snippet."
            >
              <TextArea
                mono
                rows={4}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Paste text, a command, or a URL here"
                aria-label="Snippet to add"
              />
            </Field>

            <Button
              variant="secondary"
              onClick={() => addSnippet(draft)}
              disabled={!draft.trim()}
            >
              Add snippet
            </Button>

            {readError ? (
              <Alert tone="danger" title="Could not add the snippet">
                {readError}
              </Alert>
            ) : null}

            <Alert tone="warning" title="Handle sensitive text carefully">
              Clipboard contents can include passwords, tokens, or private keys. Add only what you
              are comfortable keeping in this browser.
            </Alert>
          </div>
        </Panel>

        <Panel title="Storage" description="Choose whether the history survives a reload.">
          <div className="space-y-4">
            <Toggle
              checked={persistHistory}
              onChange={setPersistHistory}
              label="Keep history after reload"
              description="Stores entries in this browser's localStorage. Turning this off removes the stored copy."
            />
            <Alert tone="info" title="Nothing is captured in the background">
              This tool never polls the clipboard and does not add entries when you copy elsewhere.
              New entries come only from the Read clipboard button or from text you paste and add.
            </Alert>
            <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              {persistHistory
                ? `Persistence is on. Up to ${MAX_CLIPBOARD_ENTRIES} snippets are stored under “${STORAGE_KEY}”.`
                : "Persistence is off. Entries live in this tab's memory and disappear when you reload."}
            </div>
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="History"
        description="Newest first. Duplicate text moves to the top instead of repeating."
        actions={
          <div className="flex items-center gap-1.5">
            <Badge>
              {entries.length} / {MAX_CLIPBOARD_ENTRIES}
            </Badge>
            {confirmClear ? (
              <>
                <Button variant="danger" size="sm" onClick={clearAll}>
                  Confirm clear all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmClear(true)}
                disabled={entries.length === 0}
              >
                Clear all
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Search">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by text"
              aria-label="Search history"
            />
          </Field>

          {entries.length === 0 ? (
            <EmptyState
              icon={<Clipboard className="size-5" aria-hidden />}
              title="No snippets yet"
              description="Press Read clipboard or paste text and add it. The tool waits for your action."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" aria-hidden />}
              title="No matches"
              description="No stored snippet contains that search text."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
                    {entry.text}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-faint">
                      {formatTimestamp(entry.addedAt)} · {entry.text.length} characters
                    </span>
                    <div className="flex items-center gap-1">
                      <CopyButton value={entry.text} size="sm" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
                        aria-label="Remove this snippet"
                        title="Remove this snippet"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </ToolStack>
  );
}
