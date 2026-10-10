import { useEffect, useMemo, useRef } from "react";
import { FaRegCalendarPlus } from "react-icons/fa";
import { useCalendarExport } from "../features/events/calendarExport";
import type { ExportItem } from "../features/events/exportSlice";
import { useDisclosure } from "../hooks/useDisclosure";
import { primaryButtonClass } from "../styles";
import CalendarFileLink from "./CalendarFileLink";
import { campusDateKey, formatDayLabel, formatTime } from "../utils/time";

const groupByDay = (events: ExportItem[]): [string, ExportItem[]][] => {
  const days = new Map<string, ExportItem[]>();
  for (const event of events) {
    const key = campusDateKey(event.startTime);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days];
};

// A day's heading doubles as a checkbox for the whole day: checked when every
// event is chosen, half-checked when some are. Clicking it selects or clears the day.
const DayCheckbox = ({
  label,
  chosen,
  total,
  onChange,
}: {
  label: string;
  chosen: number;
  total: number;
  onChange: (selectDay: boolean) => void;
}) => {
  const box = useRef<HTMLInputElement>(null);
  const partly = chosen > 0 && chosen < total;
  useEffect(() => {
    if (box.current) box.current.indeterminate = partly;
  }, [partly]);

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-[0.8125rem] font-bold tracking-wide text-ink-muted uppercase">
      <input
        ref={box}
        type="checkbox"
        checked={chosen === total}
        onChange={() => onChange(chosen < total)}
        aria-label={`All events on ${label}`}
        className="size-4 shrink-0 accent-ink"
      />
      <span aria-hidden="true">{label}</span>
    </label>
  );
};

// Download an .ics of all upcoming free food (up to a year ahead), for importing into Google
// Calendar (or Apple, Outlook). Everything is selected; people can drop events here
// or from an event's details. The choices are in the store (see exportSlice.ts),
// loaded by the calendar page.
const CalendarExport = ({ now }: { now: Date }) => {
  const { events, status, deselected, url, toggle, setMany } = useCalendarExport();
  // The event list renders only while "Choose events" is open.
  const chooser = useDisclosure();
  const days = useMemo(() => (chooser.isOpen ? groupByDay(events) : []), [chooser.isOpen, events]);
  const chosenCount = events.length - events.filter((event) => event.id in deselected).length;
  const ids = (list: ExportItem[]) => list.map((event) => event.id);

  return (
    <section
      aria-labelledby="calendar-export-heading"
      className="mt-8 rounded-xl border border-line bg-white p-4 sm:p-6"
    >
      <h2 id="calendar-export-heading" className="text-lg font-bold text-ink">
        Add to Your Calendar
      </h2>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-muted">
        Download upcoming free food as an .ics file, choosing the events you want. Each one comes with a
        reminder 30 minutes before. In Google Calendar, open Settings, then Import &amp; export, and choose the
        file. To get new events as they’re found, use Subscribe at the top instead.
      </p>

      {status === "error" && <p className="mt-3 text-[0.9375rem] font-semibold text-primary">Couldn’t load the events to choose from.</p>}

      {status === "ready" && events.length > 0 && (
        <details {...chooser.detailsProps} className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Choose events ({chosenCount} of {events.length} selected)
          </summary>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMany(ids(events), true)}
              className="min-h-10 rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-ink hover:bg-surface"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setMany(ids(events), false)}
              className="min-h-10 rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-ink hover:bg-surface"
            >
              Deselect all
            </button>
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-line">
            {days.map(([day, dayEvents]) => (
              <fieldset key={day} className="border-b border-line px-3 py-2 last:border-b-0">
                <legend className="sr-only">{formatDayLabel(dayEvents[0]!.startTime, now)}</legend>
                <DayCheckbox
                  label={formatDayLabel(dayEvents[0]!.startTime, now)}
                  chosen={dayEvents.filter((event) => !(event.id in deselected)).length}
                  total={dayEvents.length}
                  onChange={(selectDay) => setMany(ids(dayEvents), selectDay)}
                />
                {dayEvents.map((event) => (
                  <label key={event.id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 pl-5 text-[0.9375rem]">
                    <input
                      type="checkbox"
                      checked={!(event.id in deselected)}
                      onChange={() => toggle(event.id)}
                      className="mt-1 size-4 shrink-0 accent-ink"
                    />
                    <span>
                      <span className="text-ink-muted">{event.allDay ? "All day" : formatTime(event.startTime)}</span>
                      <span className="text-ink"> · {event.title}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>
      )}

      {chosenCount > 0 || status !== "ready" ? (
        <CalendarFileLink href={url} filename="free-stanfood.ics" className={`${primaryButtonClass} mt-3`}>
          <FaRegCalendarPlus aria-hidden="true" />
          {status === "ready" && chosenCount < events.length ? `Download ${chosenCount} events (.ics)` : "Download .ics"}
        </CalendarFileLink>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-ink-muted">Select at least one event to download.</p>
      )}
    </section>
  );
};

export default CalendarExport;
