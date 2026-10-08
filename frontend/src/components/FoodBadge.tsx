import { LIKELY_THRESHOLD, LISTED_THRESHOLD } from "../constants";

interface FoodBadgeProps {
  confidence: number;
}

export type FoodBand = "listed" | "likely" | "possible";

export const foodBand = (confidence: number): FoodBand => {
  if (confidence >= LISTED_THRESHOLD) return "listed";
  if (confidence >= LIKELY_THRESHOLD) return "likely";
  return "possible";
};

// Each band's label and colors. `stripe` is the solid color that also marks the
// event in the calendar (the .food-* classes in index.css), so the two match.
export const BAND_STYLES: Record<FoodBand, { label: string; description: string; pill: string; stripe: string }> = {
  listed: {
    label: "Food listed",
    description: "The listing says food is provided.",
    pill: "bg-listed-soft text-listed",
    stripe: "bg-listed",
  },
  likely: {
    label: "Food likely",
    description: "The listing mentions food, but doesn't clearly say it's provided.",
    pill: "bg-likely-soft text-likely",
    stripe: "bg-likely",
  },
  possible: {
    label: "Food possible",
    description: "Only a weak hint of food, such as coffee or a reception.",
    pill: "bg-possible-soft text-ink-muted",
    stripe: "bg-possible",
  },
};

const FoodBadge = ({ confidence }: FoodBadgeProps) => {
  const band = BAND_STYLES[foodBand(confidence)];
  return (
    <span
      title={band.description}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold ${band.pill}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${band.stripe}`} />
      {band.label}
    </span>
  );
};

export default FoodBadge;
