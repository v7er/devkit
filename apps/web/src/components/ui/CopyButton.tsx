import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { useCopyState } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { useToast } from "./Toast";

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "sm",
  variant = "ghost",
  disabled,
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "icon";
  variant?: "ghost" | "secondary";
  disabled?: boolean;
}) {
  const { copied, markCopied } = useCopyState();
  const { push } = useToast();

  async function handleCopy() {
    try {
      await copyText(value);
      markCopied();
    } catch {
      push("Could not copy to the clipboard", "error");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={disabled || !value}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn(copied && "text-accent", className)}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {size !== "icon" ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}
