import { FaCalendarAlt, FaInfoCircle, FaPizzaSlice, FaRegClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import { APP_NAME } from "../constants";
import MorphicNav, { type MorphicNavItem } from "./kokonut/MorphicNav";

const links: MorphicNavItem[] = [
  { to: "/", label: "Today", Icon: FaRegClock, end: true },
  { to: "/calendar", label: "Calendar", Icon: FaCalendarAlt },
  { to: "/about", label: "About", Icon: FaInfoCircle },
];

const Header = () => (
  <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur-md">
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-2.5 px-4 py-3 sm:flex-row sm:justify-between">
      <Link to="/" className="flex items-center gap-2.5 rounded-full text-[1.0625rem] font-semibold tracking-tight">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-amber-100 text-amber-600">
          <FaPizzaSlice />
        </span>
        {APP_NAME}
      </Link>
      <MorphicNav items={links} label="Main" />
    </div>
  </header>
);

export default Header;
