// Adapted from Kokonut UI's MorphicNavbar (https://kokonutui.com, MIT License,
// Copyright (c) 2025 kokonutUI). Changed to follow the router (NavLink, so
// aria-current is set) instead of local state, to use real links, and to show
// each link as its own pill rather than a joined bar.
import type { IconType } from "react-icons";
import { NavLink, useLocation } from "react-router-dom";
import { cx } from "../../utils/cx";

export interface MorphicNavItem {
  to: string;
  label: string;
  Icon: IconType;
  // Match the path exactly (for "/"), not as a prefix.
  end?: boolean;
}

const matches = (pathname: string, item: MorphicNavItem): boolean =>
  item.end ? pathname === item.to : pathname.startsWith(item.to);

const MorphicNav = ({ items, label }: { items: MorphicNavItem[]; label: string }) => {
  const { pathname } = useLocation();

  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-1.5">
        {items.map((item) => {
          const active = matches(pathname, item);
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={item.end}
                className={cx(
                  "flex min-h-11 items-center gap-1.5 rounded-full bg-stone-900 px-4 text-sm transition-colors duration-200 sm:min-h-10",
                  active ? "font-semibold text-white" : "text-stone-300 hover:text-white",
                )}
              >
                <item.Icon aria-hidden="true" className="text-[0.8rem]" />
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MorphicNav;
