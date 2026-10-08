import { useId, useState, type ReactNode } from "react";
import { FaCheck, FaSearch, FaSlidersH } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { clearFilters, selectFilters, selectFoodTypes, setFilters } from "../features/events/eventSlice";
import { hasActiveFilters, type FilterScope, type TimeWindow } from "../features/events/filterEvents";
import { cx } from "../utils/cx";
import { TIME_OF_DAY_HOURS, TIME_OF_DAY_LABELS, type TimeOfDay } from "../utils/time";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "next2h", label: "Next 2 hours" },
  { value: "today", label: "Today" },
];

const TIMES = Object.keys(TIME_OF_DAY_LABELS) as TimeOfDay[];

// Food chips shown before "+N more": the most common types.
const FOOD_CHIPS = 6;

const focusRing = "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary";

interface ChoiceProps {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: () => void;
  // Extra words for screen readers, e.g. a time range.
  hint?: string;
  children: ReactNode;
}

// A filter chip: a real checkbox or radio button, drawn as a pill. Radios in a
// group move with the arrow keys; the focus ring is drawn on the pill.
const Chip = ({ type, name, checked, onChange, hint, children }: ChoiceProps) => (
  <label className="relative shrink-0" title={hint}>
    <input type={type} name={name} checked={checked} onChange={onChange} className="peer sr-only" />
    <span
      className={cx(
        "flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-checked:hover:bg-ink",
        focusRing,
      )}
    >
      {checked && type === "checkbox" && <FaCheck aria-hidden="true" className="text-[0.625rem]" />}
      {children}
      {hint && <span className="sr-only"> ({hint})</span>}
    </span>
  </label>
);

// An on/off filter, drawn as a switch over a real checkbox.
const Switch = ({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) => (
  <label className="relative flex min-h-9 cursor-pointer items-center gap-2.5 text-[0.9375rem] text-ink">
    <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="peer sr-only" />
    <span
      aria-hidden="true"
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-ink after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4",
        focusRing,
      )}
    />
    {children}
  </label>
);

// A labeled line of chips: the label sits above them on phones, beside them from sm up.
const ChipRow = ({ label, radio = false, children }: { label: string; radio?: boolean; children: ReactNode }) => {
  const id = useId();
  return (
    <div role={radio ? "radiogroup" : "group"} aria-labelledby={id} className="sm:flex sm:items-start sm:gap-3">
      <span id={id} className="mb-1.5 block text-sm font-semibold text-ink-muted sm:mb-0 sm:w-12 sm:shrink-0 sm:pt-2">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// The filters, grouped by kind: a search box; on Today, a now / next 2 hours /
// today switcher; then food chips and on/off switches (and, on the calendar,
// time of day). On phones those last ones fold away behind a Filters button, so
// the events stay near the top. The page keeps them all in the URL.
const EventFilters = ({ scope }: { scope: FilterScope }) => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const foodTypes = useAppSelector(selectFoodTypes);
  const [panelOpen, setPanelOpen] = useState(false);
  const [allFood, setAllFood] = useState(false);
  const panelId = useId();
  const name = useId(); // radio group names, unique to this form

  // Keep chosen food types as chips even when the loaded events have none of them.
  const foodOptions = [...filters.foodTypes.filter((type) => !foodTypes.includes(type)), ...foodTypes];
  // The rest wait behind "+N more", except ones already chosen.
  const shownFood = allFood
    ? foodOptions
    : foodOptions.filter((type, index) => index < FOOD_CHIPS || filters.foodTypes.includes(type));
  const moreFood = foodOptions.length - shownFood.length;
  const toggleFood = (type: string) =>
    dispatch(
      setFilters({
        foodTypes: filters.foodTypes.includes(type)
          ? filters.foodTypes.filter((chosen) => chosen !== type)
          : [...filters.foodTypes, type],
      }),
    );

  // What's switched on behind the phone's Filters button.
  const panelCount =
    filters.foodTypes.length +
    Number(filters.openOnly) +
    Number(filters.showLowConfidence) +
    Number(scope === "calendar" && filters.timeOfDay !== "any");

  return (
    <form role="search" aria-label="Filter events" onSubmit={(e) => e.preventDefault()} className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className={cx("relative min-w-0 flex-1", scope === "calendar" && "sm:max-w-md")}>
          <label htmlFor={`${scope}-search`} className="sr-only">
            Search events
          </label>
          <FaSearch
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xs text-ink-muted"
          />
          <input
            id={`${scope}-search`}
            type="search"
            value={filters.query}
            onChange={(e) => dispatch(setFilters({ query: e.target.value }))}
            placeholder="Search food, places, hosts"
            className="h-11 w-full rounded-full border border-line-strong bg-white pr-4 pl-10 text-[0.9375rem] text-ink placeholder:text-ink-muted"
          />
        </div>
        <button
          type="button"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          aria-label={panelCount > 0 ? `Filters, ${panelCount} on` : "Filters"}
          onClick={() => setPanelOpen(!panelOpen)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-white px-4 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-surface sm:hidden"
        >
          <FaSlidersH aria-hidden="true" className="text-[0.8rem]" />
          Filters
          {panelCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-xs text-white">
              {panelCount}
            </span>
          )}
        </button>

        {scope === "today" && (
          <div
            role="radiogroup"
            aria-label="When"
            className="flex basis-full rounded-full border border-line bg-white p-1 sm:basis-auto"
          >
            {WINDOWS.map(({ value, label }) => (
              <label key={value} className="relative flex-1 sm:flex-none">
                <input
                  type="radio"
                  name={`${name}-when`}
                  checked={filters.window === value}
                  onChange={() => dispatch(setFilters({ window: value }))}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    "flex h-9 cursor-pointer items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-ink-muted transition-colors hover:text-ink peer-checked:bg-ink peer-checked:text-white",
                    focusRing,
                  )}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div
        id={panelId}
        className={cx("space-y-3 rounded-xl bg-surface p-3 sm:block sm:bg-transparent sm:p-0", !panelOpen && "hidden")}
      >
        {scope === "calendar" && (
          <ChipRow label="Time" radio>
            <Chip
              type="radio"
              name={`${name}-time`}
              checked={filters.timeOfDay === "any"}
              onChange={() => dispatch(setFilters({ timeOfDay: "any" }))}
            >
              Any time
            </Chip>
            {TIMES.map((time) => (
              <Chip
                key={time}
                type="radio"
                name={`${name}-time`}
                checked={filters.timeOfDay === time}
                onChange={() => dispatch(setFilters({ timeOfDay: time }))}
                hint={TIME_OF_DAY_HOURS[time]}
              >
                {TIME_OF_DAY_LABELS[time]}
              </Chip>
            ))}
          </ChipRow>
        )}

        {foodOptions.length > 0 && (
          <ChipRow label="Food">
            {shownFood.map((type) => (
              <Chip
                key={type}
                type="checkbox"
                name="food"
                checked={filters.foodTypes.includes(type)}
                onChange={() => toggleFood(type)}
              >
                {capitalize(type)}
              </Chip>
            ))}
            {(moreFood > 0 || allFood) && (
              <button
                type="button"
                aria-expanded={allFood}
                aria-label={allFood ? "Fewer foods" : `${moreFood} more foods`}
                onClick={() => setAllFood(!allFood)}
                className="h-9 shrink-0 rounded-full px-2 text-[0.9375rem] font-semibold whitespace-nowrap text-ink underline underline-offset-[3px] hover:text-primary"
              >
                {allFood ? "Fewer" : `${moreFood} more`}
              </button>
            )}
          </ChipRow>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 sm:pl-15">
          <Switch checked={filters.openOnly} onChange={() => dispatch(setFilters({ openOnly: !filters.openOnly }))}>
            Only events open to all
          </Switch>
          <Switch
            checked={filters.showLowConfidence}
            onChange={() => dispatch(setFilters({ showLowConfidence: !filters.showLowConfidence }))}
          >
            Include “Food possible”
          </Switch>
          {hasActiveFilters(filters, scope) && (
            <button
              type="button"
              onClick={() => dispatch(clearFilters())}
              className="min-h-9 font-semibold text-primary underline underline-offset-[3px] hover:text-primary-hover sm:ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default EventFilters;
