import { FaEnvelope } from "react-icons/fa";
import Page from "../components/Page";
import { HOST_REMOVAL_EMAIL } from "../constants";

const SUBJECT = encodeURIComponent("Removal request: Free Stanfood listing");

// Reached only from the "Host? Request removal" links, so it isn't in the main nav.
const Contact = () => (
  <Page title="Request Removal">
    <div className="space-y-4 leading-relaxed text-stone-700">
      <p>
        If you host an event listed here and want it removed, or the food information is wrong, send an email
        and it will be taken care of.
      </p>
      <p>Please include a link to the listing and what you’d like changed.</p>
      {HOST_REMOVAL_EMAIL ? (
        <p className="pt-2">
          <a
            href={`mailto:${HOST_REMOVAL_EMAIL}?subject=${SUBJECT}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
          >
            <FaEnvelope aria-hidden="true" />
            Email {HOST_REMOVAL_EMAIL}
          </a>
        </p>
      ) : (
        <p>A contact address hasn’t been configured yet.</p>
      )}
    </div>
  </Page>
);

export default Contact;
