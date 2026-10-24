import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";
import { SearchPaletteProvider } from "@/app/palette";

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [paletteOpen]);

  const openSearch = () => setPaletteOpen(true);

  return (
    <SearchPaletteProvider value={openSearch}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
        >
          Skip to content
        </a>

        <TopBar onSearch={openSearch} />

        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
        >
          <Outlet />
        </main>

        <Footer />

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </SearchPaletteProvider>
  );
}
