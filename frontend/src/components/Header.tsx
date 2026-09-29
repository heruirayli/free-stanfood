import { FaCalendarAlt, FaInfoCircle, FaPizzaSlice, FaRegClock } from "react-icons/fa";
import { Link, NavLink } from "react-router-dom";
import { APP_NAME } from "../constants";

const links = [
  { to: "/", label: "Today", Icon: FaRegClock, end: true },
  { to: "/calendar", label: "Calendar", Icon: FaCalendarAlt, end: false },
  { to: "/about", label: "About", Icon: FaInfoCircle, end: false },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium sm:flex-none ${
    isActive ? "bg-emerald-700 text-white" : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-900"
  }`;

const Header = () => (
  <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
    <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
      <Link to="/" className="flex items-center gap-2 py-1 text-lg font-bold text-emerald-800">
        <FaPizzaSlice aria-hidden="true" className="text-amber-500" />
        {APP_NAME}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">unofficial</span>
      </Link>
      <nav aria-label="Main">
        <ul className="flex gap-1">
          {links.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex flex-1 sm:flex-none">
              <NavLink to={to} end={end} className={navClass}>
                <Icon aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  </header>
);

export default Header;
