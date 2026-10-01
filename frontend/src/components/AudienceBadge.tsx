import type { IconType } from "react-icons";
import { FaDoorOpen, FaLock, FaQuestionCircle, FaRegCalendarCheck } from "react-icons/fa";
import type { Audience } from "../types/event";

interface AudienceBadgeProps {
  audience: Audience;
}

const AUDIENCE_STYLES: Record<Audience, { label: string; Icon: IconType }> = {
  open: { label: "Open to all", Icon: FaDoorOpen },
  rsvp: { label: "RSVP required", Icon: FaRegCalendarCheck },
  restricted: { label: "Restricted", Icon: FaLock },
  unknown: { label: "Audience unknown", Icon: FaQuestionCircle },
};

const AudienceBadge = ({ audience }: AudienceBadgeProps) => {
  const { label, Icon } = AUDIENCE_STYLES[audience];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700">
      <Icon aria-hidden="true" className="text-stone-500" />
      {label}
    </span>
  );
};

export default AudienceBadge;
