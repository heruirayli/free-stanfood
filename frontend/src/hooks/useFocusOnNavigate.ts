import { useEffect, type RefObject } from "react";
import { useLocation } from "react-router-dom";

// After client-side navigation to a new page, moves focus to its heading so
// screen readers announce the change. Skipped on the first page load (React
// Router's initial location key is "default"), where focus should start at the top.
// Runs only when the path changes: the filters rewrite the query string (and so
// the location key) as you type, and that must leave focus in the search box.
export const useFocusOnNavigate = (ref: RefObject<HTMLElement | null>) => {
  const { key, pathname } = useLocation();
  useEffect(() => {
    if (key !== "default") ref.current?.focus();
    // `key` is read, not watched: a new key with the same path isn't a new page.
  }, [pathname, ref]); // eslint-disable-line react-hooks/exhaustive-deps
};
