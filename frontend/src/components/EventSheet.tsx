import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEvent } from "../hooks/useEvent";
import { useNow } from "../hooks/useNow";
import { secondaryButtonClass } from "../styles";
import EventDetails from "./EventDetails";
import Sheet from "./Sheet";
import { DetailsSkeleton } from "./Skeleton";
import StatusMessage from "./StatusMessage";

// An event's details over the page it was opened from (/events/:id with a
// background). Closing goes back to that page, where it was left.
const EventSheet = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { event, error, retry } = useEvent(id);
  const now = useNow();
  const close = useCallback(() => navigate(-1), [navigate]);

  let content;
  if (event) content = <EventDetails event={event} now={now} headingLevel="h2" />;
  else if (error)
    content = (
      <StatusMessage tone="error" title="Couldn’t load this event.">
        <p className="mb-4">{error}</p>
        <button type="button" onClick={retry} className={secondaryButtonClass}>
          Try again
        </button>
      </StatusMessage>
    );
  else content = <DetailsSkeleton />;

  return (
    <Sheet onClose={close} label={event?.title ?? "Event details"}>
      {content}
    </Sheet>
  );
};

export default EventSheet;
