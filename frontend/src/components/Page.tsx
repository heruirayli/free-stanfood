import { useRef, type ReactNode } from "react";
import { APP_NAME } from "../constants";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";
import { cx } from "../utils/cx";

interface PageProps {
  title: string;
  // A line under the heading, e.g. the date.
  subtitle?: string;
  // Browser tab title, if it should differ from the heading.
  documentTitle?: string;
  wide?: boolean;
  // Keep the heading for screen readers only (the calendar shows its own title).
  hideTitle?: boolean;
  children: ReactNode;
}

// Shared page shell: consistent heading, a per-page document title, and a short
// fade-in on navigation. Focus moves to the heading after navigation.
const Page = ({ title, subtitle, documentTitle = title, wide = false, hideTitle = false, children }: PageProps) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useFocusOnNavigate(heading);

  return (
    <div className={cx("animate-fade-in", !wide && "mx-auto max-w-2xl")}>
      <title>{`${documentTitle} · ${APP_NAME}`}</title>
      <header className={hideTitle ? "sr-only" : "mb-4"}>
        <h1 ref={heading} tabIndex={-1} className="text-[1.75rem] leading-tight font-bold text-ink focus:outline-none">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
};

export default Page;
