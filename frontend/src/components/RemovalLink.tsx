import { HOST_REMOVAL_EMAIL } from "../constants";

const SUBJECT = encodeURIComponent("Removal request: Free Stanfood listing");

// "Host? Request removal" mailto link. Hidden if no address is configured.
const RemovalLink = () => {
  if (!HOST_REMOVAL_EMAIL) return null;
  return (
    <a
      href={`mailto:${HOST_REMOVAL_EMAIL}?subject=${SUBJECT}`}
      className="font-medium text-emerald-800 underline-offset-2 hover:underline"
    >
      Host? Request removal
    </a>
  );
};

export default RemovalLink;
