import { lazy, Suspense } from "react";
import { Navigate, BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import ErrorBoundary from "./components/ErrorBoundary";
import EventSheet from "./components/EventSheet";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Spinner from "./components/Spinner";
import About from "./pages/About";
import type { CalendarView } from "./pages/CalendarPage";
import Contact from "./pages/Contact";
import EventPage from "./pages/EventPage";
import NotFound from "./pages/NotFound";
import Today from "./pages/Today";
import { backgroundOf } from "./utils/background";

// FullCalendar is most of the bundle, so load it only when the calendar opens.
const CalendarPage = lazy(() => import("./pages/CalendarPage"));

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
      <Routes location={page}>
        <Route path="/" element={<Today />} />
        <Route path="/week" element={<Calendar view="week" />} />
        <Route path="/month" element={<Calendar view="month" />} />
        <Route path="/calendar" element={<OldCalendar />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {background && (
        <Routes>
          <Route path="/events/:id" element={<EventSheet />} />
        </Routes>
      )}
    </ErrorBoundary>
  );
};

// "/free-stanfood" on GitHub Pages, "" when served at the root.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => (
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
    <ToastContainer position="bottom-center" />
  </Router>
);

export default App;
