import { Link } from "react-router-dom";
import { HOST_REMOVAL_EMAIL } from "../constants";
import { linkClass } from "../styles";
import RemovalLink from "./RemovalLink";

const Footer = () => (
  <footer className="mt-12 border-t border-line bg-surface">
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-[0.9375rem] leading-relaxed text-ink-muted">
      <p className="max-w-2xl">
        Listings come from public sources and food is not guaranteed. Please respect each host’s stated
        audience and RSVP rules.
      </p>
      <p className="flex flex-wrap gap-x-5 gap-y-2">
        <Link to="/about" className={linkClass}>
          About
        </Link>
        {HOST_REMOVAL_EMAIL && <RemovalLink />}
      </p>
    </div>
  </footer>
);

export default Footer;
