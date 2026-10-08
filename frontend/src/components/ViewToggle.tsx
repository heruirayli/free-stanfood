import { Link, useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { selectFilters } from "../features/events/eventSlice";
import { sharedFilterSearch } from "../features/events/filterUrl";
import { backgroundOf } from "../utils/background";
import { cx } from "../utils/cx";

const VIEWS = [
  { to: "/", label: "Today" },
  { to: "/week", label: "Week" },
  { to: "/month", label: "Month" },
];

// Today / Week / Month, as a segmented control of real links. They carry the
// shared filters along, so switching views keeps them.
const ViewToggle = ({ className }: { className?: string }) => {
  const location = useLocation();
  // With an event's details open, the page underneath stays the current one.
  const { pathname } = backgroundOf(location) ?? location;
  const search = sharedFilterSearch(useAppSelector(selectFilters));

  return (
    <nav aria-label="Views" className={className}>
      <ul className="flex rounded-full bg-surface p-1">
        {VIEWS.map(({ to, label }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex flex-1 sm:flex-none">
              <Link
                to={{ pathname: to, search }}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 flex-1 items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold transition-colors",
                  active ? "bg-white text-ink shadow-[0_1px_3px_rgba(46,45,41,0.2)]" : "text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default ViewToggle;
