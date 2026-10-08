import { Link } from "react-router-dom";
import { HOST_REMOVAL_EMAIL } from "../constants";
import { linkClass } from "../styles";

// "Host? Request removal" link to the contact page. Hidden if no address is configured.
const RemovalLink = ({ className = linkClass }: { className?: string }) => {
  if (!HOST_REMOVAL_EMAIL) return null;
  return (
    <Link to="/contact" className={className}>
      Host? Request removal
    </Link>
  );
};

export default RemovalLink;
