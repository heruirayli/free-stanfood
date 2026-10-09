import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import AudienceBadge from "../components/AudienceBadge";
import FoodBadge from "../components/FoodBadge";
import Page from "../components/Page";
import RemovalLink from "../components/RemovalLink";
import { APP_NAME, HOST_REMOVAL_EMAIL } from "../constants";
import { linkClass } from "../styles";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-line py-7 first-of-type:border-t-0 first-of-type:pt-0">
    <h2 className="mb-3 text-xl font-bold text-ink">{title}</h2>
    <div className="space-y-3 text-[1.0625rem] leading-relaxed text-ink">{children}</div>
  </section>
);

const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const Term = ({ children }: { children: ReactNode }) => <strong className="font-bold">{children}</strong>;

const About = () => (
  <Page title={`About ${APP_NAME}`} documentTitle="About">
    <Section title="What This Is">
      <p>
        {APP_NAME} gathers events from around campus and shows you the ones with free food: what’s happening right
        now, what’s later today and tonight, and what’s coming up.
      </p>
    </Section>

    <Section title="How to Use It">
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
        <li>
          <Term>
            <Link to="/" className={linkClass}>
              Today
            </Link>
          </Term>{" "}
          shows what’s happening now, later today, and tonight, soonest first. Tap an event for everything about it.
        </li>
        <li>
          <Term>
            <Link to="/week" className={linkClass}>
              Week
            </Link>
          </Term>{" "}
          and{" "}
          <Term>
            <Link to="/month" className={linkClass}>
              Month
            </Link>
          </Term>{" "}
          show what’s coming up, up to a year ahead.
        </li>
        <li>
          <Term>Filters</Term> narrow things down: events open to all, what’s on now or in the next two hours, a
          kind of food, or a search like “pizza” or a building name. The page’s address keeps them, so you can
          bookmark or share a filtered view.
        </li>
        <li>
          <Term>Subscribe</Term>, at the top of every page, adds upcoming free food to Google Calendar or Apple
          Calendar, and keeps it up to date.
        </li>
        <li>
          <Term>Add to calendar</Term>, in an event’s details, downloads just that event. To download a set of
          events once, use <Term>Add to Your Calendar</Term> at the bottom of Week and Month: everything is
          included, and you can uncheck the events or days you don’t want.
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
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
        <li>Food isn’t guaranteed. Hosts can run out or change plans, so earlier is better.</li>
        <li>Open the original listing for the latest details, the exact room, and any sign-up.</li>
        <li>Respect who the event is for. Free food is a kindness from the host, not an open invitation.</li>
      </ul>
    </Section>

    <Section title="Where Listings Come From">
      <p>
        Events come from <ExternalLink href="https://events.stanford.edu">Stanford Events</ExternalLink>, student
        groups on <ExternalLink href="https://cardinalengage.stanford.edu">CardinalEngage</ExternalLink>, public{" "}
        <ExternalLink href="https://luma.com">Luma</ExternalLink> calendars of Stanford centers and clubs, the Law
        School’s calendar, and the event pages of departments and offices across campus. They’re updated every
        morning and go up to a year ahead.
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
