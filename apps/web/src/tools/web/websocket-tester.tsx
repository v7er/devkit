import { useEffect, useRef, useState } from "react";
import { Eraser, Plug, Send, Unplug } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  describeSocketData,
  formatLogTime,
  validateWebSocketUrl,
  WebSocketUrlError,
} from "./logic";

type Status = "idle" | "connecting" | "open" | "closing";

interface LogEntry {
  id: number;
  time: string;
  direction: "in" | "out" | "system";
  text: string;
}

const STATUS_LABELS: Record<Status, string> = {
  idle: "Disconnected",
  connecting: "Connecting",
  open: "Connected",
  closing: "Closing",
};

export default function WebSocketTesterTool() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    return () => {
      socketRef.current?.close(1000, "Component unmounted");
      socketRef.current = null;
    };
  }, []);

  function append(direction: LogEntry["direction"], text: string) {
    const entry: LogEntry = {
      id: nextIdRef.current,
      time: formatLogTime(new Date()),
      direction,
      text,
    };
    nextIdRef.current += 1;
    setLog((current) => [...current.slice(-299), entry]);
  }

  function connect() {
    let target: string;
    try {
      target = validateWebSocketUrl(url);
    } catch (caught) {
      setError(caught instanceof WebSocketUrlError ? caught.message : "Enter a valid WebSocket URL.");
      return;
    }

    setError("");
    socketRef.current?.close(1000, "Reconnecting");
    setStatus("connecting");
    append("system", `Connecting to ${target}`);

    const socket = new WebSocket(target);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("open");
      append("system", "Connection opened");
    };
    socket.onmessage = (event: MessageEvent) => {
      append("in", describeSocketData(event.data));
    };
    socket.onerror = () => {
      setError("The connection reported an error. Check that the server accepts browser clients.");
    };
    socket.onclose = (event) => {
      append("system", `Connection closed (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`);
      if (socketRef.current === socket) {
        socketRef.current = null;
        setStatus("idle");
      }
    };
  }

  function disconnect() {
    const socket = socketRef.current;
    if (!socket) return;
    setStatus("closing");
    socket.close(1000, "User disconnected");
  }

  function send() {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Open a connection before sending a message.");
      return;
    }
    if (!message) return;
    try {
      socket.send(message);
      append("out", message);
      setMessage("");
      setError("");
    } catch {
      setError("The message could not be sent.");
    }
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Connection"
          description="The browser connects directly to the server you enter. Nothing connects until you press Connect."
        >
          <div className="space-y-3">
            <Field
              label="WebSocket URL"
              hint="Use ws:// for plain connections or wss:// for TLS. Custom headers cannot be set from the browser."
            >
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="wss://echo.websocket.events"
                aria-label="WebSocket URL"
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={connect}
                disabled={status === "connecting" || status === "open" || status === "closing"}
              >
                <Plug className="size-3.5" aria-hidden />
                Connect
              </Button>
              <Button
                variant="secondary"
                onClick={disconnect}
                disabled={status !== "open" && status !== "connecting"}
              >
                <Unplug className="size-3.5" aria-hidden />
                Disconnect
              </Button>
              <Badge tone={status === "open" ? "accent" : status === "connecting" ? "warning" : "neutral"}>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            {error ? (
              <Alert tone="danger" title="WebSocket error">
                {error}
              </Alert>
            ) : null}
          </div>
        </Panel>

        <Panel title="Send a text message" description="Only text frames are supported; binary frames are logged by size.">
          <div className="space-y-3">
            <Field label="Message">
              <TextArea
                mono
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder='{"type":"ping"}'
                aria-label="Message to send"
              />
            </Field>
            <Button variant="secondary" onClick={send} disabled={status !== "open" || !message}>
              <Send className="size-3.5" aria-hidden />
              Send
            </Button>
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="Event log"
        description={`${log.length} entr${log.length === 1 ? "y" : "ies"}; newest stays at the bottom.`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLog([])}
            disabled={log.length === 0}
          >
            <Eraser className="size-3.5" aria-hidden />
            Clear log
          </Button>
        }
      >
        {log.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="Connect to a WebSocket server to see open, message, and close events here."
          />
        ) : (
          <ol className="max-h-80 space-y-1.5 overflow-auto">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-2 rounded-md border border-line bg-surface-2/40 px-2.5 py-2"
              >
                <span className="shrink-0 font-mono text-[10px] text-faint">{entry.time}</span>
                <Badge
                  tone={
                    entry.direction === "in"
                      ? "accent"
                      : entry.direction === "out"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {entry.direction === "in" ? "in" : entry.direction === "out" ? "out" : "system"}
                </Badge>
                <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-text">
                  {entry.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </ToolStack>
  );
}
