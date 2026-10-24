import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-transparent bg-surface-2 px-3.5 text-text placeholder:text-faint transition-colors focus:border-accent/50 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, "h-10 text-sm", className)} {...props} />;
  },
);

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, mono = false, rows = 8, spellCheck = false, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      spellCheck={spellCheck}
      className={cn(
        base,
        "resize-y py-2.5 text-sm leading-relaxed",
        mono && "font-mono text-[14px]",
        className,
      )}
      {...props}
    />
  );
});
