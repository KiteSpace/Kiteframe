import { useEffect, useState } from "react";

/**
 * Tracks the app's `.dark` class on <html>.
 *
 * Read from the DOM rather than a theme provider because the app has no theme
 * context mounted; this keeps working if one is added later.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, []);

  return dark;
}
