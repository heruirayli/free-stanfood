import type { ReactNode } from "react";
import AudienceBadge from "../components/AudienceBadge";
import FoodBadge from "../components/FoodBadge";
import Page from "../components/Page";
import RemovalLink from "../components/RemovalLink";
import { APP_NAME, HOST_REMOVAL_EMAIL } from "../constants";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-stone-200/70 py-7 first-of-type:border-t-0 first-of-type:pt-0">
    <h2 className="mb-3 text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
    <div className="space-y-3 leading-relaxed text-stone-700">{children}</div>
  </section>
);

const SourceLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900"
    target="_blank"
    rel="noopener noreferrer"
  >
    {children}
  </a>
);

const About = () => (
  <Page title={`About ${APP_NAME}`} documentTitle="About">
    <Section title="What This Is">
      <p>
        {APP_NAME} collects public event listings from around campus and highlights the ones that mention free
        food.
      </p>
    </Section>

    <Section title="Where Listings Come From">
      <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
        <li>
          <SourceLink href="https://events.stanford.edu">Stanford Events</SourceLink>, through its public events
          API. Most listings come from here: talks, seminars, workshops, and department events.
        </li>
        <li>
          <SourceLink href="https://cardinalengage.stanford.edu">CardinalEngage</SourceLink>, through its public
          events feed, for student organizations. Only events a club makes public appear. Rooms are hidden from
          people who aren’t signed in, so check the original listing for the location.
        </li>
        <li>
          Public <SourceLink href="https://luma.com">Luma</SourceLink> calendars of Stanford centers, institutes, and
          student groups.
        </li>
      </ul>
      <p>
        Listings refresh automatically once a day and look up to a year ahead. When the same event appears in more
        than one place, it’s shown once.
      </p>
      <p>
        Only public, event-level information is collected: no attendee names, emails, or RSVP lists. Nothing behind
        a sign-in is read. Private listings, members-only club events, and events restricted to specific groups are
        left out. Every event links back to its original listing, which is always the authority.
      </p>
    </Section>

    <Section title="How Food Is Detected">
      <p>
        Each listing’s title and description are scanned for food words and phrases such as “lunch will be
        provided” or “free pizza”. Mentions that don’t mean free food, like food drives, food insecurity panels,
        “bring your own lunch”, or food for purchase, are discounted.
      </p>
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.9} /> The listing says food is provided.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.5} /> Food is mentioned but not clearly provided.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.3} /> Only a weak hint, like coffee or a reception. Hidden unless you turn it
          on.
        </li>
      </ul>
      <p>Food is never guaranteed. Hosts may run out, change plans, or limit food to registered guests.</p>
    </Section>

    <Section title="Who Can Attend">
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2.5">
          <AudienceBadge audience="open" /> Listed as open to everyone.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <AudienceBadge audience="rsvp" /> Registration or RSVP is requested. Please RSVP before going.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
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
  </Page>
);

export default About;
