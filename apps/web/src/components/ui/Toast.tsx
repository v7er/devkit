import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "default" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "default") => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-2xl bg-surface-2/95 px-4 py-3 text-sm text-text shadow-xl ring-1 ring-line/60 backdrop-blur-xl animate-rise",
              item.tone === "error" && "ring-danger/25",
              item.tone === "success" && "ring-accent/25",
            )}
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            ) : item.tone === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            )}
            <span className="leading-snug">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
