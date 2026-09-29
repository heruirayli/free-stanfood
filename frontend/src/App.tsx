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
  <>
    <Router>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
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
  </>
);

export default App;
