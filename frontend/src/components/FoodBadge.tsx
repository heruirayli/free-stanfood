import { FaUtensils } from "react-icons/fa";
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

const BAND_STYLES: Record<FoodBand, { label: string; description: string; className: string }> = {
  listed: {
    label: "Food listed",
    description: "The listing says food is provided.",
    className: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  },
  likely: {
    label: "Food likely",
    description: "The listing mentions food, but doesn't clearly say it's provided.",
    className: "bg-amber-100 text-amber-900 ring-amber-300",
  },
  possible: {
    label: "Food possible",
    description: "Only a weak hint of food, such as coffee or a reception.",
    className: "bg-gray-100 text-gray-800 ring-gray-300",
  },
};

const FoodBadge = ({ confidence }: FoodBadgeProps) => {
  const band = BAND_STYLES[foodBand(confidence)];
  return (
    <span
      title={band.description}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${band.className}`}
    >
      <FaUtensils aria-hidden="true" />
      {band.label}
    </span>
  );
};

export default FoodBadge;
