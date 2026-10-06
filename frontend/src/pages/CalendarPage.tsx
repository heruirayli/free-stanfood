import type { DatesSetArg, EventClickArg, MoreLinkContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import CalendarExport from "../components/CalendarExport";
import EventDialog from "../components/EventDialog";
import EventFilters from "../components/EventFilters";
import Page from "../components/Page";
import Spinner from "../components/Spinner";
import StatusMessage from "../components/StatusMessage";
import { useCalendarExport } from "../features/events/calendarExport";
import { campusNow, toCalendarEvent } from "../features/events/calendarEvents";
import { getEvents, reset, selectEventState, selectVisibleEvents } from "../features/events/eventSlice";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import { fromCampusWallClock } from "../utils/time";

const LEGEND = [
  { label: "Food listed", dot: "bg-emerald-700" },
  { label: "Food likely", dot: "bg-amber-700" },
  { label: "Food possible", dot: "bg-stone-500" },
];

const VIEWS = [
  { type: "dayGridMonth", label: "Month" },
  { type: "timeGridWeek", label: "Week" },
  { type: "listWeek", label: "List" },
];

// Short "+3" link on phones, where "+3 more" doesn't fit a day cell.
const shortMoreLink = ({ num }: MoreLinkContentArg) => `+${num}`;

const CalendarPage = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const events = useAppSelector(selectVisibleEvents);
  const now = useNow();
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const request = useRef<{ abort: () => void } | null>(null);
  const calendar = useRef<FullCalendar>(null);
  const [view, setView] = useState(isNarrow ? "listWeek" : "dayGridMonth");
  // Shared by the export section and the event dialog, so both edit the same choices.
  const calendarExport = useCalendarExport();

  useEffect(
    () => () => {
      request.current?.abort();
      dispatch(reset());
    },
    [dispatch],
  );

  useEffect(() => {
    if (isError) toast.error(message);
  }, [isError, message]);

  // FullCalendar reports the visible range whenever the view or dates change. The
  // range is in campus wall-clock form (see calendarEvents.ts), so convert it back.
  const onDatesSet = useCallback(
    (range: DatesSetArg) => {
      setView(range.view.type);
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

  const onEventClick = useCallback((click: EventClickArg) => {
    click.jsEvent.preventDefault();
    setSelectedId(click.event.id);
  }, []);

  const calendarEvents = useMemo(() => events.map(toCalendarEvent), [events]);
  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <Page title="Calendar" wide>
      <EventFilters />
      {isSuccess && !isLoading && events.length === 0 && (
        <div className="mb-4">
          <StatusMessage title="No food events in this range match your filters." />
        </div>
      )}
      {isError && (
        <div className="mb-4">
          <StatusMessage tone="error" title="Couldn’t load events.">
            {message}
          </StatusMessage>
        </div>
      )}
      <div className="relative rounded-3xl border border-stone-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-[1px]">
            <Spinner />
          </div>
        )}
        {/* View switcher sits above the date, so it lives outside FullCalendar's one-row toolbar. */}
        <div role="group" aria-label="Calendar view" className="mb-3 flex justify-center gap-1">
          {VIEWS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              aria-pressed={view === type}
              onClick={() => calendar.current?.getApi().changeView(type)}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                view === type
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <FullCalendar
          ref={calendar}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          timeZone="UTC"
          now={campusNow}
          initialView={isNarrow ? "listWeek" : "dayGridMonth"}
          headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
          buttonText={{ today: "Today" }}
          events={calendarEvents}
          datesSet={onDatesSet}
          eventClick={onEventClick}
          height="auto"
          dayMaxEvents={3}
          // Phones: month cells are ~46px wide, so drop the event times (they spill
          // into the next day) and leave the room for the colored dot and title.
          views={{ dayGridMonth: { displayEventTime: !isNarrow } }}
          moreLinkContent={isNarrow ? shortMoreLink : undefined}
          nowIndicator
          noEventsContent="No food events listed"
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        />
      </div>
      <ul aria-label="Calendar colors" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-stone-600">
        {LEGEND.map(({ label, dot }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
            {label}
          </li>
        ))}
      </ul>
      <CalendarExport state={calendarExport} />
      <EventDialog event={selected} now={now} onClose={() => setSelectedId(null)} exportState={calendarExport} />
    </Page>
  );
};

export default CalendarPage;
