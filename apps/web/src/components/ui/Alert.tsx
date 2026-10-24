import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { className: string; icon: ReactNode }> = {
  info: {
    className: "bg-info-soft text-info",
    icon: <Info className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  success: {
    className: "bg-accent-soft text-accent",
    icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  warning: {
    className: "bg-warning-soft text-warning",
    icon: <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  danger: {
    className: "bg-danger-soft text-danger",
    icon: <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = tones[tone];
  return (
    <div
      className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-xs", config.className, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {config.icon}
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && "mt-0.5", "text-current/90")}>{children}</div>
      </div>
    </div>
  );
}
