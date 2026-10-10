import type { DatesSetArg, EventClickArg, EventContentArg, MoreLinkContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import CalendarExport from "../components/CalendarExport";
import EventFilters from "../components/EventFilters";
import { BAND_STYLES } from "../components/FoodBadge";
import Page from "../components/Page";
import Spinner from "../components/Spinner";
import StatusMessage from "../components/StatusMessage";
import { useLoadCalendarExport } from "../features/events/calendarExport";
import { campusNow, toCalendarEvent } from "../features/events/calendarEvents";
import { getEvents, reset, selectEventState, selectFilters, selectVisibleEvents } from "../features/events/eventSlice";
import { matchesTimeOfDay } from "../features/events/filterEvents";
import { useFilterUrlSync } from "../hooks/useFilterUrlSync";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import type { BackgroundState } from "../utils/background";
import { fromCampusWallClock } from "../utils/time";
import { notifyError } from "../utils/notify";

export type CalendarView = "week" | "month";

// Short "+3" link on phones, where "+3 more" doesn't fit a day cell.
const shortMoreLink = ({ num }: MoreLinkContentArg) => `+${num}`;

// The list view leads with the food, as Today's cards do.
const listEventContent = ({ event }: EventContentArg) => {
  const food: unknown = event.extendedProps["food"];
  return (
    <span>
      {typeof food === "string" && <strong className="font-bold">{food} · </strong>}
      {event.title}
    </span>
  );
};

// Week and Month. On phones the week is a list; from sm up, a time grid.
const CalendarPage = ({ view }: { view: CalendarView }) => {
  const dispatch = useAppDispatch();
  useFilterUrlSync("calendar");
  useLoadCalendarExport();
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const { timesOfDay } = useAppSelector(selectFilters);
  const events = useAppSelector(selectVisibleEvents);
  const now = useNow();
  const navigate = useNavigate();
  const location = useLocation();
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const request = useRef<{ abort: () => void } | null>(null);
  const calendar = useRef<FullCalendar>(null);
  // Phones get a list of the next seven days, from today: a Sunday-to-Saturday
  // list would open on days that are already over.
  const viewType = view === "month" ? "dayGridMonth" : isNarrow ? "listNextSevenDays" : "timeGridWeek";

  useEffect(
    () => () => {
      request.current?.abort();
      dispatch(reset());
    },
    [dispatch],
  );

  useEffect(() => {
    if (isError) notifyError(message);
  }, [isError, message]);

  // Week ↔ Month and phone ↔ wider screen switch the view in place, keeping the date.
  useEffect(() => {
    const api = calendar.current?.getApi();
    if (api && api.view.type !== viewType) api.changeView(viewType);
  }, [viewType]);

  // FullCalendar reports the visible range whenever the view or dates change. The
  // range is in campus wall-clock form (see calendarEvents.ts), so convert it back.
  const onDatesSet = useCallback(
    (range: DatesSetArg) => {
      request.current?.abort();
      request.current = dispatch(
        getEvents({
          from: fromCampusWallClock(range.start).toISOString(),
          to: fromCampusWallClock(range.end).toISOString(),
          minConfidence: 0,
        }),
      );
    },
    [dispatch],
  );

  // Details open over the calendar, which stays as it was underneath.
  const onEventClick = useCallback(
    (click: EventClickArg) => {
      click.jsEvent.preventDefault();
      const state: BackgroundState = { background: location };
      navigate(`/events/${click.event.id}`, { state });
    },
    [navigate, location],
  );

  const calendarEvents = useMemo(
    () => events.filter((event) => matchesTimeOfDay(event, timesOfDay)).map(toCalendarEvent),
    [events, timesOfDay],
  );

  return (
    <Page title={view === "month" ? "Month" : "Week"} hideTitle wide>
      <EventFilters scope="calendar" />
      {isSuccess && !isLoading && calendarEvents.length === 0 && (
        <div className="mb-4">
          <StatusMessage title="No free food in this range matches your filters." />
        </div>
      )}
      {isError && (
        <div className="mb-4">
          <StatusMessage tone="error" title="Couldn’t load events.">
            {message}
          </StatusMessage>
        </div>
      )}
      <div className="relative rounded-xl border border-line bg-white p-2 sm:p-5">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <Spinner />
          </div>
        )}
        <FullCalendar
          ref={calendar}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          timeZone="UTC"
          now={campusNow}
          initialView={viewType}
          headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
          buttonText={{ today: "Today" }}
          events={calendarEvents}
          datesSet={onDatesSet}
          eventClick={onEventClick}
          // Events are links for keyboards too: Tab to one, Enter to open it.
          eventInteractive
          // The week grid scrolls inside a fixed height, starting at 8 AM.
          height={viewType === "timeGridWeek" ? 760 : "auto"}
          scrollTime="08:00:00"
          dayMaxEvents={3}
          views={{
            // Phones: month cells are ~46px wide, so drop the event times (they spill
            // into the next day) and leave the room for the colored dot and title.
            dayGridMonth: { displayEventTime: !isNarrow },
            timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric" } },
            // The list has room for times as the cards write them: "12:00 PM".
            listNextSevenDays: {
              type: "list",
              duration: { days: 7 },
              // Day headings as in FullCalendar's weekly list: the weekday, then the date.
              listDayFormat: { weekday: "long" },
              listDaySideFormat: { month: "long", day: "numeric", year: "numeric" },
              eventContent: listEventContent,
              eventTimeFormat: { hour: "numeric", minute: "2-digit" },
            },
          }}
          moreLinkContent={isNarrow ? shortMoreLink : undefined}
          nowIndicator
          noEventsContent="No food events listed"
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        />
      </div>
      <ul aria-label="Calendar colors" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-muted">
        {Object.values(BAND_STYLES).map(({ label, stripe }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${stripe}`} />
            {label}
          </li>
        ))}
      </ul>
      <CalendarExport now={now} />
    </Page>
  );
};

export default CalendarPage;
