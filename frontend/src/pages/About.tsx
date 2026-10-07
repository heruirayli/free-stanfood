import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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

const linkClass = "font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900";

const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const Term = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-stone-900">{children}</strong>;

const About = () => (
  <Page title={`About ${APP_NAME}`} documentTitle="About">
    <Section title="What This Is">
      <p>
        {APP_NAME} gathers events from around campus and shows you the ones with free food: what’s happening right
        now, what’s later today, and what’s coming up.
      </p>
    </Section>

    <Section title="How to Use It">
      <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
        <li>
          <Term>
            <Link to="/" className={linkClass}>
              Today
            </Link>
          </Term>{" "}
          shows what’s free right now, later today, and tomorrow, soonest first.
        </li>
        <li>
          <Term>
            <Link to="/calendar" className={linkClass}>
              Calendar
            </Link>
          </Term>{" "}
          shows events by month, week, or as a list. Tap an event for details.
        </li>
        <li>
          <Term>Filters</Term> narrow things down by food, time of day, or a search like “pizza” or a building name.
        </li>
        <li>
          <Term>Add to Your Calendar</Term>, at the bottom of the Calendar page, downloads upcoming events for Google
          Calendar, Apple Calendar, or Outlook. Everything is included; uncheck the events or days you don’t want.
          In Google Calendar, open Settings, then Import &amp; export, and choose the file.
        </li>
      </ul>
    </Section>

    <Section title="What the Labels Mean">
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.9} /> The listing says food will be there, like “lunch will be provided”.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.5} /> Food is mentioned, but the listing doesn’t say outright that it’s provided.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <FoodBadge confidence={0.3} /> Only a hint, like coffee or a reception. Hidden unless you turn it on in the
          filters.
        </li>
      </ul>
      <ul className="space-y-2 pt-1">
        <li className="flex flex-wrap items-center gap-2.5">
          <AudienceBadge audience="open" /> Anyone can come.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <AudienceBadge audience="rsvp" /> Sign up first, so the host orders enough.
        </li>
        <li className="flex flex-wrap items-center gap-2.5">
          <AudienceBadge audience="unknown" /> The listing doesn’t say. Check it before you go.
        </li>
      </ul>
    </Section>

    <Section title="Before You Go">
      <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
        <li>Food isn’t guaranteed. Hosts can run out or change plans, so earlier is better.</li>
        <li>Open the original listing for the latest details, the exact room, and any sign-up.</li>
        <li>Respect who the event is for. Free food is a kindness from the host, not an open invitation.</li>
      </ul>
    </Section>

    <Section title="Where Listings Come From">
      <p>
        Events come from <ExternalLink href="https://events.stanford.edu">Stanford Events</ExternalLink>, student
        groups on <ExternalLink href="https://cardinalengage.stanford.edu">CardinalEngage</ExternalLink>, and public{" "}
        <ExternalLink href="https://luma.com">Luma</ExternalLink> calendars of Stanford centers and clubs. They’re
        updated every morning and go up to a year ahead.
      </p>
      <p>
        Only public events are included, and only information about the event itself: never who’s attending.
        Private and members-only events are left out. For student-group events, sign in on CardinalEngage to see
        the room.
      </p>
    </Section>

    <Section title="Hosts">
      <p>
        Hosting an event listed here? If you’d like it removed, or the food details are wrong, let us know.{" "}
        {HOST_REMOVAL_EMAIL ? <RemovalLink /> : "A contact address hasn’t been set up yet."}
      </p>
    </Section>
  </Page>
);

export default About;
