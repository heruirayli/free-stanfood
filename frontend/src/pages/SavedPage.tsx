import { useEffect, useMemo, useState } from "react";
import { FaRegCalendarPlus } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AgendaSection from "../components/AgendaSection";
import CalendarFileLink from "../components/CalendarFileLink";
import Page from "../components/Page";
import { AgendaSkeleton } from "../components/Skeleton";
import StatusMessage from "../components/StatusMessage";
import { CALENDAR_FEED_PATH, REMINDER_MINUTES } from "../constants";
import { byDay } from "../features/events/byDay";
import { getEvents, reset, selectEventState } from "../features/events/eventSlice";
import { removeSaved, useSavedEvents } from "../features/saved/savedEvents";
import { useNow } from "../hooks/useNow";
import { primaryButtonClass, secondaryButtonClass } from "../styles";
import { dayKeyLabel } from "../utils/time";
import { notifyError } from "../utils/notify";

// The saved events as one calendar file, with reminders.
const savedCalendarUrl = (ids: string[]): string =>
  `${CALENDAR_FEED_PATH}?${new URLSearchParams({ ids: ids.join(","), minConfidence: "0", alarm: String(REMINDER_MINUTES) })}`;

// The events starred in this browser that are still coming up, by day, with one
// download for all of them. Saved events that are no longer listed are named, so
// they can be cleared.
const SavedPage = () => {
  const dispatch = useAppDispatch();
  const saved = useSavedEvents();
  const { events, isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const now = useNow();
  const [attempt, setAttempt] = useState(0);
  const anySaved = saved.length > 0;

  // Every upcoming event (the API has no "these ids" list), then the saved ones among them.
  useEffect(() => {
    if (!anySaved) return;
    const request = dispatch(getEvents({ minConfidence: 0 }));
    return () => request.abort();
  }, [dispatch, anySaved, attempt]);

  useEffect(
    () => () => {
      dispatch(reset());
    },
    [dispatch],
  );

  useEffect(() => {
    if (isError) notifyError(message);
  }, [isError, message]);

  const savedIds = useMemo(() => new Set(saved.map((entry) => entry.id)), [saved]);
  const upcoming = useMemo(() => events.filter((event) => savedIds.has(event.id)), [events, savedIds]);
  const days = useMemo(() => byDay(upcoming, now), [upcoming, now]);
  // Saved and not over, but not in the listings any more (taken down, or no longer free food).
  const listedIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const gone = isSuccess
    ? saved.filter((entry) => !listedIds.has(entry.id) && Date.parse(entry.endTime ?? entry.startTime) > now.getTime())
    : [];

  let content;
  if (!anySaved) {
    content = (
      <StatusMessage title="No saved events yet.">
        <p>Tap the star on any event to keep it here. Saved events stay in this browser.</p>
      </StatusMessage>
    );
  } else if (isError) {
    content = (
      <StatusMessage tone="error" title="Couldn’t load your saved events.">
        <p className="mb-4">{message}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={primaryButtonClass}>
          Try again
        </button>
      </StatusMessage>
    );
  } else if (isLoading || !isSuccess) {
    content = <AgendaSkeleton />;
  } else {
    content = (
      <>
        {upcoming.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <CalendarFileLink
              href={savedCalendarUrl(upcoming.map((event) => event.id))}
              filename="free-stanfood-saved.ics"
              className={primaryButtonClass}
            >
              <FaRegCalendarPlus aria-hidden="true" />
              Add {upcoming.length === 1 ? "it" : `all ${upcoming.length}`} to calendar
            </CalendarFileLink>
            <p className="text-[0.9375rem] text-ink-muted">With a reminder 30 minutes before each.</p>
          </div>
        ) : (
          <div className="mb-7">
            <StatusMessage title="None of your saved events are coming up." />
          </div>
        )}
        {days.map((day) => (
          <AgendaSection
            key={day.key}
            id={`saved-${day.key}`}
            title={dayKeyLabel(day.key, now)}
            events={day.events}
            now={now}
          />
        ))}
        {gone.length > 0 && (
          <section aria-labelledby="gone-heading" className="mt-2 rounded-xl bg-surface p-4">
            <h2 id="gone-heading" className="font-bold text-ink">
              No longer listed
            </h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-muted">
              {gone.map((entry) => (
                <li key={entry.id}>{entry.title}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => removeSaved(new Set(gone.map((entry) => entry.id)))}
              className={`${secondaryButtonClass} mt-3`}
            >
              Remove {gone.length === 1 ? "it" : "them"}
            </button>
          </section>
        )}
      </>
    );
  }

  return (
    <Page title="Saved" subtitle="Events you starred, kept in this browser">
      {content}
    </Page>
  );
};

export default SavedPage;
