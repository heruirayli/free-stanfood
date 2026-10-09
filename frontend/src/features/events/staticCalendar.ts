import { LIKELY_THRESHOLD } from "../../constants";
import { buildCalendar } from "./ics";
import { loadStaticEvents, selectStaticEvents } from "./staticEvents";

// On a static host, the calendar file an API URL (e.g. /api/events/calendar.ics?ids=...)
// would return, built in the browser from the site's copy of the events. Same
// selection as GET /api/events/calendar.ics.
export const staticCalendarFile = async (apiUrl: string, now = new Date()): Promise<string> => {
  const params = new URL(apiUrl, "https://free-stanfood.invalid").searchParams;
  const list = (name: string): string[] | null => params.get(name)?.split(",").filter(Boolean) ?? null;
  const ids = list("ids");
  const exclude = new Set(list("exclude") ?? []);
  const minConfidence = params.get("minConfidence");
  const events = selectStaticEvents(
    await loadStaticEvents(),
    {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      minConfidence: minConfidence === null ? LIKELY_THRESHOLD : Number(minConfidence),
    },
    now,
  ).filter((event) => (!ids || ids.includes(event.id)) && !exclude.has(event.id));
  return buildCalendar(events, now);
};

// Hands `text` to the browser as a file download.
export const saveFile = (text: string, filename: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
