import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

const RELOAD_KEY = "devkit:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 30_000;
const RETRY_DELAY_MS = 400;

function allowReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lazily loads a tool, retrying once. If the chunk is gone (a stale build after
 * a deploy), reload the page once to pick up the current asset manifest.
 */
export function lazyTool<T extends ComponentType<unknown>>(
  load: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await load();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        return await load();
      } catch (error) {
        if (allowReload()) {
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw error;
      }
    }
  });
}
