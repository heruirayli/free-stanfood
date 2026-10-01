import { Link } from "react-router-dom";
import { HOST_REMOVAL_EMAIL } from "../constants";

// "Host? Request removal" link to the contact page. Hidden if no address is configured.
const RemovalLink = ({
  className = "font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900",
}: {
  className?: string;
}) => {
  if (!HOST_REMOVAL_EMAIL) return null;
  return (
    <Link to="/contact" className={className}>
      Host? Request removal
    </Link>
  );
};

export default RemovalLink;
