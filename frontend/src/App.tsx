import { lazy, Suspense, useEffect } from "react";
import { Navigate, BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Spinner from "./components/Spinner";
import type { CalendarView } from "./pages/CalendarPage";
import Today from "./pages/Today";
import { backgroundOf } from "./utils/background";
import { useToastsWanted } from "./utils/notify";

// Only Today (the page most visits open) is in the first download. The rest load
// when opened: FullCalendar is most of the code, and the others aren't needed
// to show what's on today.
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SavedPage = lazy(() => import("./pages/SavedPage"));
const EventPage = lazy(() => import("./pages/EventPage"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Toasts = lazy(() => import("./components/Toasts"));
const loadEventSheet = () => import("./components/EventSheet");
const EventSheet = lazy(loadEventSheet);

// An event's details are a tap away on Today, so fetch them once the page is up.
const usePrefetchEventSheet = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => void loadEventSheet(), 2000);
    return () => window.clearTimeout(timer);
  }, []);
};

// The same element for Week and Month, so switching between them keeps the
// calendar (and its date) instead of building a new one.
const Calendar = ({ view }: { view: CalendarView }) => (
  <Suspense fallback={<Spinner label="Loading calendar…" />}>
    <CalendarPage view={view} />
  </Suspense>
);

// The old /calendar address, kept for bookmarks.
const OldCalendar = () => {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/week", search }} replace />;
};

export const AppRoutes = () => {
  const location = useLocation();
  // An event opened from a page renders over that page, which stays as it was.
  const background = backgroundOf(location);
  const page = background ?? location;

  return (
    <ErrorBoundary resetKey={page.pathname}>
      {/* Navigation waits for a page's code with the current page still showing. */}
      <Suspense fallback={<Spinner label="Loading…" />}>
        <Routes location={page}>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<Calendar view="week" />} />
          <Route path="/month" element={<Calendar view="month" />} />
          <Route path="/calendar" element={<OldCalendar />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/events/:id" element={<EventPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {background && (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/events/:id" element={<EventSheet />} />
          </Routes>
        </Suspense>
      )}
    </ErrorBoundary>
  );
};

// "/free-stanfood" on GitHub Pages, "" when served at the root.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => {
  usePrefetchEventSheet();
  const toastsWanted = useToastsWanted();
  return (
    <Router basename={BASENAME}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-6 sm:pt-8">
          <AppRoutes />
        </main>
        <Footer />
      </div>
      {toastsWanted && (
        <Suspense fallback={null}>
          <Toasts />
        </Suspense>
      )}
    </Router>
  );
};

export default App;
