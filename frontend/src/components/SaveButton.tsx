import { FaRegStar, FaStar } from "react-icons/fa";
import { toggleSaved, useIsSaved } from "../features/saved/savedEvents";
import type { FoodEvent } from "../types/event";
import { secondaryButtonClass } from "../styles";
import { cx } from "../utils/cx";

interface SaveButtonProps {
  event: FoodEvent;
  // "icon": a star in a card's corner. "button": "Save" with a star, in the details.
  variant: "icon" | "button";
  className?: string;
}

// Saves an event to the Saved list (in this browser). A toggle button: its name
// stays the same and aria-pressed says whether it's saved.
const SaveButton = ({ event, variant, className }: SaveButtonProps) => {
  const saved = useIsSaved(event.id);
  const Star = saved ? FaStar : FaRegStar;

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={`Save ${event.title}`}
        title={saved ? "Saved" : "Save"}
        onClick={() => toggleSaved(event)}
        className={cx(
          "grid size-10 place-items-center rounded-full transition-colors hover:bg-surface",
          saved ? "text-primary" : "text-ink-muted hover:text-ink",
          className,
        )}
      >
        <Star aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleSaved(event)}
      className={cx(secondaryButtonClass, className)}
    >
      <Star aria-hidden="true" className={saved ? "text-primary" : undefined} />
      {saved ? "Saved" : "Save"}
    </button>
  );
};

export default SaveButton;
