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
    className={`rounded-2xl border p-8 text-center ${
      tone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-dashed border-stone-300 bg-white/60 text-stone-600"
    }`}
  >
    <p className={`font-medium ${tone === "error" ? "" : "text-stone-800"}`}>{title}</p>
    {children && <div className="mt-2 text-sm">{children}</div>}
  </div>
);

export default StatusMessage;
