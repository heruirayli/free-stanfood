import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import EventDetails from "../components/EventDetails";
import { DetailsSkeleton } from "../components/Skeleton";
import StatusMessage from "../components/StatusMessage";
import { APP_NAME } from "../constants";
import { useEvent } from "../hooks/useEvent";
import { useNow } from "../hooks/useNow";
import { linkClass, secondaryButtonClass } from "../styles";

// An event on its own page, for links shared or opened directly. (From a list,
// the details open in a sheet over it instead; see EventSheet.)
const EventPage = () => {
  const { id = "" } = useParams();
  const { event, error, retry } = useEvent(id);
  const now = useNow();

  let content;
  if (event) content = <EventDetails event={event} now={now} headingLevel="h1" />;
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
    <div className="mx-auto max-w-2xl animate-fade-in">
      <title>{`${event?.title ?? "Event"} · ${APP_NAME}`}</title>
      <Link to="/" className={`${linkClass} inline-flex items-center gap-1.5`}>
        <FaArrowLeft aria-hidden="true" className="text-[0.75rem]" />
        Today’s free food
      </Link>
      <div className="mt-4 rounded-xl border border-line p-5 sm:p-7">{content}</div>
    </div>
  );
};

export default EventPage;
