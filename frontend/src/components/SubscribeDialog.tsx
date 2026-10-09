import { useRef, useState, type ReactNode } from "react";
import { FaRegCopy } from "react-icons/fa";
import { CALENDAR_FEED_PATH, STATIC_DATA } from "../constants";
import { linkClass, primaryButtonClass } from "../styles";
import Sheet from "./Sheet";

type CopyStatus = "idle" | "copied" | "failed";

const COPY_MESSAGES: Record<CopyStatus, string> = {
  idle: "",
  copied: "Link copied.",
  failed: "Couldn’t copy automatically. The link is selected, so copy it from the box.",
};

const Steps = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-6">
    <h3 className="font-bold text-ink">{title}</h3>
    <div className="mt-1.5 space-y-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">{children}</div>
  </section>
);

// The calendar feed's URL, with how to subscribe to it in Google and Apple Calendar.
const SubscribeDialog = ({ onClose }: { onClose: () => void }) => {
  // The static build serves the feed as a file next to the site.
  const feedUrl = STATIC_DATA
    ? `${window.location.origin}${import.meta.env.BASE_URL}calendar.ics`
    : `${window.location.origin}${CALENDAR_FEED_PATH}`;
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<CopyStatus>("idle");

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopy("copied");
    } catch {
      input.current?.select();
      setCopy("failed");
    }
  };

  return (
    <Sheet onClose={onClose} labelledBy="subscribe-heading">
      <h2 id="subscribe-heading" className="text-xl font-bold text-ink">
        Subscribe in Your Calendar
      </h2>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        Add upcoming free food to your calendar app. It keeps itself up to date as new events are found. It includes
        events marked “Food listed” and “Food likely”.
      </p>

      <label htmlFor="feed-url" className="mt-5 block text-sm font-semibold text-ink">
        Calendar link
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          ref={input}
          id="feed-url"
          readOnly
          value={feedUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink"
        />
        <button type="button" onClick={onCopy} className={primaryButtonClass}>
          <FaRegCopy aria-hidden="true" />
          {copy === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="mt-1.5 min-h-5 text-sm text-ink-muted">
        {COPY_MESSAGES[copy]}
      </p>

      <Steps title="Google Calendar">
        <ol className="list-decimal space-y-1 pl-5">
          <li>On a computer, open Google Calendar.</li>
          <li>Next to “Other calendars”, select + and then “From URL”.</li>
          <li>Paste the link and select “Add calendar”.</li>
        </ol>
        <p>It then shows on your phone too. Google can take up to a day to pick up new events.</p>
      </Steps>

      <Steps title="Apple Calendar">
        <p>
          On an iPhone, iPad, or Mac,{" "}
          <a href={feedUrl.replace(/^https?:/, "webcal:")} className={linkClass}>
            open the link in Calendar
          </a>{" "}
          and confirm. Or, in Calendar on a Mac, choose File, then New Calendar Subscription, and paste the link.
        </p>
      </Steps>
    </Sheet>
  );
};

export default SubscribeDialog;
