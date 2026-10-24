import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-5 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          devkit v1.0.0 · MIT licensed ·{" "}
          <Link
            to="/download"
            className="text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-text"
          >
            Desktop app
          </Link>
        </p>
        <p>Your input never leaves this device.</p>
      </div>
    </footer>
  );
}
