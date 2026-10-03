import { AnimatePresence, motion } from "motion/react";
import type { ChangeEvent, ReactNode, SelectHTMLAttributes } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { clearFilters, selectFilters, selectFoodTypes, setFilters } from "../features/events/eventSlice";
import { hasActiveFilters } from "../features/events/filterEvents";
import { TIME_OF_DAY_LABELS, type TimeOfDay } from "../utils/time";

const isTimeOfDay = (value: string): value is TimeOfDay => value in TIME_OF_DAY_LABELS;

const fieldClass =
  "h-11 w-full rounded-full border border-transparent bg-stone-100 text-[0.9375rem] text-stone-900 transition-colors placeholder:text-stone-600 hover:bg-stone-200/60 focus:border-stone-300 focus:bg-white";

// Native select, restyled: keeps keyboard and screen-reader behavior for free.
const Select = ({ id, label, children, ...props }: { id: string; label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <select id={id} className={`${fieldClass} appearance-none pr-9 pl-4`} {...props}>
      {children}
    </select>
    <FaChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[0.65rem] text-stone-500" />
  </div>
);

const EventFilters = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const foodTypes = useAppSelector(selectFoodTypes);

  // Keep a selected food type in the list even if the current window has none of it.
  const foodOptions =
    filters.foodType !== "any" && !foodTypes.includes(filters.foodType)
      ? [filters.foodType, ...foodTypes]
      : foodTypes;

  const onTimeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    dispatch(setFilters({ timeOfDay: isTimeOfDay(value) ? value : "any" }));
  };

  return (
    <form
      role="search"
      aria-label="Filter events"
      onSubmit={(e) => e.preventDefault()}
      className="mb-8 rounded-3xl border border-stone-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-4"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="relative col-span-2 sm:col-span-1">
          <label htmlFor="event-search" className="sr-only">
            Search
          </label>
          <FaSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xs text-stone-500" />
          <input
            id="event-search"
            type="search"
            value={filters.query}
            onChange={(e) => dispatch(setFilters({ query: e.target.value }))}
            placeholder="Search pizza, building, or host"
            className={`${fieldClass} pr-4 pl-10`}
          />
        </div>
        <Select
          id="food-type"
          label="Food"
          value={filters.foodType}
          onChange={(e) => dispatch(setFilters({ foodType: e.target.value }))}
        >
          <option value="any">Any food</option>
          {foodOptions.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </Select>
        <Select id="time-of-day" label="Time of day" value={filters.timeOfDay} onChange={onTimeChange}>
          <option value="any">Any time</option>
          {Object.entries(TIME_OF_DAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={filters.showLowConfidence}
            onChange={(e) => dispatch(setFilters({ showLowConfidence: e.target.checked }))}
            className="peer sr-only"
          />
          {/* Switch track and knob; the real checkbox above keeps it keyboard- and screen-reader-accessible. */}
          <span
            aria-hidden="true"
            className="relative h-5 w-9 shrink-0 rounded-full bg-stone-500 transition-colors peer-checked:bg-stone-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stone-900 peer-checked:[&>span]:translate-x-4"
          >
            <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200" />
          </span>
          Include “Food possible” matches
        </label>
        <AnimatePresence>
          {hasActiveFilters(filters) && (
            <motion.button
              type="button"
              onClick={() => dispatch(clearFilters())}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.2 }}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            >
              Clear filters
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
};

export default EventFilters;
