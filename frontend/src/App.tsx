import { MotionConfig } from "motion/react";
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Spinner from "./components/Spinner";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Today from "./pages/Today";

// FullCalendar is most of the bundle, so load it only when the calendar opens.
const CalendarPage = lazy(() => import("./pages/CalendarPage"));

const App = () => (
  // Honors the OS "reduce motion" setting: movement is turned off, fades remain.
  <MotionConfig reducedMotion="user">
    <Router>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-stone-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-6 sm:pt-12">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route
              path="/calendar"
              element={
                <Suspense fallback={<Spinner label="Loading calendar…" />}>
                  <CalendarPage />
                </Suspense>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
    <ToastContainer position="bottom-center" />
  </MotionConfig>
);

export default App;
