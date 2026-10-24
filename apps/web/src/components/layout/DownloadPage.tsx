import { Apple, Check, Download, HardDrive, Laptop, Monitor, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { CopyButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { tools } from "@/tools/registry";

const VERSION = "1.0.0";

interface Release {
  name: string;
  detail: string;
  file: string;
  href: string;
  size: string;
  requirements: string;
  icon: LucideIcon;
  sha256: string;
  platform: "mac" | "windows";
}

const RELEASES: Release[] = [
  {
    name: "macOS",
    detail: "Universal build for Apple Silicon and Intel.",
    file: "devkit_1.0.0_universal.dmg",
    href: "/downloads/devkit_1.0.0_universal.dmg",
    size: "11.1 MB",
    requirements: "macOS 11 or later",
    icon: Apple,
    sha256: "e3d8b2a1eb1b7b64f925b041bb6597a2657302964e78bec1ad1ca39807216fd0",
    platform: "mac",
  },
  {
    name: "Windows",
    detail: "64-bit installer for modern PCs.",
    file: "devkit_1.0.0_x64-setup.exe",
    href: "/downloads/devkit_1.0.0_x64-setup.exe",
    size: "4.5 MB",
    requirements: "Windows 10 or 11 · 64-bit",
    icon: Monitor,
    sha256: "8102239b109a8a1c49a812e967655dd5da4f4bd8fe53c0bc6ff7c619e120488a",
    platform: "windows",
  },
];

function detectPlatform(): Release["platform"] | null {
  const platform = navigator.platform;
  if (/Mac/.test(platform)) return "mac";
  if (/Win/.test(platform)) return "windows";
  return null;
}

function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function DownloadPage() {
  const current = detectPlatform();

  if (isDesktopApp()) {
    return (
      <div className="animate-fade-in">
        <section className="mx-auto max-w-xl pb-16 pt-12 text-center sm:pt-20">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2 text-text">
            <Laptop className="size-6" aria-hidden />
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-text sm:text-5xl">
            You&apos;re running devkit v{VERSION}.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-muted">
            All {tools.length} tools are available offline in this window. The native build updates
            through a fresh installer from the website.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-strong"
          >
            Open the toolbox
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <section className="mx-auto max-w-2xl pb-10 pt-4 text-center sm:pb-14 sm:pt-10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
          Desktop app
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-text sm:text-5xl">
          {tools.length} tools. One native window.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
          The full devkit toolbox for macOS and Windows. Everything runs locally, so it keeps
          working when the network doesn&apos;t.
        </p>
      </section>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {RELEASES.map((release) => {
          const Icon = release.icon;
          const recommended = current === release.platform;
          return (
            <section
              key={release.platform}
              className={cn(
                "flex flex-col rounded-panel bg-surface p-6 shadow-panel ring-1 ring-line/60",
                recommended && "ring-2 ring-accent/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text">
                  <Icon className="size-5" aria-hidden />
                </span>
                {recommended ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">
                    <Check className="size-3" aria-hidden />
                    Your platform
                  </span>
                ) : null}
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-tight text-text">{release.name}</h2>
              <p className="mt-1 text-sm text-muted">{release.detail}</p>

              <dl className="mt-5 space-y-1.5 border-t border-line/70 pt-4 text-[13px] text-faint">
                <div className="flex items-center justify-between gap-3">
                  <dt>Version</dt>
                  <dd className="text-muted">v{VERSION}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Download</dt>
                  <dd className="text-muted">
                    {release.size} · .{release.file.split(".").pop()}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Requires</dt>
                  <dd className="text-right text-muted">{release.requirements}</dd>
                </div>
              </dl>

              <a
                href={release.href}
                download={release.file}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-strong"
              >
                <Download className="size-4" aria-hidden />
                Download for {release.name}
              </a>
            </section>
          );
        })}
      </div>

      <section className="mx-auto mt-10 max-w-3xl rounded-panel bg-surface p-5 shadow-panel ring-1 ring-line/60 sm:p-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4.5 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold text-text">Before you install</h2>
        </div>

        <div className="mt-4 grid gap-5 text-sm leading-relaxed text-muted sm:grid-cols-2">
          <div>
            <p className="font-medium text-text">macOS</p>
            <p className="mt-1">
              Open the disk image and drag <span className="text-text">devkit</span> into
              Applications. The build is unsigned, so on first launch use right-click → Open, or
              allow it in System Settings → Privacy &amp; Security.
            </p>
          </div>
          <div>
            <p className="font-medium text-text">Windows</p>
            <p className="mt-1">
              Run the installer and follow the prompts. If SmartScreen appears, choose More info →
              Run anyway. devkit installs per user and does not require administrator access.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2.5 border-t border-line/70 pt-4 text-[13px] leading-relaxed text-faint">
          <HardDrive className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            The desktop app shares the same local-first engine as the web version. It needs no
            account and sends no telemetry.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-3xl">
        <h2 className="text-sm font-semibold text-text">Checksums</h2>
        <p className="mt-1 text-xs text-faint">
          Verify a download with <code className="font-mono">shasum -a 256</code> on macOS or{" "}
          <code className="font-mono">certutil -hashfile</code> on Windows.
        </p>
        <div className="mt-4 space-y-2">
          {RELEASES.map((release) => (
            <div
              key={release.platform}
              className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-line/60"
            >
              <span className="w-20 shrink-0 text-[13px] font-medium text-text">
                {release.name}
              </span>
              <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-faint">
                {release.sha256 || "Available with the release build"}
              </code>
              <CopyButton
                value={release.sha256}
                size="icon"
                label={`Copy ${release.name} checksum`}
                disabled={!release.sha256}
              />
            </div>
          ))}
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-3xl border-t border-line pt-6 text-center text-xs leading-relaxed text-faint">
        Prefer the browser?{" "}
        <Link to="/" className="text-muted underline decoration-line-strong underline-offset-2 hover:text-text">
          Use all {tools.length} tools on the web
        </Link>
        .
      </p>
    </div>
  );
}
