import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageProps {
  title: string;
  wide?: boolean;
  children: ReactNode;
}

// Shared page shell: consistent heading and a short fade-in on navigation.
const Page = ({ title, wide = false, children }: PageProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className={wide ? "" : "mx-auto max-w-2xl"}
  >
    <header className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
    </header>
    {children}
  </motion.div>
);

export default Page;
