import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useMemo, useState } from "react";
import { FaBolt, FaRegSun, FaRegMoon, FaRegClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AgendaSection from "../components/AgendaSection";
import EventFilters from "../components/EventFilters";
import Page from "../components/Page";
import Spinner from "../components/Spinner";
import StatusMessage from "../components/StatusMessage";
import { CAMPUS_TIME_ZONE } from "../constants";
import { agendaIsEmpty, buildAgenda } from "../features/events/agenda";
import {
  getEvents,
  reset,
  selectEventState,
  selectHiddenLowConfidence,
  selectVisibleEvents,
  setFilters,
} from "../features/events/eventSlice";
import { useNow } from "../hooks/useNow";
import { campusDateKey, hasEnded, startOfCampusDay } from "../utils/time";

const buttonClass =
  "inline-flex min-h-11 items-center rounded-full bg-stone-900 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-700";

const Today = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const events = useAppSelector(selectVisibleEvents);
  const hiddenLowConfidence = useAppSelector(selectHiddenLowConfidence);
  const now = useNow();
  const [attempt, setAttempt] = useState(0);
  const campusDay = campusDateKey(now);

  // Load everything from now through the end of tomorrow (campus time). Reloads
  // when the campus day rolls over, so a tab left open overnight gets the new tomorrow.
  useEffect(() => {
    const start = new Date();
    const request = dispatch(
      getEvents({
        from: start.toISOString(),
        to: startOfCampusDay(start, 2).toISOString(),
        minConfidence: 0,
      }),
    );
    return () => {
      request.abort();
      dispatch(reset());
    };
  }, [dispatch, attempt, campusDay]);

  useEffect(() => {
    if (isError) toast.error(message);
  }, [isError, message]);

  const agenda = useMemo(() => buildAgenda(events, now), [events, now]);
  const hiddenCount = hiddenLowConfidence.filter((event) => !hasEnded(event, now)).length;

  let content;
  if (isError) {
    content = (
      <StatusMessage tone="error" title="Couldn’t load events.">
        <p className="mb-3">{message}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={buttonClass}>
          Try again
        </button>
      </StatusMessage>
    );
  } else if (isLoading || !isSuccess) {
    content = <Spinner />;
  } else if (agendaIsEmpty(agenda)) {
    content = (
      <StatusMessage title="No free food listed for the rest of today or tomorrow.">
        <p>
          Try clearing filters, or check the{" "}
          <Link to="/calendar" className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900">
            calendar
          </Link>{" "}
          for later this week.
        </p>
      </StatusMessage>
    );
  } else {
    content = (
      <>
        <AgendaSection
          id="now"
          title="Happening Now"
          now={now}
          events={agenda.happeningNow}
          icon={<FaBolt aria-hidden="true" className="text-emerald-700" />}
        />
        <AgendaSection
          id="all-day"
          title="All Day Today"
          now={now}
          events={agenda.allDayToday}
          icon={<FaRegSun aria-hidden="true" className="text-amber-600" />}
        />
        <AgendaSection
          id="later"
          title="Later Today"
          subtitle={formatInTimeZone(now, CAMPUS_TIME_ZONE, "EEEE, MMMM d")}
          now={now}
          groups={agenda.laterToday}
          icon={<FaRegClock aria-hidden="true" className="text-stone-600" />}
        />
        {agenda.happeningNow.length + agenda.allDayToday.length + agenda.laterToday.length === 0 && (
          <div className="mb-10">
            <StatusMessage title="Nothing else listed for today." />
          </div>
        )}
        <AgendaSection
          id="tomorrow"
          title="Tomorrow"
          now={now}
          groups={agenda.tomorrow}
          icon={<FaRegMoon aria-hidden="true" className="text-indigo-600" />}
        />
      </>
    );
  }

  return (
    <Page title="Free Food Today" documentTitle="Today">
      <EventFilters />
      {content}
      {isSuccess && hiddenCount > 0 && (
        <p className="mt-2 text-center text-sm text-stone-600">
          {hiddenCount} more {hiddenCount === 1 ? "listing has" : "listings have"} only a weak hint of food.{" "}
          <button
            type="button"
            onClick={() => dispatch(setFilters({ showLowConfidence: true }))}
            className="ml-1 rounded-full bg-white px-3 py-1 font-medium text-stone-900 ring-1 ring-stone-200 transition-colors hover:bg-stone-100"
          >
            Show {hiddenCount === 1 ? "it" : "them"}
          </button>
        </p>
      )}
    </Page>
  );
};

export default Today;
