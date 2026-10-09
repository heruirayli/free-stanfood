import type { ReactNode } from "react";
import { toast } from "react-toastify";
import { STATIC_DATA } from "../constants";
import { saveFile, staticCalendarFile } from "../features/events/staticCalendar";

interface CalendarFileLinkProps {
  // The API URL of the .ics file.
  href: string;
  filename: string;
  className: string;
  children: ReactNode;
}

// Downloads an .ics file. With the API it's a plain download link. On a static
// host there's no API, so it's a button that builds the file in the browser.
const CalendarFileLink = ({ href, filename, className, children }: CalendarFileLinkProps) => {
  if (!STATIC_DATA) {
    return (
      <a href={href} download={filename} className={className}>
        {children}
      </a>
    );
  }
  const download = () =>
    staticCalendarFile(href)
      .then((text) => saveFile(text, filename, "text/calendar"))
      .catch(() => toast.error("Couldn’t make the calendar file. Try again."));
  return (
    <button type="button" onClick={() => void download()} className={className}>
      {children}
    </button>
  );
};

export default CalendarFileLink;
