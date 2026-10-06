import { useEffect, useMemo, useRef } from "react";
import { FaCalendarPlus } from "react-icons/fa";
import type { CalendarExportState } from "../features/events/calendarExport";
import { useNow } from "../hooks/useNow";
import type { FoodEvent } from "../types/event";
import { campusDateKey, formatDayLabel, formatTime } from "../utils/time";

const groupByDay = (events: FoodEvent[]): [string, FoodEvent[]][] => {
  const days = new Map<string, FoodEvent[]>();
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-xs font-medium tracking-wider text-stone-600 uppercase">
      <input
        ref={box}
        type="checkbox"
        checked={chosen === total}
        onChange={() => onChange(chosen < total)}
        aria-label={`All events on ${label}`}
        className="size-4 shrink-0 accent-stone-900"
      />
      <span aria-hidden="true">{label}</span>
    </label>
  );
};

// Download an .ics of the next 8 weeks of free food, for importing into Google
// Calendar (or Apple, Outlook). Everything is selected; people can drop events here
// or from an event's details. The choices live in useCalendarExport, which the
// Calendar page shares with its event dialog.
const CalendarExport = ({ state }: { state: CalendarExportState }) => {
  const { events, status, deselected, url, toggle, setMany } = state;
  const now = useNow();
  const days = useMemo(() => groupByDay(events), [events]);
  const chosenCount = events.length - events.filter((event) => deselected.has(event.id)).length;
  const ids = (list: FoodEvent[]) => list.map((event) => event.id);

  return (
    <section
      aria-labelledby="calendar-export-heading"
      className="mt-6 rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5"
    >
      <h2 id="calendar-export-heading" className="text-base font-semibold tracking-tight text-stone-900">
        Add to Your Calendar
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">
        Download the next 8 weeks of free food as an .ics file. In Google Calendar, open Settings, then Import &amp;
        export, and choose the file.
      </p>

      {status === "error" && <p className="mt-3 text-sm text-rose-800">Couldn’t load the events to choose from.</p>}

      {status === "ready" && events.length > 0 && (
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-stone-800">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Choose events ({chosenCount} of {events.length} selected)
          </summary>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMany(ids(events), true)}
              className="min-h-10 rounded-full border border-stone-200 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setMany(ids(events), false)}
              className="min-h-10 rounded-full border border-stone-200 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              Deselect all
            </button>
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-stone-200/80">
            {days.map(([day, dayEvents]) => (
              <fieldset key={day} className="border-b border-stone-200/80 px-3 py-2 last:border-b-0">
                <legend className="sr-only">{formatDayLabel(dayEvents[0]!.startTime, now)}</legend>
                <DayCheckbox
                  label={formatDayLabel(dayEvents[0]!.startTime, now)}
                  chosen={dayEvents.filter((event) => !deselected.has(event.id)).length}
                  total={dayEvents.length}
                  onChange={(selectDay) => setMany(ids(dayEvents), selectDay)}
                />
                {dayEvents.map((event) => (
                  <label key={event.id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 pl-5 text-sm">
                    <input
                      type="checkbox"
                      checked={!deselected.has(event.id)}
                      onChange={() => toggle(event.id)}
                      className="mt-0.5 size-4 shrink-0 accent-stone-900"
                    />
                    <span>
                      <span className="text-stone-600">{event.allDay ? "All day" : formatTime(event.startTime)}</span>
                      <span className="text-stone-900"> · {event.title}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>
      )}

      {chosenCount > 0 || status !== "ready" ? (
        <a
          href={url}
          download="free-stanfood.ics"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
        >
          <FaCalendarPlus aria-hidden="true" />
          {status === "ready" && chosenCount < events.length ? `Download ${chosenCount} events (.ics)` : "Download .ics"}
        </a>
      ) : (
        <p className="mt-3 text-sm text-stone-600">Select at least one event to download.</p>
      )}
    </section>
  );
};

export default CalendarExport;
