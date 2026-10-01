import { HOST_REMOVAL_EMAIL } from "../constants";
import RemovalLink from "./RemovalLink";

const linkClass = "font-medium text-stone-800 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-800";

const Footer = () => (
  <footer className="mt-16 border-t border-stone-200/70">
    <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm leading-relaxed text-stone-600">
      <p>
        Listings come from public sources and food is not guaranteed. Please respect each host’s stated
        audience and RSVP rules.
      </p>
      {HOST_REMOVAL_EMAIL && (
        <p className="pt-1">
          <RemovalLink className={linkClass} />
        </p>
      )}
    </div>
  </footer>
);

export default Footer;
