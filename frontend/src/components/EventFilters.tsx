import type { ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { clearFilters, selectFilters, selectFoodTypes, setFilters } from "../features/events/eventSlice";
import { hasActiveFilters } from "../features/events/filterEvents";
import { TIME_OF_DAY_LABELS, type TimeOfDay } from "../utils/time";

const isTimeOfDay = (value: string): value is TimeOfDay => value in TIME_OF_DAY_LABELS;

const fieldClass =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 shadow-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:outline-none";

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
      className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <label htmlFor="event-search" className="text-sm font-medium text-gray-800">
            Search
          </label>
          <input
            id="event-search"
            type="search"
            value={filters.query}
            onChange={(e) => dispatch(setFilters({ query: e.target.value }))}
            placeholder="Pizza, building, or host"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="food-type" className="text-sm font-medium text-gray-800">
            Food
          </label>
          <select
            id="food-type"
            value={filters.foodType}
            onChange={(e) => dispatch(setFilters({ foodType: e.target.value }))}
            className={fieldClass}
          >
            <option value="any">Any food</option>
            {foodOptions.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="time-of-day" className="text-sm font-medium text-gray-800">
            Time of day
          </label>
          <select id="time-of-day" value={filters.timeOfDay} onChange={onTimeChange} className={fieldClass}>
            <option value="any">Any time</option>
            {Object.entries(TIME_OF_DAY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={filters.showLowConfidence}
              onChange={(e) => dispatch(setFilters({ showLowConfidence: e.target.checked }))}
              className="h-5 w-5 rounded border-gray-400 accent-emerald-700"
            />
            Include “Food possible” matches
          </label>
        </div>
      </div>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => dispatch(clearFilters())}
          className="mt-3 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          Clear filters
        </button>
      )}
    </form>
  );
};

export default EventFilters;
