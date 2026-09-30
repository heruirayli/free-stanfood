import type { ReactNode } from "react";
import AudienceBadge from "../components/AudienceBadge";
import FoodBadge from "../components/FoodBadge";
import RemovalLink from "../components/RemovalLink";
import { APP_NAME, HOST_REMOVAL_EMAIL } from "../constants";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-8">
    <h2 className="mb-2 text-xl font-bold text-gray-900">{title}</h2>
    <div className="space-y-3 text-gray-800">{children}</div>
  </section>
);

const About = () => (
  <div className="mx-auto max-w-2xl">
    <h1 className="mb-6 text-2xl font-bold text-gray-900">About {APP_NAME}</h1>

    <Section title="What this is">
      <p>
        {APP_NAME} collects public event listings from around campus and highlights the ones that mention free
        food. It is an independent student project, is unaffiliated with Stanford University, and is not an
        official source.
      </p>
    </Section>

    <Section title="Where listings come from">
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <a
            href="https://events.stanford.edu"
            className="font-medium text-emerald-800 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stanford Events
          </a>
          , through its public events API.
        </li>
        <li>Public calendar feeds from campus groups, such as Stanford centers’ Luma calendars.</li>
      </ul>
      <p>
        Only public, event-level information is collected: no attendee names, emails, or RSVP lists. Private
        listings and events restricted to specific groups are left out. Every event links back to its original
        listing, which is always the authority.
      </p>
    </Section>

    <Section title="How food is detected">
      <p>
        Each listing’s title and description are scanned for food words and phrases such as “lunch will be
        provided” or “free pizza”. Mentions that don’t mean free food, like food drives, food insecurity panels,
        “bring your own lunch”, or food for purchase, are discounted.
      </p>
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2">
          <FoodBadge confidence={0.9} /> The listing says food is provided.
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <FoodBadge confidence={0.5} /> Food is mentioned but not clearly provided.
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <FoodBadge confidence={0.3} /> Only a weak hint, like coffee or a reception. Hidden unless you turn it
          on.
        </li>
      </ul>
      <p>Food is never guaranteed. Hosts may run out, change plans, or limit food to registered guests.</p>
    </Section>

    <Section title="Who can attend">
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2">
          <AudienceBadge audience="open" /> Listed as open to everyone.
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <AudienceBadge audience="rsvp" /> Registration or RSVP is requested. Please RSVP before going.
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <AudienceBadge audience="unknown" /> The listing doesn’t say. Check the original listing.
        </li>
      </ul>
      <p>Please respect each host’s stated audience. Free food is a courtesy, not an invitation to crash.</p>
    </Section>

    <Section title="Hosts">
      <p>
        If you host an event listed here and want it removed, or the food information is wrong, please get in
        touch. {HOST_REMOVAL_EMAIL ? <RemovalLink /> : "A contact address hasn’t been configured yet."}
      </p>
    </Section>
  </div>
);

export default About;
