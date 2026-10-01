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

const BAND_STYLES: Record<FoodBand, { label: string; description: string; pill: string; dot: string }> = {
  listed: {
    label: "Food listed",
    description: "The listing says food is provided.",
    pill: "bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  likely: {
    label: "Food likely",
    description: "The listing mentions food, but doesn't clearly say it's provided.",
    pill: "bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  possible: {
    label: "Food possible",
    description: "Only a weak hint of food, such as coffee or a reception.",
    pill: "bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  },
};

const FoodBadge = ({ confidence }: FoodBadgeProps) => {
  const band = BAND_STYLES[foodBand(confidence)];
  return (
    <span
      title={band.description}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${band.pill}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${band.dot}`} />
      {band.label}
    </span>
  );
};

export default FoodBadge;
