import { FaEnvelope } from "react-icons/fa";
import Page from "../components/Page";
import { HOST_REMOVAL_EMAIL } from "../constants";
import { primaryButtonClass } from "../styles";

const SUBJECT = encodeURIComponent("Removal request: Free Stanfood listing");

// Reached only from the "Host? Request removal" links, so it isn't in the main nav.
const Contact = () => (
  <Page title="Request Removal">
    <div className="space-y-4 text-[1.0625rem] leading-relaxed text-ink">
      <p>
        If you host an event listed here and want it removed, or the food information is wrong, send an email
        and it will be taken care of.
      </p>
      <p>Please include a link to the listing and what you’d like changed.</p>
      {HOST_REMOVAL_EMAIL ? (
        <p className="pt-2">
          <a
            href={`mailto:${HOST_REMOVAL_EMAIL}?subject=${SUBJECT}`}
            className={primaryButtonClass}
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
