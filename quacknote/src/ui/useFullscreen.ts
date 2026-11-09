import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

export function useFullscreen(onError: (message: string) => void) {
  const [fullscreen, setFullscreen] = useState(false);
  const changing = useRef(false);

  const toggle = useCallback(async () => {
    if (changing.current) return;
    changing.current = true;
    try {
      if (isTauri()) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const window = getCurrentWindow();
        const next = !(await window.isFullscreen());
        await window.setFullscreen(next);
        setFullscreen(next);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (reason) {
      onError(`Could not change fullscreen mode: ${String(reason)}`);
    } finally { changing.current = false; }
  }, [onError]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const browserChanged = () => setFullscreen(!!document.fullscreenElement);
    if (isTauri()) {
      void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
        const window = getCurrentWindow();
        const sync = async () => {
          const active = await window.isFullscreen();
          if (!disposed) setFullscreen(active);
        };
        await sync();
        const stop = await window.onResized(() => { void sync().catch(() => {}); });
        if (disposed) stop(); else unlisten = stop;
      }).catch((reason) => { if (!disposed) onError(String(reason)); });
    } else {
      document.addEventListener("fullscreenchange", browserChanged);
    }
    const shortcut = (event: KeyboardEvent) => {
      // Keep browser F11 behavior intact; the native window needs our handler.
      if (!isTauri() || event.defaultPrevented) return;
      const exit = event.key === "Escape" && fullscreen && !document.querySelector("dialog[open]");
      if (event.key !== "F11" && !exit) return;
      event.preventDefault();
      if (!event.repeat) void toggle();
    };
    window.addEventListener("keydown", shortcut, true);
    return () => {
      disposed = true;
      unlisten?.();
      document.removeEventListener("fullscreenchange", browserChanged);
      window.removeEventListener("keydown", shortcut, true);
    };
  }, [fullscreen, toggle, onError]);

  return { fullscreen, toggle };
}
