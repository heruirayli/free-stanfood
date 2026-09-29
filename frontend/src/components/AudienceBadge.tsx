import type { IconType } from "react-icons";
import { FaDoorOpen, FaLock, FaQuestionCircle, FaRegCalendarCheck } from "react-icons/fa";
import type { Audience } from "../types/event";

interface AudienceBadgeProps {
  audience: Audience;
}

const AUDIENCE_STYLES: Record<Audience, { label: string; Icon: IconType; className: string }> = {
  open: { label: "Open to all", Icon: FaDoorOpen, className: "bg-sky-100 text-sky-900 ring-sky-300" },
  rsvp: {
    label: "RSVP required",
    Icon: FaRegCalendarCheck,
    className: "bg-violet-100 text-violet-900 ring-violet-300",
  },
  restricted: { label: "Restricted", Icon: FaLock, className: "bg-rose-100 text-rose-900 ring-rose-300" },
  unknown: {
    label: "Audience unknown",
    Icon: FaQuestionCircle,
    className: "bg-gray-100 text-gray-800 ring-gray-300",
  },
};

const AudienceBadge = ({ audience }: AudienceBadgeProps) => {
  const { label, Icon, className } = AUDIENCE_STYLES[audience];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
};

export default AudienceBadge;
