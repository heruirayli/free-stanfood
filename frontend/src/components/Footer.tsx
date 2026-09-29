import { Link } from "react-router-dom";
import RemovalLink from "./RemovalLink";

const Footer = () => (
  <footer className="mt-12 border-t border-gray-200 bg-gray-50">
    <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm text-gray-700">
      <p>
        Listings come from public sources and food is not guaranteed. Please respect each host’s stated
        audience and RSVP rules.
      </p>
      <p>This site is an independent student project and is unaffiliated with Stanford University.</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <RemovalLink />
        <Link to="/about" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
          Sources and how it works
        </Link>
      </p>
    </div>
  </footer>
);

export default Footer;
