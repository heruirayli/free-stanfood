import { HOST_REMOVAL_EMAIL } from "../constants";

const SUBJECT = encodeURIComponent("Removal request: Free Stanfood listing");

// "Host? Request removal" mailto link. Hidden if no address is configured.
const RemovalLink = ({
  className = "font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900",
}: {
  className?: string;
}) => {
  if (!HOST_REMOVAL_EMAIL) return null;
  return (
    <a href={`mailto:${HOST_REMOVAL_EMAIL}?subject=${SUBJECT}`} className={className}>
      Host? Request removal
    </a>
  );
};

export default RemovalLink;
