import { useEffect, type RefObject } from "react";
import { useLocation } from "react-router-dom";

// After client-side navigation, moves focus to the new page's heading so screen
// readers announce the page change. Skipped on the first page load (React Router's
// initial location key is "default"), where focus should start at the top.
export const useFocusOnNavigate = (ref: RefObject<HTMLElement | null>) => {
  const { key } = useLocation();
  useEffect(() => {
    if (key !== "default") ref.current?.focus();
  }, [key, ref]);
};
