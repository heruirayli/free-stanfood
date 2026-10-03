import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { APP_NAME } from "../constants";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";

interface PageProps {
  title: string;
  // Browser tab title, if it should differ from the heading.
  documentTitle?: string;
  wide?: boolean;
  children: ReactNode;
}

// Shared page shell: consistent heading, a per-page document title, and a short
// fade-in on navigation. Focus moves to the heading after navigation.
const Page = ({ title, documentTitle = title, wide = false, children }: PageProps) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useFocusOnNavigate(heading);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={wide ? "" : "mx-auto max-w-2xl"}
    >
      <title>{`${documentTitle} · ${APP_NAME}`}</title>
      <header className="mb-6">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-stone-900 focus:outline-none sm:text-4xl"
        >
          {title}
        </h1>
      </header>
      {children}
    </motion.div>
  );
};

export default Page;
