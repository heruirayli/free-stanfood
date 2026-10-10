import { lazy, Suspense, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FaPizzaSlice, FaRegCalendarPlus, FaStar } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { APP_NAME } from "../constants";
import { selectFilters } from "../features/events/eventSlice";
import { sharedFilterSearch } from "../features/events/filterUrl";
import { useSavedEvents } from "../features/saved/savedEvents";
import { backgroundOf } from "../utils/background";
import { cx } from "../utils/cx";
import ViewToggle from "./ViewToggle";

// Loaded when Subscribe is pressed.
const SubscribeDialog = lazy(() => import("./SubscribeDialog"));

// Publishes the header's height as --header-height, so the Today page's section
// headings can stick right below it (it's two rows on phones, one from sm up).
const useHeightProperty = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--header-height", `${element.offsetHeight}px`));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
};

const Header = () => {
  const header = useRef<HTMLElement>(null);
  const [subscribing, setSubscribing] = useState(false);
  const search = sharedFilterSearch(useAppSelector(selectFilters));
  const saved = useSavedEvents().length;
  const location = useLocation();
  const onSaved = (backgroundOf(location) ?? location).pathname === "/saved";
  useHeightProperty(header);

  return (
    <>
      <header ref={header} className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr] sm:py-3">
          <Link
            to={{ pathname: "/", search }}
            className="flex items-center gap-2 justify-self-start rounded-md text-lg font-bold text-ink"
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-lg bg-primary text-[0.8rem] text-white"
            >
              <FaPizzaSlice />
            </span>
            {APP_NAME}
          </Link>
          {/* Phones: its own row under the name and Subscribe. */}
          <ViewToggle className="order-last col-span-2 sm:order-none sm:col-span-1" />
          <div className="flex items-center gap-2 justify-self-end">
            <Link
              to="/saved"
              aria-label={saved > 0 ? `Saved events, ${saved}` : "Saved events"}
              aria-current={onSaved ? "page" : undefined}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.9375rem] font-semibold transition-colors",
                onSaved ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-surface",
              )}
            >
              <FaStar aria-hidden="true" className={onSaved ? undefined : "text-primary"} />
              {saved > 0 && <span aria-hidden="true">{saved}</span>}
            </Link>
            <button
              type="button"
              onClick={() => setSubscribing(true)}
              aria-haspopup="dialog"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <FaRegCalendarPlus aria-hidden="true" />
              Subscribe
            </button>
          </div>
        </div>
      </header>
      {subscribing && (
        <Suspense fallback={null}>
          <SubscribeDialog onClose={() => setSubscribing(false)} />
        </Suspense>
      )}
    </>
  );
};

export default Header;
