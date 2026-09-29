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
    className={`rounded-xl border p-6 text-center ${
      tone === "error" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-gray-200 bg-white text-gray-700"
    }`}
  >
    <p className="font-semibold">{title}</p>
    {children && <div className="mt-2 text-sm">{children}</div>}
  </div>
);

export default StatusMessage;
