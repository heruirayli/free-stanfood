import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import EventDialog from "../components/EventDialog";
import EventFilters from "../components/EventFilters";
import { foodBand } from "../components/FoodBadge";
import Spinner from "../components/Spinner";
import StatusMessage from "../components/StatusMessage";
import { getEvents, reset, selectEventState, selectVisibleEvents } from "../features/events/eventSlice";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import type { FoodEvent } from "../types/event";

const toCalendarEvent = (event: FoodEvent): EventInput => ({
  id: event.id,
  title: event.title,
  start: event.startTime,
  end: event.endTime ?? undefined,
  allDay: event.allDay,
  classNames: [`food-${foodBand(event.foodConfidence)}`],
});

const CalendarPage = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const events = useAppSelector(selectVisibleEvents);
  const now = useNow();
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const request = useRef<{ abort: () => void } | null>(null);

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

  // FullCalendar reports the visible range whenever the view or dates change.
  const onDatesSet = useCallback(
    (range: DatesSetArg) => {
      request.current?.abort();
      request.current = dispatch(
        getEvents({ from: range.start.toISOString(), to: range.end.toISOString(), minConfidence: 0 }),
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
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Calendar</h1>
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
      <div className="relative rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:p-4">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <Spinner />
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView={isNarrow ? "listWeek" : "dayGridMonth"}
          headerToolbar={
            isNarrow
              ? { left: "prev,next", center: "title", right: "today" }
              : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" }
          }
          footerToolbar={isNarrow ? { center: "dayGridMonth,timeGridWeek,listWeek" } : undefined}
          buttonText={{ today: "Today", month: "Month", week: "Week", list: "List" }}
          events={calendarEvents}
          datesSet={onDatesSet}
          eventClick={onEventClick}
          height="auto"
          dayMaxEvents={3}
          nowIndicator
          noEventsContent="No food events listed"
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-600">
        Colors: green = food listed, amber = food likely, gray = food possible.
      </p>
      <EventDialog event={selected} now={now} onClose={() => setSelectedId(null)} />
    </div>
  );
};

export default CalendarPage;
