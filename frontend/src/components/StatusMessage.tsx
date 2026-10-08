import type { ReactNode } from "react";

interface StatusMessageProps {
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "error";
}

// Explicit empty and error states for event lists.
const StatusMessage = ({ title, children, tone = "neutral" }: StatusMessageProps) => (
  <div
    role={tone === "error" ? "alert" : undefined}
    className={`rounded-xl px-6 py-8 text-center ${
      tone === "error" ? "border border-primary/30 bg-primary-soft text-ink" : "bg-surface text-ink-muted"
    }`}
  >
    <p className="text-[1.0625rem] font-semibold text-ink">{title}</p>
    {children && <div className="mt-2">{children}</div>}
  </div>
);

export default StatusMessage;
